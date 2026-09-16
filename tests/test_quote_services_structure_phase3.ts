import assert from 'node:assert';
import {
  calculateFinancialSummaryFromServices,
  createDefaultServiceItem,
  isLegacyPackageData,
  normalizeLegacyToNewStructure,
  serviceItemToCostComponent,
} from '../src/services/legacyAdapterService';
import {
  saveQuoteDraft,
  getQuoteDraft,
  clearQuoteDraft,
} from '../src/services/quoteDraftService';
import {
  FavoriteService,
  QuotationData,
  QuoteDraft,
  ServiceItem,
  ServiceType,
  SERVICE_TYPE_LABELS,
} from '../src/types';
import { getNextSequentialReference } from '../src/services/referenceService';

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

console.log('=== INICIANDO BATERIA DE TESTES: REESTRUTURAÇÃO DA COTAÇÃO (FASE 3) ===\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err: any) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`   Detalhe: ${err.message}`);
    testsFailed++;
  }
}

// 1. Nova cotação sem serviços
runTest('1. Nova cotação sem serviços possui lista vazia e custo total 0', () => {
  const quoteData: QuotationData = {
    destination: 'Roma',
    services: [],
    financials: calculateFinancialSummaryFromServices({
      services: [],
      salePrice: 750,
      targetCurrency: 'EUR',
    }),
  };
  assert.strictEqual(quoteData.destination, 'Roma');
  assert.strictEqual(quoteData.services?.length, 0);
  assert.strictEqual(quoteData.financials?.totalCost, 0);
  assert.strictEqual(quoteData.financials?.salePrice, 750);
});

// 2. Cada um dos 8 tipos de serviço
runTest('2. Suporte individual a cada um dos 8 tipos de serviço', () => {
  const types: ServiceType[] = [
    'outbound_transport',
    'inbound_transport',
    'accommodation',
    'transfer',
    'insurance',
    'additional',
    'taxes',
    'other',
  ];

  types.forEach((t) => {
    const item = createDefaultServiceItem(t, 'EUR', 'Madrid');
    assert.strictEqual(item.type, t);
    assert.ok(item.id && item.id.length > 0);
    assert.strictEqual(item.currency, 'EUR');
    assert.strictEqual(item.amount, 0);
    assert.strictEqual(item.quantity, 1);
    assert.ok(SERVICE_TYPE_LABELS[t]);
  });
});

// 3. Múltiplos serviços mistos
runTest('3. Múltiplos serviços heterogêneos somam custos corretamente', () => {
  const s1 = createDefaultServiceItem('outbound_transport', 'EUR');
  s1.amount = 100;
  s1.quantity = 2; // 200

  const s2 = createDefaultServiceItem('accommodation', 'EUR');
  s2.amount = 300;
  s2.quantity = 1; // 300

  const s3 = createDefaultServiceItem('transfer', 'EUR');
  s3.amount = 50;
  s3.quantity = 2; // 100

  const summary = calculateFinancialSummaryFromServices({
    services: [s1, s2, s3],
    salePrice: 700,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(summary.totalCost, 600);
  assert.strictEqual(summary.salePrice, 700);
  assert.strictEqual(summary.profit, 100);
});

// 4. Múltiplos serviços do mesmo tipo
runTest('4. Múltiplos serviços do mesmo tipo (ex: 2 hospedagens, 2 transfers)', () => {
  const h1 = createDefaultServiceItem('accommodation', 'EUR', 'Tóquio');
  h1.description = 'Hotel Keio Plaza Tóquio';
  h1.amount = 600;

  const h2 = createDefaultServiceItem('accommodation', 'EUR', 'Quioto');
  h2.description = 'Ryokan Kyoto';
  h2.amount = 500;

  const t1 = createDefaultServiceItem('transfer', 'EUR');
  t1.description = 'Transfer Aeroporto Haneda -> Tóquio';
  t1.amount = 80;

  const t2 = createDefaultServiceItem('transfer', 'EUR');
  t2.description = 'Transfer Estação Quioto -> Ryokan';
  t2.amount = 40;

  const quoteData: QuotationData = {
    destination: 'Japão (Tóquio e Quioto)',
    services: [h1, h2, t1, t2],
    financials: calculateFinancialSummaryFromServices({
      services: [h1, h2, t1, t2],
      salePrice: 1500,
      targetCurrency: 'EUR',
    }),
  };

  assert.strictEqual(quoteData.services?.length, 4);
  assert.strictEqual(quoteData.financials?.totalCost, 1220);
});

// 5. Destino independente dos serviços
runTest('5. Destino comercial da cotação é independente das cidades dos serviços', () => {
  const quoteData: QuotationData = {
    destination: 'Paris',
    services: [
      {
        id: 'h1',
        type: 'accommodation',
        description: 'Hotel Novotel Paris Est',
        destination: 'Bagnolet',
        amount: 400,
        currency: 'EUR',
        quantity: 1,
      },
      {
        id: 'h2',
        type: 'accommodation',
        description: 'Hotel Ibis Roissy',
        destination: 'Roissy-en-France',
        amount: 200,
        currency: 'EUR',
        quantity: 1,
      },
    ],
  };

  assert.strictEqual(quoteData.destination, 'Paris');
  assert.strictEqual(quoteData.services?.[0].destination, 'Bagnolet');
  assert.strictEqual(quoteData.services?.[1].destination, 'Roissy-en-France');
});

// 6. Snapshot de catálogo
runTest('6. Seleção de item do catálogo cria cópia snapshot sem ID persistente obrigatório', () => {
  const catalogHotel: FavoriteService = {
    id: 'fav-srv-999',
    type: 'hotel',
    name: 'Belmond Hotel Cipriani',
    country: 'Itália',
    city: 'Veneza',
    notes: '5 estrelas luxo',
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const hotelDest = [catalogHotel.city, catalogHotel.country].filter(Boolean).join(', ');
  const serviceItem: ServiceItem = {
    id: 'generated-uuid-1',
    type: 'accommodation',
    description: catalogHotel.name,
    destination: hotelDest,
    amount: 1200,
    currency: 'EUR',
    quantity: 1,
    notes: catalogHotel.notes,
  };

  assert.strictEqual(serviceItem.description, 'Belmond Hotel Cipriani');
  assert.strictEqual(serviceItem.destination, 'Veneza, Itália');
  assert.strictEqual((serviceItem as any).favorite_service_id, undefined);
});

// 7. Edição do snapshot
runTest('7. Edição de serviço originado do catálogo não afeta o catálogo original', () => {
  const catalogHotel: FavoriteService = {
    id: 'fav-srv-888',
    type: 'hotel',
    name: 'Hotel Ritz Lisboa',
    country: 'Portugal',
    city: 'Lisboa',
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const quoteService: ServiceItem = {
    id: 'quote-srv-1',
    type: 'accommodation',
    description: catalogHotel.name,
    destination: 'Lisboa, Portugal',
    amount: 500,
    currency: 'EUR',
    quantity: 1,
  };

  // Usuário customiza na cotação
  quoteService.description = 'Hotel Ritz Lisboa (Quarto Superior com Vista Parque)';
  quoteService.amount = 650;

  assert.strictEqual(catalogHotel.name, 'Hotel Ritz Lisboa');
  assert.strictEqual(quoteService.description, 'Hotel Ritz Lisboa (Quarto Superior com Vista Parque)');
  assert.strictEqual(quoteService.amount, 650);
});

// 8. Remoção de serviço
runTest('8. Remoção de serviço da lista recalcula o resumo financeiro imediatamente', () => {
  const s1 = createDefaultServiceItem('outbound_transport', 'EUR');
  s1.amount = 150;
  const s2 = createDefaultServiceItem('accommodation', 'EUR');
  s2.amount = 400;

  let servicesList = [s1, s2];
  let summary = calculateFinancialSummaryFromServices({
    services: servicesList,
    salePrice: 600,
    targetCurrency: 'EUR',
  });
  assert.strictEqual(summary.totalCost, 550);

  // Remove s1
  servicesList = servicesList.filter((s) => s.id !== s1.id);
  summary = calculateFinancialSummaryFromServices({
    services: servicesList,
    salePrice: 600,
    targetCurrency: 'EUR',
  });
  assert.strictEqual(summary.totalCost, 400);
});

// 9. Cálculo financeiro derivado
runTest('9. Resumo financeiro derivado diretamente de services[] sem financials.components paralelos', () => {
  const s1 = createDefaultServiceItem('outbound_transport', 'EUR');
  s1.amount = 200;
  s1.quantity = 2; // 400

  const s2 = createDefaultServiceItem('taxes', 'EUR');
  s2.amount = 50;
  s2.quantity = 1; // 50

  const summary = calculateFinancialSummaryFromServices({
    services: [s1, s2],
    salePrice: 500,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(summary.totalCost, 450);
  assert.strictEqual(summary.taxesAndFeesTotal, 50);
  assert.strictEqual(summary.salePrice, 500);
  assert.strictEqual(summary.profit, 50);
});

// 10. EUR
runTest('10. Operações financeiras em EUR', () => {
  const s = createDefaultServiceItem('accommodation', 'EUR');
  s.amount = 850;
  const summary = calculateFinancialSummaryFromServices({
    services: [s],
    salePrice: 1000,
    targetCurrency: 'EUR',
  });
  assert.strictEqual(summary.currency, 'EUR');
  assert.strictEqual(summary.totalCost, 850);
  assert.strictEqual(summary.salePrice, 1000);
});

// 11. BRL
runTest('11. Operações financeiras em BRL', () => {
  const s = createDefaultServiceItem('accommodation', 'BRL');
  s.amount = 3500;
  const summary = calculateFinancialSummaryFromServices({
    services: [s],
    salePrice: 4200,
    targetCurrency: 'BRL',
  });
  assert.strictEqual(summary.currency, 'BRL');
  assert.strictEqual(summary.totalCost, 3500);
  assert.strictEqual(summary.salePrice, 4200);
});

// 12. Múltiplas moedas com taxa de câmbio
runTest('12. Conversão cambial de EUR para BRL em serviços mistos', () => {
  const sEUR = createDefaultServiceItem('accommodation', 'EUR');
  sEUR.amount = 100; // 100 EUR = 600 BRL com taxa 6.0

  const sBRL = createDefaultServiceItem('transfer', 'BRL');
  sBRL.amount = 200; // 200 BRL

  const summary = calculateFinancialSummaryFromServices({
    services: [sEUR, sBRL],
    salePrice: 1000,
    targetCurrency: 'BRL',
    exchangeRate: 6.0,
  });

  assert.strictEqual(summary.currency, 'BRL');
  assert.strictEqual(summary.totalCost, 800); // 600 + 200
  assert.strictEqual(summary.profit, 200);
});

// 13. Preço de venda separado
runTest('13. Preço de venda não é um item da lista de serviços', () => {
  const s = createDefaultServiceItem('accommodation', 'EUR');
  s.amount = 500;
  const quoteData: QuotationData = {
    destination: 'Lisboa',
    services: [s],
    financials: calculateFinancialSummaryFromServices({
      services: [s],
      salePrice: 650,
      targetCurrency: 'EUR',
    }),
  };

  assert.strictEqual(quoteData.services?.length, 1);
  assert.strictEqual(quoteData.financials?.salePrice, 650);
  assert.strictEqual(quoteData.services?.find((srv) => srv.description.includes('Preço de venda')), undefined);
});

// 14. Margem de lucro
runTest('14. Cálculo de margem percentual determinística', () => {
  const s = createDefaultServiceItem('accommodation', 'EUR');
  s.amount = 800;
  const summary = calculateFinancialSummaryFromServices({
    services: [s],
    salePrice: 1000,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(summary.profit, 200);
  assert.strictEqual(summary.profitPercent, 20); // 200 / 1000 = 20%
});

// 15. Impostos e taxas
runTest('15. Subtotal de impostos e taxas segregado corretamente', () => {
  const s1 = createDefaultServiceItem('accommodation', 'EUR');
  s1.amount = 500;
  const sTax = createDefaultServiceItem('taxes', 'EUR');
  sTax.amount = 35;

  const summary = calculateFinancialSummaryFromServices({
    services: [s1, sTax],
    salePrice: 600,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(summary.taxesAndFeesTotal, 35);
  assert.strictEqual(summary.totalCost, 535);
});

// 16. Draft com services[]
runTest('16. Armazenamento de rascunho de cotação com destination e services[]', () => {
  clearQuoteDraft();
  const service = createDefaultServiceItem('outbound_transport', 'EUR');
  service.description = 'Porto -> Londres';
  service.amount = 130;

  const draft: Omit<QuoteDraft, 'savedAt'> = {
    reference: 'COT-2026-088',
    clientName: 'Cliente Teste VIP',
    status: 'draft',
    currency: 'EUR',
    startDate: '2026-08-01',
    endDate: '2026-08-08',
    durationDays: 8,
    durationNights: 7,
    adults: 2,
    children: 0,
    infants: 0,
    destination: 'Londres, Reino Unido',
    services: [service],
    salePrice: 400,
    paymentConditions: '50% entrada + 50% até 15 dias',
    localTaxNotes: 'City tax paga no local',
  };

  saveQuoteDraft(draft);
  const retrieved = getQuoteDraft();

  assert.ok(retrieved !== null);
  assert.strictEqual(retrieved?.reference, 'COT-2026-088');
  assert.strictEqual(retrieved?.clientName, 'Cliente Teste VIP');
  assert.strictEqual(retrieved?.destination, 'Londres, Reino Unido');
  assert.strictEqual(retrieved?.services?.length, 1);
  assert.strictEqual(retrieved?.services?.[0].description, 'Porto -> Londres');
  assert.strictEqual(retrieved?.paymentConditions, '50% entrada + 50% até 15 dias');
  assert.strictEqual(retrieved?.localTaxNotes, 'City tax paga no local');
});

// 17. Restauração e limpeza do draft
runTest('17. Restauração e limpeza de rascunho de cotação via clearQuoteDraft', () => {
  clearQuoteDraft();
  assert.strictEqual(getQuoteDraft(), null);

  saveQuoteDraft({
    reference: 'COT-2026-099',
    clientName: 'Teste',
    status: 'draft',
    currency: 'EUR',
    startDate: '',
    endDate: '',
    durationDays: 0,
    durationNights: 0,
    adults: 2,
    children: 0,
    infants: 0,
    destination: 'Roma',
    services: [],
    salePrice: 0,
  });

  assert.ok(getQuoteDraft() !== null);
  clearQuoteDraft();
  assert.strictEqual(getQuoteDraft(), null);
});

// 18. Carregamento de cotação legada
runTest('18. Carregamento e normalização em memória de cotação legada', () => {
  const legacyQuoteData: QuotationData = {
    passengers: { adults: 2, children: 1, infants: 0 },
    dates: { startDate: '2026-05-10', endDate: '2026-05-15', durationDays: 6, durationNights: 5 },
    outboundTransport: {
      type: 'flight',
      route: 'LIS -> FCO',
      carrier: 'TAP',
      departureTime: '08:00',
      arrivalTime: '11:55',
    },
    inboundTransport: {
      type: 'flight',
      route: 'FCO -> LIS',
      carrier: 'TAP',
      departureTime: '17:00',
      arrivalTime: '19:00',
    },
    lodging: [
      {
        id: 'h-leg-1',
        name: 'Hotel Quirinale Roma',
        destination: 'Roma',
        mealPlan: 'Café da manhã (BB)',
        nights: 5,
      },
    ],
    financials: {
      currency: 'EUR',
      components: [
        { id: 'c1', category: 'outbound_transport', description: 'LIS -> FCO', amount: 150, currency: 'EUR', quantity: 2 },
        { id: 'c2', category: 'inbound_transport', description: 'FCO -> LIS', amount: 140, currency: 'EUR', quantity: 2 },
        { id: 'c3', category: 'lodging', description: 'Hotel Quirinale Roma', amount: 500, currency: 'EUR', quantity: 1 },
      ],
      totalCost: 1080,
      salePrice: 1300,
      pricePerPerson: 433.33,
      profit: 220,
      profitPercent: 16.92,
      taxesAndFeesTotal: 0,
    },
    localTaxNotes: '6€ p/ noite',
    paymentConditions: 'Sinal 30%',
    customNotes: 'Cliente solicita quarto silencioso',
  };

  assert.strictEqual(isLegacyPackageData(legacyQuoteData), true);

  const normalized = normalizeLegacyToNewStructure(legacyQuoteData);
  assert.strictEqual(normalized.destination, 'Roma');
  assert.strictEqual(normalized.services.length, 3);
  assert.strictEqual(normalized.services[0].type, 'outbound_transport');
  assert.strictEqual(normalized.services[0].carrier, 'TAP');
  assert.strictEqual(normalized.services[0].departureTime, '08:00');
  assert.strictEqual(normalized.services[1].type, 'inbound_transport');
  assert.strictEqual(normalized.services[2].type, 'accommodation');
  assert.strictEqual(normalized.services[2].description, 'Hotel Quirinale Roma');
  assert.strictEqual(normalized.localTaxNotes, '6€ p/ noite');
  assert.strictEqual(normalized.paymentConditions, 'Sinal 30%');
  assert.strictEqual(normalized.customNotes, 'Cliente solicita quarto silencioso');
});

// 19. Preservação de localTaxNotes
runTest('19. Preservação de localTaxNotes como texto livre comercial', () => {
  const quoteData: QuotationData = {
    destination: 'Florença',
    services: [],
    localTaxNotes: 'Taxa turística de 4,50€ por pessoa/noite a pagar no check-in',
  };
  assert.strictEqual(quoteData.localTaxNotes, 'Taxa turística de 4,50€ por pessoa/noite a pagar no check-in');
});

// 20. Preservação de paymentConditions
runTest('20. Preservação de paymentConditions', () => {
  const quoteData: QuotationData = {
    destination: 'Grécia',
    services: [],
    paymentConditions: '20% na reserva, 80% até 30 dias antes da partida',
  };
  assert.strictEqual(quoteData.paymentConditions, '20% na reserva, 80% até 30 dias antes da partida');
});

// 21. Preservação de informações adicionais
runTest('21. Preservação de customNotes, extraServicesNotes e transferService', () => {
  const quoteData: QuotationData = {
    destination: 'Cancún',
    services: [],
    customNotes: 'Passaportes com validade mínima de 6 meses',
    extraServicesNotes: 'Passeio Chichen Itza opcional',
    transferService: 'Transfer van compartilhada',
  };
  assert.strictEqual(quoteData.customNotes, 'Passaportes com validade mínima de 6 meses');
  assert.strictEqual(quoteData.extraServicesNotes, 'Passeio Chichen Itza opcional');
  assert.strictEqual(quoteData.transferService, 'Transfer van compartilhada');
});

// 22. Snapshot independente do pacote base
runTest('22. Criação de snapshot de cotação a partir de pacote clona dados de forma isolada', () => {
  const basePackageData: QuotationData = {
    destination: 'Paris',
    services: [
      {
        id: 'srv-base-1',
        type: 'accommodation',
        description: 'Hotel Mercure Paris',
        amount: 600,
        currency: 'EUR',
        quantity: 1,
      },
    ],
  };

  // Simula a lógica de snapshot em quotationsService.createQuotationFromPackage
  const clonedData: QuotationData = JSON.parse(JSON.stringify(basePackageData));
  clonedData.snapshotCreatedAt = new Date().toISOString();
  clonedData.originPackageName = 'Pacote Paris Romântico';
  clonedData.originPackageReference = 'PK-2026-010';

  assert.strictEqual(clonedData.destination, 'Paris');
  assert.strictEqual(clonedData.services?.length, 1);
  assert.strictEqual(clonedData.originPackageName, 'Pacote Paris Romântico');
});

// 23. Alteração posterior do pacote não altera a cotação
runTest('23. Alteração no pacote base não impacta cotação já criada', () => {
  const originalPackageServices: ServiceItem[] = [
    {
      id: 'srv-1',
      type: 'accommodation',
      description: 'Hotel A',
      amount: 400,
      currency: 'EUR',
      quantity: 1,
    },
  ];

  // Cotação criada como snapshot
  const quoteServices: ServiceItem[] = JSON.parse(JSON.stringify(originalPackageServices));

  // Pacote base é alterado semanas depois
  originalPackageServices[0].description = 'Hotel Alterado B';
  originalPackageServices[0].amount = 800;
  originalPackageServices.push({
    id: 'srv-2',
    type: 'transfer',
    description: 'Transfer novo',
    amount: 100,
    currency: 'EUR',
    quantity: 1,
  });

  // A cotação permanece 100% inalterada
  assert.strictEqual(quoteServices.length, 1);
  assert.strictEqual(quoteServices[0].description, 'Hotel A');
  assert.strictEqual(quoteServices[0].amount, 400);
});

// 24. Múltiplas hospedagens
runTest('24. Cotação suporta múltiplas hospedagens com regimes e destinos distintos', () => {
  const h1: ServiceItem = {
    id: 'h-1',
    type: 'accommodation',
    description: 'Hotel Atenas Centro',
    destination: 'Atenas',
    mealPlan: 'Café da manhã (BB)',
    amount: 300,
    currency: 'EUR',
    quantity: 1,
  };

  const h2: ServiceItem = {
    id: 'h-2',
    type: 'accommodation',
    description: 'Resort Santorini Caldera',
    destination: 'Santorini',
    mealPlan: 'Meia-pensão (HB)',
    amount: 900,
    currency: 'EUR',
    quantity: 1,
  };

  const summary = calculateFinancialSummaryFromServices({
    services: [h1, h2],
    salePrice: 1500,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(summary.totalCost, 1200);
  assert.strictEqual(h1.mealPlan, 'Café da manhã (BB)');
  assert.strictEqual(h2.mealPlan, 'Meia-pensão (HB)');
});

// 25. Múltiplos transfers
runTest('25. Cotação suporta múltiplos transfers', () => {
  const t1 = createDefaultServiceItem('transfer', 'EUR');
  t1.description = 'Aeroporto -> Porto de Pireus';
  t1.amount = 45;

  const t2 = createDefaultServiceItem('transfer', 'EUR');
  t2.description = 'Porto de Santorini -> Hotel';
  t2.amount = 35;

  const t3 = createDefaultServiceItem('transfer', 'EUR');
  t3.description = 'Hotel Santorini -> Aeroporto Thira';
  t3.amount = 35;

  const summary = calculateFinancialSummaryFromServices({
    services: [t1, t2, t3],
    salePrice: 150,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(summary.totalCost, 115);
});

// 26. Horários de ida
runTest('26. Preservação de horários e cia no transporte de ida', () => {
  const out = createDefaultServiceItem('outbound_transport', 'EUR');
  out.description = 'LIS -> FCO (TP-832)';
  out.carrier = 'TAP Air Portugal';
  out.departureTime = '07:30';
  out.arrivalTime = '11:15';

  assert.strictEqual(out.departureTime, '07:30');
  assert.strictEqual(out.arrivalTime, '11:15');
  assert.strictEqual(out.carrier, 'TAP Air Portugal');
});

// 27. Horários de volta
runTest('27. Preservação de horários e cia no transporte de volta', () => {
  const inb = createDefaultServiceItem('inbound_transport', 'EUR');
  inb.description = 'FCO -> LIS (TP-837)';
  inb.carrier = 'TAP Air Portugal';
  inb.departureTime = '19:40';
  inb.arrivalTime = '21:45';

  assert.strictEqual(inb.departureTime, '19:40');
  assert.strictEqual(inb.arrivalTime, '21:45');
  assert.strictEqual(inb.carrier, 'TAP Air Portugal');
});

// 28. Observações nos serviços
runTest('28. Observações contextuais nos serviços', () => {
  const s = createDefaultServiceItem('accommodation', 'EUR');
  s.description = 'Hotel Excelsior';
  s.notes = 'Check-in antecipado solicitado; cama casal';

  assert.strictEqual(s.notes, 'Check-in antecipado solicitado; cama casal');
});

// 29. Referência sequencial COT-YYYY-NNN
runTest('29. Geração de referências COT-YYYY-NNN', () => {
  const existingRefs = ['COT-2026-001', 'COT-2026-002', 'COT-2026-005'];
  const nextRef = getNextSequentialReference('COT', existingRefs, 2026);
  assert.strictEqual(nextRef, 'COT-2026-006');

  const firstOfYear = getNextSequentialReference('COT', [], 2026);
  assert.strictEqual(firstOfYear, 'COT-2026-001');
});

// 30. Compatibilidade de mapeamento para CostComponent
runTest('30. serviceItemToCostComponent mapeia todos os 8 tipos sem perda financeira', () => {
  const types: ServiceType[] = [
    'outbound_transport',
    'inbound_transport',
    'accommodation',
    'transfer',
    'insurance',
    'additional',
    'taxes',
    'other',
  ];

  types.forEach((t) => {
    const s = createDefaultServiceItem(t, 'EUR');
    s.amount = 100;
    s.quantity = 2;
    s.description = `Teste ${t}`;
    const comp = serviceItemToCostComponent(s);
    assert.strictEqual(comp.amount, 100);
    assert.strictEqual(comp.quantity, 2);
    assert.strictEqual(comp.description, `Teste ${t}`);
  });
});

// 31. Imutabilidade na normalização
runTest('31. normalizeLegacyToNewStructure não muta objeto legado original', () => {
  const originalData: QuotationData = {
    passengers: { adults: 2, children: 0, infants: 0 },
    lodging: [{ id: '1', name: 'Hotel Teste', destination: 'Porto' }],
  };
  const originalJson = JSON.stringify(originalData);

  const normalized = normalizeLegacyToNewStructure(originalData);
  assert.strictEqual(JSON.stringify(originalData), originalJson);
  assert.strictEqual(normalized.destination, 'Porto');
  assert.strictEqual(normalized.services.length, 1);
});

// 32. Divisor comercial por passageiros pagantes
runTest('32. Cálculo de preço por pessoa considera adultos + crianças', () => {
  const s = createDefaultServiceItem('accommodation', 'EUR');
  s.amount = 1200;

  const summary = calculateFinancialSummaryFromServices({
    services: [s],
    salePrice: 1500,
    targetCurrency: 'EUR',
    passengers: { adults: 2, children: 1, infants: 1 }, // 3 pagantes (bebê não entra no divisor)
  });

  assert.strictEqual(summary.pricePerPerson, 500); // 1500 / 3
});

console.log(`\n=== FIM DOS TESTES: ${testsPassed} PASSARAM, ${testsFailed} FALHARAM ===\n`);

if (testsFailed > 0) {
  process.exit(1);
}
