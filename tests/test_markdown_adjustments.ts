import assert from 'node:assert';
import { Package, StructuredPackageContent } from '../src/types';
import {
  generatePackageMarkdown,
  S23_OBLIGATORY_PAYMENT_NOTE,
  S23_DESTINATION_DISCLAIMER,
  appendDestinationDisclaimer,
  sanitizePublicMarkdownContent,
} from '../src/services/markdownService';
import { validatePackageMarkdown } from '../src/services/markdownValidationService';
import { validateStructuredContent, buildContentGenerationInput } from '../src/services/contentValidationService';
import { generateWhatsAppMessage } from '../src/services/whatsappService';

console.log('====================================================');
console.log(' TESTES: AJUSTE DO GERADOR DE MARKDOWN E CONTEÚDO S23');
console.log('====================================================\n');

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

// -------------------------------------------------------------
// TESTE 1: SalePrice = €1.699 | PricePerPerson = €849,50
// Resultado: Markdown utiliza 849,50 €.
// -------------------------------------------------------------
runTest('TESTE 1: Preço no Markdown utiliza SEMPRE pricePerPerson (849,50 €) e não salePrice (1.699,00 €)', () => {
  const pkgData = {
    destination: 'Viena',
    services: [
      {
        id: 'svc-1',
        type: 'accommodation' as const,
        description: 'Hotel Central',
        amount: 800,
        currency: 'EUR' as const,
        quantity: 1,
      },
    ],
    financials: {
      salePrice: 1699,
      pricePerPerson: 849.5,
      totalCost: 800,
      currency: 'EUR' as const,
      profit: 899,
      profitPercent: 52.9,
      taxesAndFeesTotal: 0,
      components: [],
    },
  };

  // Preço público consumido pelo gerador / estruturado
  const sovereignPrice = pkgData.financials.pricePerPerson;

  const content: StructuredPackageContent = {
    title: 'Viena Imperial 2026',
    category: 'Europa',
    excerpt: 'Descubra a grandiosidade de Viena.',
    slug: 'viena-imperial-2026',
    price: sovereignPrice,
    published: false,
    featured: false,
    sobre: {
      title: 'Sobre Viena',
      text: appendDestinationDisclaimer('Viena é uma cidade fabulosa com palácios lendários.'),
    },
    incluso: [
      { icon: 'gift', title: 'Guia exclusivo S23', desc: 'Nossas dicas práticas.' },
    ],
    naoIncluso: [],
    pagamento: {
      observacao: S23_OBLIGATORY_PAYMENT_NOTE,
    },
    seoTitle: 'Pacote Viena 2026',
    seoDescription: 'Reserve seu pacote para Viena com a S23 Viagens.',
  };

  const md = generatePackageMarkdown(content, { packageData: pkgData });

  // Valida que o preço no Markdown é 849.50 e NÃO 1699
  assert(md.includes('price: 849.5') || md.includes('price: "849.50 €"') || md.includes('849,50 €') || md.includes('849.5'), 'Markdown deve conter 849.5');
  assert(!md.includes('1699') && !md.includes('1.699'), 'Markdown NÃO pode conter 1699 ou 1.699');
});

// -------------------------------------------------------------
// TESTE 2: Alterar manualmente a observação de pagamento.
// Resultado: Texto alterado é persistido e reaparece após carregar o conteúdo.
// -------------------------------------------------------------
runTest('TESTE 2: Observação de pagamento editada manualmente é persistida e reaparece após recarregar', () => {
  // Simulação de banco em memória
  let persistedDatabase: Record<string, any> = {};

  const pkgId = 'pkg-vienna-001';
  const customNote = 'Entrada de 30% + saldo em até 10x sem juros no cartão. Quarto duplo.';

  // Conteúdo com edição manual pelo operador
  const editedContent: StructuredPackageContent = {
    title: 'Viena Imperial',
    category: 'Europa',
    excerpt: 'Resumo.',
    slug: 'viena-imperial',
    price: 849.5,
    sobre: { title: 'Sobre', text: appendDestinationDisclaimer('Texto.') },
    incluso: [{ icon: 'gift', title: 'Guia exclusivo S23', desc: 'Dicas' }],
    pagamento: {
      observacao: customNote,
    },
    seoTitle: 'SEO Title',
    seoDescription: 'SEO Desc',
  };

  // 1. Validação no salvamento permite observação editada
  const validation = validateStructuredContent(editedContent, undefined, { allowCustomPaymentNote: true });
  assert.strictEqual(validation.valid, true);

  // 2. Geração do Markdown respeita a observação editada
  const md = generatePackageMarkdown(editedContent);
  assert(md.includes(customNote), 'Markdown deve conter a observação de pagamento customizada');

  const mdValidation = validatePackageMarkdown(md, editedContent);
  assert.strictEqual(mdValidation.valid, true);

  // 3. Salvar no banco (simulação)
  persistedDatabase[pkgId] = {
    package_id: pkgId,
    content: JSON.parse(JSON.stringify(editedContent)),
    markdown: md,
  };

  // 4. Sair e recarregar
  const reloaded = persistedDatabase[pkgId];
  assert(reloaded, 'Registro deve existir no banco');
  assert.strictEqual(reloaded.content.pagamento.observacao, customNote, 'A observação deve ser exatamente a editada pelo operador');
  assert(reloaded.markdown.includes(customNote), 'O Markdown carregado deve conter a observação editada');
});

// -------------------------------------------------------------
// TESTE 3: Novo conteúdo.
// Resultado: Observação padrão: "Valor por pessoa em quarto duplo. Consulte-nos sobre personalizações."
// -------------------------------------------------------------
runTest('TESTE 3: Novo conteúdo possui a observação oficial padrão por default', () => {
  const defaultNote = S23_OBLIGATORY_PAYMENT_NOTE;
  assert.strictEqual(
    defaultNote,
    'Valor por pessoa em quarto duplo. Consulte-nos sobre personalizações.'
  );

  // Validação aceita o padrão oficial
  const newContent: StructuredPackageContent = {
    title: 'Novo Pacote',
    category: 'Europa',
    excerpt: 'Resumo.',
    slug: 'novo-pacote',
    price: 500,
    sobre: { title: 'Sobre', text: appendDestinationDisclaimer('Texto.') },
    incluso: [{ icon: 'gift', title: 'Guia exclusivo S23', desc: 'Dicas' }],
    pagamento: {
      observacao: defaultNote,
    },
    seoTitle: 'SEO Title',
    seoDescription: 'SEO Desc',
  };

  const validation = validateStructuredContent(newContent);
  assert.strictEqual(validation.valid, true);

  const md = generatePackageMarkdown(newContent);
  assert(md.includes('Valor por pessoa em quarto duplo. Consulte-nos sobre personalizações.'));
});

// -------------------------------------------------------------
// TESTE 4: Descrição do destino.
// Resultado: O aviso aparece exatamente uma vez no final:
// "Anúncio gerado por rotina informática. Confirme informações e condições junto à S23 antes da contratação."
// -------------------------------------------------------------
runTest('TESTE 4: Descrição do destino inclui o aviso padrão exatamente uma vez no final', () => {
  const originalText =
    'Viena é a deslumbrante capital da Áustria, famosa por sua arquitetura imperial, palácios lendários como o Schönbrunn e o Hofburg, e uma tradição musical sem igual.';

  const formatted = appendDestinationDisclaimer(originalText);

  assert(formatted.endsWith(S23_DESTINATION_DISCLAIMER), 'Deve terminar com o aviso oficial');
  assert(formatted.includes(originalText), 'Deve conter o texto original');

  // Conta ocorrências
  const occurrences = (formatted.match(new RegExp(S23_DESTINATION_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  assert.strictEqual(occurrences, 1, 'Aviso deve aparecer exatamente uma única vez');
});

// -------------------------------------------------------------
// TESTE 5: Executar geração/regeneração múltiplas vezes.
// Resultado: O aviso não é duplicado.
// -------------------------------------------------------------
runTest('TESTE 5: Regenerações múltiplas não duplicam o aviso de rotina informática', () => {
  const initialText = 'Texto inicial sobre o destino.';
  let text = appendDestinationDisclaimer(initialText);

  // Executa múltiplas vezes (simulando 5 regenerações ou ciclos de edição/salvamento)
  for (let i = 0; i < 5; i++) {
    text = appendDestinationDisclaimer(text);
  }

  const occurrences = (text.match(new RegExp(S23_DESTINATION_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  assert.strictEqual(occurrences, 1, 'O aviso não pode ser duplicado após múltiplas chamadas');
  assert(text.endsWith(S23_DESTINATION_DISCLAIMER));
});

// -------------------------------------------------------------
// TESTE 6: Pacote contendo:
// - Ryanair;
// - OPO → VIE;
// - 15:05 → 19:20;
// - Hotel Brixen.
// Resultado:
// O Markdown NÃO contém Ryanair, 15:05, 19:20, Hotel Brixen.
// Mas o Pacote original continua contendo essas informações.
// -------------------------------------------------------------
runTest('TESTE 6: Generalização no Markdown omite Ryanair, 15:05, 19:20 e Hotel Brixen, mantendo Pacote original intacto', () => {
  const originalPackageData = {
    destination: 'Viena',
    dates: { startDate: '2026-10-10', endDate: '2026-10-15', durationDays: 6 },
    services: [
      {
        id: 'svc-flight-out',
        type: 'outbound_transport' as const,
        description: 'OPO → VIE (15:05 → 19:20)',
        carrier: 'Ryanair',
        departureTime: '15:05',
        arrivalTime: '19:20',
        amount: 150,
        currency: 'EUR' as const,
        quantity: 1,
      },
      {
        id: 'svc-hotel',
        type: 'accommodation' as const,
        description: 'Hotel Brixen',
        carrier: undefined,
        amount: 500,
        currency: 'EUR' as const,
        quantity: 5,
        mealPlan: 'Café da manhã',
      },
    ],
    financials: {
      salePrice: 1300,
      pricePerPerson: 650,
      totalCost: 650,
      currency: 'EUR' as const,
      profit: 650,
      profitPercent: 50,
      taxesAndFeesTotal: 0,
      components: [],
    },
  };

  // Conteúdo estruturado derivado
  const content: StructuredPackageContent = {
    title: 'Viena Clássica',
    category: 'Europa',
    excerpt: 'Pacote incrível para Viena.',
    slug: 'viena-classica-2026',
    price: 650,
    sobre: {
      title: 'Sobre Viena',
      text: 'Encante-se com a estadia no Hotel Brixen e aproveite o voo Ryanair das 15:05 até 19:20.',
    },
    incluso: [
      { icon: 'gift', title: 'Guia exclusivo S23', desc: 'Dicas' },
      { icon: 'plane', title: 'Voo Ryanair OPO → VIE (15:05 → 19:20)' },
      { icon: 'bed', title: 'Estadia no Hotel Brixen com café da manhã' },
    ],
    naoIncluso: [],
    pagamento: {
      observacao: S23_OBLIGATORY_PAYMENT_NOTE,
    },
    seoTitle: 'Pacote Viena',
    seoDescription: 'Reserve seu pacote com a S23.',
  };

  // Gera o Markdown passando os metadados do pacote
  const md = generatePackageMarkdown(content, {
    packageData: originalPackageData,
    disallowedCarriers: ['Ryanair'],
    disallowedHotels: ['Hotel Brixen'],
  });

  // Verificações no Markdown público
  assert(!md.toLowerCase().includes('ryanair'), 'Markdown público NÃO deve conter "Ryanair"');
  assert(!md.includes('15:05'), 'Markdown público NÃO deve conter horário "15:05"');
  assert(!md.includes('19:20'), 'Markdown público NÃO deve conter horário "19:20"');
  assert(!md.toLowerCase().includes('hotel brixen'), 'Markdown público NÃO deve conter "Hotel Brixen"');

  // Mas a rota genérica e o serviço de voo continuam descritos de forma comercial
  assert(md.includes('Transporte aéreo') || md.includes('transporte aéreo') || md.includes('Voo') || md.includes('OPO → VIE') || md.includes('Hospedagem'));

  // IMPORTANTE: Verifica que o pacote original não foi modificado
  assert.strictEqual(originalPackageData.services[0].carrier, 'Ryanair', 'Pacote original DEVE manter Ryanair');
  assert.strictEqual(originalPackageData.services[0].departureTime, '15:05', 'Pacote original DEVE manter 15:05');
  assert.strictEqual(originalPackageData.services[0].arrivalTime, '19:20', 'Pacote original DEVE manter 19:20');
  assert.strictEqual(originalPackageData.services[1].description, 'Hotel Brixen', 'Pacote original DEVE manter Hotel Brixen');
});

// -------------------------------------------------------------
// TESTE 7: Garantir que os serviços internos continuam inalterados.
// -------------------------------------------------------------
runTest('TESTE 7: Serviços internos (services[]) continuam estritamente inalterados', () => {
  const internalServices = [
    {
      id: 'svc-voo',
      type: 'outbound_transport' as const,
      description: 'Porto → Londres (LGW)',
      carrier: 'EasyJet',
      departureTime: '06:30',
      arrivalTime: '08:50',
      amount: 120,
      currency: 'EUR' as const,
      quantity: 1,
    },
    {
      id: 'svc-hotel',
      type: 'accommodation' as const,
      description: 'The Savoy London',
      amount: 900,
      currency: 'EUR' as const,
      quantity: 3,
    },
  ];

  const packageCopy = JSON.parse(JSON.stringify(internalServices));

  // Executa rotinas de preparação e geração de Markdown
  const pkgData = {
    destination: 'Londres',
    services: internalServices,
    financials: {
      salePrice: 1500,
      pricePerPerson: 750,
      totalCost: 1020,
      currency: 'EUR' as const,
      profit: 480,
      profitPercent: 32,
      taxesAndFeesTotal: 0,
      components: [],
    },
  };

  const input = buildContentGenerationInput({
    package: {
      id: 'pkg-lon',
      reference: 'PK-LON',
      name: 'Londres',
      status: 'active',
      base_currency: 'EUR',
      created_at: '',
      updated_at: '',
      data: pkgData,
    },
  });

  const content: StructuredPackageContent = {
    title: 'Londres Clássica',
    category: 'Europa',
    excerpt: 'Resumo',
    slug: 'londres-classica',
    price: 750,
    sobre: { title: 'Sobre', text: appendDestinationDisclaimer('Texto') },
    incluso: [{ icon: 'gift', title: 'Guia exclusivo S23', desc: 'Dicas' }],
    pagamento: { observacao: S23_OBLIGATORY_PAYMENT_NOTE },
    seoTitle: 'SEO',
    seoDescription: 'SEO',
  };

  const md = generatePackageMarkdown(content, { packageData: pkgData });

  // Valida que internalServices não sofreu nenhuma mutação
  assert.deepStrictEqual(internalServices, packageCopy, 'Os services[] internos devem ser 100% idênticos antes e depois');
});

// -------------------------------------------------------------
// TESTE 8: Garantir que o WhatsApp não foi afetado.
// -------------------------------------------------------------
runTest('TESTE 8: Geração de WhatsApp permanece 100% funcional e preserva dados comerciais da cotação', () => {
  const quoteData = {
    originPackageName: 'Pacote Viena & Budapeste',
    destination: 'Viena',
    dates: { startDate: '2026-11-01', endDate: '2026-11-08', durationDays: 8 },
    passengers: { adults: 2, children: 0, infants: 0 },
    services: [
      {
        id: 's1',
        type: 'outbound_transport' as const,
        description: 'Porto → Viena',
        carrier: 'Ryanair',
        departureTime: '15:05',
        arrivalTime: '19:20',
        amount: 200,
        currency: 'EUR' as const,
        quantity: 1,
      },
      {
        id: 's2',
        type: 'accommodation' as const,
        description: 'Hotel Brixen Viena',
        mealPlan: 'Café da manhã',
        amount: 600,
        currency: 'EUR' as const,
        quantity: 7,
      },
      {
        id: 's3',
        type: 'transfer' as const,
        description: 'Aeroporto ⇄ Hotel',
        amount: 80,
        currency: 'EUR' as const,
        quantity: 1,
      },
    ],
    financials: {
      salePrice: 1200,
      pricePerPerson: 600,
      totalCost: 880,
      currency: 'EUR' as const,
      profit: 320,
      profitPercent: 26.6,
      taxesAndFeesTotal: 0,
      components: [],
    },
  };

  const quote: any = {
    id: 'q-wa-test',
    package_id: 'pkg-base-1',
    reference: 'COT-2026-WA',
    client_name: 'Carlos Oliveira',
    status: 'sent',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: quoteData,
  };

  const basePackage: Package = {
    id: 'pkg-base-1',
    reference: 'PK-BASE-1',
    name: 'Pacote Viena & Budapeste',
    status: 'active',
    base_currency: 'EUR',
    created_at: '',
    updated_at: '',
    data: quoteData,
  };

  const waMessage = generateWhatsAppMessage(quote, basePackage);

  // O WhatsApp deve continuar contendo o título comercial do pacote, detalhes de hotel e preço por pessoa
  assert(waMessage.includes('Pacote Viena & Budapeste'), 'Título do WhatsApp preservado');
  assert(waMessage.includes('Hotel Brixen Viena'), 'WhatsApp preserva hotel operacional');
  assert(waMessage.includes('€ 600,00'), 'WhatsApp formata preço por pessoa corretamente');
  assert(waMessage.includes('2 adultos'), 'WhatsApp formata passageiros');
});

console.log(`\n====================================================`);
console.log(` RESULTADO FINAL: ${testsPassed} PASSOU / ${testsFailed} FALHOU`);
console.log(`====================================================\n`);

if (testsFailed > 0) {
  process.exit(1);
}
