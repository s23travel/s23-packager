import assert from 'node:assert';
import {
  normalizeLegacyToNewStructure,
  classifyServiceComponent,
  extractTimesFromText,
  resolveDestination,
} from '../src/services/legacyAdapterService';
import { PackageData, QuotationData } from '../src/types';

console.log('=== INICIANDO BATERIA DE TESTES DO NOVO MODELO DE SERVIÇOS E ADAPTER LEGADO (FASE 1) ===\n');

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

// 1. Package sem serviços
runTest('1. Package sem serviços converte com serviços vazios e sem quebras', () => {
  const legacy: PackageData = {
    dates: { startDate: '2026-10-01', endDate: '2026-10-05' },
    passengers: { adults: 2, children: 0, infants: 0 },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(Array.isArray(normalized.services), true);
  assert.strictEqual(normalized.services.length, 0);
  assert.strictEqual(normalized.destination, undefined);
  assert.strictEqual(normalized.dates?.startDate, '2026-10-01');
});

// 2. Package com transporte de ida
runTest('2. Package com transporte de ida consolida rota e custo em ServiceItem', () => {
  const legacy: PackageData = {
    outboundTransport: {
      type: 'flight',
      route: 'Ryanair (OPO)',
      carrier: 'Ryanair',
    },
    financials: {
      currency: 'EUR',
      totalCost: 76,
      salePrice: 100,
      pricePerPerson: 50,
      profit: 24,
      profitPercent: 24,
      taxesAndFeesTotal: 0,
      components: [
        {
          id: 'cost_outbound_1',
          category: 'outbound_transport',
          description: 'Ryanair (OPO)',
          amount: 38,
          currency: 'EUR',
          quantity: 2,
        },
      ],
    },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.services.length, 1);
  const item = normalized.services[0];
  assert.strictEqual(item.type, 'outbound_transport');
  assert.strictEqual(item.description, 'Ryanair (OPO)');
  assert.strictEqual(item.amount, 38);
  assert.strictEqual(item.quantity, 2);
  assert.strictEqual(item.carrier, 'Ryanair');
  assert.strictEqual(item.legacyComponentId, 'cost_outbound_1');
});

// 3. Package com transporte de volta
runTest('3. Package com transporte de volta consolida rota e custo em ServiceItem', () => {
  const legacy: PackageData = {
    inboundTransport: {
      type: 'flight',
      route: 'Ryanair (MXP)',
    },
    financials: {
      currency: 'EUR',
      totalCost: 38,
      salePrice: 50,
      pricePerPerson: 25,
      profit: 12,
      profitPercent: 24,
      taxesAndFeesTotal: 0,
      components: [
        {
          id: 'cost_inbound_1',
          category: 'inbound_transport',
          description: 'Ryanair (MXP)',
          amount: 38,
          currency: 'EUR',
          quantity: 1,
        },
      ],
    },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.services.length, 1);
  const item = normalized.services[0];
  assert.strictEqual(item.type, 'inbound_transport');
  assert.strictEqual(item.description, 'Ryanair (MXP)');
  assert.strictEqual(item.amount, 38);
  assert.strictEqual(item.quantity, 1);
});

// 4. Transporte com horários estruturados
runTest('4. Transporte com horários estruturados preserva departureTime e arrivalTime', () => {
  const legacy: PackageData = {
    outboundTransport: {
      type: 'flight',
      route: 'Iberia (OPO)',
      departureTime: '20:40',
      arrivalTime: '02:05',
    },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.services.length, 1);
  const item = normalized.services[0];
  assert.strictEqual(item.departureTime, '20:40');
  assert.strictEqual(item.arrivalTime, '02:05');
});

// 5. Transporte com horários somente em notes do componente financeiro
runTest('5. Transporte com horários somente em notes extrai horários para campos estruturados', () => {
  const legacy: PackageData = {
    outboundTransport: {
      type: 'flight',
      route: 'Ryanair (OPO)',
    },
    financials: {
      currency: 'EUR',
      totalCost: 76,
      salePrice: 100,
      pricePerPerson: 50,
      profit: 24,
      profitPercent: 24,
      taxesAndFeesTotal: 0,
      components: [
        {
          id: 'cost_out_notes',
          category: 'outbound_transport',
          description: 'Ryanair (OPO)',
          notes: '15:15-18:40',
          amount: 38,
          currency: 'EUR',
          quantity: 2,
        },
      ],
    },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  const item = normalized.services[0];
  assert.strictEqual(item.departureTime, '15:15');
  assert.strictEqual(item.arrivalTime, '18:40');
});

// 6. Transporte com horários estruturados + notes adicionais
runTest('6. Transporte com horários estruturados + notes não perde notas adicionais', () => {
  const legacy: PackageData = {
    outboundTransport: {
      type: 'flight',
      route: 'Easyjet (OPO)',
      departureTime: '06:15',
      arrivalTime: '09:25',
    },
    financials: {
      currency: 'EUR',
      totalCost: 98,
      salePrice: 150,
      pricePerPerson: 75,
      profit: 52,
      profitPercent: 34.6,
      taxesAndFeesTotal: 0,
      components: [
        {
          id: 'cost_out_full',
          category: 'outbound_transport',
          description: 'Easyjet (OPO)',
          notes: '06:15-09:25 Tarifa Standard apenas mochila',
          amount: 98,
          currency: 'EUR',
          quantity: 1,
        },
      ],
    },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  const item = normalized.services[0];
  assert.strictEqual(item.departureTime, '06:15');
  assert.strictEqual(item.arrivalTime, '09:25');
  assert.strictEqual(item.notes?.includes('Tarifa Standard apenas mochila'), true);
});

// 7. Hospedagem única
runTest('7. Hospedagem única cria ServiceItem accommodation e mapeia destino para nível superior', () => {
  const legacy: PackageData = {
    lodging: [
      {
        id: 'hotel-1',
        name: 'Joy 124 Hotel Milano',
        mealPlan: 'Apenas alojamento (RO)',
        destination: 'Milão',
      },
    ],
    financials: {
      currency: 'EUR',
      totalCost: 345,
      salePrice: 450,
      pricePerPerson: 225,
      profit: 105,
      profitPercent: 23.3,
      taxesAndFeesTotal: 0,
      components: [
        {
          id: 'cost_h1',
          category: 'lodging',
          description: 'Joy 124 Hotel Milano',
          amount: 345,
          currency: 'EUR',
          quantity: 1,
        },
      ],
    },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.destination, 'Milão');
  assert.strictEqual(normalized.destinationConflict, false);
  assert.strictEqual(normalized.services.length, 1);
  const hotel = normalized.services[0];
  assert.strictEqual(hotel.type, 'accommodation');
  assert.strictEqual(hotel.description, 'Joy 124 Hotel Milano');
  assert.strictEqual(hotel.mealPlan, 'Apenas alojamento (RO)');
  assert.strictEqual(hotel.destination, 'Milão');
  assert.strictEqual(hotel.amount, 345);
});

// 8. Múltiplas hospedagens
runTest('8. Múltiplas hospedagens geram múltiplos ServiceItems accommodation sem consolidar', () => {
  const legacy: PackageData = {
    lodging: [
      {
        id: 'hotel-1',
        name: 'Hotel Colmar Centre',
        mealPlan: 'Café da manhã (BB)',
        destination: 'Colmar',
      },
      {
        id: 'hotel-2',
        name: 'Hotel Strasbourg Gare',
        mealPlan: 'Apenas alojamento (RO)',
        destination: 'Estrasburgo',
      },
    ],
    financials: {
      currency: 'EUR',
      totalCost: 600,
      salePrice: 800,
      pricePerPerson: 400,
      profit: 200,
      profitPercent: 25,
      taxesAndFeesTotal: 0,
      components: [
        {
          id: 'cost_h1',
          category: 'lodging',
          description: 'Hotel Colmar Centre',
          amount: 350,
          currency: 'EUR',
          quantity: 1,
        },
        {
          id: 'cost_h2',
          category: 'lodging',
          description: 'Hotel Strasbourg Gare',
          amount: 250,
          currency: 'EUR',
          quantity: 1,
        },
      ],
    },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.services.length, 2);
  assert.strictEqual(normalized.services[0].description, 'Hotel Colmar Centre');
  assert.strictEqual(normalized.services[0].amount, 350);
  assert.strictEqual(normalized.services[1].description, 'Hotel Strasbourg Gare');
  assert.strictEqual(normalized.services[1].amount, 250);
  assert.strictEqual(normalized.destinationConflict, true);
  assert.strictEqual(normalized.destination, 'Colmar / Estrasburgo');
});

// 9. Serviços adicionais
runTest('9. Serviços adicionais categorizados como services viram additional', () => {
  const legacy: PackageData = {
    financials: {
      currency: 'EUR',
      totalCost: 127,
      salePrice: 160,
      pricePerPerson: 80,
      profit: 33,
      profitPercent: 20.6,
      taxesAndFeesTotal: 0,
      components: [
        {
          id: 'srv_1',
          category: 'services',
          description: 'Bilhete 1 dia Parque Warner',
          amount: 40,
          currency: 'EUR',
          quantity: 2,
        },
        {
          id: 'srv_2',
          category: 'services',
          description: 'Bilhete Trenord Milão<->Lugano',
          notes: '07:43\t18:02',
          amount: 32,
          currency: 'EUR',
          quantity: 2,
        },
      ],
    },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.services.length, 2);
  assert.strictEqual(normalized.services[0].type, 'additional');
  assert.strictEqual(normalized.services[0].description, 'Bilhete 1 dia Parque Warner');
  assert.strictEqual(normalized.services[1].type, 'additional');
  assert.strictEqual(normalized.services[1].description, 'Bilhete Trenord Milão<->Lugano');
});

// 10. Seguro-viagem
runTest('10. Componente com menção a Seguro é classificado como insurance', () => {
  const legacy: PackageData = {
    financials: {
      currency: 'EUR',
      totalCost: 30,
      salePrice: 40,
      pricePerPerson: 20,
      profit: 10,
      profitPercent: 25,
      taxesAndFeesTotal: 0,
      components: [
        {
          id: 'srv_ins',
          category: 'services',
          description: 'Seguro-viagem',
          notes: 'Mawdy',
          amount: 15,
          currency: 'EUR',
          quantity: 2,
        },
      ],
    },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.services.length, 1);
  const s = normalized.services[0];
  assert.strictEqual(s.type, 'insurance');
  assert.strictEqual(s.description, 'Seguro-viagem');
  assert.strictEqual(s.notes, 'Mawdy');
  assert.strictEqual(s.amount, 15);
  assert.strictEqual(s.quantity, 2);
});

// 11. Transfer
runTest('11. Componente com menção a Transfer / Traslado é classificado como transfer', () => {
  const legacy: PackageData = {
    financials: {
      currency: 'EUR',
      totalCost: 360,
      salePrice: 450,
      pricePerPerson: 225,
      profit: 90,
      profitPercent: 20,
      taxesAndFeesTotal: 0,
      components: [
        {
          id: 'srv_tr1',
          category: 'services',
          description: 'Transfere ida/volta',
          amount: 360,
          currency: 'EUR',
          quantity: 1,
        },
        {
          id: 'srv_tr2',
          category: 'services',
          description: 'Traslado Aeroporto-Hotel',
          amount: 50,
          currency: 'EUR',
          quantity: 2,
        },
      ],
    },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.services.length, 2);
  assert.strictEqual(normalized.services[0].type, 'transfer');
  assert.strictEqual(normalized.services[1].type, 'transfer');
});

// 12. Componentes de impostos/taxas
runTest('12. Componente da categoria taxes é convertido para ServiceType taxes', () => {
  const legacy: PackageData = {
    financials: {
      currency: 'EUR',
      totalCost: 50,
      salePrice: 60,
      pricePerPerson: 30,
      profit: 10,
      profitPercent: 16.6,
      taxesAndFeesTotal: 50,
      components: [
        {
          id: 'tax_1',
          category: 'taxes',
          description: 'Taxa turística municipal',
          amount: 25,
          currency: 'EUR',
          quantity: 2,
        },
      ],
    },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.services.length, 1);
  assert.strictEqual(normalized.services[0].type, 'taxes');
  assert.strictEqual(normalized.services[0].amount, 25);
  assert.strictEqual(normalized.services[0].quantity, 2);
});

// 13. Outros custos
runTest('13. Componente da categoria other é convertido para ServiceType other', () => {
  const legacy: PackageData = {
    financials: {
      currency: 'EUR',
      totalCost: 40,
      salePrice: 50,
      pricePerPerson: 25,
      profit: 10,
      profitPercent: 20,
      taxesAndFeesTotal: 0,
      components: [
        {
          id: 'oth_1',
          category: 'other',
          description: 'Emissão de visto / taxa operacional',
          amount: 40,
          currency: 'EUR',
          quantity: 1,
        },
      ],
    },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.services.length, 1);
  assert.strictEqual(normalized.services[0].type, 'other');
  assert.strictEqual(normalized.services[0].amount, 40);
});

// 14. additionalInfo com texto livre
runTest('14. additionalInfo com texto livre é preservado integralmente sem virar custo estruturado', () => {
  const rawText = 'Tx.local: 0€\nTraslado Ida/Volta:\t145€\nAluguel de Carro: 48€';
  const legacy: PackageData = {
    additionalInfo: rawText,
    financials: {
      currency: 'EUR',
      totalCost: 100,
      salePrice: 120,
      pricePerPerson: 60,
      profit: 20,
      profitPercent: 16.6,
      taxesAndFeesTotal: 0,
      components: [],
    },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.additionalInfo, rawText);
  // Não deve criar componentes financeiros fantasmas
  assert.strictEqual(normalized.services.length, 0);
});

// 15. localTaxNotes
runTest('15. localTaxNotes é preservado em Quotations sem gerar custo artificial', () => {
  const legacy: QuotationData = {
    localTaxNotes: 'Tx.local: 21€',
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.localTaxNotes, 'Tx.local: 21€');
  assert.strictEqual(normalized.services.length, 0);
});

// 16. paymentConditions
runTest('16. paymentConditions é preservado em Quotations', () => {
  const legacy: QuotationData = {
    paymentConditions: 'Entrada: 530€ + restante até 10/11',
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.paymentConditions, 'Entrada: 530€ + restante até 10/11');
});

// 17. Componentes com quantidade
runTest('17. Preserva quantidade e moeda dos componentes', () => {
  const legacy: PackageData = {
    financials: {
      currency: 'EUR',
      totalCost: 160,
      salePrice: 200,
      pricePerPerson: 50,
      profit: 40,
      profitPercent: 20,
      taxesAndFeesTotal: 0,
      components: [
        {
          id: 'q_test',
          category: 'services',
          description: 'Passeio barco',
          amount: 40,
          currency: 'EUR',
          quantity: 4,
        },
      ],
    },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.services[0].quantity, 4);
  assert.strictEqual(normalized.services[0].amount, 40);
  assert.strictEqual(normalized.services[0].currency, 'EUR');
});

// 18. Componentes com moeda BRL
runTest('18. Preserva componentes com moeda BRL', () => {
  const legacy: PackageData = {
    financials: {
      currency: 'BRL',
      totalCost: 1200,
      salePrice: 1500,
      pricePerPerson: 750,
      profit: 300,
      profitPercent: 20,
      taxesAndFeesTotal: 0,
      components: [
        {
          id: 'brl_test',
          category: 'services',
          description: 'Ingresso Show',
          amount: 300,
          currency: 'BRL',
          quantity: 2,
        },
      ],
    },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.services[0].currency, 'BRL');
  assert.strictEqual(normalized.services[0].amount, 300);
});

// 19. Códigos/categorias desconhecidos
runTest('19. Categorias desconhecidas mapeiam de forma segura para other', () => {
  const legacy: PackageData = {
    financials: {
      currency: 'EUR',
      totalCost: 50,
      salePrice: 100,
      pricePerPerson: 50,
      profit: 50,
      profitPercent: 50,
      taxesAndFeesTotal: 0,
      components: [
        {
          id: 'unknown_cat',
          category: 'unknown_category_legacy' as any,
          description: 'Custo especial fornecedor',
          amount: 50,
          currency: 'EUR',
          quantity: 1,
        },
      ],
    },
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.services.length, 1);
  assert.strictEqual(normalized.services[0].type, 'other');
  assert.strictEqual(normalized.services[0].description, 'Custo especial fornecedor');
});

// 20. Dados incompletos
runTest('20. Registro vazio ou dados incompletos não disparam erro', () => {
  const normalized = normalizeLegacyToNewStructure({} as PackageData);
  assert.strictEqual(Array.isArray(normalized.services), true);
  assert.strictEqual(normalized.services.length, 0);
});

// 21. Dados conflitantes de destino
runTest('21. Múltiplos destinos diferentes sinalizam conflito sem escolha silenciosa', () => {
  const legacy: PackageData = {
    lodging: [
      { id: '1', name: 'Hotel 1', destination: 'Paris' },
      { id: '2', name: 'Hotel 2', destination: 'Nice' },
    ],
  };
  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.destinationConflict, true);
  assert.strictEqual(normalized.destination, 'Paris / Nice');
  assert.deepStrictEqual(normalized.destinationConflictDetails, ['Paris', 'Nice']);
});

// 22. Adapter não altera objeto original
runTest('22. Adapter opera em memória sem alterar o objeto original recebido', () => {
  const original: PackageData = {
    dates: { startDate: '2026-10-10', endDate: '2026-10-15' },
    lodging: [{ id: 'h1', name: 'Hotel Original', destination: 'Lisboa' }],
  };
  const originalClone = JSON.parse(JSON.stringify(original));
  normalizeLegacyToNewStructure(original);
  assert.deepStrictEqual(original, originalClone);
});

// 23. Nenhuma operação de banco é executada (verificação de pureza)
runTest('23. normalizeLegacyToNewStructure é função pura em memória', () => {
  const legacy: PackageData = {
    dates: { startDate: '2026-10-10', endDate: '2026-10-15' },
  };
  const res1 = normalizeLegacyToNewStructure(legacy);
  const res2 = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(res1.dates?.startDate, res2.dates?.startDate);
});

// 24. Nenhum dado é silenciosamente descartado
runTest('24. Nenhum dado de transporte, hotel ou componentes é descartado', () => {
  const legacy: PackageData = {
    dates: { startDate: '2026-11-23', endDate: '2026-11-26', durationDays: 4, durationNights: 3 },
    passengers: { adults: 2, children: 0, infants: 0 },
    lodging: [
      { id: 'hotel-1', name: 'Colmar Hotel', mealPlan: 'pequeno-almoço', destination: 'Colmar' },
    ],
    outboundTransport: { type: 'flight', route: 'Easyjet (OPO)' },
    inboundTransport: { type: 'flight', route: 'Easyjet (BSL)' },
    financials: {
      currency: 'EUR',
      salePrice: 1299,
      totalCost: 1138,
      profit: 161,
      profitPercent: 12.39,
      taxesAndFeesTotal: 0,
      pricePerPerson: 649.5,
      components: [
        {
          id: 'cost_h',
          category: 'lodging',
          description: 'Colmar Hotel',
          amount: 52,
          quantity: 2,
          currency: 'EUR',
        },
        {
          id: 'cost_out',
          category: 'outbound_transport',
          description: 'Easyjet (OPO)',
          notes: '07:00 - 10:30',
          amount: 52,
          quantity: 2,
          currency: 'EUR',
        },
        {
          id: 'cost_in',
          category: 'inbound_transport',
          description: 'Easyjet (BSL)',
          notes: '12:15 - 13:55',
          amount: 570,
          quantity: 1,
          currency: 'EUR',
        },
        {
          id: 'cost_tr',
          category: 'services',
          description: 'Transfere ida/volta',
          amount: 360,
          quantity: 1,
          currency: 'EUR',
        },
      ],
    },
    additionalInfo: 'Tarifa somente mochila\nTx.local: 12€',
  };

  const normalized = normalizeLegacyToNewStructure(legacy);
  assert.strictEqual(normalized.destination, 'Colmar');
  assert.strictEqual(normalized.additionalInfo, 'Tarifa somente mochila\nTx.local: 12€');
  assert.strictEqual(normalized.dates?.durationDays, 4);
  assert.strictEqual(normalized.passengers?.adults, 2);
  assert.strictEqual(normalized.financials?.salePrice, 1299);

  // Deve conter exatamente 4 serviços: ida, volta, hotel, transfer
  assert.strictEqual(normalized.services.length, 4);

  const types = normalized.services.map((s) => s.type);
  assert.strictEqual(types.includes('outbound_transport'), true);
  assert.strictEqual(types.includes('inbound_transport'), true);
  assert.strictEqual(types.includes('accommodation'), true);
  assert.strictEqual(types.includes('transfer'), true);

  const outbound = normalized.services.find((s) => s.type === 'outbound_transport')!;
  assert.strictEqual(outbound.departureTime, '07:00');
  assert.strictEqual(outbound.arrivalTime, '10:30');
  assert.strictEqual(outbound.amount, 52);
  assert.strictEqual(outbound.quantity, 2);

  const inbound = normalized.services.find((s) => s.type === 'inbound_transport')!;
  assert.strictEqual(inbound.departureTime, '12:15');
  assert.strictEqual(inbound.arrivalTime, '13:55');
  assert.strictEqual(inbound.amount, 570);

  const hotel = normalized.services.find((s) => s.type === 'accommodation')!;
  assert.strictEqual(hotel.description, 'Colmar Hotel');
  assert.strictEqual(hotel.mealPlan, 'pequeno-almoço');
  assert.strictEqual(hotel.amount, 52);
  assert.strictEqual(hotel.quantity, 2);

  const transfer = normalized.services.find((s) => s.type === 'transfer')!;
  assert.strictEqual(transfer.description, 'Transfere ida/volta');
  assert.strictEqual(transfer.amount, 360);
});

// Exemplos reais específicos adicionais do inventário
runTest('25. Exemplo real: "Carro classe económica" classificado como additional', () => {
  const sType = classifyServiceComponent('Carro classe económica');
  assert.strictEqual(sType, 'additional');
});

runTest('26. Exemplo real: "Visita guiada de 4h..." classificado como additional', () => {
  const sType = classifyServiceComponent('Visita guiada de 4h, com bilhetes, para a Sagrada Família + Parque Güell');
  assert.strictEqual(sType, 'additional');
});

console.log(`\n====================================================`);
console.log(` RESULTADO FINAL: ${testsPassed} PASSOU / ${testsFailed} FALHOU`);
console.log(`====================================================\n`);

if (testsFailed > 0) {
  process.exit(1);
}
