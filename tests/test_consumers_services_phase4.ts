import assert from 'node:assert';
import {
  generateWhatsAppMessage,
  formatDateCommercial,
  formatPassengersText,
  formatPriceText,
  getPackageCommercialTitle,
  getWhatsAppTitle,
} from '../src/services/whatsappService';
import {
  Quotation,
  QuotationData,
  Package,
  PackageData,
  ServiceItem,
} from '../src/types';
import {
  calculateFinancialSummaryFromServices,
  createDefaultServiceItem,
  normalizeLegacyToNewStructure,
} from '../src/services/legacyAdapterService';

console.log('=== INICIANDO BATERIA DE TESTES: MIGRAÇÃO DOS CONSUMIDORES PARA services[] (FASE 4) ===\n');

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

// 1. Cotação nova com services[]
runTest('1. Cotação nova estruturada com services[] gera mensagem WhatsApp completa', () => {
  const outbound = createDefaultServiceItem('outbound_transport', 'EUR');
  outbound.description = 'Porto → Paris';
  outbound.carrier = 'Easyjet';
  outbound.departureTime = '06:30';
  outbound.arrivalTime = '09:45';

  const inbound = createDefaultServiceItem('inbound_transport', 'EUR');
  inbound.description = 'Paris → Porto';
  inbound.carrier = 'Easyjet';
  inbound.departureTime = '20:15';
  inbound.arrivalTime = '21:30';

  const hotel = createDefaultServiceItem('accommodation', 'EUR', 'Paris');
  hotel.description = 'Hotel Pullman Paris Tour Eiffel';
  hotel.mealPlan = 'Café da manhã (BB)';

  const transfer = createDefaultServiceItem('transfer', 'EUR');
  transfer.description = 'Transfer Aeroporto CDG → Hotel (Privativo)';

  const insurance = createDefaultServiceItem('insurance', 'EUR');
  insurance.description = 'Seguro-viagem Internacional Mawdy';

  const quote: Quotation = {
    id: 'q-new-1',
    reference: 'COT-2026-101',
    package_id: null,
    client_name: 'Dr. Fernando Santos',
    status: 'sent',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '2026-09-10T10:00:00Z',
    updated_at: '2026-09-10T10:00:00Z',
    data: {
      destination: 'Paris, França',
      dates: { startDate: '2026-10-10', endDate: '2026-10-15', durationDays: 6, durationNights: 5 },
      passengers: { adults: 2, children: 1, infants: 0 },
      services: [outbound, inbound, hotel, transfer, insurance],
      financials: {
        currency: 'EUR',
        components: [],
        totalCost: 1500,
        salePrice: 1950,
        pricePerPerson: 650,
        profit: 450,
        profitPercent: 23.08,
        taxesAndFeesTotal: 0,
      },
      paymentConditions: '40% entrada + saldo em até 20 dias antes',
      localTaxNotes: '5,20€ por pessoa/noite no hotel',
      customNotes: 'Quarto com vista Torre Eiffel confirmado.',
    },
  };

  const msg = generateWhatsAppMessage(quote);

  assert(msg.includes('✨ Dr. Fernando Santos – Paris, França'));
  assert(msg.includes('📅 10/10/2026 a 15/10/2026'));
  assert(msg.includes('✈️ O que está incluído para 2 adultos e 1 criança:'));
  assert(msg.includes('🛫 10/10/2026 – Easyjet Porto → Paris'));
  assert(msg.includes('⏰ Partida: 06:30 → 09:45'));
  assert(msg.includes('🛬 15/10/2026 – Easyjet Paris → Porto'));
  assert(msg.includes('⏰ Partida: 20:15 → 21:30'));
  assert(msg.includes('🏨 10/10/2026 – 5 noites em Hotel Pullman Paris Tour Eiffel, com Café da manhã (BB).'));
  assert(msg.includes('🚗 Transfer Aeroporto CDG → Hotel (Privativo)'));
  assert(msg.includes('🛡️ Seguro-viagem Internacional Mawdy'));
  assert(msg.includes('💶 Preço por pessoa: *€ 650,00*'));
  assert(msg.includes('💳 Entrada: 40% entrada + saldo em até 20 dias antes'));
  assert(msg.includes('Quarto com vista Torre Eiffel confirmado.'));
  assert(msg.includes('Taxa local a pagar diretamente na hospedagem: 5,20€ por pessoa/noite no hotel'));
  assert(msg.includes('Até a data da contratação podem ocorrer alterações sem controle da agência.'));
});

// 2. Cotação legada com adapter
runTest('2. Cotação legada com estruturas antigas gera WhatsApp idêntico via adapter', () => {
  const legacyQuote: Quotation = {
    id: 'q-leg-1',
    reference: 'COT-2026-LEG',
    package_id: null,
    client_name: 'Dra. Luísa',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      dates: { startDate: '2026-11-01', endDate: '2026-11-05', durationDays: 5, durationNights: 4 },
      passengers: { adults: 2, children: 0, infants: 0 },
      outboundTransport: { type: 'flight', carrier: 'TAP', route: 'LIS → MAD', departureTime: '09:00', arrivalTime: '11:15' },
      inboundTransport: { type: 'flight', carrier: 'TAP', route: 'MAD → LIS', departureTime: '19:00', arrivalTime: '19:15' },
      lodging: [{ id: '1', name: 'Hotel Mayorazgo Madrid', destination: 'Madrid', mealPlan: 'Café da manhã (BB)' }],
      financials: { totalCost: 600, salePrice: 850, currency: 'EUR', components: [], pricePerPerson: 425, profit: 250, profitPercent: 29.41, taxesAndFeesTotal: 0 },
    },
  };

  const msg = generateWhatsAppMessage(legacyQuote);

  assert(msg.includes('✨ Dra. Luísa – Madrid'));
  assert(msg.includes('📅 01/11/2026 a 05/11/2026'));
  assert(msg.includes('🛫 01/11/2026 – TAP LIS → MAD'));
  assert(msg.includes('⏰ Partida: 09:00 → 11:15'));
  assert(msg.includes('🛬 05/11/2026 – TAP MAD → LIS'));
  assert(msg.includes('⏰ Partida: 19:00 → 19:15'));
  assert(msg.includes('🏨 01/11/2026 – 4 noites em Hotel Mayorazgo Madrid, com Café da manhã (BB).'));
  assert(msg.includes('💶 Preço por pessoa: *€ 425,00*'));
});

// 3. Título de cotação vinculada a Pacote Base
runTest('3. Título de cotação vinculada a pacote usa o nome comercial do Pacote Base', () => {
  const quote: Quotation = {
    id: 'q-linked',
    reference: 'COT-2026-003',
    package_id: 'pkg-1',
    origin_package_name: 'Tanzânia & Zanzibar 10D',
    client_name: 'Família Rocha',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Tanzânia',
      services: [],
    },
  };

  const title = getWhatsAppTitle(quote);
  assert.strictEqual(title, '✨ Pacote S23 – Tanzânia & Zanzibar 10D');
});

// 4. Título standalone com cliente e destino
runTest('4. Título standalone com cliente e destino', () => {
  const quote: Quotation = {
    id: 'q-std',
    reference: 'COT-2026-004',
    package_id: null,
    client_name: 'Beatriz Lima',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Roma, Itália',
      services: [],
    },
  };

  const title = getWhatsAppTitle(quote);
  assert.strictEqual(title, '✨ Beatriz Lima – Roma, Itália');
});

// 5. Título sem cliente usa destino
runTest('5. Título sem cliente usa apenas o destino', () => {
  const quote: Quotation = {
    id: 'q-no-client',
    reference: 'COT-2026-005',
    package_id: null,
    client_name: null,
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Tóquio',
      services: [],
    },
  };

  const title = getWhatsAppTitle(quote);
  assert.strictEqual(title, '✨ Tóquio');
});

// 6. Título nunca usa aeroporto ou cia aérea
runTest('6. Título nunca usa aeroporto ou cia aérea como fallback', () => {
  const quote: Quotation = {
    id: 'q-no-dest',
    reference: 'COT-2026-006',
    package_id: null,
    client_name: null,
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      services: [
        {
          id: '1',
          type: 'outbound_transport',
          carrier: 'Ryanair',
          description: 'OPO → BCN (Aeroporto de Barcelona)',
          amount: 50,
          currency: 'EUR',
          quantity: 1,
        },
      ],
    },
  };

  const title = getWhatsAppTitle(quote);
  assert(!title.includes('Ryanair'));
  assert(!title.includes('OPO'));
  assert(!title.includes('BCN'));
  assert.strictEqual(title, '✨ Pacote S23');
});

// 7. Múltiplas hospedagens
runTest('7. Múltiplas hospedagens aparecem sequencialmente no WhatsApp', () => {
  const h1 = createDefaultServiceItem('accommodation', 'EUR', 'Atenas');
  h1.description = 'Hotel Royal Olympic Atenas';
  h1.mealPlan = 'Café da manhã (BB)';

  const h2 = createDefaultServiceItem('accommodation', 'EUR', 'Santorini');
  h2.description = 'Santorini Secret Suites';
  h2.mealPlan = 'Café da manhã (BB)';

  const quote: Quotation = {
    id: 'q-multi-hotel',
    reference: 'COT-2026-007',
    package_id: null,
    client_name: 'Casal Silva',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Grécia (Atenas & Santorini)',
      dates: { startDate: '2026-06-10', endDate: '2026-06-18', durationDays: 9, durationNights: 8 },
      services: [h1, h2],
      financials: { totalCost: 1800, salePrice: 2400, currency: 'EUR', components: [], pricePerPerson: 1200, profit: 600, profitPercent: 25, taxesAndFeesTotal: 0 },
    },
  };

  const msg = generateWhatsAppMessage(quote);
  assert(msg.includes('Hotel Royal Olympic Atenas'));
  assert(msg.includes('Santorini Secret Suites'));
});

// 8. Múltiplos transfers
runTest('8. Múltiplos transfers são todos incluídos na mensagem', () => {
  const t1 = createDefaultServiceItem('transfer', 'EUR');
  t1.description = 'Transfer Aeroporto → Hotel';

  const t2 = createDefaultServiceItem('transfer', 'EUR');
  t2.description = 'Transfer Hotel → Porto';

  const quote: Quotation = {
    id: 'q-multi-transfer',
    reference: 'COT-2026-008',
    package_id: null,
    client_name: 'Cliente',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Nápoles',
      services: [t1, t2],
      financials: { totalCost: 100, salePrice: 150, currency: 'EUR', components: [], pricePerPerson: 150, profit: 50, profitPercent: 33.33, taxesAndFeesTotal: 0 },
    },
  };

  const msg = generateWhatsAppMessage(quote);
  assert(msg.includes('🚗 Transfer Aeroporto → Hotel'));
  assert(msg.includes('🚗 Transfer Hotel → Porto'));
});

// 9. Impostos/taxas e Outros custos
runTest('9. Serviços adicionais, taxas e outros custos aparecem com seus respectivos emojis', () => {
  const tax = createDefaultServiceItem('taxes', 'EUR');
  tax.description = 'Taxa de turismo de Lisboa';

  const extra = createDefaultServiceItem('additional', 'EUR');
  extra.description = 'Passeio de barco no Tejo ao pôr do sol';

  const other = createDefaultServiceItem('other', 'EUR');
  other.description = 'Chip e-SIM Internacional 10GB';

  const quote: Quotation = {
    id: 'q-misc',
    reference: 'COT-2026-009',
    package_id: null,
    client_name: 'Turista',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Lisboa',
      services: [tax, extra, other],
      financials: { totalCost: 120, salePrice: 180, currency: 'EUR', components: [], pricePerPerson: 180, profit: 60, profitPercent: 33.33, taxesAndFeesTotal: 20 },
    },
  };

  const msg = generateWhatsAppMessage(quote);
  assert(msg.includes('🏛️ Taxa de turismo de Lisboa'));
  assert(msg.includes('🎫 Passeio de barco no Tejo ao pôr do sol'));
  assert(msg.includes('📦 Chip e-SIM Internacional 10GB'));
});

// 10. Destino comercial independente da hospedagem
runTest('10. Destino comercial no WhatsApp é extraído de data.destination e não de hotel.destination', () => {
  const hotel = createDefaultServiceItem('accommodation', 'EUR', 'Bagnolet');
  hotel.description = 'Hotel Ibis Budget Bagnolet';

  const quote: Quotation = {
    id: 'q-dest-test',
    reference: 'COT-2026-010',
    package_id: null,
    client_name: 'Viajante',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Paris', // Destino comercial de alto nível
      services: [hotel],
      financials: { totalCost: 300, salePrice: 400, currency: 'EUR', components: [], pricePerPerson: 400, profit: 100, profitPercent: 25, taxesAndFeesTotal: 0 },
    },
  };

  const title = getWhatsAppTitle(quote);
  assert.strictEqual(title, '✨ Viajante – Paris');
});

// 11. Formatação de preços em BRL
runTest('11. Mensagem WhatsApp com moeda BRL formata corretamente', () => {
  const quote: Quotation = {
    id: 'q-brl',
    reference: 'COT-2026-011',
    package_id: null,
    client_name: 'Cliente BR',
    status: 'draft',
    currency: 'BRL',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Gramado',
      services: [],
      financials: { totalCost: 2000, salePrice: 3200.50, currency: 'BRL', components: [], pricePerPerson: 1600.25, profit: 1200.50, profitPercent: 37.5, taxesAndFeesTotal: 0 },
    },
  };

  const msg = generateWhatsAppMessage(quote);
  assert(msg.includes('💰 Preço por pessoa: *R$ 1.600,25*'));
});

// 12. Confidencialidade
runTest('12. Nenhum custo, margem ou fornecedor vaza na mensagem do WhatsApp', () => {
  const service = createDefaultServiceItem('accommodation', 'EUR');
  service.description = 'Hotel Teste';
  service.amount = 450; // Custo de 450 não deve aparecer

  const quote: Quotation = {
    id: 'q-secret',
    reference: 'COT-2026-012',
    package_id: null,
    client_name: 'Cliente Seguro',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Milão',
      supplier: 'Fornecedor Confidencial DMC',
      services: [service],
      financials: { totalCost: 450, salePrice: 700, currency: 'EUR', components: [], pricePerPerson: 700, profit: 250, profitPercent: 35.71, taxesAndFeesTotal: 0 },
    },
  };

  const msg = generateWhatsAppMessage(quote);
  assert(!msg.includes('450'));
  assert(!msg.includes('250'));
  assert(!msg.includes('35.71%'));
  assert(!msg.includes('Fornecedor Confidencial'));
  assert(msg.includes('€ 700,00'));
});

console.log(`\n=== FIM DOS TESTES DA FASE 4: ${testsPassed} PASSARAM, ${testsFailed} FALHARAM ===\n`);

if (testsFailed > 0) {
  process.exit(1);
}
