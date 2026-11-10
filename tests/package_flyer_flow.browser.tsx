import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { PackageFlyerCreator } from '../src/components/packages/PackageFlyerCreator';
import type { Package } from '../src/types';

declare global {
  interface Window {
    IS_REACT_ACT_ENVIRONMENT: boolean;
    flyerFlowTest: {
      generations: Array<{ destination: string; hint?: string }>;
      previews: unknown[];
      publications: unknown[];
      savedDownloads: string[];
      currentReads: string[];
  resolveGeneration?: (result: any) => void;
  deferGeneration: boolean;
    };
  }
}

window.IS_REACT_ACT_ENVIRONMENT = true;
window.flyerFlowTest = {
  generations: [], previews: [], publications: [], savedDownloads: [], currentReads: [], deferGeneration: false,
};

const pkg: Package = {
  id: 'fixture', reference: 'TESTE', name: 'Pacote fictício', status: 'draft', base_currency: 'BRL', created_at: '', updated_at: '',
  data: {
    origin: 'Porto', destination: 'Açores', dates: { startDate: '2027-04-12', endDate: '2027-04-19' },
    passengers: { adults: 2, children: 0, infants: 0 },
    financials: { currency: 'BRL', components: [], totalCost: 748, salePrice: 1496, pricePerPerson: 748, profit: 748, profitPercent: 50, taxesAndFeesTotal: 0 },
    paymentConditions: '30% de entrada e saldo antes da viagem',
    services: [{ id: 'air', type: 'outbound_transport', description: 'Voo fictício', currency: 'BRL', amount: 0, quantity: 1 }],
  },
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const container = document.getElementById('root')!;
const root = createRoot(container);

async function click(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes(label));
  assert(button, `Botão "${label}" não encontrado`);
  await act(async () => { button.click(); });
  return button;
}

async function check(label: string) {
  const item = Array.from(container.querySelectorAll('label')).find(element => element.textContent?.includes(label));
  const input = item?.querySelector('input[type="checkbox"]');
  assert(input, `Confirmação "${label}" não encontrada`);
  await act(async () => { (input as HTMLInputElement).click(); });
}

async function fillSubtitle(value: string) {
  const input = container.querySelector('textarea[aria-label="Subtítulo comercial sugerido"]') as HTMLTextAreaElement | null;
  assert(input, 'Campo de revisão do subtítulo não encontrado');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value);
  await act(async () => { input.dispatchEvent(new Event('input', { bubbles: true })); });
}

const hintField = () => container.querySelector('textarea[aria-label="Indicação para a imagem"]') as HTMLTextAreaElement | null;

async function fillHint(value: string) {
  const input = hintField();
  assert(input, 'Campo de indicação da imagem não encontrado');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value);
  await act(async () => { input.dispatchEvent(new Event('input', { bubbles: true })); });
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
  let objectUrlNumber = 0;
  URL.createObjectURL = () => `blob:flyer-test-${++objectUrlNumber}`;
  URL.revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = () => undefined;

  try {
    await act(async () => { root.render(<PackageFlyerCreator package={pkg} />); });
    const generate = await click('Criar lâmina');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    assert(window.flyerFlowTest.generations.length === 0, 'A IA foi chamada sem ação explícita');
    assert(container.textContent?.includes('Gerar imagem e subtítulo com IA'), 'A ação de IA não está identificada');
    assert(container.textContent?.includes('Ainda não há uma lâmina salva neste pacote'), 'A tela não apresenta o estado vazio do anexo');
    assert(container.textContent?.includes('pode gerar cobrança'), 'A tela não informa que a IA pode ter custo');

    const previewBeforeReview = () => Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes('Gerar prévia final no servidor')) as HTMLButtonElement | undefined;
    assert(previewBeforeReview() === undefined, 'Prévia final não deveria existir antes de gerar a sugestão');

    await fillHint('Trem Bernina-Express entre paisagens de gelo');
    await click('Gerar imagem e subtítulo com IA');
    assert(window.flyerFlowTest.generations.length === 1 && window.flyerFlowTest.generations[0].destination === 'Açores', 'A IA recebeu destino incorreto');
    assert(window.flyerFlowTest.generations[0].hint === 'Trem Bernina-Express entre paisagens de gelo', 'A indicação da imagem não chegou à IA');
    assert(container.querySelector('img[alt="Imagem gerada para Açores"]'), 'A imagem sugerida não foi apresentada para revisão');
    assert(previewBeforeReview()?.disabled, 'Prévia final foi liberada sem revisão');

    await check('Revisei a imagem gerada');
    assert(previewBeforeReview()?.disabled, 'Um único aceite liberou a prévia final');
    await fillSubtitle('Descubra lagoas e paisagens vulcânicas');
    await check('Revisei o subtítulo comercial');

    await fillItem(1, 'Aéreo com bagagem');
    assert(container.textContent?.includes('Aéreo com bagagem'), 'A edição dos serviços não chegou à prévia');
    await fillItem(1, 'Aéreo com fornecedor secreto');
    assert(previewBeforeReview()?.disabled, 'Serviço com termo interno liberou a prévia final');
    await fillItem(1, 'Aéreo com bagagem');

    const pageText = container.textContent || '';
    assert(pageText.includes('R$ 748,00'), 'O preço comercial sumiu da prévia');
    assert(pageText.includes('12 a 19 de abril de 2027'), 'O período comercial sumiu da prévia');
    assert(pageText.includes('30% de entrada e saldo antes da viagem'), 'Condições comerciais cadastradas foram omitidas');
    assert(pageText.includes('Descubra lagoas e paisagens vulcânicas'), 'O subtítulo revisado não aparece na prévia');

    const saveButton = previewBeforeReview();
    assert(saveButton && !saveButton.disabled, 'Prévia final do servidor não ficou disponível após a revisão');
    await click('Gerar prévia final no servidor');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    assert(window.flyerFlowTest.previews.length === 1, 'A prévia final não foi gerada no servidor');
    assert((window.flyerFlowTest.previews[0] as { items?: Array<{ label: string }> }).items?.[0]?.label === 'Aéreo com bagagem', 'Os serviços editados não chegaram ao servidor');
    await fillItem(1, 'Aéreo com bagagem e assento');
    assert(previewBeforeReview() !== undefined && !previewBeforeReview()!.disabled, 'Editar os serviços não devolveu a prévia final ao utilizador');
    assert(!container.textContent?.includes('Salvar lâmina no pacote'), 'Editar os serviços manteve a prévia final anterior');
    await click('Gerar prévia final no servidor');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    assert(window.flyerFlowTest.previews.length === 2, 'A prévia final não foi regenerada após editar os serviços');
    const publishButton = Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes('Salvar lâmina no pacote')) as HTMLButtonElement | undefined;
    assert(publishButton?.disabled, 'O salvamento foi liberado antes da revisão da prévia final');
    await check('Revisei a prévia final gerada no servidor');
    assert(!publishButton.disabled, 'A confirmação da prévia final não liberou o salvamento');
    await click('Salvar lâmina no pacote');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    assert(window.flyerFlowTest.publications.length === 1, 'A confirmação não publicou o anexo staged');
    assert(container.textContent?.includes('Lâmina salva neste pacote · versão 1'), 'A interface não confirmou a versão salva');
    await click('Baixar PNG');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    assert(window.flyerFlowTest.savedDownloads.join(',') === 'fixture:png', 'O PNG salvo não pôde ser baixado novamente');

    const changedPricePackage = { ...pkg, data: {
      ...pkg.data,
      financials: { ...pkg.data.financials!, salePrice: 1998, pricePerPerson: 999 },
    } };
    await act(async () => { root.render(<PackageFlyerCreator package={changedPricePackage} />); });
    assert(!container.querySelector('img[alt="Imagem gerada para Açores"]'), 'Alterar dados comerciais manteve a revisão de uma lâmina antiga');
    assert(!container.textContent?.includes('Gerar prévia final'), 'Alterar preço manteve uma prévia aprovada anteriormente');
    assert(hintField()?.value === 'Trem Bernina-Express entre paisagens de gelo', 'Alterar dados comerciais apagou a indicação da imagem');

    await act(async () => { root.render(<PackageFlyerCreator package={{ ...pkg, id: 'other', data: { ...pkg.data, destination: 'Madeira' } }} />); });
    assert(!container.textContent?.includes('Descubra lagoas'), 'Estado da sugestão vazou entre pacotes');
    assert(hintField()?.value === '', 'A indicação de um pacote vazou para outro pacote');
    assert(generate.isConnected, 'A tela não manteve o botão de criação no pacote atual');

    window.flyerFlowTest.deferGeneration = true;
    await click('Gerar imagem e subtítulo com IA');
    assert(window.flyerFlowTest.resolveGeneration, 'A geração simulada não ficou pendente');
    await act(async () => {
      root.render(<PackageFlyerCreator package={{ ...pkg, id: 'third', data: { ...pkg.data, destination: 'Lisboa' } }} />);
    });
    window.flyerFlowTest.deferGeneration = false;
    await act(async () => {
      window.flyerFlowTest.resolveGeneration!({ success: true, data: {
        image: { mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aR8AAAAASUVORK5CYII=' },
        subtitle: 'Explore novas paisagens',
      } });
      await Promise.resolve();
    });
    assert(!container.querySelector('img[alt="Imagem gerada para Lisboa"]'), 'Resposta atrasada de outro pacote contaminou a nova prévia');
    assert(!container.textContent?.includes('Gerar prévia final'), 'Resposta atrasada liberou a prévia final de outro pacote');
    return 'Fluxo público: geração e revisão, prévia final do servidor, publicação do anexo e download do salvo';
  } finally {
    await act(async () => { root.unmount(); });
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    HTMLAnchorElement.prototype.click = originalClick;
  }
}

run().then(
  message => fetch('/result', { method: 'POST', body: JSON.stringify({ ok: true, message }) }),
  error => fetch('/result', { method: 'POST', body: JSON.stringify({ ok: false, message: error.stack || String(error) }) }),
);
