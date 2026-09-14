import assert from 'node:assert';
import {
  generateWhatsAppMessage,
  formatDateCommercial,
  formatPassengersText,
  formatPriceText,
  getPackageCommercialTitle,
  getWhatsAppTitle,
} from '../src/services/whatsappService';
import { Quotation, Package } from '../src/types';

console.log('=== INICIANDO BATERIA DE TESTES DO GERADOR DE WHATSAPP (FASE 5) ===\n');

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

// 1. Quotation completa com todos os campos comerciais preenchidos.
runTest('1. Quotation completa com todos os dados comerciais', () => {
  const quote: Quotation = {
    id: 'quote-101',
    package_id: 'pkg-1',
    origin_package_name: 'Maiorca Verão 2026',
    reference: 'COT-2026-001',
    client_name: 'Dra. Maria Clara',
    status: 'sent',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '2026-09-09T00:00:00Z',
    updated_at: '2026-09-09T00:00:00Z',
    data: {
      originPackageName: 'Maiorca Verão 2026',
      dates: { startDate: '2026-07-15', endDate: '2026-07-22', durationDays: 8 },
      passengers: { adults: 2, children: 1, infants: 1 },
      outboundTransport: {
        type: 'flight',
        carrier: 'TAP Air Portugal',
        route: 'Porto → Maiorca',
        departureTime: '08:30',
        arrivalTime: '11:45',
      },
      inboundTransport: {
        type: 'flight',
        carrier: 'TAP Air Portugal',
        route: 'Maiorca → Porto',
        departureTime: '18:20',
        arrivalTime: '19:40',
      },
      lodging: [
        {
          id: 'h1',
          name: 'Iberostar Selection Playa de Palma',
          destination: 'Maiorca',
          nights: 7,
          mealPlan: 'Tudo Incluído',
        },
      ],
      transferService: 'Transfer privativo aeroporto / hotel / aeroporto incluído',
      financials: {
        currency: 'EUR',
        components: [
          { id: 'c1', category: 'outbound_transport', description: 'Voo TAP', amount: 800, currency: 'EUR', quantity: 1 },
        ],
        totalCost: 1800,
        salePrice: 2850,
        pricePerPerson: 950,
        profit: 1050,
        profitPercent: 36.84,
        taxesAndFeesTotal: 50,
      },
      paymentConditions: '30% no ato da reserva + saldo até 20 dias antes da partida',
      customNotes: 'Opção com quarto vista mar e cancelamento gratuito até 30 dias antes.',
      localTaxNotes: '3,30€ por pessoa/noite a liquidar diretamente no check-in.',
      extraServicesNotes: 'Seguro viagem com cobertura de cancelamento por força maior.',
    },
  };

  const msg = generateWhatsAppMessage(quote);

  // Verificações
  assert(msg.includes('✨ Pacote S23 – Maiorca Verão 2026'));
  assert(!msg.includes('✨ Pacote S23 – Porto → Maiorca'));
  assert(msg.includes('📅 15/07/2026 a 22/07/2026'));
  assert(msg.includes('✈️ O que está incluído para 2 adultos, 1 criança e 1 bebé:'));
  assert(msg.includes('🛫 15/07/2026 – TAP Air Portugal Porto → Maiorca'));
  assert(msg.includes('⏰ Partida: 08:30 → 11:45'));
  assert(msg.includes('🛬 22/07/2026 – TAP Air Portugal Maiorca → Porto'));
  assert(msg.includes('⏰ Partida: 18:20 → 19:40'));
  assert(msg.includes('🏨 15/07/2026 – 7 noites em Iberostar Selection Playa de Palma, com Tudo Incluído.'));
  assert(msg.includes('🚗 Transfer privativo aeroporto / hotel / aeroporto incluído'));
  assert(msg.includes('💶 Total do pacote: *€ 2.850,00*'));
  assert(msg.includes('💳 Entrada: 30% no ato da reserva + saldo até 20 dias antes da partida'));
  assert(msg.includes('Opção com quarto vista mar'));
  assert(msg.includes('Taxa local a pagar diretamente na hospedagem: 3,30€ por pessoa/noite'));
  assert(msg.includes('Consulte-nos sobre serviços extra: Seguro viagem com cobertura'));
  assert(msg.includes('Até a data da contratação podem ocorrer alterações sem controle da agência.'));
});

// 2. Quotation sem hotel.
runTest('2. Quotation sem hotel omite a linha de hospedagem', () => {
  const quote: Quotation = {
    id: 'quote-2',
    reference: 'COT-2026-002',
    status: 'draft',
    currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      dates: { startDate: '2026-08-01', endDate: '2026-08-05' },
      outboundTransport: { type: 'flight', route: 'Lisboa → Madrid' },
      financials: { totalCost: 300, salePrice: 450, currency: 'EUR', components: [], pricePerPerson: 450, profit: 150, profitPercent: 33.33, taxesAndFeesTotal: 0 },
    },
    package_id: null,
    client_name: null,
    exchange_rate: null,
    exchange_rate_date: null,
  };

  const msg = generateWhatsAppMessage(quote);
  assert(!msg.includes('🏨'));
  assert(!msg.includes('noites em'));
});

// 3. Quotation sem transfer.
runTest('3. Quotation sem transfer omite a linha de transfer', () => {
  const quote: Quotation = {
    id: 'quote-3',
    reference: 'COT-2026-003',
    status: 'draft',
    currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      outboundTransport: { type: 'flight', route: 'Porto → Paris' },
      financials: { totalCost: 500, salePrice: 700, currency: 'EUR', components: [], pricePerPerson: 700, profit: 200, profitPercent: 28.57, taxesAndFeesTotal: 0 },
    },
    package_id: null,
    client_name: null,
    exchange_rate: null,
    exchange_rate_date: null,
  };

  const msg = generateWhatsAppMessage(quote);
  assert(!msg.includes('🚗'));
  assert(!msg.includes('Transfer'));
});

// 4. Quotation sem serviços extras.
runTest('4. Quotation sem serviços extras omite a linha de serviços extra', () => {
  const quote: Quotation = {
    id: 'quote-4',
    reference: 'COT-2026-004',
    status: 'draft',
    currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      outboundTransport: { type: 'flight', route: 'Faro → Londres' },
      financials: { totalCost: 400, salePrice: 600, currency: 'EUR', components: [], pricePerPerson: 600, profit: 200, profitPercent: 33.33, taxesAndFeesTotal: 0 },
    },
    package_id: null,
    client_name: null,
    exchange_rate: null,
    exchange_rate_date: null,
  };

  const msg = generateWhatsAppMessage(quote);
  assert(!msg.includes('Consulte-nos sobre serviços extra'));
});

// 5. Quotation sem condição de pagamento.
runTest('5. Quotation sem condição de pagamento omite a linha de entrada/pagamento', () => {
  const quote: Quotation = {
    id: 'quote-5',
    reference: 'COT-2026-005',
    status: 'draft',
    currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      outboundTransport: { type: 'flight', route: 'Porto → Roma' },
      financials: { totalCost: 600, salePrice: 900, currency: 'EUR', components: [], pricePerPerson: 900, profit: 300, profitPercent: 33.33, taxesAndFeesTotal: 0 },
    },
    package_id: null,
    client_name: null,
    exchange_rate: null,
    exchange_rate_date: null,
  };

  const msg = generateWhatsAppMessage(quote);
  assert(!msg.includes('💳 Entrada:'));
  assert(!msg.includes('💳'));
});

// 6. Quotation com adultos + crianças.
runTest('6. Quotation com adultos + crianças formata plural e concordância', () => {
  const quote: Quotation = {
    id: 'quote-6',
    reference: 'COT-2026-006',
    status: 'draft',
    currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      passengers: { adults: 2, children: 2, infants: 0 },
      outboundTransport: { type: 'flight', route: 'Porto → Orlando' },
      financials: { totalCost: 2000, salePrice: 3000, currency: 'EUR', components: [], pricePerPerson: 750, profit: 1000, profitPercent: 33.33, taxesAndFeesTotal: 0 },
    },
    package_id: null,
    client_name: null,
    exchange_rate: null,
    exchange_rate_date: null,
  };

  const msg = generateWhatsAppMessage(quote);
  assert(msg.includes('✈️ O que está incluído para 2 adultos e 2 crianças:'));
});

// 7. Quotation com bebés.
runTest('7. Quotation com bebés inclui o termo correto', () => {
  const quote: Quotation = {
    id: 'quote-7',
    reference: 'COT-2026-007',
    status: 'draft',
    currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      passengers: { adults: 2, children: 0, infants: 1 },
      outboundTransport: { type: 'flight', route: 'Porto → Tenerife' },
      financials: { totalCost: 800, salePrice: 1200, currency: 'EUR', components: [], pricePerPerson: 600, profit: 400, profitPercent: 33.33, taxesAndFeesTotal: 0 },
    },
    package_id: null,
    client_name: null,
    exchange_rate: null,
    exchange_rate_date: null,
  };

  const msg = generateWhatsAppMessage(quote);
  assert(msg.includes('✈️ O que está incluído para 2 adultos e 1 bebé:'));
});

// 8. Quotation em EUR.
runTest('8. Quotation em EUR formata com símbolo e emoji de euro', () => {
  const quote: Quotation = {
    id: 'quote-8',
    reference: 'COT-2026-008',
    status: 'draft',
    currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      financials: { totalCost: 1000, salePrice: 1450.50, currency: 'EUR', components: [], pricePerPerson: 725.25, profit: 450.50, profitPercent: 31.06, taxesAndFeesTotal: 0 },
    },
    package_id: null,
    client_name: null,
    exchange_rate: null,
    exchange_rate_date: null,
  };

  const msg = generateWhatsAppMessage(quote);
  assert(msg.includes('💶 Total do pacote: *€ 1.450,50*'));
});

// 9. Quotation em BRL.
runTest('9. Quotation em BRL formata com símbolo e moeda brasileira', () => {
  const quote: Quotation = {
    id: 'quote-9',
    reference: 'COT-2026-009',
    status: 'draft',
    currency: 'BRL',
    created_at: '',
    updated_at: '',
    data: {
      financials: { totalCost: 5000, salePrice: 7890.00, currency: 'BRL', components: [], pricePerPerson: 3945.00, profit: 2890, profitPercent: 36.63, taxesAndFeesTotal: 0 },
    },
    package_id: null,
    client_name: null,
    exchange_rate: null,
    exchange_rate_date: null,
  };

  const msg = generateWhatsAppMessage(quote);
  assert(msg.includes('💰 Total do pacote: *R$ 7.890,00*'));
});

// 10. Dados opcionais ausentes não geram placeholders.
runTest('10. Dados opcionais ausentes nunca geram placeholders ou strings vazias anômalas', () => {
  const quote: Quotation = {
    id: 'quote-10',
    reference: 'COT-2026-010',
    status: 'draft',
    currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {},
    package_id: null,
    client_name: null,
    exchange_rate: null,
    exchange_rate_date: null,
  };

  const msg = generateWhatsAppMessage(quote);
  assert(!msg.includes('undefined'));
  assert(!msg.includes('null'));
  assert(!msg.includes('NaN'));
  assert(!msg.includes('[hotel]'));
  assert(!msg.includes('[horário]'));
  assert(!msg.includes('[origem]'));
  assert(!msg.includes('[destino]'));
  assert(!msg.includes('[preço]'));
  assert(!msg.includes('[quantidade'));
});

// 11. Mensagem não contém lucro/margem/custos internos/fornecedores.
runTest('11. Mensagem não expõe dados internos confidenciais (lucro, margem, custo, fornecedor)', () => {
  const quote: Quotation = {
    id: 'quote-11',
    reference: 'COT-2026-011',
    status: 'draft',
    currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      supplier: 'Operador Secreto DMCs Ltd',
      financials: {
        totalCost: 1500,
        salePrice: 2500,
        pricePerPerson: 1250,
        profit: 1000,
        profitPercent: 40.0,
        taxesAndFeesTotal: 80,
        currency: 'EUR',
        components: [
          { id: 'c1', category: 'lodging', description: 'Custo Hotel B2B', amount: 1500, currency: 'EUR', quantity: 1 },
        ],
      },
    },
    package_id: 'internal-pkg-uuid-12345',
    client_name: 'Cliente Teste',
    exchange_rate: 6.20,
    exchange_rate_date: '2026-09-09',
  };

  const msg = generateWhatsAppMessage(quote);
  assert(!msg.includes('1500')); // Custo total não deve vazar
  assert(!msg.includes('1000')); // Lucro não deve vazar
  assert(!msg.includes('40.0%') && !msg.includes('40%')); // Margem não deve vazar
  assert(!msg.includes('Operador Secreto')); // Fornecedor não deve vazar
  assert(!msg.includes('internal-pkg-uuid-12345')); // ID interno não deve vazar
  assert(!msg.includes('markup'));
  assert(!msg.includes('Custo Hotel B2B'));
});

// 12. Mensagem usa os dados da quotation e não do package.
runTest('12. Mensagem usa estritamente os dados da quotation e ignora package de origem', () => {
  const quote: Quotation = {
    id: 'quote-12',
    package_id: 'pkg-999',
    reference: 'COT-2026-012',
    status: 'draft',
    currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      originPackageName: 'Pacote Original no Package',
      outboundTransport: { type: 'flight', route: 'Porto → Funchal (Customizado na Quotation)' },
      financials: { totalCost: 800, salePrice: 1100, currency: 'EUR', components: [], pricePerPerson: 1100, profit: 300, profitPercent: 27.27, taxesAndFeesTotal: 0 },
    },
    client_name: null,
    exchange_rate: null,
    exchange_rate_date: null,
  };

  const msg = generateWhatsAppMessage(quote);
  // Deve refletir a rota customizada da quotation
  assert(msg.includes('Porto → Funchal (Customizado na Quotation)'));
  assert(msg.includes('€ 1.100,00'));
});

// 13. Alteração posterior no package não altera a mensagem da quotation.
runTest('13. Alteração posterior no package não altera a mensagem da quotation (imutabilidade)', () => {
  const originalPkg = {
    id: 'pkg-base-1',
    name: 'Pacote Açores 7 Dias',
    data: {
      dates: { startDate: '2026-09-10', endDate: '2026-09-17' },
      outboundTransport: { type: 'flight', route: 'Porto → Ponta Delgada' },
      financials: { salePrice: 850, totalCost: 600, currency: 'EUR' },
    },
  };

  // Cria cotação a partir do package com snapshot independente (deep clone)
  const quotation: Quotation = {
    id: 'quote-snap-1',
    package_id: originalPkg.id,
    reference: 'COT-2026-SNAP',
    client_name: 'Ana Ribeiro',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '2026-09-09T00:00:00Z',
    updated_at: '2026-09-09T00:00:00Z',
    data: JSON.parse(JSON.stringify(originalPkg.data)),
  };

  // Gera mensagem inicial
  const msgBefore = generateWhatsAppMessage(quotation);
  assert(msgBefore.includes('€ 850,00'));
  assert(msgBefore.includes('Porto → Ponta Delgada'));

  // Modifica drasticamente o pacote de origem
  originalPkg.data.outboundTransport.route = 'Lisboa → Terceira (ALTERADO NO PACOTE)';
  originalPkg.data.financials.salePrice = 1600;

  // Gera mensagem novamente a partir da cotação
  const msgAfter = generateWhatsAppMessage(quotation);

  // A cotação permanece IDÊNTICA
  assert.strictEqual(msgBefore, msgAfter);
  assert(!msgAfter.includes('ALTERADO NO PACOTE'));
  assert(!msgAfter.includes('1.600,00'));
  assert(msgAfter.includes('€ 850,00'));
});

// 14. Valores monetários formatados corretamente.
runTest('14. Valores monetários com formatação decimal portuguesa (ponto e vírgula)', () => {
  assert.strictEqual(formatPriceText(1234.56, 'EUR'), '💶 Total do pacote: *€ 1.234,56*');
  assert.strictEqual(formatPriceText(5000, 'EUR'), '💶 Total do pacote: *€ 5.000,00*');
  assert.strictEqual(formatPriceText(9876.5, 'BRL'), '💰 Total do pacote: *R$ 9.876,50*');
});

// 15. Teste Explícito de Isolamento de Snapshot Workflow.
runTest('15. Teste Explícito de Isolamento de Snapshot Workflow', () => {
  // 1. Criar package
  const pkg: Package = {
    id: 'pkg-flow-1',
    reference: 'PK-FLOW-1',
    name: 'Grécia Clássica',
    status: 'active',
    base_currency: 'EUR',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    data: {
      dates: { startDate: '2026-06-01', endDate: '2026-06-08' },
      outboundTransport: { type: 'flight', route: 'Lisboa → Atenas', carrier: 'Aegean' },
      financials: { salePrice: 1990, totalCost: 1400, currency: 'EUR', components: [], pricePerPerson: 995, profit: 590, profitPercent: 29.65, taxesAndFeesTotal: 0 },
    },
  };

  // 2. Criar quotation a partir dele
  const quotation: Quotation = {
    id: 'quote-flow-1',
    package_id: pkg.id,
    reference: 'COT-FLOW-1',
    client_name: 'Família Santos',
    status: 'draft',
    currency: pkg.base_currency,
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    data: JSON.parse(JSON.stringify(pkg.data)),
  };

  // 3. Alterar package
  pkg.data.dates = { startDate: '2026-10-01', endDate: '2026-10-08' };
  pkg.data.outboundTransport = { type: 'flight', route: 'Lisboa → Creta' };
  if (pkg.data.financials) pkg.data.financials.salePrice = 3500;

  // 4. Gerar mensagem usando quotation
  const message = generateWhatsAppMessage(quotation);

  // 5. Confirmar que a mensagem continua refletindo a quotation original
  assert(message.includes('Lisboa → Atenas'));
  assert(message.includes('01/06/2026 a 08/06/2026'));
  assert(message.includes('€ 1.990,00'));
  assert(!message.includes('Creta'));
  assert(!message.includes('10/2026'));
  assert(!message.includes('3.500,00'));
});

console.log('\n=== TESTES ESPECÍFICOS: TÍTULO DA MENSAGEM WHATSAPP (SEM TRANSPORTE) ===\n');

// 16. Cotação vinculada a Pacote Base com transporte
runTest('16. Cotação vinculada a Pacote Base: usa nome comercial do Pacote Base e ignora transporte Easyjet (OPO)', () => {
  const quote: Quotation = {
    id: 'quote-test-1',
    package_id: 'pkg-paris-1',
    origin_package_name: 'Paris Réveillon 2027',
    reference: 'COT-2026-T1',
    client_name: 'Liliana',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      originPackageName: 'Paris Réveillon 2027',
      outboundTransport: {
        type: 'flight',
        carrier: 'Easyjet',
        route: 'Easyjet (OPO)',
      },
      lodging: [{ id: 'h1', name: 'Hotel Paris', destination: 'Paris' }],
    },
  };

  const title = getWhatsAppTitle(quote);
  assert.strictEqual(title, '✨ Pacote S23 – Paris Réveillon 2027');
  assert(!title.includes('Easyjet'));
  assert(!title.includes('OPO'));

  const msg = generateWhatsAppMessage(quote);
  assert(msg.startsWith('✨ Pacote S23 – Paris Réveillon 2027'));
  assert(!msg.includes('✨ Pacote S23 – Easyjet (OPO)'));
});

// 17. Cotação vinculada a Pacote Base com transporte diferente
runTest('17. Cotação vinculada a Pacote Base com transporte diferente continua usando nome do Pacote Base', () => {
  const quote: Quotation = {
    id: 'quote-test-2',
    package_id: 'pkg-paris-1',
    origin_package_name: 'Paris Réveillon 2027',
    reference: 'COT-2026-T2',
    client_name: 'Carlos',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      originPackageName: 'Paris Réveillon 2027',
      outboundTransport: {
        type: 'flight',
        carrier: 'TAP Air Portugal',
        route: 'Lisboa → Paris CDG (TP432)',
      },
      lodging: [{ id: 'h1', name: 'Hotel Paris', destination: 'Paris' }],
    },
  };

  const title = getWhatsAppTitle(quote);
  assert.strictEqual(title, '✨ Pacote S23 – Paris Réveillon 2027');
});

// 18. Cotação avulsa com cliente + destino
runTest('18. Cotação avulsa com cliente + destino: usa "✨ {Cliente} – {Destino}"', () => {
  const quote: Quotation = {
    id: 'quote-test-3',
    package_id: null,
    reference: 'COT-2026-T3',
    client_name: 'Liliana',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      lodging: [{ id: 'h1', name: 'Hotel Louvre', destination: 'Paris' }],
      outboundTransport: { type: 'flight', route: 'Ryanair FR1001' },
    },
  };

  const title = getWhatsAppTitle(quote);
  assert.strictEqual(title, '✨ Liliana – Paris');
  assert(!title.includes('Ryanair'));

  const msg = generateWhatsAppMessage(quote);
  assert(msg.startsWith('✨ Liliana – Paris'));
  assert(!msg.includes('✨ Liliana – Ryanair'));
});

// 19. Cotação avulsa sem cliente
runTest('19. Cotação avulsa sem cliente: usa somente "✨ {Destino}"', () => {
  const quote: Quotation = {
    id: 'quote-test-4',
    package_id: null,
    reference: 'COT-2026-T4',
    client_name: null,
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      lodging: [{ id: 'h1', name: 'Hotel Louvre', destination: 'Paris' }],
      outboundTransport: { type: 'flight', route: 'Easyjet (OPO)' },
    },
  };

  const title = getWhatsAppTitle(quote);
  assert.strictEqual(title, '✨ Paris');
  assert(!title.includes('Easyjet'));
  assert(!title.includes('OPO'));

  const msg = generateWhatsAppMessage(quote);
  assert(msg.startsWith('✨ Paris'));
});

// 20. Transporte de ida preenchido, mas sem destino: NÃO usar transporte como título
runTest('20. Transporte de ida preenchido, mas sem destino: NÃO usar transporte como título', () => {
  const quote: Quotation = {
    id: 'quote-test-5',
    package_id: null,
    reference: 'COT-2026-T5',
    client_name: null,
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      outboundTransport: { type: 'flight', route: 'Porto → Paris', carrier: 'Transavia' },
    },
  };

  const title = getWhatsAppTitle(quote);
  assert(!title.includes('Porto → Paris'));
  assert(!title.includes('Transavia'));
  assert.strictEqual(title, '✨ Pacote S23');
});

// 21. Transporte de volta preenchido: NÃO usar transporte como título
runTest('21. Transporte de volta preenchido: NÃO usar transporte como título', () => {
  const quote: Quotation = {
    id: 'quote-test-6',
    package_id: null,
    reference: 'COT-2026-T6',
    client_name: null,
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      inboundTransport: { type: 'flight', route: 'Paris → Porto', carrier: 'Air France' },
    },
  };

  const title = getWhatsAppTitle(quote);
  assert(!title.includes('Paris → Porto'));
  assert(!title.includes('Air France'));
  assert.strictEqual(title, '✨ Pacote S23');
});

// 22. Companhia aérea preenchida: NÃO usar companhia aérea no título
runTest('22. Companhia aérea preenchida: NÃO usar companhia aérea no título', () => {
  const quote: Quotation = {
    id: 'quote-test-7',
    package_id: null,
    reference: 'COT-2026-T7',
    client_name: 'Liliana',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      outboundTransport: { type: 'flight', carrier: 'Ryanair' },
      inboundTransport: { type: 'flight', carrier: 'Ryanair' },
    },
  };

  const title = getWhatsAppTitle(quote);
  assert(!title.includes('Ryanair'));
  assert.strictEqual(title, '✨ Liliana');
});

// 23. Aeroporto / IATA preenchido: NÃO usar aeroporto/IATA no título
runTest('23. Aeroporto / IATA preenchido: NÃO usar aeroporto/IATA no título', () => {
  const quote: Quotation = {
    id: 'quote-test-8',
    package_id: null,
    reference: 'COT-2026-T8',
    client_name: null,
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      outboundTransport: { type: 'flight', route: 'OPO' },
    },
  };

  const title = getWhatsAppTitle(quote);
  assert(!title.includes('OPO'));
  assert.strictEqual(title, '✨ Pacote S23');
});

// 24. Alterar transporte não altera o título de cotação vinculada a Pacote Base
runTest('24. Alterar o transporte NÃO altera o título de uma cotação vinculada a Pacote Base', () => {
  const quote: Quotation = {
    id: 'quote-test-9',
    package_id: 'pkg-roma',
    origin_package_name: 'Roma Histórica',
    reference: 'COT-2026-T9',
    client_name: 'Marcos',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      originPackageName: 'Roma Histórica',
      outboundTransport: { type: 'flight', route: 'Lisboa → Fiumicino' },
      lodging: [{ id: 'h1', name: 'Hotel Colosseum', destination: 'Roma' }],
    },
  };

  const title1 = getWhatsAppTitle(quote);
  assert.strictEqual(title1, '✨ Pacote S23 – Roma Histórica');

  // Altera transporte para outro completamente diferente
  if (quote.data.outboundTransport) {
    quote.data.outboundTransport.route = 'Easyjet (OPO) - Voo Cancelado/Alterado';
    quote.data.outboundTransport.carrier = 'Wizz Air';
  }

  const title2 = getWhatsAppTitle(quote);
  assert.strictEqual(title2, '✨ Pacote S23 – Roma Histórica');
  assert.strictEqual(title1, title2);
});

// 25. Restante da mensagem WhatsApp permanece inalterado
runTest('25. O restante da mensagem WhatsApp permanece inalterado', () => {
  const quote: Quotation = {
    id: 'quote-test-10',
    package_id: 'pkg-paris-1',
    origin_package_name: 'Paris Réveillon 2027',
    reference: 'COT-2026-T10',
    client_name: 'Liliana',
    status: 'sent',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      dates: { startDate: '2026-12-28', endDate: '2027-01-02' },
      passengers: { adults: 2, children: 0, infants: 0 },
      outboundTransport: {
        type: 'flight',
        carrier: 'Easyjet',
        route: 'Porto → Paris CDG',
        departureTime: '10:00',
        arrivalTime: '13:15',
      },
      lodging: [{ id: 'h1', name: 'Novotel Paris', destination: 'Paris', nights: 5, mealPlan: 'Café da manhã (BB)' }],
      transferService: 'Transfer privativo incluído',
      financials: {
        totalCost: 1000,
        salePrice: 1600,
        currency: 'EUR',
        components: [],
        pricePerPerson: 800,
        profit: 600,
        profitPercent: 37.5,
        taxesAndFeesTotal: 0,
      },
      paymentConditions: '50% na reserva + 50% 15 dias antes',
    },
  };

  const msg = generateWhatsAppMessage(quote);
  // Título segue a nova regra
  assert(msg.startsWith('✨ Pacote S23 – Paris Réveillon 2027'));
  // Restante da mensagem preservado
  assert(msg.includes('📅 28/12/2026 a 02/01/2027'));
  assert(msg.includes('✈️ O que está incluído para 2 adultos:'));
  assert(msg.includes('🛫 28/12/2026 – Easyjet Porto → Paris CDG'));
  assert(msg.includes('⏰ Partida: 10:00 → 13:15'));
  assert(msg.includes('🏨 28/12/2026 – 5 noites em Novotel Paris, com Café da manhã (BB).'));
  assert(msg.includes('🚗 Transfer privativo incluído'));
  assert(msg.includes('💶 Total do pacote: *€ 1.600,00*'));
  assert(msg.includes('💳 Entrada: 50% na reserva + 50% 15 dias antes'));
  assert(msg.includes('Até a data da contratação podem ocorrer alterações sem controle da agência.'));
});

console.log(`\n=== RESULTADO: ${testsPassed} PASSOU, ${testsFailed} FALHOU ===`);
if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log(`🎉 TODOS OS ${testsPassed} TESTES DO GERADOR WHATSAPP PASSARAM COM SUCESSO!\n`);
}
