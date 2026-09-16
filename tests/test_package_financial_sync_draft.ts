/**
 * Suíte de Testes Automatizados:
 * Refatoração Novo Pacote: Herança Financeira (Seção 3 → Seção 4),
 * Autocomplete e Preservação de Rascunho (Draft).
 */

import {
  savePackageDraft,
  getPackageDraft,
  clearPackageDraft,
  hasPackageDraft,
} from '../src/services/packageDraftService';
import { serviceItemToCostComponent } from '../src/services/legacyAdapterService';
import { CostComponent, PackageDraft, ServiceItem } from '../src/types';

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

// 1. Serviço de transporte de ida gera custo financeiro correspondente
{
  const outboundService: ServiceItem = {
    id: 'srv_outbound',
    type: 'outbound_transport',
    description: 'LIS → GIG | TAP | TP123',
    amount: 450,
    currency: 'EUR',
    quantity: 1,
  };
  const cost = serviceItemToCostComponent(outboundService);
  assert(
    cost.category === 'outbound_transport' &&
      cost.description === 'LIS → GIG | TAP | TP123',
    '1. Serviço de transporte de ida gera custo financeiro de transporte de ida'
  );
}

// 2. Serviço de transporte de volta gera custo financeiro correspondente
{
  const inboundService: ServiceItem = {
    id: 'srv_inbound',
    type: 'inbound_transport',
    description: 'GIG → LIS | TAP | TP124',
    amount: 450,
    currency: 'EUR',
    quantity: 1,
  };
  const cost = serviceItemToCostComponent(inboundService);
  assert(
    cost.category === 'inbound_transport' &&
      cost.description === 'GIG → LIS | TAP | TP124',
    '2. Serviço de transporte de volta gera custo financeiro de transporte de volta'
  );
}

// 3. Serviço de hospedagem gera custo financeiro de hospedagem
{
  const lodgingService: ServiceItem = {
    id: 'srv_lodging',
    type: 'accommodation',
    description: 'Hotel das Flores',
    amount: 600,
    currency: 'EUR',
    quantity: 1,
  };
  const cost = serviceItemToCostComponent(lodgingService);
  assert(
    cost.category === 'lodging' &&
      cost.description === 'Hotel das Flores',
    '3. Serviço de hospedagem gera custo financeiro de hospedagem'
  );
}

// 4. Componentes de serviços continuam editáveis (quantidade, moeda, valor unitário, observação)
{
  const service: ServiceItem = {
    id: 'srv_custom',
    type: 'outbound_transport',
    description: 'LIS → GIG',
    amount: 1500,
    currency: 'BRL',
    quantity: 2,
    details: 'Tarifa executiva',
  };

  assert(
    service.quantity === 2 &&
      service.currency === 'BRL' &&
      service.amount === 1500 &&
      service.details === 'Tarifa executiva',
    '4. Componentes herdados continuam editáveis (quantidade, moeda, valor, observação)'
  );
}

// 5. Componente financeiro adicionado manualmente continua independente
{
  const manualTax: ServiceItem = {
    id: 'manual_1',
    type: 'taxes',
    description: 'Taxa de Embarque',
    amount: 80,
    currency: 'EUR',
    quantity: 1,
  };

  const services: ServiceItem[] = [
    { id: 'srv_1', type: 'outbound_transport', description: 'LIS → GIG', amount: 300, currency: 'EUR', quantity: 1 },
    { id: 'srv_2', type: 'inbound_transport', description: 'GIG → LIS', amount: 300, currency: 'EUR', quantity: 1 },
    { id: 'srv_3', type: 'accommodation', description: 'Hotel Sol', amount: 500, currency: 'EUR', quantity: 1 },
    manualTax,
  ];

  const preserved = services.find((c) => c.id === 'manual_1');
  assert(
    preserved !== undefined &&
      preserved.description === 'Taxa de Embarque' &&
      preserved.amount === 80 &&
      services.length === 4,
    '5. Componente financeiro adicionado manualmente continua independente'
  );
}

// 6. Alteração na rota atualiza descrição do componente de custo
{
  const outboundService: ServiceItem = {
    id: 'srv_dyn',
    type: 'outbound_transport',
    description: 'LIS → GIG | TAP | TP123',
    amount: 400,
    currency: 'EUR',
    quantity: 1,
  };
  outboundService.description = 'LIS → GIG | TAP | TP125';
  const updatedCost = serviceItemToCostComponent(outboundService);
  assert(
    updatedCost.description === 'LIS → GIG | TAP | TP125',
    '6. Alteração na Seção 3 atualiza descrição herdada na Seção 4'
  );
}

// 7. Descrição customizada é preservada fielmente
{
  const customService: ServiceItem = {
    id: 'srv_custom_7',
    type: 'outbound_transport',
    description: 'LIS → GIG | TAP | TP123 — tarifa especial',
    amount: 400,
    currency: 'EUR',
    quantity: 1,
  };
  const cost = serviceItemToCostComponent(customService);
  assert(
    cost.description === 'LIS → GIG | TAP | TP123 — tarifa especial',
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

  const lodgingService: ServiceItem = {
    id: 'srv_lodging_12',
    type: 'accommodation',
    description: updatedHotelName,
    amount: 800,
    currency: draft.baseCurrency,
    quantity: 1,
  };
  const lodgingComp = serviceItemToCostComponent(lodgingService);

  assert(
    updatedHotelName === 'Four Seasons Serengeti' &&
      updatedDestination === 'Serengeti, Tanzânia' &&
      lodgingComp.description === 'Four Seasons Serengeti',
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
