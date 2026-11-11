import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { QuotationFlyerCreator } from '../src/components/quotes/QuotationFlyerCreator';
import type { Quotation } from '../src/types';

declare global {
  interface Window {
    IS_REACT_ACT_ENVIRONMENT: boolean;
    flyerFlowTest: {
      generations: Array<{ destination: string; hint?: string }>;
      previews: Array<Record<string, any>>;
      publications: Array<Record<string, any>>;
      savedDownloads: string[];
      currentReads: string[];
      currents: Record<string, { revision: number; savedAt: string } | null>;
      confirmations: string[];
    };
  }
}

window.IS_REACT_ACT_ENVIRONMENT = true;
window.flyerFlowTest = {
  generations: [], previews: [], publications: [], savedDownloads: [], currentReads: [], currents: {}, confirmations: [],
};

// Fixture inspirada na COT-2026-059, a mesma da prévia aprovada.
const quote: Quotation = {
  id: 'cot-fixture',
  package_id: null,
  reference: 'COT-2026-059',
  client_name: 'Sandra Colognesi',
  status: 'draft',
  currency: 'EUR',
  exchange_rate: null,
  exchange_rate_date: null,
  created_at: '2026-11-11T09:30:00Z',
  updated_at: '2026-11-11T09:30:00Z',
  archived_at: null,
  data: {
    origin: 'Porto',
    destination: 'Paris',
    proposalDate: '2026-11-11',
    dates: { startDate: '2027-04-02', endDate: '2027-04-05', durationDays: 4, durationNights: 3 },
    passengers: { adults: 2, children: 0, infants: 0 },
    depositAmount: 250,
    balanceDueDate: '2027-03-20',
    notIncluded: ['Taxa local de 34€ paga no hotel', 'Bagagem despachada'],
    paymentConditions: 'fornecedor secreto cobra 10x',
    localTaxNotes: 'Taxa local interna 34€',
    extraServicesNotes: 'Nota interna de extras',
    customNotes: 'Observação interna do consultor',
    financials: {
      currency: 'EUR',
      components: [],
      totalCost: 400,
      salePrice: 700,
      pricePerPerson: 350,
      profit: 300,
      profitPercent: 42.86,
      taxesAndFeesTotal: 0,
    },
    services: [
      {
        id: 'out', type: 'outbound_transport', description: 'Voo de ida Porto (OPO) para Paris (ORY)',
        currency: 'EUR', amount: 0, quantity: 1, carrier: 'easyJet', notes: 'Bagagem de mão incluída',
        departureTime: '08:10', arrivalTime: '11:05',
      },
      {
        id: 'in', type: 'inbound_transport', description: 'Voo de volta Paris (ORY) para Porto (OPO)',
        currency: 'EUR', amount: 0, quantity: 1, carrier: 'easyJet', notes: 'Bagagem de mão incluída',
        departureTime: '18:40', arrivalTime: '19:45',
      },
      {
        id: 'hotel', type: 'accommodation', description: 'Ibis Paris Alésia Montparnasse 14ème',
        currency: 'EUR', amount: 0, quantity: 1, mealPlan: 'Café da manhã (BB)',
      },
    ],
  },
};

// Cotação sem cliente, preço, origem ou datas: a prévia fica bloqueada, mas a
// lâmina salva tem de continuar visível e baixável.
const incompleteQuote: Quotation = {
  ...quote,
  id: 'cot-incompleta',
  reference: 'COT-2026-060',
  client_name: null,
  data: {
    ...quote.data,
    origin: '',
    destination: 'Lisboa',
    dates: { startDate: '', endDate: '' },
    financials: undefined,
    services: [],
  },
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const container = document.getElementById('root')!;
const root = createRoot(container);

const tick = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

async function click(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes(label)) as HTMLButtonElement | undefined;
  assert(button, `Botão "${label}" não encontrado`);
  await act(async () => { button.click(); });
  return button;
}

function button(label: string) {
  return Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes(label)) as HTMLButtonElement | undefined;
}

async function fillTextarea(ariaLabel: string, value: string) {
  const field = container.querySelector(`textarea[aria-label="${ariaLabel}"]`) as HTMLTextAreaElement | null;
  assert(field, `Campo "${ariaLabel}" não encontrado`);
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value);
  await act(async () => { field.dispatchEvent(new Event('input', { bubbles: true })); });
}

async function fillItem(index: number, value: string) {
  const input = container.querySelector(`input[aria-label="Serviço ${index}"]`) as HTMLInputElement | null;
  assert(input, `Campo do serviço ${index} não encontrado`);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  await act(async () => { input.dispatchEvent(new Event('input', { bubbles: true })); });
}

async function run() {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;
  const originalConfirm = window.confirm;
  const originalAlert = window.alert;
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  let objectUrlNumber = 0;
  let downloadedBlobType = '';
  let downloadedFileName = '';
  globalThis.createImageBitmap = async () => ({ width: 1080, height: 1920, close: () => undefined } as ImageBitmap);
  HTMLCanvasElement.prototype.getContext = (() => ({ drawImage: () => undefined })) as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = function(callback, type) {
    callback(new Blob(['jpeg fixture'], { type }));
  };
  URL.createObjectURL = blob => {
    downloadedBlobType = blob instanceof Blob ? blob.type : '';
    return `blob:quotation-flyer-test-${++objectUrlNumber}`;
  };
  URL.revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = function() { downloadedFileName = this.download; };
  window.confirm = message => { window.flyerFlowTest.confirmations.push(String(message)); return true; };
  window.alert = message => { window.flyerFlowTest.confirmations.push(`alert:${message}`); };

  try {
    await act(async () => { root.render(<QuotationFlyerCreator quotation={quote} />); });
    await click('Criar lâmina');
    await tick();

    // 1. Abrir a lâmina na cotação e consultar a versão salva.
    assert(window.flyerFlowTest.currentReads.includes('cot-fixture'), 'A lâmina salva da cotação não foi consultada');
    assert(container.textContent?.includes('Ainda não há uma lâmina salva nesta cotação.'), 'Estado vazio da lâmina salva ausente');
    assert(container.textContent?.includes('Gerar imagem e subtítulo'), 'A ação de IA não está identificada');
    assert(container.textContent?.includes('pode gerar cobrança'), 'A tela não informa que a IA pode ter custo');
    assert(button('Gerar lâmina') === undefined, 'A prévia final apareceu antes da sugestão de IA');

    // 2. Resumo textual público: cliente, data, transporte, hotel, total e pagamento.
    const summary = container.querySelector('[aria-label="Dados da lâmina em texto"]')?.textContent || '';
    assert(summary.includes('Sandra Colognesi'), 'O cliente sumiu do resumo');
    assert(summary.includes('11/11/2026'), 'A data da cotação sumiu do resumo');
    assert(summary.includes('easyJet') && summary.includes('OPO — ORY'), 'O transporte sumiu do resumo');
    assert(summary.includes('Ibis Paris Alésia Montparnasse 14ème') && summary.includes('3 noites'), 'A hospedagem sumiu do resumo');
    assert(summary.includes('Não incluído') && summary.includes('Taxa local de 34€ paga no hotel'), 'Os não incluídos sumiram do resumo');
    assert(summary.includes('€ 700,00'), 'O total sumiu do resumo');
    assert(summary.includes('€ 250,00') && summary.includes('20/03'), 'O sinal/restante sumiu do resumo');
    assert(!/fornecedor secreto|Taxa local interna|Nota interna|Observação interna|10x/.test(summary), 'Dados internos entraram no resumo');

    // 3. IA recebe só destino e indicação, nunca o cliente.
    await fillTextarea('Indicação para a imagem', 'Cafés e boulevards na primavera');
    await click('Gerar imagem e subtítulo');
    await tick();
    assert(window.flyerFlowTest.generations.length === 1, 'A IA não foi chamada uma vez');
    assert(window.flyerFlowTest.generations[0].destination === 'Paris', 'A IA recebeu destino incorreto');
    assert(window.flyerFlowTest.generations[0].hint === 'Cafés e boulevards na primavera', 'A indicação não chegou à IA');
    assert(!JSON.stringify(window.flyerFlowTest.generations[0]).includes('Sandra'), 'O nome do cliente foi enviado à IA');
    assert(container.querySelector('img[alt="Imagem gerada para Paris"]'), 'A imagem sugerida não foi apresentada');

    // 4. Revisão do subtítulo e dos serviços sem caixas de confirmação.
    await fillTextarea('Subtítulo comercial sugerido', 'Paris na primavera, entre cafés e boulevards');
    assert(!button('Gerar lâmina')?.disabled, 'A prévia final não ficou disponível após a revisão');
    await fillItem(1, 'Aéreo com bagagem');
    assert(container.textContent?.includes('Aéreo com bagagem'), 'A edição dos serviços não chegou à prévia');

    const previewButton = button('Gerar lâmina');
    assert(previewButton && !previewButton.disabled, 'A prévia final deveria estar liberada sem aceites');
    await click('Gerar lâmina');
    await tick();
    assert(window.flyerFlowTest.previews.length === 1, 'A prévia final não foi gerada no servidor');
    assert(window.flyerFlowTest.previews[0].quotationId === 'cot-fixture', 'A prévia não usou a cotação atual');
    assert(window.flyerFlowTest.previews[0].subtitle === 'Paris na primavera, entre cafés e boulevards', 'O subtítulo revisto não chegou ao servidor');
    assert(window.flyerFlowTest.previews[0].items?.[0]?.label === 'Aéreo com bagagem', 'Os serviços revistos não chegaram ao servidor');

    // 5. Editar os serviços invalida a prévia final anterior.
    await fillItem(1, 'Aéreo com bagagem e assento');
    assert(!button('Salvar lâmina na cotação'), 'Editar os serviços manteve a prévia final anterior');
    assert(!button('Gerar lâmina')?.disabled, 'A prévia final não voltou após editar os serviços');
    await click('Gerar lâmina');
    await tick();
    assert(window.flyerFlowTest.previews.length === 2, 'A prévia final não foi regenerada');

    // 6. Salvar substituindo a anterior.
    await click('Salvar lâmina na cotação');
    await tick();
    assert(window.flyerFlowTest.publications.length === 1, 'O salvamento não publicou o anexo staged');
    assert(window.flyerFlowTest.publications[0].quotationId === 'cot-fixture', 'O salvamento não usou a cotação atual');
    assert(container.textContent?.includes('Lâmina salva nesta cotação.'), 'A interface não confirmou a lâmina salva');

    // 7. Download HTML e IMAGEM (PNG do servidor, sem recompressão).
    downloadedBlobType = '';
    downloadedFileName = '';
    await click('HTML');
    await tick();
    assert(window.flyerFlowTest.savedDownloads.join(',') === 'cot-fixture:html', 'O HTML salvo não foi pedido');
    assert(downloadedBlobType.startsWith('text/html'), 'O download não entregou HTML');
    assert(downloadedFileName === 'lamina-cotacao-cot-2026-059-paris.html', `Nome do HTML inesperado: ${downloadedFileName}`);

    downloadedBlobType = '';
    downloadedFileName = '';
    await click('IMAGEM');
    await tick();
    assert(window.flyerFlowTest.savedDownloads.join(',') === 'cot-fixture:html,cot-fixture:png', 'O PNG salvo não foi pedido');
    assert(downloadedBlobType === 'image/png', 'O botão IMAGEM não entregou PNG');
    assert(downloadedFileName === 'lamina-cotacao-cot-2026-059-paris.png', `Nome do PNG inesperado: ${downloadedFileName}`);

    // 8. Cotação arquivada mantém a lâmina salva acessível, sem desarquivar.
    const archivedQuote: Quotation = { ...quote, archived_at: '2026-11-11T12:00:00Z' };
    await act(async () => { root.render(<QuotationFlyerCreator quotation={archivedQuote} />); });
    await tick();
    assert(container.textContent?.includes('Lâmina salva nesta cotação.'), 'Arquivar removeu o estado da lâmina salva');
    assert(button('HTML') && button('IMAGEM'), 'Arquivar removeu os downloads da lâmina salva');
    downloadedBlobType = '';
    await click('HTML');
    await tick();
    assert(downloadedBlobType.startsWith('text/html'), 'A cotação arquivada não permitiu baixar a versão salva');

    // 9. Dados obrigatórios em falta bloqueiam a prévia, mas não a versão salva.
    window.flyerFlowTest.currents['cot-incompleta'] = { revision: 2, savedAt: '2026-11-11T13:00:00.000Z' };
    await act(async () => { root.render(<QuotationFlyerCreator quotation={incompleteQuote} />); });
    await tick();
    const alerts = Array.from(container.querySelectorAll('[role="alert"]')).map(item => item.textContent || '').join(' ');
    assert(alerts.includes('Informe o nome do cliente na cotação.'), 'Falta o erro de cliente obrigatório');
    assert(alerts.includes('Informe um preço total válido na moeda da cotação.'), 'Falta o erro de preço obrigatório');
    assert(alerts.includes('Informe datas de ida e retorno válidas na cotação.'), 'Falta o erro de datas obrigatórias');
    assert(button('Gerar imagem e subtítulo') === undefined, 'A IA ficou disponível sem os dados obrigatórios');
    assert(button('Gerar lâmina') === undefined, 'A prévia final ficou disponível sem os dados obrigatórios');
    assert(container.textContent?.includes('Lâmina salva nesta cotação.'), 'O erro de dados escondeu a lâmina salva');
    downloadedBlobType = '';
    downloadedFileName = '';
    await click('IMAGEM');
    await tick();
    assert(window.flyerFlowTest.savedDownloads.at(-1) === 'cot-incompleta:png', 'A lâmina salva não ficou baixável com dados em falta');
    assert(downloadedBlobType === 'image/png', 'A lâmina salva com dados em falta não entregou PNG');
    assert(
      downloadedFileName === 'lamina-cotacao-cot-2026-060-lisboa.png',
      `O nome do ficheiro deve vir da cotação, mesmo sem modelo local: ${downloadedFileName}`
    );

    // 10. Sem caixas de confirmação em nenhum passo.
    assert(window.flyerFlowTest.confirmations.length === 0, `Houve confirmação: ${window.flyerFlowTest.confirmations.join(' | ')}`);
    assert(!container.textContent?.includes('Revisei'), 'A tela voltou a exigir aceites');

    return 'Fluxo da cotação: lâmina salva independente do modelo, IA, revisão, prévia, publicação e downloads HTML/PNG';
  } finally {
    await act(async () => { root.unmount(); });
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    HTMLAnchorElement.prototype.click = originalClick;
    window.confirm = originalConfirm;
    window.alert = originalAlert;
    globalThis.createImageBitmap = originalCreateImageBitmap;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
  }
}

run().then(
  message => fetch('/result', { method: 'POST', body: JSON.stringify({ ok: true, message }) }),
  error => fetch('/result', { method: 'POST', body: JSON.stringify({ ok: false, message: error.stack || String(error) }) }),
);
