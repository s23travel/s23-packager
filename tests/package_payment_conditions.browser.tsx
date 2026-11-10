import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { PackageFormPage } from '../src/pages/packages/PackageFormPage';

declare global {
  interface Window {
    packageTest: { saved: any[]; loaded: any; calls: string[] };
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
}

window.IS_REACT_ACT_ENVIRONMENT = true;
window.packageTest = { saved: [], loaded: null, calls: [] };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const container = document.getElementById('root')!;
const root = createRoot(container);

function ServiceReturn() {
  const navigate = useNavigate();
  const { state } = useLocation();
  return <button type="button" onClick={() => navigate(state.returnTo, {
    state: { createdService: { type: 'hotel', name: 'Hotel fictício', city: 'Cidade', country: 'País' } },
  })}>Voltar ao pacote</button>;
}

async function render(path: string) {
  await act(async () => {
    root.render(null);
  });
  await act(async () => {
    root.render(<MemoryRouter key={path} initialEntries={[path]}>
      <Routes>
        <Route path="/pacotes/novo" element={<PackageFormPage />} />
        <Route path="/pacotes/:id/editar" element={<PackageFormPage />} />
        <Route path="/pacotes/:id" element={<p>Pacote salvo</p>} />
        <Route path="/servicos/novo" element={<ServiceReturn />} />
      </Routes>
    </MemoryRouter>);
  });
}

async function click(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.includes(label));
  assert(button, `Botão ${label} não encontrado`);
  await act(async () => button.click());
}

async function fill(id: string, value: string) {
  const field = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  assert(field, `Campo ${id} não encontrado`);
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(field, value);
  await act(async () => field.dispatchEvent(new Event('input', { bubbles: true })));
}

async function submit() {
  const form = container.querySelector('form');
  assert(form, 'Formulário não encontrado');
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

async function run() {
  sessionStorage.clear();
  await render('/pacotes/novo');
  await fill('name', 'Pacote fictício');
  await fill('destination', 'Destino fictício');
  await fill('paymentConditions', 'Entrada de 30%\nSaldo antes da viagem');
  await submit();
  assert(window.packageTest.saved.length === 1, 'Pacote novo não foi salvo');
  assert(window.packageTest.saved[0].data.paymentConditions === 'Entrada de 30%\nSaldo antes da viagem', 'Condições não foram salvas');

  window.packageTest.saved = [];
  window.packageTest.calls = [];
  window.packageTest.loaded = {
    id: 'edit', reference: 'PK-2026-123', name: 'Pacote fictício', status: 'active', base_currency: 'EUR',
    data: {
      destination: 'Destino fictício', services: [], paymentConditions: '  Sinal e saldo  ',
      localTaxNotes: 'Taxa fictícia', customNotes: 'Nota preservada',
      extraMetadata: { key: 'valor' },
      dates: { startDate: '', endDate: '', durationDays: 0, durationNights: 0, note: 'data' },
      passengers: { adults: 2, children: 0, infants: 1, note: 'passageiros' },
      financials: { currency: 'EUR', components: [], salePrice: 400, totalCost: 0, pricePerPerson: 200, profit: 400, profitPercent: 100, taxesAndFeesTotal: 0, note: 'financeiro' },
    },
  };
  const original = JSON.stringify(window.packageTest.loaded);
  await render('/pacotes/edit/editar');
  const conditions = document.getElementById('paymentConditions') as HTMLTextAreaElement | null;
  assert(conditions?.value === '  Sinal e saldo  ', 'Edição não exibiu o texto existente integralmente');
  await fill('paymentConditions', 'Novo sinal e saldo');
  await submit();
  const edited = window.packageTest.saved[0]?.data;
  assert(edited?.paymentConditions === 'Novo sinal e saldo', 'Edição não salvou as condições alteradas');
  assert(edited.localTaxNotes === 'Taxa fictícia' && edited.customNotes === 'Nota preservada', 'Notas existentes foram descartadas');
  assert(edited.extraMetadata?.key === 'valor', 'Metadado adicional foi descartado');
  assert(edited.dates.note === 'data' && edited.passengers.note === 'passageiros' && edited.financials.note === 'financeiro', 'Metadados aninhados foram descartados');
  assert(edited.passengers.infants === 1, 'Quantidade de bebês foi descartada');
  assert(JSON.stringify(window.packageTest.loaded) === original, 'Pacote original foi mutado');
  assert(window.packageTest.calls.join(',') === 'update:edit', 'A edição tentou alterar algo além do pacote');

  sessionStorage.clear();
  window.packageTest.saved = [];
  await render('/pacotes/novo');
  await fill('name', 'Rascunho novo');
  await fill('destination', 'Destino fictício');
  await fill('paymentConditions', 'Condição no rascunho novo');
  await click('Adicionar serviço fictício');
  await click('Voltar ao pacote');
  assert((document.getElementById('paymentConditions') as HTMLTextAreaElement)?.value === 'Condição no rascunho novo', 'Retorno ao novo pacote perdeu as condições');
  assert((document.getElementById('name') as HTMLInputElement)?.value === 'Rascunho novo', 'Retorno ao novo pacote perdeu o nome');
  await submit();
  assert(window.packageTest.saved[0]?.data.paymentConditions === 'Condição no rascunho novo', 'Condição restaurada não foi salva');
  assert(window.packageTest.saved[0]?.data.services[0]?.description === 'Hotel fictício', 'Serviço criado não retornou ao novo pacote');

  sessionStorage.clear();
  window.packageTest.saved = [];
  window.packageTest.loaded.data.financials.exchangeRateUsed = 6.2;
  window.packageTest.loaded.data.services = [{ id: 'srv', type: 'transfer', description: 'Transfer', amount: 620, currency: 'BRL', quantity: 1 }];
  await render('/pacotes/edit/editar');
  await fill('name', 'Nome editado em rascunho');
  await fill('paymentConditions', 'Condição em edição');
  await click('Adicionar serviço fictício');
  await click('Voltar ao pacote');
  assert((document.getElementById('paymentConditions') as HTMLTextAreaElement)?.value === 'Condição em edição', 'Retorno à edição perdeu as condições');
  assert((document.getElementById('name') as HTMLInputElement)?.value === 'Nome editado em rascunho', 'Retorno à edição perdeu outros campos');
  await submit();
  const restoredEdit = window.packageTest.saved[0];
  assert(restoredEdit?.data.paymentConditions === 'Condição em edição', 'Condição da edição restaurada não foi salva');
  assert(restoredEdit.data.services.some((service: any) => service.description === 'Hotel fictício'), 'Serviço criado não retornou à edição');
  assert(restoredEdit.data.financials.exchangeRateUsed === 6.2, 'Câmbio da edição foi perdido');
  assert(restoredEdit.data.extraMetadata?.key === 'valor', 'Metadados da edição restaurada foram perdidos');

  sessionStorage.clear();
  window.packageTest.saved = [];
  window.packageTest.loaded = {
    id: 'legacy', reference: 'PK-2026-124', name: 'Pacote legado', status: 'draft', base_currency: 'EUR',
    data: {
      paymentConditions: '  Texto antigo\ncom condições  ', localTaxNotes: 'Taxa antiga',
      outboundTransport: { type: 'flight', route: 'Rota fictícia', carrier: 'Empresa fictícia' },
      lodging: [{ id: 'old-hotel', name: 'Hotel antigo', destination: 'Destino antigo', roomType: 'Duplo' }],
      additionalServices: [{ id: 'extra', name: 'Passeio fictício', type: 'tour', included: true }],
      otherMetadata: { note: 'preservar' },
    },
  };
  const legacySnapshot = JSON.stringify(window.packageTest.loaded);
  await render('/pacotes/legacy/editar');
  assert((document.getElementById('paymentConditions') as HTMLTextAreaElement)?.value === '  Texto antigo\ncom condições  ', 'Condições legadas não foram exibidas');
  await submit();
  const legacy = window.packageTest.saved[0]?.data;
  assert(legacy?.paymentConditions === '  Texto antigo\ncom condições  ', 'Texto legado inalterado foi modificado');
  assert(legacy.outboundTransport?.carrier === 'Empresa fictícia' && legacy.lodging?.[0]?.roomType === 'Duplo', 'Dados operacionais legados foram descartados');
  assert(legacy.additionalServices?.[0]?.name === 'Passeio fictício' && legacy.otherMetadata?.note === 'preservar', 'Outros dados legados foram descartados');
  assert(JSON.stringify(window.packageTest.loaded) === legacySnapshot, 'Carregamento de legado alterou o objeto original');

  sessionStorage.clear();
  window.packageTest.saved = [];
  window.packageTest.loaded = { id: 'empty', reference: 'PK-2026-125', name: 'Sem condições', status: 'draft', base_currency: 'EUR', data: {} };
  await render('/pacotes/empty/editar');
  assert((document.getElementById('paymentConditions') as HTMLTextAreaElement)?.value === '', 'Campo ausente não iniciou vazio');
  await fill('destination', 'Destino fictício');
  await submit();
  assert(window.packageTest.saved[0]?.data.paymentConditions === undefined, 'Campo ausente gerou condição inventada');

  sessionStorage.setItem('packager_novo_pacote_draft_v1', JSON.stringify({
    reference: 'PK-2026-126', name: 'Rascunho antigo', status: 'draft', baseCurrency: 'EUR',
    supplier: '', additionalInfo: '', startDate: '', endDate: '', durationDays: 0, durationNights: 0,
    adults: 2, children: 0, hotelName: 'Hotel antigo', hotelDestination: 'Destino antigo', salePrice: 0,
  }));
  window.packageTest.saved = [];
  await render('/pacotes/novo');
  assert((document.getElementById('paymentConditions') as HTMLTextAreaElement)?.value === '', 'Rascunho antigo sem condições não iniciou vazio');
  await fill('paymentConditions', 'Condição adicionada ao rascunho antigo');
  await submit();
  assert(window.packageTest.saved[0]?.data.paymentConditions === 'Condição adicionada ao rascunho antigo', 'Rascunho antigo não salvou condições');
  assert(window.packageTest.saved[0]?.data.services[0]?.description === 'Hotel antigo', 'Rascunho legado perdeu hospedagem');

  sessionStorage.setItem('packager_novo_pacote_draft_v1', JSON.stringify({
    packageId: 'outro', reference: 'PK-2026-999', name: 'Outro pacote', status: 'draft', baseCurrency: 'EUR',
    supplier: '', additionalInfo: '', paymentConditions: 'Não pertence a este pacote', startDate: '', endDate: '',
    durationDays: 0, durationNights: 0, adults: 2, children: 0, destination: 'Outro destino', services: [], salePrice: 0,
  }));
  window.packageTest.saved = [];
  window.packageTest.loaded = { id: 'empty', reference: 'PK-2026-125', name: 'Sem condições', status: 'draft', base_currency: 'EUR', data: { destination: 'Destino fictício', services: [], paymentConditions: 'Condição original' } };
  await render('/pacotes/empty/editar');
  assert((document.getElementById('paymentConditions') as HTMLTextAreaElement)?.value === 'Condição original', 'Rascunho de outro pacote contaminou a edição');
  await fill('paymentConditions', '');
  await submit();
  assert(window.packageTest.saved[0]?.data.paymentConditions === undefined, 'Limpar condições não removeu o texto');

  sessionStorage.setItem('packager_novo_pacote_draft_v1', JSON.stringify({ packageId: 'outro', reference: 'PK-2026-999', name: 'Outro pacote' }));
  await render('/pacotes/novo');
  assert((document.getElementById('name') as HTMLInputElement)?.value === '', 'Rascunho de edição contaminou novo pacote');
  return 'Novo, edição, rascunhos e legados: condições e metadados preservados';
}

run().then(
  (message) => fetch('/result', { method: 'POST', body: JSON.stringify({ ok: true, message }) }),
  (error) => fetch('/result', { method: 'POST', body: JSON.stringify({ ok: false, message: error.stack || String(error) }) }),
);
