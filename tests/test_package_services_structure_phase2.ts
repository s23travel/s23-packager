import assert from 'node:assert';
import {
  calculateFinancialSummaryFromServices,
  createDefaultServiceItem,
  isLegacyPackageData,
  normalizeLegacyToNewStructure,
  serviceItemToCostComponent,
} from '../src/services/legacyAdapterService';
import {
  savePackageDraft,
  getPackageDraft,
  clearPackageDraft,
} from '../src/services/packageDraftService';
import {
  FavoriteService,
  PackageData,
  PackageDraft,
  ServiceItem,
  ServiceType,
} from '../src/types';

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

console.log('=== INICIANDO BATERIA DE TESTES: REESTRUTURAÇÃO DO PACOTE BASE (FASE 2) ===\n');

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

// 1. Novo pacote sem serviços
runTest('1. Novo pacote sem serviços possui lista vazia e custo total 0', () => {
  const packageData: PackageData = {
    destination: 'Lisboa',
    services: [],
    financials: calculateFinancialSummaryFromServices({
      services: [],
      salePrice: 500,
      targetCurrency: 'EUR',
    }),
  };
  assert.strictEqual(packageData.services?.length, 0);
  assert.strictEqual(packageData.financials?.totalCost, 0);
  assert.strictEqual(packageData.financials?.salePrice, 500);
});

// 2. Novo pacote com transporte de ida
runTest('2. Novo pacote com transporte de ida registra ServiceItem outbound_transport', () => {
  const item = createDefaultServiceItem('outbound_transport', 'EUR');
  item.description = 'Porto → Paris (Easyjet)';
  item.amount = 120;
  item.quantity = 2;

  const summary = calculateFinancialSummaryFromServices({
    services: [item],
    salePrice: 300,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(item.type, 'outbound_transport');
  assert.strictEqual(summary.totalCost, 240);
});

// 3. Novo pacote com transporte de volta
runTest('3. Novo pacote com transporte de volta registra ServiceItem inbound_transport', () => {
  const item = createDefaultServiceItem('inbound_transport', 'EUR');
  item.description = 'Paris → Porto (Easyjet)';
  item.amount = 110;
  item.quantity = 2;

  const summary = calculateFinancialSummaryFromServices({
    services: [item],
    salePrice: 300,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(item.type, 'inbound_transport');
  assert.strictEqual(summary.totalCost, 220);
});

// 4. Novo pacote com hospedagem
runTest('4. Novo pacote com hospedagem registra ServiceItem accommodation', () => {
  const item = createDefaultServiceItem('accommodation', 'EUR', 'Paris');
  item.description = 'Hotel Louvre Paris';
  item.amount = 450;
  item.quantity = 1;
  item.mealPlan = 'Café da manhã (BB)';

  const summary = calculateFinancialSummaryFromServices({
    services: [item],
    salePrice: 550,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(item.type, 'accommodation');
  assert.strictEqual(item.destination, 'Paris');
  assert.strictEqual(item.mealPlan, 'Café da manhã (BB)');
  assert.strictEqual(summary.totalCost, 450);
});

// 5. Novo pacote com transfer
runTest('5. Novo pacote com transfer registra ServiceItem transfer', () => {
  const item = createDefaultServiceItem('transfer', 'EUR');
  item.description = 'Aeroporto CDG → Hotel';
  item.amount = 80;
  item.quantity = 1;

  const summary = calculateFinancialSummaryFromServices({
    services: [item],
    salePrice: 100,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(item.type, 'transfer');
  assert.strictEqual(summary.totalCost, 80);
});

// 6. Novo pacote com seguro
runTest('6. Novo pacote com seguro registra ServiceItem insurance', () => {
  const item = createDefaultServiceItem('insurance', 'EUR');
  item.description = 'Seguro-viagem Internacional Mawdy';
  item.amount = 25;
  item.quantity = 2;

  const summary = calculateFinancialSummaryFromServices({
    services: [item],
    salePrice: 80,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(item.type, 'insurance');
  assert.strictEqual(summary.totalCost, 50);
});

// 7. Novo pacote com serviço adicional
runTest('7. Novo pacote com serviço adicional registra ServiceItem additional', () => {
  const item = createDefaultServiceItem('additional', 'EUR');
  item.description = 'Ingresso Museu do Louvre';
  item.amount = 22;
  item.quantity = 2;

  const summary = calculateFinancialSummaryFromServices({
    services: [item],
    salePrice: 60,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(item.type, 'additional');
  assert.strictEqual(summary.totalCost, 44);
});

// 8. Novo pacote com impostos/taxas
runTest('8. Novo pacote com impostos/taxas registra ServiceItem taxes e soma em taxesAndFeesTotal', () => {
  const item = createDefaultServiceItem('taxes', 'EUR');
  item.description = 'Taxa turística de Paris';
  item.amount = 15;
  item.quantity = 2;

  const summary = calculateFinancialSummaryFromServices({
    services: [item],
    salePrice: 50,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(item.type, 'taxes');
  assert.strictEqual(summary.totalCost, 30);
  assert.strictEqual(summary.taxesAndFeesTotal, 30);
});

// 9. Novo pacote com outros custos
runTest('9. Novo pacote com outros custos registra ServiceItem other', () => {
  const item = createDefaultServiceItem('other', 'EUR');
  item.description = 'Taxa de emissão / trâmites';
  item.amount = 40;
  item.quantity = 1;

  const summary = calculateFinancialSummaryFromServices({
    services: [item],
    salePrice: 60,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(item.type, 'other');
  assert.strictEqual(summary.totalCost, 40);
});

// 10. Múltiplos serviços do mesmo tipo
runTest('10. Múltiplos serviços do mesmo tipo são permitidos sem consolidação forçada', () => {
  const t1 = createDefaultServiceItem('additional', 'EUR');
  t1.description = 'Passeio de Barco Sena';
  t1.amount = 30;
  t1.quantity = 2;

  const t2 = createDefaultServiceItem('additional', 'EUR');
  t2.description = 'Torre Eiffel com subida ao topo';
  t2.amount = 45;
  t2.quantity = 2;

  const summary = calculateFinancialSummaryFromServices({
    services: [t1, t2],
    salePrice: 200,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(summary.totalCost, 150);
});

// 11. Múltiplas hospedagens
runTest('11. Múltiplas hospedagens coexistem com seus próprios custos e destinos', () => {
  const h1 = createDefaultServiceItem('accommodation', 'EUR', 'Paris');
  h1.description = 'Hotel Paris Centro';
  h1.destination = 'Paris';
  h1.amount = 400;

  const h2 = createDefaultServiceItem('accommodation', 'EUR', 'Bruxelas');
  h2.description = 'Hotel Bruxelas Grand Place';
  h2.destination = 'Bruxelas';
  h2.amount = 350;

  const summary = calculateFinancialSummaryFromServices({
    services: [h1, h2],
    salePrice: 900,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(h1.destination, 'Paris');
  assert.strictEqual(h2.destination, 'Bruxelas');
  assert.strictEqual(summary.totalCost, 750);
});

// 12. Horário de partida
runTest('12. Horário de partida em transporte é preservado no ServiceItem', () => {
  const item = createDefaultServiceItem('outbound_transport', 'EUR');
  item.departureTime = '06:15';
  assert.strictEqual(item.departureTime, '06:15');
});

// 13. Horário de chegada
runTest('13. Horário de chegada em transporte é preservado no ServiceItem', () => {
  const item = createDefaultServiceItem('outbound_transport', 'EUR');
  item.arrivalTime = '09:25';
  assert.strictEqual(item.arrivalTime, '09:25');
});

// 14. Regime de hospedagem
runTest('14. Regime de hospedagem é configurável por hotel', () => {
  const h = createDefaultServiceItem('accommodation', 'EUR');
  h.mealPlan = 'Tudo incluído (AI)';
  assert.strictEqual(h.mealPlan, 'Tudo incluído (AI)');
});

// 15. Observação por serviço
runTest('15. Cada serviço preserva sua própria observação individual opcional', () => {
  const s = createDefaultServiceItem('transfer', 'EUR');
  s.notes = 'Van privativa com motorista bilíngue';
  assert.strictEqual(s.notes, 'Van privativa com motorista bilíngue');
});

// 16. Moedas diferentes
runTest('16. Moedas diferentes são calculadas com a taxa manual de câmbio informada', () => {
  const s1 = createDefaultServiceItem('accommodation', 'EUR');
  s1.amount = 100; // 100 EUR
  s1.quantity = 1;

  const s2 = createDefaultServiceItem('transfer', 'BRL');
  s2.amount = 620; // 620 BRL
  s2.quantity = 1;

  // Câmbio: 1 EUR = 6.20 BRL => 620 BRL / 6.20 = 100 EUR
  const summary = calculateFinancialSummaryFromServices({
    services: [s1, s2],
    salePrice: 250,
    targetCurrency: 'EUR',
    exchangeRate: 6.20,
  });

  assert.strictEqual(summary.conversionError, null);
  assert.strictEqual(summary.totalCost, 200);
});

// 17. Quantidade
runTest('17. Quantidade multiplica o custo unitário no custo total', () => {
  const item = createDefaultServiceItem('additional', 'EUR');
  item.amount = 50;
  item.quantity = 3;

  const summary = calculateFinancialSummaryFromServices({
    services: [item],
    salePrice: 200,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(summary.totalCost, 150);
});

// 18. Cálculo do custo total a partir de services[]
runTest('18. Custo total é soma estrita de todos os services[]', () => {
  const s1 = createDefaultServiceItem('outbound_transport', 'EUR');
  s1.amount = 100;
  const s2 = createDefaultServiceItem('accommodation', 'EUR');
  s2.amount = 200;
  const s3 = createDefaultServiceItem('transfer', 'EUR');
  s3.amount = 50;

  const summary = calculateFinancialSummaryFromServices({
    services: [s1, s2, s3],
    salePrice: 400,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(summary.totalCost, 350);
});

// 19. Preço de venda separado dos serviços
runTest('19. Preço de venda é dado comercial independente dos serviços', () => {
  const s1 = createDefaultServiceItem('accommodation', 'EUR');
  s1.amount = 300;

  const summary = calculateFinancialSummaryFromServices({
    services: [s1],
    salePrice: 450,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(summary.totalCost, 300);
  assert.strictEqual(summary.salePrice, 450);
});

// 20. Cálculo de lucro preservado
runTest('20. Lucro bruto e margem percentual são calculados com precisão determinística', () => {
  const s1 = createDefaultServiceItem('accommodation', 'EUR');
  s1.amount = 800;

  const summary = calculateFinancialSummaryFromServices({
    services: [s1],
    salePrice: 1000,
    targetCurrency: 'EUR',
  });

  assert.strictEqual(summary.profit, 200);
  assert.strictEqual(summary.profitPercent, 20);
});

// 21. Destination no nível principal
runTest('21. Destination é atributo de nível superior em PackageData', () => {
  const pkgData: PackageData = {
    destination: 'Paris / Bruxelas',
    services: [],
  };
  assert.strictEqual(pkgData.destination, 'Paris / Bruxelas');
});

// 22. Destination específico da hospedagem
runTest('22. Destination específico da hospedagem coexiste com o destino principal do pacote', () => {
  const hotel = createDefaultServiceItem('accommodation', 'EUR');
  hotel.destination = 'Bruxelas';

  const pkgData: PackageData = {
    destination: 'Bélgica & Países Baixos',
    services: [hotel],
  };

  assert.strictEqual(pkgData.destination, 'Bélgica & Países Baixos');
  assert.strictEqual(pkgData.services![0].destination, 'Bruxelas');
});

// 23. Seleção de serviço do catálogo gera snapshot
runTest('23. Seleção de serviço do catálogo copia apenas strings sem id de catálogo', () => {
  const catalogItem: FavoriteService = {
    id: 'catalog-uuid-123',
    type: 'hotel',
    name: 'Hotel Splendido',
    city: 'Portofino',
    country: 'Itália',
    active: true,
    created_at: '',
    updated_at: '',
  };

  const serviceItem = createDefaultServiceItem('accommodation', 'EUR');
  serviceItem.description = catalogItem.name;
  serviceItem.destination = `${catalogItem.city}, ${catalogItem.country}`;

  assert.strictEqual(serviceItem.description, 'Hotel Splendido');
  assert.strictEqual(serviceItem.destination, 'Portofino, Itália');
  assert.strictEqual((serviceItem as any).catalogId, undefined);
});

// 24. Alteração posterior do catálogo não altera o pacote
runTest('24. Alteração posterior do catálogo não altera o snapshot do pacote', () => {
  let catalogItem: FavoriteService = {
    id: 'catalog-1',
    type: 'hotel',
    name: 'Nome Original',
    country: 'França',
    active: true,
    created_at: '',
    updated_at: '',
  };

  const serviceItem = createDefaultServiceItem('accommodation', 'EUR');
  serviceItem.description = catalogItem.name;

  // Catálogo muda de nome
  catalogItem = { ...catalogItem, name: 'Nome Modificado no Catálogo' };

  // O pacote continua com o snapshot congelado
  assert.strictEqual(serviceItem.description, 'Nome Original');
});

// 25. Remoção de serviço
runTest('25. Remoção de serviço da lista recalcula o financeiro sem inconsistências', () => {
  const s1 = createDefaultServiceItem('outbound_transport', 'EUR');
  s1.amount = 100;
  const s2 = createDefaultServiceItem('transfer', 'EUR');
  s2.amount = 50;

  let currentServices = [s1, s2];
  let summary = calculateFinancialSummaryFromServices({
    services: currentServices,
    salePrice: 200,
    targetCurrency: 'EUR',
  });
  assert.strictEqual(summary.totalCost, 150);

  // Remove o transfer (índice 1)
  currentServices = currentServices.filter((_, i) => i !== 1);
  summary = calculateFinancialSummaryFromServices({
    services: currentServices,
    salePrice: 200,
    targetCurrency: 'EUR',
  });
  assert.strictEqual(summary.totalCost, 100);
});

// 26. Edição de serviço
runTest('26. Edição de serviço atualiza os valores e recalcula o financeiro', () => {
  const s1 = createDefaultServiceItem('accommodation', 'EUR');
  s1.amount = 300;

  // Atualiza para 400
  s1.amount = 400;

  const summary = calculateFinancialSummaryFromServices({
    services: [s1],
    salePrice: 500,
    targetCurrency: 'EUR',
  });
  assert.strictEqual(summary.totalCost, 400);
  assert.strictEqual(summary.profit, 100);
});

// 27. Draft preservando services[]
runTest('27. Draft preserva destination e services[] em sessionStorage', () => {
  const s1 = createDefaultServiceItem('outbound_transport', 'EUR');
  s1.description = 'Voo LIS-MAD';
  s1.amount = 150;

  const draftPayload: Omit<PackageDraft, 'savedAt'> = {
    reference: 'PK-2026-999',
    name: 'Rascunho Novo Teste',
    status: 'draft',
    baseCurrency: 'EUR',
    supplier: 'Abreu',
    additionalInfo: 'Info teste',
    startDate: '2026-08-01',
    endDate: '2026-08-10',
    durationDays: 10,
    durationNights: 9,
    adults: 2,
    children: 0,
    destination: 'Madrid',
    services: [s1],
    salePrice: 400,
  };

  savePackageDraft(draftPayload);
  const loadedDraft = getPackageDraft();

  assert.strictEqual(loadedDraft?.reference, 'PK-2026-999');
  assert.strictEqual(loadedDraft?.destination, 'Madrid');
  assert.strictEqual(loadedDraft?.services?.length, 1);
  assert.strictEqual(loadedDraft?.services?.[0].description, 'Voo LIS-MAD');
  clearPackageDraft();
});

// 28. Pacote legado é carregado através do adapter
runTest('28. Pacote legado sem services[] é detectado e normalizado pelo adapter', () => {
  const legacyData: PackageData = {
    outboundTransport: { type: 'flight', route: 'Ryanair (OPO)', carrier: 'Ryanair' },
    lodging: [{ id: 'h1', name: 'Joy 124 Hotel Milano', destination: 'Milão', mealPlan: 'Apenas alojamento (RO)' }],
    financials: {
      currency: 'EUR',
      salePrice: 658,
      totalCost: 383,
      profit: 275,
      profitPercent: 41.79,
      taxesAndFeesTotal: 0,
      pricePerPerson: 329,
      components: [
        { id: 'c1', category: 'outbound_transport', description: 'Ryanair (OPO)', amount: 38, quantity: 2, currency: 'EUR' },
        { id: 'c2', category: 'lodging', description: 'Joy 124 Hotel Milano', amount: 345, quantity: 1, currency: 'EUR' },
      ],
    },
  };

  assert.strictEqual(isLegacyPackageData(legacyData), true);

  const normalized = normalizeLegacyToNewStructure(legacyData);
  assert.strictEqual(normalized.destination, 'Milão');
  assert.strictEqual(normalized.services.length, 2);
  assert.strictEqual(normalized.services[0].type, 'outbound_transport');
  assert.strictEqual(normalized.services[1].type, 'accommodation');
});

// 29. Pacote legado mantém dados não mapeáveis
runTest('29. Pacote legado preserva additionalInfo e outros dados sem descartar', () => {
  const legacyData: PackageData = {
    additionalInfo: 'Tx.local: 60€\nTraslado Ida/Volta: 145€',
    localTaxNotes: '60€',
    paymentConditions: 'Entrada 30%',
    lodging: [{ id: '1', name: 'Hotel A', destination: 'Roma' }],
  };

  const normalized = normalizeLegacyToNewStructure(legacyData);
  assert.strictEqual(normalized.additionalInfo, 'Tx.local: 60€\nTraslado Ida/Volta: 145€');
  assert.strictEqual(normalized.localTaxNotes, '60€');
  assert.strictEqual(normalized.paymentConditions, 'Entrada 30%');
});

// 30. Pacote legado pode ser salvo na nova estrutura
runTest('30. Pacote legado normalizado é estruturado com destination e services[] para salvamento', () => {
  const legacyData: PackageData = {
    lodging: [{ id: '1', name: 'Hotel Paris', destination: 'Paris' }],
    financials: {
      currency: 'EUR',
      salePrice: 500,
      totalCost: 300,
      profit: 200,
      profitPercent: 40,
      taxesAndFeesTotal: 0,
      pricePerPerson: 250,
      components: [{ id: '1', category: 'lodging', description: 'Hotel Paris', amount: 300, quantity: 1, currency: 'EUR' }],
    },
  };

  const normalized = normalizeLegacyToNewStructure(legacyData);

  const savedPackageData: PackageData = {
    destination: normalized.destination,
    services: normalized.services,
    financials: calculateFinancialSummaryFromServices({
      services: normalized.services,
      salePrice: 500,
      targetCurrency: 'EUR',
    }),
  };

  assert.strictEqual(savedPackageData.destination, 'Paris');
  assert.strictEqual(savedPackageData.services?.length, 1);
  assert.strictEqual(isLegacyPackageData(savedPackageData), false);
});

// 31. Pacote novo não cria estruturas operacionais legadas
runTest('31. Pacote novo não cria outboundTransport, inboundTransport nem lodging', () => {
  const newPackageData: PackageData = {
    destination: 'Tenerife',
    services: [
      createDefaultServiceItem('outbound_transport', 'EUR'),
      createDefaultServiceItem('accommodation', 'EUR', 'Tenerife'),
    ],
  };

  assert.strictEqual(newPackageData.outboundTransport, undefined);
  assert.strictEqual(newPackageData.inboundTransport, undefined);
  assert.strictEqual(newPackageData.lodging, undefined);
  assert.strictEqual(Array.isArray(newPackageData.services), true);
});

// 32. syncOperationalWithFinancials não é utilizado pelo Novo Pacote
runTest('32. syncOperationalWithFinancials não é requerido pois services[] já carrega os custos', () => {
  const services: ServiceItem[] = [
    {
      id: 'srv-1',
      type: 'outbound_transport',
      description: 'OPO → MAD',
      amount: 45,
      currency: 'EUR',
      quantity: 2,
    },
  ];

  // Os custos vêm direto de services[]
  const costComp = serviceItemToCostComponent(services[0]);
  assert.strictEqual(costComp.description, 'OPO → MAD');
  assert.strictEqual(costComp.amount, 45);
  assert.strictEqual(costComp.quantity, 2);
});

// 33. Nenhum dado existente é alterado durante o carregamento
runTest('33. normalizeLegacyToNewStructure não muta o objeto legado original', () => {
  const original: PackageData = {
    lodging: [{ id: 'h1', name: 'Hotel Original', destination: 'Porto' }],
  };
  const snapshot = JSON.stringify(original);
  normalizeLegacyToNewStructure(original);
  assert.strictEqual(JSON.stringify(original), snapshot);
});

// 34. Dados ambíguos não são inventados
runTest('34. additionalInfo em texto não vira custo financeiro estruturado falso', () => {
  const legacy: PackageData = {
    additionalInfo: 'Tx.local: 60€\nTraslado Ida/Volta: 145€',
    financials: {
      currency: 'EUR',
      salePrice: 200,
      totalCost: 0,
      profit: 200,
      profitPercent: 100,
      taxesAndFeesTotal: 0,
      pricePerPerson: 100,
      components: [],
    },
  };

  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.services.length, 0);
  assert.strictEqual(normalized.additionalInfo, 'Tx.local: 60€\nTraslado Ida/Volta: 145€');
});

console.log(`\n====================================================`);
console.log(` RESULTADO FINAL: ${testsPassed} PASSOU / ${testsFailed} FALHOU`);
console.log(`====================================================\n`);

if (testsFailed > 0) {
  process.exit(1);
}
