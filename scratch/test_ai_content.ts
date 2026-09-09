import assert from 'node:assert';
import {
  buildContentGenerationInput,
  validateStructuredContent,
  OBRIGATORIO_ITEM_INCLUSO_S23,
  OBRIGATORIO_PAGAMENTO_OBSERVACAO,
} from '../src/services/contentValidationService';
import { Package, Quotation, StructuredPackageContent } from '../src/types';

console.log('=== INICIANDO BATERIA DE TESTES DE IA E CONTEÚDO ESTRUTURADO (FASE 6A) ===\n');

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

// 1. Validação de ContentGenerationInput
runTest('1. Validação de ContentGenerationInput a partir de Quotation', () => {
  const quote: Quotation = {
    id: 'quote-test-1',
    package_id: 'pkg-1',
    reference: 'COT-2026-TEST',
    client_name: 'Cliente Teste',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      dates: { startDate: '2026-09-10', endDate: '2026-09-17', durationDays: 8 },
      lodging: [{ id: 'h1', name: 'Hotel Tivoli', destination: 'Lisboa', mealPlan: 'Café da Manhã', nights: 7 }],
      outboundTransport: { type: 'flight', route: 'Porto → Lisboa' },
      financials: { totalCost: 600, salePrice: 950, currency: 'EUR', components: [], pricePerPerson: 950, profit: 350, profitPercent: 36.84, taxesAndFeesTotal: 0 },
    },
  };

  const input = buildContentGenerationInput({ quotation: quote });
  assert.strictEqual(input.sourceType, 'quotation');
  assert.strictEqual(input.sourceId, 'quote-test-1');
  assert.strictEqual(input.destination, 'Lisboa');
  assert.strictEqual(input.salePrice, 950);
  assert.strictEqual(input.currency, 'EUR');
  assert.strictEqual(input.durationDays, 8);
  assert(input.includedServices.some((s) => s.includes('Hotel Tivoli')));
});

// 2. Validação da resposta estruturada válida
runTest('2. Validação de resposta estruturada completa e conforme', () => {
  const validAIResponse: StructuredPackageContent = {
    title: 'Lisboa Encantadora: História e Charme',
    category: 'Europa',
    excerpt: 'Descubra as ladeiras históricas e a gastronomia incrível de Lisboa.',
    slug: 'lisboa-encantadora-2026',
    price: 950,
    published: false,
    featured: false,
    subtitle: 'Uma viagem inesquecível pela capital portuguesa.',
    duracao: '8 dias',
    origem: 'Porto',
    ctaLabel: 'Quero garantir minha vaga',
    incluso: [
      { icon: 'gift', title: 'Guia exclusivo S23', desc: 'Nossas dicas práticas.' },
      { icon: 'bed', title: 'Hospedagem com café da manhã' },
    ],
    naoIncluso: ['Taxas turísticas locais'],
    sobre: {
      title: 'Sobre Lisboa',
      text: 'Lisboa é uma das cidades mais antigas da Europa ocidental...',
    },
    infoDestino: {
      localizacao: 'Portugal',
      clima: 'Mediterrânico',
      idiomaCultura: 'Português',
      documentacao: 'Passaporte válido',
    },
    pagamento: {
      observacao: OBRIGATORIO_PAGAMENTO_OBSERVACAO,
    },
    seoTitle: 'Pacote de Viagem Lisboa 2026 | S23 Viagens',
    seoDescription: 'Reserve seu pacote exclusivo para Lisboa com a S23.',
  };

  const res = validateStructuredContent(validAIResponse);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.errors.length, 0);
  assert.strictEqual(res.data?.title, 'Lisboa Encantadora: História e Charme');
});

// 3. Rejeição de resposta inválida
runTest('3. Rejeição de resposta que não seja um objeto JSON', () => {
  assert.strictEqual(validateStructuredContent(null).valid, false);
  assert.strictEqual(validateStructuredContent('string').valid, false);
  assert.strictEqual(validateStructuredContent(12345).valid, false);
  assert.strictEqual(validateStructuredContent([]).valid, false);
});

// 4. Rejeição de campos obrigatórios ausentes
runTest('4. Rejeição de campos obrigatórios ausentes (title, category, sobre, fixed item)', () => {
  // Caso A: Sem title
  const noTitle = {
    category: 'Europa',
    excerpt: 'Resumo',
    slug: 'slug-valido',
    sobre: { title: 'T', text: 'Txt' },
    incluso: [OBRIGATORIO_ITEM_INCLUSO_S23],
    pagamento: { observacao: OBRIGATORIO_PAGAMENTO_OBSERVACAO },
    seoTitle: 'SEO',
    seoDescription: 'Desc',
  };
  assert.strictEqual(validateStructuredContent(noTitle).valid, false);

  // Caso B: Sem o item fixo obrigatório S23
  const noFixedItem = {
    title: 'Titulo',
    category: 'Europa',
    excerpt: 'Resumo',
    slug: 'slug-valido',
    sobre: { title: 'T', text: 'Txt' },
    incluso: [{ title: 'Outro item' }],
    pagamento: { observacao: OBRIGATORIO_PAGAMENTO_OBSERVACAO },
    seoTitle: 'SEO',
    seoDescription: 'Desc',
  };
  const resB = validateStructuredContent(noFixedItem);
  assert.strictEqual(resB.valid, false);
  assert(resB.errors.some((e) => e.includes('Guia exclusivo S23')));

  // Caso C: Frase de pagamento divergente
  const wrongPayment = {
    title: 'Titulo',
    category: 'Europa',
    excerpt: 'Resumo',
    slug: 'slug-valido',
    sobre: { title: 'T', text: 'Txt' },
    incluso: [OBRIGATORIO_ITEM_INCLUSO_S23],
    pagamento: { observacao: 'Frase inventada pela IA' },
    seoTitle: 'SEO',
    seoDescription: 'Desc',
  };
  const resC = validateStructuredContent(wrongPayment);
  assert.strictEqual(resC.valid, false);
  assert(resC.errors.some((e) => e.includes('observação de pagamento deve ser exatamente')));
});

// 5. Proteção contra dados comerciais alterados (Preço Nível 1 Soberano)
runTest('5. Proteção contra divergência no preço comercial fornecido', () => {
  const input = {
    sourceType: 'quotation' as const,
    sourceId: '1',
    reference: 'REF-1',
    name: 'Pacote Teste',
    destination: 'Paris',
    salePrice: 1500,
    currency: 'EUR' as const,
    includedServices: [],
    notIncludedServices: [],
  };

  const aiOutputWithChangedPrice = {
    title: 'Paris Romântica',
    category: 'Europa',
    excerpt: 'Resumo',
    slug: 'paris-romantica',
    price: 2500, // Diverge dos 1500 oficiais
    sobre: { title: 'Sobre Paris', text: 'Texto' },
    incluso: [OBRIGATORIO_ITEM_INCLUSO_S23],
    pagamento: { observacao: OBRIGATORIO_PAGAMENTO_OBSERVACAO },
    seoTitle: 'SEO',
    seoDescription: 'Desc',
  };

  const res = validateStructuredContent(aiOutputWithChangedPrice, input);
  assert.strictEqual(res.valid, false);
  assert(res.errors.some((e) => e.includes('diverge do preço comercial oficial')));
});

// 6. Ausência de informações financeiras internas no input enviado à IA
runTest('6. Ausência absoluta de custos, lucros, margens e fornecedores no ContentGenerationInput', () => {
  const sensitiveQuote: Quotation = {
    id: 'quote-secret',
    package_id: 'pkg-1',
    reference: 'COT-SECRET',
    client_name: 'Cliente VIP',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: 6.25,
    exchange_rate_date: '2026-09-09',
    created_at: '',
    updated_at: '',
    data: {
      supplier: 'Fornecedor Confidencial DMC Europa',
      financials: {
        totalCost: 1200,
        profit: 800,
        profitPercent: 40,
        taxesAndFeesTotal: 100,
        currency: 'EUR',
        salePrice: 2000,
        pricePerPerson: 1000,
        components: [
          { id: 'c1', category: 'lodging', description: 'Custo B2B Hotel', amount: 1200, currency: 'EUR', quantity: 1 },
        ],
      },
    },
  };

  const input = buildContentGenerationInput({ quotation: sensitiveQuote });
  const rawInputStr = JSON.stringify(input);

  assert(!rawInputStr.includes('1200')); // Sem custo interno
  assert(!rawInputStr.includes('800'));  // Sem lucro
  assert(!rawInputStr.includes('Fornecedor Confidencial')); // Sem fornecedor
  assert(!rawInputStr.includes('Custo B2B Hotel'));
  assert(!('totalCost' in input));
  assert(!('profit' in input));
  assert(!('profitPercent' in input));
  assert(!('supplier' in input));
});

// 7. Separação Package x Quotation
runTest('7. Separação de fonte: Package x Quotation são tratados de forma independente', () => {
  const pkg: Package = {
    id: 'pkg-orig',
    reference: 'PK-ORIG',
    name: 'Pacote Base Itália',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: {
      financials: { salePrice: 1800, totalCost: 1200, currency: 'EUR', components: [], pricePerPerson: 900, profit: 600, profitPercent: 33.33, taxesAndFeesTotal: 0 },
    },
  };

  const quote: Quotation = {
    id: 'quote-derived',
    package_id: pkg.id,
    reference: 'COT-DERIVED',
    client_name: 'Cliente X',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      originPackageName: 'Pacote Base Itália',
      financials: { salePrice: 2200, totalCost: 1400, currency: 'EUR', components: [], pricePerPerson: 1100, profit: 800, profitPercent: 36.36, taxesAndFeesTotal: 0 },
    },
  };

  const inputPkg = buildContentGenerationInput({ package: pkg });
  const inputQuote = buildContentGenerationInput({ quotation: quote });

  assert.strictEqual(inputPkg.sourceType, 'package');
  assert.strictEqual(inputPkg.salePrice, 1800);

  assert.strictEqual(inputQuote.sourceType, 'quotation');
  assert.strictEqual(inputQuote.salePrice, 2200);
});

// 8. Tratamento de slug inválido
runTest('8. Rejeição de slug mal formatado (com maiúsculas, espaços ou caracteres especiais)', () => {
  const badSlug = {
    title: 'Titulo',
    category: 'Europa',
    excerpt: 'Resumo',
    slug: 'Slug Com Espaço & Acento!',
    sobre: { title: 'T', text: 'Txt' },
    incluso: [OBRIGATORIO_ITEM_INCLUSO_S23],
    pagamento: { observacao: OBRIGATORIO_PAGAMENTO_OBSERVACAO },
    seoTitle: 'SEO',
    seoDescription: 'Desc',
  };
  const res = validateStructuredContent(badSlug);
  assert.strictEqual(res.valid, false);
  assert(res.errors.some((e) => e.includes('slug')));
});

// 9. JSON estruturado válido
runTest('9. Retorno com tipos limpos e flags booleanas normalizadas', () => {
  const rawObj = {
    title: 'Grécia dos Sonhos',
    category: 'Europa',
    excerpt: 'Ilhas gregas banhadas pelo mar Egeu.',
    slug: 'grecia-dos-sonhos-2026',
    price: 3400,
    sobre: { title: 'Sobre a Grécia', text: 'Berço da civilização...' },
    incluso: [OBRIGATORIO_ITEM_INCLUSO_S23],
    pagamento: { observacao: OBRIGATORIO_PAGAMENTO_OBSERVACAO },
    seoTitle: 'Pacote Grécia 2026',
    seoDescription: 'Reserve seu pacote Grécia.',
  };

  const res = validateStructuredContent(rawObj);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.data?.published, false);
  assert.strictEqual(res.data?.featured, false);
  assert.strictEqual(res.data?.ctaLabel, 'Quero garantir minha vaga');
  assert.deepStrictEqual(res.data?.naoIncluso, []);
});

console.log(`\n=== RESULTADO: ${testsPassed} PASSOU, ${testsFailed} FALHOU ===`);
if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('🎉 TODOS OS 9 TESTES DA FASE 6A PASSARAM COM SUCESSO!\n');
}
