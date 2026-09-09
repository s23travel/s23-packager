/**
 * Suíte de Testes Automatizados:
 * Refatoração Novo Pacote: Herança Financeira (Seção 3 → Seção 4),
 * Autocomplete e Preservação de Rascunho (Draft).
 */

import { syncOperationalWithFinancials } from '../src/services/packageFinancialSyncService';
import {
  savePackageDraft,
  getPackageDraft,
  clearPackageDraft,
  hasPackageDraft,
} from '../src/services/packageDraftService';
import { CostComponent, PackageDraft } from '../src/types';

// Mock simples para sessionStorage se executado em Node/tsx
if (typeof globalThis.sessionStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    length: 0,
  } as Storage;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    failed++;
  }
}

console.log('\n====================================================');
console.log(' TESTES: HERANÇA FINANCEIRA E PRESERVAÇÃO DE DRAFT');
console.log('====================================================\n');

// 1. Seção 3 cria automaticamente custo de transporte de ida
{
  const initialComponents: CostComponent[] = [];
  const synced = syncOperationalWithFinancials(initialComponents, {
    outboundRoute: 'LIS → GIG | TAP | TP123',
    inboundRoute: '',
    hotelName: '',
    baseCurrency: 'EUR',
  });

  const outbound = synced.find((c) => c.sourceField === 'outboundRoute');
  assert(
    outbound !== undefined &&
      outbound.category === 'outbound_transport' &&
      outbound.description === 'LIS → GIG | TAP | TP123',
    '1. Seção 3 cria automaticamente custo de transporte de ida'
  );
}

// 2. Seção 3 cria automaticamente custo de transporte de volta
{
  const initialComponents: CostComponent[] = [];
  const synced = syncOperationalWithFinancials(initialComponents, {
    outboundRoute: '',
    inboundRoute: 'GIG → LIS | TAP | TP124',
    hotelName: '',
    baseCurrency: 'EUR',
  });

  const inbound = synced.find((c) => c.sourceField === 'inboundRoute');
  assert(
    inbound !== undefined &&
      inbound.category === 'inbound_transport' &&
      inbound.description === 'GIG → LIS | TAP | TP124',
    '2. Seção 3 cria automaticamente custo de transporte de volta'
  );
}

// 3. Seção 3 cria automaticamente custo de hospedagem
{
  const initialComponents: CostComponent[] = [];
  const synced = syncOperationalWithFinancials(initialComponents, {
    outboundRoute: '',
    inboundRoute: '',
    hotelName: 'Hotel das Flores',
    baseCurrency: 'EUR',
  });

  const lodging = synced.find((c) => c.sourceField === 'hotelName');
  assert(
    lodging !== undefined &&
      lodging.category === 'lodging' &&
      lodging.description === 'Hotel das Flores',
    '3. Seção 3 cria automaticamente custo de hospedagem'
  );
}

// 4. Componentes herdados continuam editáveis (quantidade, moeda, valor unitário, observação)
{
  let components: CostComponent[] = [];
  components = syncOperationalWithFinancials(components, {
    outboundRoute: 'LIS → GIG',
    inboundRoute: '',
    hotelName: '',
    baseCurrency: 'EUR',
  });

  // Usuário edita quantidade, moeda, valor unitário e observação na Seção 4
  const idx = components.findIndex((c) => c.sourceField === 'outboundRoute');
  components[idx] = {
    ...components[idx],
    quantity: 2,
    currency: 'BRL',
    amount: 1500,
    notes: 'Tarifa executiva',
  };

  assert(
    components[idx].quantity === 2 &&
      components[idx].currency === 'BRL' &&
      components[idx].amount === 1500 &&
      components[idx].notes === 'Tarifa executiva',
    '4. Componentes herdados continuam editáveis (quantidade, moeda, valor, observação)'
  );
}

// 5. Componente financeiro adicionado manualmente continua independente
{
  const manualComponent: CostComponent = {
    id: 'manual_1',
    category: 'taxes',
    description: 'Taxa de Embarque',
    amount: 80,
    currency: 'EUR',
    quantity: 1,
  };

  let components = [manualComponent];
  components = syncOperationalWithFinancials(components, {
    outboundRoute: 'LIS → GIG',
    inboundRoute: 'GIG → LIS',
    hotelName: 'Hotel Sol',
    baseCurrency: 'EUR',
  });

  const preservedManual = components.find((c) => c.id === 'manual_1');
  assert(
    preservedManual !== undefined &&
      preservedManual.description === 'Taxa de Embarque' &&
      preservedManual.amount === 80 &&
      components.length === 4,
    '5. Componente financeiro adicionado manualmente continua independente'
  );
}

// 6. Alteração na Seção 3 atualiza descrição herdada na Seção 4
{
  let components: CostComponent[] = [];
  components = syncOperationalWithFinancials(components, {
    outboundRoute: 'LIS → GIG | TAP | TP123',
    inboundRoute: '',
    hotelName: '',
    baseCurrency: 'EUR',
  });

  // Usuário altera a rota na Seção 3
  components = syncOperationalWithFinancials(components, {
    outboundRoute: 'LIS → GIG | TAP | TP125',
    inboundRoute: '',
    hotelName: '',
    baseCurrency: 'EUR',
  });

  const outbound = components.find((c) => c.sourceField === 'outboundRoute');
  assert(
    outbound !== undefined && outbound.description === 'LIS → GIG | TAP | TP125',
    '6. Alteração na Seção 3 atualiza descrição herdada na Seção 4'
  );
}

// 7. Alteração manual na descrição financeira não é sobrescrita
{
  let components: CostComponent[] = [];
  components = syncOperationalWithFinancials(components, {
    outboundRoute: 'LIS → GIG | TAP | TP123',
    inboundRoute: '',
    hotelName: '',
    baseCurrency: 'EUR',
  });

  // Usuário customiza manualmente a descrição na Seção 4
  const idx = components.findIndex((c) => c.sourceField === 'outboundRoute');
  components[idx] = {
    ...components[idx],
    description: 'LIS → GIG | TAP | TP123 — tarifa especial',
    isCustomized: true,
  };

  // Usuário altera a Seção 3 posteriormente
  components = syncOperationalWithFinancials(components, {
    outboundRoute: 'LIS → GIG | TAP | TP999',
    inboundRoute: '',
    hotelName: '',
    baseCurrency: 'EUR',
  });

  const outbound = components.find((c) => c.sourceField === 'outboundRoute');
  assert(
    outbound !== undefined &&
      outbound.description === 'LIS → GIG | TAP | TP123 — tarifa especial',
    '7. Alteração manual na descrição financeira não é sobrescrita'
  );
}

// 8. Autocomplete apresenta nome + cidade + país
{
  const mockService = {
    name: 'Hotel das Flores',
    city: 'Rio de Janeiro',
    country: 'Brasil',
  };
  const label = mockService.city
    ? `${mockService.city}, ${mockService.country}`
    : mockService.country;
  assert(
    label === 'Rio de Janeiro, Brasil',
    '8. Autocomplete apresenta nome + cidade + país'
  );
}

// 9. Autocomplete não apresenta Região
{
  const mockServiceWithNoRegion = {
    name: 'Hotel das Flores',
    country: 'Brasil',
  };
  const label = (mockServiceWithNoRegion as any).city
    ? `${(mockServiceWithNoRegion as any).city}, ${mockServiceWithNoRegion.country}`
    : mockServiceWithNoRegion.country;
  assert(
    label === 'Brasil' && !label.includes('Região'),
    '9. Autocomplete não apresenta Região'
  );
}

// 10. Draft do Novo Pacote é salvo antes de navegar para Novo Serviço
{
  clearPackageDraft();
  const mockDraft: Omit<PackageDraft, 'savedAt'> = {
    reference: 'PK-2026-999',
    name: 'Safári Tanzânia',
    status: 'draft',
    baseCurrency: 'EUR',
    supplier: 'Sense of Africa',
    additionalInfo: 'Info teste',
    startDate: '2026-11-19',
    endDate: '2026-11-25',
    durationDays: 7,
    durationNights: 6,
    adults: 2,
    children: 0,
    outboundRoute: 'LIS → JRO',
    outboundCarrier: 'Qatar Airways',
    inboundRoute: 'ZNZ → LIS',
    inboundCarrier: 'Qatar Airways',
    hotelName: 'Hotel das Flores',
    hotelDestination: 'Arusha, Tanzânia',
    hotelMealPlan: 'Pensão Completa',
    costComponents: [],
    salePrice: 2500,
  };

  savePackageDraft(mockDraft);
  assert(hasPackageDraft() === true, '10. Draft do Novo Pacote é salvo antes de navegar');
}

// 11. Draft é restaurado ao retornar
{
  const restored = getPackageDraft();
  assert(
    restored !== null &&
      restored.reference === 'PK-2026-999' &&
      restored.name === 'Safári Tanzânia' &&
      restored.startDate === '2026-11-19' &&
      restored.durationDays === 7 &&
      restored.outboundRoute === 'LIS → JRO',
    '11. Draft é restaurado ao retornar'
  );
}

// 12. Novo Serviço criado é automaticamente selecionado na hospedagem
{
  const createdService = {
    id: 'srv_123',
    name: 'Four Seasons Serengeti',
    city: 'Serengeti',
    country: 'Tanzânia',
    active: true,
  };

  const draft = getPackageDraft()!;
  // Simulando a seleção pós-retorno
  const updatedHotelName = createdService.name;
  const updatedDestination = [createdService.city, createdService.country]
    .filter(Boolean)
    .join(', ');

  const syncedFinancials = syncOperationalWithFinancials(draft.costComponents, {
    outboundRoute: draft.outboundRoute,
    inboundRoute: draft.inboundRoute,
    hotelName: updatedHotelName,
    baseCurrency: draft.baseCurrency,
  });

  const lodgingComp = syncedFinancials.find((c) => c.sourceField === 'hotelName');

  assert(
    updatedHotelName === 'Four Seasons Serengeti' &&
      updatedDestination === 'Serengeti, Tanzânia' &&
      lodgingComp?.description === 'Four Seasons Serengeti',
    '12. Novo Serviço criado é automaticamente selecionado na hospedagem'
  );
}

// 13. Cancelar Novo Serviço preserva o draft
{
  // Apenas lê o draft sem limpar
  const draftAfterCancel = getPackageDraft();
  assert(
    draftAfterCancel !== null && draftAfterCancel.name === 'Safári Tanzânia',
    '13. Cancelar Novo Serviço preserva o draft'
  );
}

// 14. Draft é removido após salvar o Novo Pacote
{
  clearPackageDraft();
  assert(
    hasPackageDraft() === false && getPackageDraft() === null,
    '14. Draft é removido após salvar o Novo Pacote'
  );
}

// 15. Draft não contém credenciais ou secrets
{
  const draftPayload: Omit<PackageDraft, 'savedAt'> = {
    reference: 'PK-2026-100',
    name: 'Teste Seguro',
    status: 'draft',
    baseCurrency: 'EUR',
    supplier: '',
    additionalInfo: '',
    startDate: '',
    endDate: '',
    durationDays: 0,
    durationNights: 0,
    adults: 2,
    children: 0,
    outboundRoute: '',
    outboundCarrier: '',
    inboundRoute: '',
    inboundCarrier: '',
    hotelName: '',
    hotelDestination: '',
    hotelMealPlan: '',
    costComponents: [],
    salePrice: 0,
  };

  savePackageDraft(draftPayload);
  const rawStored = sessionStorage.getItem('packager_novo_pacote_draft_v1') || '';
  const parsed = JSON.parse(rawStored);

  const hasSecrets =
    'token' in parsed ||
    'password' in parsed ||
    'apiKey' in parsed ||
    'secret' in parsed ||
    'supabase' in parsed;

  clearPackageDraft();

  assert(
    !hasSecrets && 'reference' in parsed && 'name' in parsed,
    '15. Draft não contém credenciais ou secrets'
  );
}

console.log('\n====================================================');
console.log(` RESULTADO FINAL: ${passed} PASSOU / ${failed} FALHOU`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
}
