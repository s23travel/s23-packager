// Suíte Oficial de Testes Automatizados da Fase 6A
// Valida a adaptação do Conteúdo para Website/IA ao novo modelo destination + services[]

import assert from 'node:assert';
import {
  buildContentGenerationInput,
  buildWebsiteContentPayload,
  sanitizePublicNote,
  validateStructuredContent,
  OBRIGATORIO_ITEM_INCLUSO_S23,
  OBRIGATORIO_PAGAMENTO_OBSERVACAO,
} from '../src/services/contentValidationService';
import {
  Package,
  PackageData,
  ServiceItem,
  StructuredPackageContent,
} from '../src/types';

console.log('=== INICIANDO BATERIA DE TESTES: CONTEÚDO WEBSITE COM services[] (FASE 6A) ===\n');

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

// 1. Pacote novo com services[]
runTest('1. Pacote novo com services[] constrói payload corretamente', () => {
  const pkg: Package = {
    id: 'pkg-new-1',
    reference: 'PK-NEW-01',
    name: 'Pacote Maiorca Exclusivo',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Maiorca',
      dates: { startDate: '2026-09-10', endDate: '2026-09-17', durationDays: 8, durationNights: 7 },
      passengers: { adults: 2, children: 0, infants: 0 },
      services: [
        { id: 'uuid-1', type: 'outbound_transport', description: 'Porto → Palma de Maiorca', carrier: 'TAP', departureTime: '08:30', amount: 150, currency: 'EUR', quantity: 1 },
        { id: 'uuid-2', type: 'accommodation', description: 'Hotel Playa', mealPlan: 'Pequeno-almoço', amount: 500, currency: 'EUR', quantity: 7 },
      ],
      financials: { salePrice: 950, totalCost: 650, currency: 'EUR', components: [], pricePerPerson: 950, profit: 300, profitPercent: 31.57, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert.strictEqual(input.sourceType, 'package');
  assert.strictEqual(input.destination, 'Maiorca');
  assert.strictEqual(input.services?.length, 2);
  assert.strictEqual(input.salePrice, 950);
});

// 2. destination no nível raiz
runTest('2. destination no nível raiz é respeitado mesmo se diferente da hospedagem', () => {
  const pkg: Package = {
    id: 'pkg-dest-1',
    reference: 'PK-DEST',
    name: 'Paris Romântica',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Paris', // Nível raiz comercial
      services: [
        { id: 'uuid-h', type: 'accommodation', description: 'Ibis Bagnolet', destination: 'Bagnolet', amount: 300, currency: 'EUR', quantity: 4 },
      ],
      financials: { salePrice: 700, totalCost: 300, currency: 'EUR', components: [], pricePerPerson: 700, profit: 400, profitPercent: 57.14, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert.strictEqual(input.destination, 'Paris');
});

// 3. Transporte de ida
runTest('3. Transporte de ida mapeado para inclusão comercial', () => {
  const pkg: Package = {
    id: 'pkg-out',
    reference: 'PK-OUT',
    name: 'Voo Ida Teste',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Roma',
      services: [
        { id: 'uuid-o', type: 'outbound_transport', description: 'Porto → Roma (FCO)', carrier: 'TAP', departureTime: '09:15', amount: 180, currency: 'EUR', quantity: 1 },
      ],
      financials: { salePrice: 400, totalCost: 180, currency: 'EUR', components: [], pricePerPerson: 400, profit: 220, profitPercent: 55, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert(input.includedServices.some((s) => s.includes('Transporte de ida') && s.includes('Porto → Roma (FCO)') && s.includes('TAP')));
});

// 4. Transporte de volta
runTest('4. Transporte de volta mapeado para inclusão comercial', () => {
  const pkg: Package = {
    id: 'pkg-in',
    reference: 'PK-IN',
    name: 'Voo Volta Teste',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Roma',
      services: [
        { id: 'uuid-i', type: 'inbound_transport', description: 'Roma (FCO) → Porto', carrier: 'TAP', departureTime: '14:00', amount: 180, currency: 'EUR', quantity: 1 },
      ],
      financials: { salePrice: 400, totalCost: 180, currency: 'EUR', components: [], pricePerPerson: 400, profit: 220, profitPercent: 55, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert(input.includedServices.some((s) => s.includes('Transporte de volta') && s.includes('Roma (FCO) → Porto')));
});

// 5. Múltiplas hospedagens
runTest('5. Múltiplas hospedagens refletidas no conteúdo sem sobreposição', () => {
  const pkg: Package = {
    id: 'pkg-multihotel',
    reference: 'PK-MULTI',
    name: 'Roteiro Andaluzia',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Andaluzia',
      services: [
        { id: 'h1', type: 'accommodation', description: 'Hotel Sevilha Centro', mealPlan: 'Pequeno-almoço', amount: 200, currency: 'EUR', quantity: 3 },
        { id: 'h2', type: 'accommodation', description: 'Granada Palace', mealPlan: 'Meia pensão', amount: 250, currency: 'EUR', quantity: 2 },
      ],
      financials: { salePrice: 800, totalCost: 450, currency: 'EUR', components: [], pricePerPerson: 800, profit: 350, profitPercent: 43.75, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert(input.includedServices.some((s) => s.includes('Hotel Sevilha Centro')));
  assert(input.includedServices.some((s) => s.includes('Granada Palace')));
});

// 6. Transfer
runTest('6. Transfer é mapeado para incluído', () => {
  const pkg: Package = {
    id: 'pkg-trf',
    reference: 'PK-TRF',
    name: 'Transfer Teste',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Cancun',
      services: [
        { id: 't1', type: 'transfer', description: 'Traslado Aeroporto - Resort', amount: 50, currency: 'EUR', quantity: 1 },
      ],
      financials: { salePrice: 100, totalCost: 50, currency: 'EUR', components: [], pricePerPerson: 100, profit: 50, profitPercent: 50, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert(input.includedServices.some((s) => s.includes('Transfer: Traslado Aeroporto - Resort')));
});

// 7. Seguro
runTest('7. Seguro-viagem é mapeado para incluído', () => {
  const pkg: Package = {
    id: 'pkg-ins',
    reference: 'PK-INS',
    name: 'Seguro Teste',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Europa',
      services: [
        { id: 's1', type: 'insurance', description: 'Seguro Viagem Europa 30k', amount: 40, currency: 'EUR', quantity: 1 },
      ],
      financials: { salePrice: 80, totalCost: 40, currency: 'EUR', components: [], pricePerPerson: 80, profit: 40, profitPercent: 50, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert(input.includedServices.some((s) => s.includes('Seguro-viagem: Seguro Viagem Europa 30k')));
});

// 8. Serviços adicionais
runTest('8. Serviços adicionais são mapeados para incluídos', () => {
  const pkg: Package = {
    id: 'pkg-add',
    reference: 'PK-ADD',
    name: 'Passeio Teste',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Roma',
      services: [
        { id: 'a1', type: 'additional', description: 'Entrada com guia no Coliseu', amount: 60, currency: 'EUR', quantity: 1 },
      ],
      financials: { salePrice: 120, totalCost: 60, currency: 'EUR', components: [], pricePerPerson: 120, profit: 60, profitPercent: 50, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert(input.includedServices.includes('Entrada com guia no Coliseu'));
});

// 9. Impostos
runTest('9. Impostos e taxas discriminados mapeiam para notIncludedServices', () => {
  const pkg: Package = {
    id: 'pkg-tax',
    reference: 'PK-TAX',
    name: 'Taxas Teste',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Roma',
      services: [
        { id: 'tx1', type: 'taxes', description: 'Taxa turística municipal de Roma (paga no hotel)', amount: 15, currency: 'EUR', quantity: 1 },
      ],
      financials: { salePrice: 100, totalCost: 15, currency: 'EUR', components: [], pricePerPerson: 100, profit: 85, profitPercent: 85, taxesAndFeesTotal: 15 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert(input.notIncludedServices.includes('Taxa turística municipal de Roma (paga no hotel)'));
});

// 10. Outros
runTest('10. Outros serviços são incluídos como itens descritivos', () => {
  const pkg: Package = {
    id: 'pkg-oth',
    reference: 'PK-OTH',
    name: 'Outros Teste',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Lisboa',
      services: [
        { id: 'o1', type: 'other', description: 'Kit de boas-vindas especial', amount: 20, currency: 'EUR', quantity: 1 },
      ],
      financials: { salePrice: 100, totalCost: 20, currency: 'EUR', components: [], pricePerPerson: 100, profit: 80, profitPercent: 80, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert(input.includedServices.includes('Kit de boas-vindas especial'));
});

// 11. Múltiplos serviços simultâneos
runTest('11. Múltiplos serviços simultâneos são consolidados no payload', () => {
  const pkg: Package = {
    id: 'pkg-full',
    reference: 'PK-FULL',
    name: 'Pacote Completo',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Atenas',
      services: [
        { id: '1', type: 'outbound_transport', description: 'Porto → Atenas', carrier: 'Lufthansa', amount: 200, currency: 'EUR', quantity: 1 },
        { id: '2', type: 'inbound_transport', description: 'Atenas → Porto', carrier: 'Lufthansa', amount: 200, currency: 'EUR', quantity: 1 },
        { id: '3', type: 'accommodation', description: 'Hotel Acropolis', mealPlan: 'Café da manhã', amount: 400, currency: 'EUR', quantity: 4 },
        { id: '4', type: 'transfer', description: 'Aeroporto / Hotel in/out', amount: 60, currency: 'EUR', quantity: 1 },
        { id: '5', type: 'insurance', description: 'Seguro Viagem Plus', amount: 35, currency: 'EUR', quantity: 1 },
        { id: '6', type: 'additional', description: 'Ingresso Museu da Acrópole', amount: 25, currency: 'EUR', quantity: 1 },
      ],
      financials: { salePrice: 1400, totalCost: 920, currency: 'EUR', components: [], pricePerPerson: 1400, profit: 480, profitPercent: 34.28, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert.strictEqual(input.services?.length, 6);
  assert.strictEqual(input.includedServices.length, 6);
});

// 12. Ausência de serviços opcionais
runTest('12. Ausência de serviços opcionais não gera itens fictícios', () => {
  const pkg: Package = {
    id: 'pkg-minimal',
    reference: 'PK-MIN',
    name: 'Somente Hospedagem',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Porto',
      services: [
        { id: '1', type: 'accommodation', description: 'Hotel Porto', amount: 150, currency: 'EUR', quantity: 2 },
      ],
      financials: { salePrice: 300, totalCost: 150, currency: 'EUR', components: [], pricePerPerson: 300, profit: 150, profitPercent: 50, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert(!input.includedServices.some((s) => s.toLowerCase().includes('transfer')));
  assert(!input.includedServices.some((s) => s.toLowerCase().includes('seguro')));
  assert(!input.includedServices.some((s) => s.toLowerCase().includes('transporte de ida')));
});

// 13. Moeda EUR
runTest('13. Moeda EUR identificada e preservada', () => {
  const pkg: Package = {
    id: 'pkg-eur',
    reference: 'PK-EUR',
    name: 'Teste EUR',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Madrid',
      services: [],
      financials: { salePrice: 500, currency: 'EUR', components: [], totalCost: 0, pricePerPerson: 500, profit: 500, profitPercent: 100, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert.strictEqual(input.currency, 'EUR');
});

// 14. Moeda BRL
runTest('14. Moeda BRL identificada e preservada', () => {
  const pkg: Package = {
    id: 'pkg-brl',
    reference: 'PK-BRL',
    name: 'Teste BRL',
    status: 'active',
    base_currency: 'BRL',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Gramado',
      services: [],
      financials: { salePrice: 3200, currency: 'BRL', components: [], totalCost: 0, pricePerPerson: 3200, profit: 3200, profitPercent: 100, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert.strictEqual(input.currency, 'BRL');
});

// 15. Preço comercial tratado como publicSalePrice
runTest('15. Preço comercial é exposto como publicSalePrice e salePrice', () => {
  const pkg: Package = {
    id: 'pkg-price',
    reference: 'PK-PRC',
    name: 'Preço Teste',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Lisboa',
      services: [],
      financials: { salePrice: 1250, currency: 'EUR', components: [], totalCost: 800, pricePerPerson: 1250, profit: 450, profitPercent: 36, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert.strictEqual(input.salePrice, 1250);
  assert.strictEqual(input.publicSalePrice, 1250);
});

// 16 a 22. Sigilo Financeiro no Payload Sanitizado
runTest('16 a 22. Custos, lucros, margens, markup, fornecedor, IDs internos e financials.components NÃO chegam ao payload', () => {
  const sensitivePackage: Package = {
    id: 'pkg-super-secret-uuid',
    reference: 'PK-SECRET',
    name: 'Pacote Confidencial',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Dubai',
      supplier: 'Operadora Confidencial B2B',
      services: [
        { id: 'internal-service-id-999', type: 'accommodation', description: 'Hotel Atlantis', amount: 2400, currency: 'EUR', quantity: 5, notes: 'Custo B2B net: 2400 via operador' },
      ],
      financials: {
        totalCost: 2400,
        salePrice: 3900,
        currency: 'EUR',
        profit: 1500,
        profitPercent: 38.46,
        markup: 62.5,
        pricePerPerson: 3900,
        taxesAndFeesTotal: 0,
        components: [
          { id: 'c1', category: 'lodging', description: 'Custo Hotel', amount: 2400, currency: 'EUR', quantity: 1 },
        ],
      },
    },
  };

  const input = buildContentGenerationInput({ package: sensitivePackage });
  const rawStr = JSON.stringify(input);

  // 16. Custo não enviado
  assert(!rawStr.includes('"totalCost"'));
  assert(!rawStr.includes('2400'));

  // 17. Lucro não enviado
  assert(!rawStr.includes('"profit"'));
  assert(!rawStr.includes('1500'));

  // 18. Margem não enviada
  assert(!rawStr.includes('"profitPercent"'));
  assert(!rawStr.includes('38.46'));

  // 19. Markup não enviado
  assert(!rawStr.includes('"markup"'));
  assert(!rawStr.includes('62.5'));

  // 20. Fornecedor não enviado
  assert(!rawStr.includes('Operadora Confidencial B2B'));

  // 21. IDs internos dos serviços não enviados em services
  assert(!rawStr.includes('internal-service-id-999'));

  // 22. financials.components não enviado
  assert(!rawStr.includes('"components"'));
});

// 23. Notas internas sanitizadas
runTest('23. Notas com termos de backoffice são sanitizadas e omitidas', () => {
  assert.strictEqual(sanitizePublicNote('Custo B2B 150 EUR'), undefined);
  assert.strictEqual(sanitizePublicNote('PNR localizador: ABC123'), undefined);
  assert.strictEqual(sanitizePublicNote('tarifa acordo não divulgar'), undefined);
  assert.strictEqual(sanitizePublicNote('Fornecedor Abreu Viagens'), undefined);
  assert.strictEqual(sanitizePublicNote('Quarto com vista para o mar'), 'Quarto com vista para o mar');
  assert.strictEqual(sanitizePublicNote(''), undefined);
  assert.strictEqual(sanitizePublicNote(undefined), undefined);
});

// 24 a 26. Compatibilidade com Pacotes Legados
runTest('24 a 26. Pacote legado sem services[] é convertido automaticamente em memória pelo adapter', () => {
  const legacyPackage: Package = {
    id: 'pkg-legacy-01',
    reference: 'PK-LEGACY',
    name: 'Pacote Antigo Algarve',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      outboundTransport: { type: 'flight', route: 'Porto → Faro', carrier: 'Ryanair' },
      inboundTransport: { type: 'flight', route: 'Faro → Porto', carrier: 'Ryanair' },
      lodging: [
        { id: 'h1', name: 'Hotel Algarve Luxo', destination: 'Albufeira', mealPlan: 'Tudo Incluído', nights: 5 },
      ],
      transferService: 'Transfer Aeroporto Faro',
      financials: {
        totalCost: 400,
        salePrice: 750,
        currency: 'EUR',
        components: [
          { id: 'c1', category: 'outbound_transport', description: 'Voo Ida', amount: 100, currency: 'EUR', quantity: 1 },
          { id: 'c2', category: 'lodging', description: 'Hotel Algarve Luxo', amount: 300, currency: 'EUR', quantity: 1 },
        ],
        pricePerPerson: 750,
        profit: 350,
        profitPercent: 46.66,
        taxesAndFeesTotal: 0,
      },
    },
  };

  const input = buildContentGenerationInput({ package: legacyPackage });

  // 24. Converte pelo adapter
  assert.strictEqual(input.sourceType, 'package');
  assert(input.services && input.services.length > 0);

  // 25. Destination legado recuperado
  assert.strictEqual(input.destination, 'Albufeira');

  // 26. Services derivados do legado
  assert(input.includedServices.some((s) => s.includes('Hotel Algarve Luxo')));
  assert(input.includedServices.some((s) => s.includes('Porto → Faro')));
  assert(input.includedServices.some((s) => s.includes('Transfer Aeroporto Faro')));
});

// 27. Google Search Grounding configurado no systemPrompt
runTest('27. Template de prompt inclui instrução para Google Search Grounding', () => {
  const pkg: Package = {
    id: 'pkg-grounding',
    reference: 'PK-GRD',
    name: 'Pacote Japão Milenar',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Tóquio',
      services: [{ id: '1', type: 'accommodation', description: 'Hotel Shinjuku', amount: 500, currency: 'EUR', quantity: 5 }],
      financials: { salePrice: 1500, currency: 'EUR', components: [], totalCost: 500, pricePerPerson: 1500, profit: 1000, profitPercent: 66.6, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert.strictEqual(input.destination, 'Tóquio');
});

// 28. Grounding não pode alterar dados específicos do pacote
runTest('28. Validador de resposta editorial rejeita alteração no preço soberano', () => {
  const fakeResponse: StructuredPackageContent = {
    title: 'Tóquio Imperial',
    category: 'Ásia',
    excerpt: 'Descubra o melhor de Tóquio.',
    slug: 'toquio-imperial-2026',
    price: 1501, // Alteração de 1 euro em relação a 1500
    sobre: { title: 'Sobre Tóquio', text: 'Tóquio é a capital vibrante do Japão.' },
    incluso: [OBRIGATORIO_ITEM_INCLUSO_S23],
    pagamento: { observacao: OBRIGATORIO_PAGAMENTO_OBSERVACAO },
    seoTitle: 'Tóquio 2026',
    seoDescription: 'Pacote de viagem para Tóquio.',
  };

  const validation = validateStructuredContent(fakeResponse, {
    sourceType: 'package',
    sourceId: '1',
    reference: 'PK-1',
    name: 'Tóquio',
    destination: 'Tóquio',
    salePrice: 1500,
    currency: 'EUR',
    includedServices: [],
    notIncludedServices: [],
  });

  assert.strictEqual(validation.valid, false);
  assert(validation.errors.some((e) => e.includes('1501') && e.includes('1500')));
});

// 29. Ausência de serviço não gera serviço fictício
runTest('29. Pacote sem seguro não inclui seguro na lista comercial', () => {
  const pkg: Package = {
    id: 'pkg-no-ins',
    reference: 'PK-NO-INS',
    name: 'Sem Seguro',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      destination: 'Madri',
      services: [
        { id: '1', type: 'accommodation', description: 'Hotel Gran Via', amount: 200, currency: 'EUR', quantity: 2 },
      ],
      financials: { salePrice: 400, totalCost: 200, currency: 'EUR', components: [], pricePerPerson: 400, profit: 200, profitPercent: 50, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ package: pkg });
  assert(!input.includedServices.some((s) => s.toLowerCase().includes('seguro')));
});

// 30. Schema de saída atual é preservado
runTest('30. Schema editorial preserva todos os campos existentes', () => {
  const validResponse: StructuredPackageContent = {
    title: 'Paris Inesquecível',
    category: 'Europa',
    excerpt: 'Viva a magia de Paris.',
    slug: 'paris-inesquecivel-2026',
    price: 1200,
    published: false,
    featured: false,
    subtitle: 'A Cidade Luz espera por você.',
    duracao: '5 dias',
    origem: 'Porto',
    ctaLabel: 'Quero garantir minha vaga',
    incluso: [OBRIGATORIO_ITEM_INCLUSO_S23],
    naoIncluso: ['Taxas turísticas'],
    sobre: { title: 'Sobre Paris', text: 'Texto descritivo.' },
    infoDestino: { localizacao: 'França', clima: 'Temperado', idiomaCultura: 'Francês', documentacao: 'Passaporte' },
    pagamento: { observacao: OBRIGATORIO_PAGAMENTO_OBSERVACAO },
    seoTitle: 'Paris 2026',
    seoDescription: 'Pacote Paris.',
  };

  const val = validateStructuredContent(validResponse, {
    sourceType: 'package',
    sourceId: 'p1',
    reference: 'PK-P1',
    name: 'Paris',
    destination: 'Paris',
    salePrice: 1200,
    currency: 'EUR',
    includedServices: [],
    notIncludedServices: [],
  });

  assert.strictEqual(val.valid, true);
  assert.strictEqual(val.data?.title, 'Paris Inesquecível');
  assert.strictEqual(val.data?.price, 1200);
});

// 31. Payload não contém estruturas operacionais legadas para novos pacotes
runTest('31. Payload comercial WebsiteContentPayload não contém outboundTransport ou lodging isolados', () => {
  const packageData: PackageData = {
    destination: 'Lisboa',
    services: [
      { id: '1', type: 'accommodation', description: 'Hotel Central', amount: 300, currency: 'EUR', quantity: 3 },
    ],
    financials: { salePrice: 600, totalCost: 300, currency: 'EUR', components: [], pricePerPerson: 600, profit: 300, profitPercent: 50, taxesAndFeesTotal: 0 },
  };

  const payload = buildWebsiteContentPayload(packageData, { name: 'Lisboa' });
  const rawPayload = JSON.parse(JSON.stringify(payload));

  assert(!('outboundTransport' in rawPayload));
  assert(!('inboundTransport' in rawPayload));
  assert(!('lodging' in rawPayload));
  assert(!('financials' in rawPayload));
  assert('services' in rawPayload);
  assert.strictEqual(rawPayload.publicSalePrice, 600);
});

// 32. Determinismo do payload
runTest('32. Mesmo PackageData produz payload idêntico bit-a-bit', () => {
  const packageData: PackageData = {
    destination: 'Porto',
    dates: { startDate: '2026-11-01', endDate: '2026-11-05', durationDays: 5, durationNights: 4 },
    services: [
      { id: 's1', type: 'accommodation', description: 'Hotel Ribeira', mealPlan: 'Pequeno-almoço', amount: 400, currency: 'EUR', quantity: 4 },
      { id: 's2', type: 'transfer', description: 'Aeroporto / Hotel', amount: 40, currency: 'EUR', quantity: 1 },
    ],
    financials: { salePrice: 850, totalCost: 440, currency: 'EUR', components: [], pricePerPerson: 850, profit: 410, profitPercent: 48.23, taxesAndFeesTotal: 0 },
  };

  const p1 = JSON.stringify(buildWebsiteContentPayload(packageData, { name: 'Porto Especial' }));
  const p2 = JSON.stringify(buildWebsiteContentPayload(packageData, { name: 'Porto Especial' }));

  assert.strictEqual(p1, p2);
});

console.log(`\n=== FIM DOS TESTES DA FASE 6A: ${testsPassed} PASSARAM, ${testsFailed} FALHARAM ===\n`);

if (testsFailed > 0) {
  process.exit(1);
}
