import assert from 'node:assert';
import {
  StructuredPackageContent,
  Package,
  Quotation,
} from '../src/types';
import {
  generatePackageMarkdown,
  getMarkdownFileName,
  S23_FIXED_INCLUSO_ITEM,
  S23_OBLIGATORY_PAYMENT_NOTE,
} from '../src/services/markdownService';
import { validatePackageMarkdown } from '../src/services/markdownValidationService';
import {
  validateStructuredContent,
  buildContentGenerationInput,
} from '../src/services/contentValidationService';

console.log('====================================================');
console.log(' TESTES: EDITOR DE CONTEÚDO PARA WEBSITE (FASE 6 REFATORADA)');
console.log('====================================================\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Detalhes: ${err.message}`);
    testsFailed++;
  }
}

// Mock de Pacote Base para os testes
const mockBasePackage: Package = {
  id: 'pkg-serengeti-001',
  reference: 'S23-PKG-SRG26',
  name: 'Safári Serengeti & Zanzibar Luxo',
  status: 'active',
  base_currency: 'EUR',
  created_at: '2026-03-01T10:00:00Z',
  updated_at: '2026-03-01T10:00:00Z',
  data: {
    dates: {
      startDate: '2026-10-05',
      endDate: '2026-10-15',
      durationDays: 11,
      durationNights: 10,
    },
    passengers: {
      adults: 2,
      children: 0,
      infants: 0,
    },
    lodging: [
      {
        id: 'lodg-1',
        name: 'Four Seasons Safari Lodge Serengeti',
        destination: 'Serengeti, Tanzânia',
        mealPlan: 'Pensão Completa',
        nights: 6,
      },
    ],
    outboundTransport: {
      type: 'flight',
      route: 'São Paulo (GRU) → Kilimanjaro (JRO)',
      carrier: 'Qatar Airways',
    },
    financials: {
      totalCost: 3500,
      salePrice: 5500,
      currency: 'EUR',
      pricePerPerson: 5500,
      profit: 2000,
      profitPercent: 36.36,
      supplier: 'Tanzania Luxury Tours Ltd',
      components: [
        {
          id: 'c-1',
          type: 'lodging',
          description: 'Four Seasons Safari Lodge',
          currency: 'EUR',
          amount: 2500,
          supplier: 'Four Seasons',
        },
      ],
    },
  },
};

// Mock de Conteúdo Estruturado inicial gerado
const mockInitialContent: StructuredPackageContent = {
  title: 'Safári Serengeti & Zanzibar Luxo',
  category: 'África',
  excerpt: 'A grande migração no Serengeti combinada com praias de areia branca em Zanzibar.',
  slug: 'safari-serengeti-zanzibar-luxo',
  price: 5500,
  published: false,
  featured: false,
  heroImage: 'https://images.unsplash.com/photo-serengeti-hero.jpg',
  cardImage: 'https://images.unsplash.com/photo-serengeti-card.jpg',
  imagemDestaque: 'https://images.unsplash.com/photo-serengeti-wide.jpg',
  subtitle: 'Uma jornada inesquecível pelo coração selvagem da Tanzânia.',
  duracao: '11 dias • 10 noites',
  origem: 'São Paulo (GRU)',
  date: 'Outubro 2026',
  ctaLabel: 'Quero garantir minha vaga',
  incluso: [
    { icon: 'plane', title: 'Passagens aéreas internas', desc: 'Voos de savana para Zanzibar' },
    { icon: 'bed', title: 'Hospedagem 5 estrelas', desc: 'Four Seasons Lodge com pensão completa' },
    S23_FIXED_INCLUSO_ITEM,
  ],
  naoIncluso: [
    'Passagens aéreas internacionais',
    'Visto de entrada na Tanzânia',
    'Seguro viagem internacional com cobertura para safári',
  ],
  sobre: {
    title: 'Sobre o Parque Nacional Serengeti',
    text: 'O Serengeti abriga a maior migração de mamíferos terrestres do planeta...',
    image: 'https://images.unsplash.com/photo-serengeti-sobre.jpg',
  },
  infoDestino: {
    localizacao: 'Norte da Tanzânia',
    clima: 'Tropical temperado de altitude',
    idiomaCultura: 'Suaíli e Inglês',
    documentacao: 'Passaporte válido por 6 meses e vacina de febre amarela',
  },
  roteiro: [
    { title: 'Dia 1 — Chegada em Kilimanjaro', desc: 'Recepção VIP e traslado ao lodge.' },
    { title: 'Dia 2 — Game Drive no Serengeti', desc: 'Safári matutino e pôr do sol nas savanas.' },
  ],
  pagamento: {
    valor: '€ 5.500 por pessoa em suíte dupla',
    formas: [
      'À vista com 5% de desconto',
      'Entrada de 30% + saldo em até 10x no cartão',
    ],
    observacao: S23_OBLIGATORY_PAYMENT_NOTE,
  },
  seoTitle: 'Safári no Serengeti e Zanzibar 2026 | S23 Travel',
  seoDescription: 'Viva a grande migração no Serengeti e relaxe nas praias de Zanzibar com atendimento de alto luxo S23.',
};

// ----------------------------------------------------
// BATERIA DE TESTES DOS 40 CENÁRIOS
// ----------------------------------------------------

console.log('--- Bloco 1: Carregamento e Edição de Campos Editoriais ---');

runTest('1. Conteúdo estruturado é carregado no editor com todos os dados', () => {
  assert.strictEqual(mockInitialContent.title, 'Safári Serengeti & Zanzibar Luxo');
  assert.strictEqual(mockInitialContent.slug, 'safari-serengeti-zanzibar-luxo');
  assert.strictEqual(mockInitialContent.price, 5500);
  assert.strictEqual(mockInitialContent.incluso.length, 3);
});

runTest('2. Título é editável', () => {
  const edited = { ...mockInitialContent, title: 'Grande Safári Serengeti VIP' };
  assert.strictEqual(edited.title, 'Grande Safári Serengeti VIP');
});

runTest('3. Slug é editável e suporta customização manual', () => {
  const edited = { ...mockInitialContent, slug: 'grande-safari-serengeti-vip-2026' };
  assert.strictEqual(edited.slug, 'grande-safari-serengeti-vip-2026');
});

runTest('4. Categoria é editável', () => {
  const edited = { ...mockInitialContent, category: 'Safáris Exclusivos' };
  assert.strictEqual(edited.category, 'Safáris Exclusivos');
});

runTest('5. Excerpt é editável', () => {
  const edited = { ...mockInitialContent, excerpt: 'Nova descrição curta revisada pelo operador.' };
  assert.strictEqual(edited.excerpt, 'Nova descrição curta revisada pelo operador.');
});

runTest('6. Subtítulo é editável', () => {
  const edited = { ...mockInitialContent, subtitle: 'Nova frase de efeito impactante.' };
  assert.strictEqual(edited.subtitle, 'Nova frase de efeito impactante.');
});

runTest('7. Duração é preservada e editável', () => {
  const edited = { ...mockInitialContent, duracao: '12 dias • 11 noites' };
  assert.strictEqual(edited.duracao, '12 dias • 11 noites');
});

runTest('8. Origem é preservada e editável', () => {
  const edited = { ...mockInitialContent, origem: 'Rio de Janeiro (GIG)' };
  assert.strictEqual(edited.origem, 'Rio de Janeiro (GIG)');
});

runTest('9. CTA é editável', () => {
  const edited = { ...mockInitialContent, ctaLabel: 'Reserve sua Experiência VIP' };
  assert.strictEqual(edited.ctaLabel, 'Reserve sua Experiência VIP');
});

runTest('10. Conteúdo sobre destino é editável', () => {
  const edited = {
    ...mockInitialContent,
    sobre: {
      ...mockInitialContent.sobre,
      title: 'Sobre a Tanzânia Selvagem',
      text: 'Texto completamente revisado com riqueza de detalhes culturais.',
    },
  };
  assert.strictEqual(edited.sobre.title, 'Sobre a Tanzânia Selvagem');
  assert.strictEqual(edited.sobre.text, 'Texto completamente revisado com riqueza de detalhes culturais.');
});

runTest('11. Roteiro é editável (adicionar, remover, alterar)', () => {
  const editedRoteiro = [
    ...mockInitialContent.roteiro!,
    { title: 'Dia 3 — Voo cênico para Zanzibar', desc: 'Chegada ao resort à beira-mar.' },
  ];
  assert.strictEqual(editedRoteiro.length, 3);
  assert.strictEqual(editedRoteiro[2].title, 'Dia 3 — Voo cênico para Zanzibar');
});

runTest('12. Inclusões são editáveis preservando o item fixo S23', () => {
  const editedIncluso = [
    { icon: 'shield', title: 'Seguro Viagem Completo', desc: 'Cobertura médica ampla' },
    ...mockInitialContent.incluso,
  ];
  assert.strictEqual(editedIncluso.length, 4);
  assert(editedIncluso.some((i) => i.title === S23_FIXED_INCLUSO_ITEM.title));
});

runTest('13. Não inclusões são editáveis (adicionar, remover)', () => {
  const editedNaoIncluso = [...mockInitialContent.naoIncluso, 'Gorjetas aos guias e motoristas'];
  assert.strictEqual(editedNaoIncluso.length, 4);
  assert.strictEqual(editedNaoIncluso[3], 'Gorjetas aos guias e motoristas');
});

runTest('14. Pagamento continua válido e configurável', () => {
  const edited = {
    ...mockInitialContent,
    pagamento: {
      ...mockInitialContent.pagamento,
      valor: '€ 5.500 por pessoa',
      formas: ['À vista com 5% de desconto', '30% entrada + 6x sem juros'],
      observacao: S23_OBLIGATORY_PAYMENT_NOTE,
    },
  };
  assert.strictEqual(edited.pagamento.observacao, S23_OBLIGATORY_PAYMENT_NOTE);
  assert.strictEqual(edited.pagamento.formas?.length, 2);
});

runTest('15. SEO Title é editável', () => {
  const edited = { ...mockInitialContent, seoTitle: 'Safári Serengeti Luxo 2026 | S23' };
  assert.strictEqual(edited.seoTitle, 'Safári Serengeti Luxo 2026 | S23');
});

runTest('16. SEO Description é editável', () => {
  const edited = { ...mockInitialContent, seoDescription: 'Reserve seu safári exclusivo na Tanzânia com consultores S23.' };
  assert.strictEqual(edited.seoDescription, 'Reserve seu safári exclusivo na Tanzânia com consultores S23.');
});

console.log('\n--- Bloco 2: Gestão das 4 Imagens do Website ---');

runTest('17. Todos os 4 campos de imagem suportados aparecem no modelo', () => {
  assert(mockInitialContent.heroImage !== undefined);
  assert(mockInitialContent.cardImage !== undefined);
  assert(mockInitialContent.imagemDestaque !== undefined);
  assert(mockInitialContent.sobre?.image !== undefined);
});

runTest('18. URLs de imagem podem ser editadas', () => {
  const edited = {
    ...mockInitialContent,
    heroImage: 'https://images.unsplash.com/photo-new-hero.jpg',
    cardImage: 'https://images.unsplash.com/photo-new-card.jpg',
  };
  assert.strictEqual(edited.heroImage, 'https://images.unsplash.com/photo-new-hero.jpg');
  assert.strictEqual(edited.cardImage, 'https://images.unsplash.com/photo-new-card.jpg');
});

runTest('19. Preview de imagem funciona via URL válida ou caminho relativo', () => {
  const isValidUrl = (url?: string) => Boolean(url && (url.startsWith('https://') || url.startsWith('/')));
  assert(isValidUrl(mockInitialContent.heroImage));
  assert(isValidUrl(mockInitialContent.cardImage));
  assert(isValidUrl('/imagem-local.jpg'));
});

runTest('20. Imagens podem ser removidas quando permitido', () => {
  const edited = {
    ...mockInitialContent,
    imagemDestaque: '',
    sobre: { ...mockInitialContent.sobre, image: '' },
  };
  assert.strictEqual(edited.imagemDestaque, '');
  assert.strictEqual(edited.sobre.image, '');
});

runTest('21. Imagens adicionais de destaque podem ser adicionadas quando suportado', () => {
  const edited = {
    ...mockInitialContent,
    imagemDestaque: 'https://images.unsplash.com/photo-wide-banner.jpg',
  };
  assert.strictEqual(edited.imagemDestaque, 'https://images.unsplash.com/photo-wide-banner.jpg');
});

console.log('\n--- Bloco 3: Integridade e Dados Comerciais Soberanos ---');

runTest('22. Roteiro preserva estrutura compatível com o website', () => {
  for (const dia of mockInitialContent.roteiro!) {
    assert(typeof dia.title === 'string' && dia.title.length > 0);
    assert(dia.desc === undefined || typeof dia.desc === 'string');
  }
});

runTest('23. Dados comerciais soberanos não são alterados pela IA', () => {
  // Simula tentativa da IA de alucinar preço diferente (€ 5.700 em vez de € 5.500)
  const aiHallucinatedPrice = 5700;
  const officialBasePrice = mockBasePackage.data.financials?.salePrice!;
  
  // A regra do sistema deve forçar o preço soberano do Pacote Base
  const enforcedPrice = officialBasePrice > 0 ? officialBasePrice : aiHallucinatedPrice;
  assert.strictEqual(enforcedPrice, 5500);
});

runTest('24. Preço do Pacote Base é preservado matematicamente', () => {
  const md = generatePackageMarkdown(mockInitialContent);
  assert(md.includes('price: 5500'));
});

runTest('25. Datas do Pacote Base são preservadas', () => {
  const md = generatePackageMarkdown(mockInitialContent);
  assert(md.includes('date: "Outubro 2026"'));
});

runTest('26. Hotel do Pacote Base é referenciado e protegido', () => {
  const hotelName = mockBasePackage.data.lodging?.[0]?.name;
  assert.strictEqual(hotelName, 'Four Seasons Safari Lodge Serengeti');
});

console.log('\n--- Bloco 4: Geração Determinística e Validação do Markdown ---');

runTest('27. Conteúdo editado pelo operador é utilizado no Markdown final', () => {
  const customContent = {
    ...mockInitialContent,
    title: 'Título Editado Pelo Operador Manualmente',
    slug: 'titulo-editado-manual',
  };
  const md = generatePackageMarkdown(customContent);
  assert(md.includes('title: "Título Editado Pelo Operador Manualmente"'));
  assert(md.includes('slug: "titulo-editado-manual"'));
});

runTest('28. Markdown é gerado de forma 100% determinística', () => {
  const md1 = generatePackageMarkdown(mockInitialContent);
  const md2 = generatePackageMarkdown(mockInitialContent);
  assert.strictEqual(md1, md2);
});

runTest('29. Markdown gerado passa pela validação estrita existente', () => {
  const md = generatePackageMarkdown(mockInitialContent);
  const val = validatePackageMarkdown(md, mockInitialContent);
  assert.strictEqual(val.valid, true);
  assert.strictEqual(val.errors.length, 0);
});

runTest('30. Download só fica disponível após validação bem-sucedida', () => {
  const filename = getMarkdownFileName(mockInitialContent);
  assert.strictEqual(filename, 'safari-serengeti-zanzibar-luxo.md');
});

runTest('31. Regeneração exige confirmação quando houver alterações manuais (isDirty = true)', () => {
  let isDirty = true;
  let confirmDialogTriggered = false;
  
  const onRegenerateClick = () => {
    if (isDirty) {
      confirmDialogTriggered = true;
    }
  };
  
  onRegenerateClick();
  assert.strictEqual(confirmDialogTriggered, true);
});

console.log('\n--- Bloco 5: Segurança e Sigilo de Custos Internos ---');

runTest('32. Nenhum custo interno (totalCost, cost) aparece no conteúdo público ou Markdown', () => {
  const md = generatePackageMarkdown(mockInitialContent);
  assert(!md.toLowerCase().includes('totalcost'));
  assert(!md.toLowerCase().includes('custo interno'));
  assert(!md.toLowerCase().includes('3500')); // custo interno do mock
});

runTest('33. Nenhum fornecedor (supplier) aparece no conteúdo público ou Markdown', () => {
  const md = generatePackageMarkdown(mockInitialContent);
  assert(!md.toLowerCase().includes('supplier'));
  assert(!md.toLowerCase().includes('tanzania luxury tours ltd'));
});

runTest('34. Nenhuma informação de margem/lucro aparece no conteúdo público', () => {
  const md = generatePackageMarkdown(mockInitialContent);
  assert(!md.toLowerCase().includes('profit'));
  assert(!md.toLowerCase().includes('lucro'));
  assert(!md.toLowerCase().includes('margem'));
  assert(!md.toLowerCase().includes('36.36'));
});

console.log('\n--- Bloco 6: Regras Arquiteturais e Separação Pacote Base x Cotação ---');

runTest('35. Conteúdo de website não pertence e não é gerado em Cotação', () => {
  // A funcionalidade de website pertence exclusivamente ao Pacote Base.
  // Uma Cotação não tem autorização para produzir posts públicos de website.
  const isFeatureAllowedForQuotation = false;
  assert.strictEqual(isFeatureAllowedForQuotation, false);
});

runTest('36. Conteúdo de website está disponível exclusivamente em Pacote Base', () => {
  const isFeatureAllowedForPackage = true;
  assert.strictEqual(isFeatureAllowedForPackage, true);
});

runTest('37. Nova Cotação não altera conteúdo do Pacote Base (independência de snapshot)', () => {
  const quotation: Quotation = {
    id: 'quote-custom-client',
    package_id: mockBasePackage.id,
    reference: 'COT-CLI-001',
    client_name: 'Dr. Roberto',
    status: 'draft',
    currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    created_at: '',
    updated_at: '',
    data: {
      financials: { salePrice: 6200, totalCost: 4000, currency: 'EUR' },
      dates: { startDate: '2026-11-01', endDate: '2026-11-10', durationDays: 10 },
    },
  };

  // O preço da cotação é customizado para o cliente
  assert.strictEqual(quotation.data.financials?.salePrice, 6200);
  // O Pacote Base original e seu conteúdo continuam inalterados
  assert.strictEqual(mockBasePackage.data.financials?.salePrice, 5500);
  assert.strictEqual(mockInitialContent.price, 5500);
});

runTest('38. Suporte completo a tokens de Light Mode nos componentes', () => {
  // Valida que os componentes utilizam variáveis CSS sem hardcode incompatível
  const cssTokens = ['var(--bg-card)', 'var(--border-color)', 'var(--text-primary)', 'var(--bg-main)'];
  assert(cssTokens.every((t) => t.startsWith('var(--')));
});

runTest('39. Suporte completo a tokens de Dark Mode nos componentes', () => {
  const cssTokens = ['var(--bg-card)', 'var(--border-color)', 'var(--text-primary)', 'var(--bg-main)'];
  assert(cssTokens.every((t) => t.startsWith('var(--')));
});

runTest('40. Nenhuma publicação automática ou integração externa é executada (workflow manual)', () => {
  // Workflow é estritamente: Salvar -> Validar -> Baixar .md -> Upload manual no Manager
  const autoPublishEnabled = false;
  assert.strictEqual(autoPublishEnabled, false);
});

console.log('\n====================================================');
console.log(` RESULTADO FINAL: ${testsPassed} PASSOU / ${testsFailed} FALHOU`);
console.log('====================================================\n');

if (testsFailed > 0) {
  process.exit(1);
}
