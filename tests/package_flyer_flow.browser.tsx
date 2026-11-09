import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { PackageFlyerCreator } from '../src/components/packages/PackageFlyerCreator';
import type { Package } from '../src/types';

declare global {
  interface Window {
    IS_REACT_ACT_ENVIRONMENT: boolean;
    flyerFlowTest: {
      generations: Array<{ destination: string }>;
      htmlModels: unknown[];
      pngModels: unknown[];
  downloads: string[];
  resolveGeneration?: (result: any) => void;
  deferGeneration: boolean;
    };
  }
}

window.IS_REACT_ACT_ENVIRONMENT = true;
window.flyerFlowTest = {
  generations: [], htmlModels: [], pngModels: [], downloads: [], deferGeneration: false,
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

async function run() {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;
  let objectUrlNumber = 0;
  URL.createObjectURL = () => `blob:flyer-test-${++objectUrlNumber}`;
  URL.revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = function () { window.flyerFlowTest.downloads.push(this.download); };

  try {
    await act(async () => { root.render(<PackageFlyerCreator package={pkg} />); });
    const generate = await click('Criar lâmina');
    assert(window.flyerFlowTest.generations.length === 0, 'A IA foi chamada sem ação explícita');
    assert(container.textContent?.includes('sugestões da IA'), 'A tela não identifica conteúdo gerado como sugestão');
    assert(container.textContent?.includes('não ficam anexados ao pacote'), 'A tela não esclarece que a lâmina não é salva no pacote');
    assert(container.textContent?.includes('cobrança por tentativa'), 'A tela não informa que a IA pode ter custo');

    const htmlBeforeReview = Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes('Baixar HTML'));
    const pngBeforeReview = Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes('Baixar PNG'));
    assert((htmlBeforeReview as HTMLButtonElement | undefined)?.disabled, 'HTML deveria aguardar revisão');
    assert((pngBeforeReview as HTMLButtonElement | undefined)?.disabled, 'PNG deveria aguardar revisão');

    await click('Gerar imagem e subtítulo com IA');
    assert(window.flyerFlowTest.generations.length === 1 && window.flyerFlowTest.generations[0].destination === 'Açores', 'A IA recebeu destino incorreto');
    assert(container.querySelector('img[alt="Imagem gerada para Açores"]'), 'A imagem sugerida não foi apresentada para revisão');
    assert((htmlBeforeReview as HTMLButtonElement).disabled, 'Downloads foram liberados sem consentimento de revisão');

    await check('Revisei a imagem gerada');
    assert((htmlBeforeReview as HTMLButtonElement).disabled, 'Um único aceite liberou downloads');
    await fillSubtitle('Descubra lagoas e paisagens vulcânicas');
    await check('Revisei o subtítulo comercial');

    const htmlButton = await click('Baixar HTML');
    assert(!(htmlButton as HTMLButtonElement).disabled, 'HTML permaneceu desabilitado após as duas revisões');
    await click('Baixar PNG');
    assert(window.flyerFlowTest.htmlModels.length === 1 && window.flyerFlowTest.pngModels.length === 1, 'Os dois exportadores não foram chamados uma vez cada');
    const htmlModel = window.flyerFlowTest.htmlModels[0] as any;
    const pngModel = window.flyerFlowTest.pngModels[0] as any;
    assert(htmlModel.subtitle === 'Descubra lagoas e paisagens vulcânicas' && pngModel.subtitle === htmlModel.subtitle, 'Subtítulo revisado não foi exportado nos dois formatos');
    assert(htmlModel.price.amount === 748 && htmlModel.price.formatted.includes('748'), 'O preço comercial foi alterado pela integração de IA');
    assert(htmlModel.origin === 'Porto' && htmlModel.destination === 'Açores' && htmlModel.period.includes('12'), 'Dados comerciais foram alterados pela IA');
    assert(htmlModel.paymentConditions === '30% de entrada e saldo antes da viagem', 'Condições comerciais cadastradas foram omitidas ou alteradas');
    assert(htmlModel.imageUrl.startsWith('data:image/png;base64,'), 'A imagem revisada não foi aplicada ao modelo exportado');
    assert(window.flyerFlowTest.downloads.join(',') === 'lamina-acores.html,lamina-acores.png', 'Nomes ou acionamento dos downloads incorretos');

    const changedPricePackage = { ...pkg, data: {
      ...pkg.data,
      financials: { ...pkg.data.financials!, salePrice: 1998, pricePerPerson: 999 },
    } };
    await act(async () => { root.render(<PackageFlyerCreator package={changedPricePackage} />); });
    assert(!container.querySelector('img[alt="Imagem gerada para Açores"]'), 'Alterar dados comerciais manteve a revisão de uma lâmina antiga');
    const changedHtml = Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes('Baixar HTML'));
    assert((changedHtml as HTMLButtonElement | undefined)?.disabled, 'Alterar preço manteve um download aprovado anteriormente');

    await act(async () => { root.render(<PackageFlyerCreator package={{ ...pkg, id: 'other', data: { ...pkg.data, destination: 'Madeira' } }} />); });
    assert(!container.textContent?.includes('Descubra lagoas'), 'Estado da sugestão vazou entre pacotes');
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
    const staleHtml = Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes('Baixar HTML'));
    assert((staleHtml as HTMLButtonElement | undefined)?.disabled, 'Resposta atrasada liberou o download de outro pacote');
    return 'Fluxo público: geração explícita, revisão separada, dados comerciais intactos e downloads HTML/PNG simulados';
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
