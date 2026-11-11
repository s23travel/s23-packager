// Teste offline do serviço de anexos da cotação. O cliente Supabase é
// substituído por um backend falso em memória: nenhuma chamada de rede.
import {
  createQuotationFlyerServerPreview,
  downloadSavedQuotationFlyer,
  getCurrentQuotationFlyer,
  publishQuotationFlyer,
} from '../src/services/quotationFlyerAttachmentService';
import type { FlyerItem } from '../supabase/functions/_shared/flyerItemsContract';

interface FakeInvokeResult { data: any; error: { message?: string } | null }
interface FakeCall { name: string; body: Record<string, any> }

declare global {
  interface Window {
    quotationFlyerAttachmentTest: {
      calls: FakeCall[];
      invoke: (name: string, options: { body: Record<string, any> }) => FakeInvokeResult | Promise<FakeInvokeResult>;
    };
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const calls: FakeCall[] = [];
let handler: (name: string, body: Record<string, any>) => FakeInvokeResult | Promise<FakeInvokeResult> =
  () => ({ data: null, error: { message: 'backend falso sem resposta' } });
window.quotationFlyerAttachmentTest = {
  calls,
  invoke: (name, options) => {
    calls.push({ name, body: options.body });
    return handler(name, options.body);
  },
};

async function rejects(run: () => Promise<unknown>, expected: RegExp, label: string) {
  try {
    await run();
  } catch (error) {
    assert(error instanceof Error, `${label}: erro não é Error`);
    assert(expected.test(error.message), `${label}: mensagem inesperada (${error.message})`);
    return;
  }
  throw new Error(`${label}: a chamada não falhou`);
}

const image = { mimeType: 'image/png' as const, data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aR8AAAAASUVORK5CYII=' };
const items: FlyerItem[] = [{ kind: 'air', label: 'Aéreo com bagagem' }];

async function run() {
  // 1. current devolve os metadados da última versão salva.
  handler = () => ({ data: { attachment: { revision: 3, savedAt: '2026-11-11T10:00:00.000Z' } }, error: null });
  const current = await getCurrentQuotationFlyer('cot-quote-1');
  assert(current?.revision === 3, 'current devolve a revisão salva');
  assert(current?.savedAt === '2026-11-11T10:00:00.000Z', 'current devolve a data de salvamento');
  assert(calls[0].name === 'quotation-flyer', 'a função invocada é quotation-flyer');
  assert(
    JSON.stringify(calls[0].body) === JSON.stringify({ action: 'current', quotationId: 'cot-quote-1' }),
    'current envia apenas action e quotationId'
  );

  // 2. current sem lâmina salva devolve null.
  handler = () => ({ data: { attachment: null }, error: null });
  assert((await getCurrentQuotationFlyer('cot-quote-2')) === null, 'current sem anexo devolve null');

  // 3. Erros: a mensagem do servidor prevalece e há fallback em pt-BR.
  handler = () => ({ data: { message: 'A cotação não foi encontrada.' }, error: { message: 'http 404' } });
  await rejects(() => getCurrentQuotationFlyer('cot-quote-3'), /A cotação não foi encontrada/, 'current com mensagem do servidor');
  handler = () => ({ data: null, error: null });
  await rejects(() => getCurrentQuotationFlyer('cot-quote-4'), /Não foi possível consultar a lâmina salva/, 'current sem mensagem');

  // 4. preview envia o pedido de revisão e devolve o PNG como Blob.
  calls.length = 0;
  handler = (_name, body) => ({
    data: { preview: btoa('png fixture'), requestId: body.requestId, expectedRevision: body.expectedRevision },
    error: null,
  });
  const preview = await createQuotationFlyerServerPreview({
    quotationId: 'cot-quote-1',
    expectedRevision: 3,
    requestId: 'req-1',
    image,
    subtitle: 'Paris na primavera',
    items,
  });
  assert(preview.preview.type === 'image/png', 'a prévia é devolvida como PNG');
  assert((await preview.preview.text()) === 'png fixture', 'o PNG é decodificado do Base64');
  assert(preview.requestId === 'req-1' && preview.expectedRevision === 3, 'a resposta mantém pedido e revisão');
  assert(
    JSON.stringify(calls[0].body) === JSON.stringify({
      action: 'preview',
      quotationId: 'cot-quote-1',
      expectedRevision: 3,
      requestId: 'req-1',
      image,
      subtitle: 'Paris na primavera',
      items,
    }),
    'preview envia só o contrato revisto'
  );

  handler = () => ({ data: { preview: btoa('png'), requestId: 'outro', expectedRevision: 3 }, error: null });
  await rejects(
    () => createQuotationFlyerServerPreview({ quotationId: 'cot-quote-1', expectedRevision: 3, requestId: 'req-2', image, subtitle: 'Paris', items }),
    /Não foi possível gerar a prévia final no servidor/,
    'preview com pedido trocado'
  );
  handler = () => ({ data: { preview: '***', requestId: 'req-3', expectedRevision: 3 }, error: null });
  await rejects(
    () => createQuotationFlyerServerPreview({ quotationId: 'cot-quote-1', expectedRevision: 3, requestId: 'req-3', image, subtitle: 'Paris', items }),
    /A prévia final do servidor está inválida/,
    'preview com Base64 inválido'
  );

  // 5. publish confirma a revisão publicada.
  calls.length = 0;
  handler = () => ({ data: { saved: true, revision: 4, savedAt: '2026-11-11T11:00:00.000Z' }, error: null });
  const published = await publishQuotationFlyer({ quotationId: 'cot-quote-1', expectedRevision: 3, requestId: 'req-1' });
  assert(published.revision === 4 && published.savedAt === '2026-11-11T11:00:00.000Z', 'publish devolve a nova revisão');
  assert(
    JSON.stringify(calls[0].body) === JSON.stringify({
      action: 'publish', quotationId: 'cot-quote-1', expectedRevision: 3, requestId: 'req-1',
    }),
    'publish envia action, cotação, revisão esperada e pedido'
  );
  handler = () => ({ data: { saved: true, revision: 4 }, error: null });
  const withoutDate = await publishQuotationFlyer({ quotationId: 'cot-quote-1', expectedRevision: 3, requestId: 'req-1' });
  assert(Boolean(withoutDate.savedAt), 'publish sem data usa a hora local como metadado');
  handler = () => ({ data: { saved: false, revision: 4 }, error: null });
  await rejects(
    () => publishQuotationFlyer({ quotationId: 'cot-quote-1', expectedRevision: 3, requestId: 'req-1' }),
    /Não foi possível salvar a lâmina\. A versão anterior continua disponível/,
    'publish sem confirmação'
  );

  // 6. download devolve HTML ou PNG conforme o formato pedido.
  calls.length = 0;
  handler = (_name, body) => ({ data: { data: btoa(`saved ${body.format}`) }, error: null });
  const html = await downloadSavedQuotationFlyer('cot-quote-1', 'html');
  assert(html.type.startsWith('text/html'), 'HTML é devolvido como text/html');
  assert((await html.text()) === 'saved html', 'o HTML salvo é decodificado');
  const png = await downloadSavedQuotationFlyer('cot-quote-1', 'png');
  assert(png.type === 'image/png', 'a imagem salva é devolvida como PNG');
  assert(
    JSON.stringify(calls.map(call => call.body)) === JSON.stringify([
      { action: 'download', quotationId: 'cot-quote-1', format: 'html' },
      { action: 'download', quotationId: 'cot-quote-1', format: 'png' },
    ]),
    'download envia apenas ação, cotação e formato'
  );
  handler = () => ({ data: { data: null }, error: null });
  await rejects(() => downloadSavedQuotationFlyer('cot-quote-1', 'html'), /Não foi possível baixar a lâmina salva/, 'download sem dados');
  handler = () => ({ data: { data: '***' }, error: null });
  await rejects(
    () => downloadSavedQuotationFlyer('cot-quote-1', 'png'),
    /O arquivo salvo não passou pela verificação de integridade/,
    'download com Base64 inválido'
  );

  return 'Serviço de anexos da cotação: ações, mensagens e formatos validados';
}

run().then(
  message => fetch('/result', { method: 'POST', body: JSON.stringify({ ok: true, message }) }),
  error => fetch('/result', { method: 'POST', body: JSON.stringify({ ok: false, message: error.stack || String(error) }) }),
);
