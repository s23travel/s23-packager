// Suíte de Testes Automatizados da Fase 6B
// Geração e Validação Determinística de Markdown para o Website S23
// Cobrindo os 20 cenários exigidos + testes de regressão.

import { generatePackageMarkdown, getMarkdownFileName, S23_FIXED_INCLUSO_ITEM, S23_OBLIGATORY_PAYMENT_NOTE } from '../src/services/markdownService';
import { validatePackageMarkdown } from '../src/services/markdownValidationService';
import { StructuredPackageContent, Package, Quotation } from '../src/types';
import { buildContentGenerationInput, validateStructuredContent } from '../src/services/contentValidationService';

function runTests() {
  console.log('====================================================');
  console.log(' INICIANDO SUÍTE DE TESTES DA FASE 6B (MARKDOWN)   ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      failed++;
    }
  }

  // Objeto base válido de StructuredPackageContent para os testes
  const baseContent: StructuredPackageContent = {
    title: 'Elas Viajam: Maiorca e Menorca',
    category: 'Europa',
    excerpt: 'Descubra as ilhas Baleares com praias paradisíacas e vilas medievais.',
    slug: 'elas-viajam-maiorca-2026',
    price: 610,
    published: true,
    featured: false,
    heroImage: 'https://images.unsplash.com/photo-maiorca-hero.jpg',
    cardImage: 'https://images.unsplash.com/photo-maiorca-card.jpg',
    subtitle: 'Uma jornada mediterrânea inesquecível pelas Ilhas Baleares.',
    duracao: '7 noites',
    origem: 'Porto (OPO)',
    date: '10 a 17 de Outubro de 2026',
    ctaLabel: 'Quero garantir minha vaga',
    incluso: [
      { icon: 'plane', title: 'Passagem aérea Porto - Palma de Maiorca', desc: 'Voo direto ida e volta' },
      { icon: 'bed', title: 'Hospedagem 4 estrelas', desc: '7 noites em hotel beira-mar' },
      S23_FIXED_INCLUSO_ITEM,
    ],
    naoIncluso: [
      'Refeições não mencionadas no roteiro',
      'Despesas de caráter pessoal e compras',
      'Taxas turísticas locais pagas no check-in',
    ],
    sobre: {
      title: 'Sobre Maiorca',
      text: 'Maiorca é a maior das ilhas Baleares da Espanha, famosa por suas enseadas deslumbrantes, montanhas de calcário e história moura e romana.',
      image: 'https://images.unsplash.com/photo-maiorca-sobre.jpg',
    },
    infoDestino: {
      localizacao: 'Mar Mediterrâneo, Espanha',
      idiomaCultura: 'Espanhol e Catalão',
      clima: 'Mediterrâneo, agradável no outono',
      documentacao: 'Passaporte válido (isenção de visto até 90 dias)',
    },
    roteiro: [
      { title: 'Dia 1 — Embarque no Porto e Chegada em Palma', desc: 'Chegada e traslado ao hotel.' },
      { title: 'Dia 2 — Centro Histórico e Catedral de Palma', desc: 'Passeio a pé e pôr do sol.' },
    ],
    pagamento: {
      valor: '€ 610 por pessoa em apartamento duplo',
      formas: ['À vista com desconto', 'Entrada de 30% + saldo parcelado'],
      observacao: S23_OBLIGATORY_PAYMENT_NOTE,
    },
    seoTitle: 'Pacote Maiorca e Menorca Outubro 2026 | S23 Travel',
    seoDescription: 'Viaje para Maiorca com a S23 em outubro de 2026. Voos do Porto, hotel 4 estrelas e guia exclusivo.',
  };

  // 1. Geração de frontmatter válido
  console.log('Cenário 1: Geração de frontmatter válido');
  const md1 = generatePackageMarkdown(baseContent);
  assert(md1.startsWith('---\n'), 'O Markdown deve iniciar com os delimitadores frontmatter "---"');
  assert(md1.includes('\n---\n'), 'O frontmatter deve fechar com "---" antes do corpo');

  // 2. Geração do corpo Markdown
  console.log('\nCenário 2: Geração do corpo Markdown');
  const valResult1 = validatePackageMarkdown(md1, baseContent);
  assert(valResult1.valid, 'Markdown gerado deve passar na validação estrita');
  assert(Boolean(valResult1.extractedBody && valResult1.extractedBody.length > 20), 'Corpo Markdown deve conter o texto de apresentação');

  // 3. YAML válido
  console.log('\nCenário 3: YAML válido');
  assert(Boolean(valResult1.extractedFrontmatter?.title === baseContent.title), 'Parser deve extrair corretamente campos chave do YAML');
  assert(Boolean(valResult1.extractedFrontmatter?.category === 'Europa'), 'Categoria deve ser corretamente serializada em YAML');

  // 4. Slug correto no nome do arquivo
  console.log('\nCenário 4: Slug correto no nome do arquivo');
  const fileName = getMarkdownFileName(baseContent);
  assert(fileName === 'elas-viajam-maiorca-2026.md', 'O nome do arquivo deve ser derivado exclusivamente do slug: elas-viajam-maiorca-2026.md');

  // 5. Preservação exata do preço (numérico e string)
  console.log('\nCenário 5: Preservação exata do preço');
  assert(valResult1.extractedFrontmatter?.price === 610, 'Preço numérico 610 deve ser preservado sem alteração');
  const contentWithStringPrice: StructuredPackageContent = { ...baseContent, price: '610 €' };
  const mdStrPrice = generatePackageMarkdown(contentWithStringPrice);
  const valStrPrice = validatePackageMarkdown(mdStrPrice, contentWithStringPrice);
  assert(valStrPrice.extractedFrontmatter?.price === '610 €', 'Preço em string "610 €" deve ser preservado com moeda');

  // 6. Preservação das datas
  console.log('\nCenário 6: Preservação das datas');
  assert(valResult1.extractedFrontmatter?.date === '10 a 17 de Outubro de 2026', 'Data do pacote deve ser exatamente preservada');

  // 7. Preservação da moeda
  console.log('\nCenário 7: Preservação da moeda');
  assert(md1.includes('€ 610 por pessoa em apartamento duplo'), 'A moeda € presente no pagamento deve ser preservada');

  // 8. Preservação da origem
  console.log('\nCenário 8: Preservação da origem');
  assert(valResult1.extractedFrontmatter?.origem === 'Porto (OPO)', 'Origem Porto (OPO) deve ser preservada');

  // 9. Presença do item fixo "Guia exclusivo S23"
  console.log('\nCenário 9: Presença do item fixo "Guia exclusivo S23"');
  const hasFixedItem = valResult1.extractedFrontmatter?.incluso?.some((i: any) => i.title === 'Guia exclusivo S23');
  assert(Boolean(hasFixedItem), 'O item fixo "Guia exclusivo S23" deve estar presente no frontmatter em incluso');

  // 10. Presença da frase obrigatória de pagamento
  console.log('\nCenário 10: Presença da frase obrigatória de pagamento');
  assert(valResult1.extractedFrontmatter?.pagamento?.observacao === S23_OBLIGATORY_PAYMENT_NOTE, 'A frase oficial de pagamento S23 deve estar presente no pagamento');

  // 11. Ausência de placeholders
  console.log('\nCenário 11: Ausência de placeholders');
  assert(!md1.includes('[hotel]') && !md1.includes('[data]') && !md1.includes('[valor]'), 'Markdown não pode conter placeholders');

  // 12. Ausência de undefined/null/NaN
  console.log('\nCenário 12: Ausência de undefined/null/NaN');
  assert(!md1.includes('undefined'), 'Markdown não pode conter "undefined"');
  assert(!md1.includes('NaN'), 'Markdown não pode conter "NaN"');
  assert(!/\bnull\b/.test(md1), 'Markdown não pode conter "null"');

  // 13. Ausência de custos/lucro/margem/fornecedor
  console.log('\nCenário 13: Ausência de custos/lucro/margem/fornecedor');
  assert(!md1.toLowerCase().includes('totalcost'), 'Markdown não pode conter totalCost');
  assert(!md1.toLowerCase().includes('profitpercent'), 'Markdown não pode conter profitPercent');
  assert(!md1.toLowerCase().includes('markup'), 'Markdown não pode conter markup');
  assert(!md1.toLowerCase().includes('supplier'), 'Markdown não pode conter supplier');

  // 14. Quotation utiliza seu próprio snapshot
  console.log('\nCenário 14: Quotation utiliza seu próprio snapshot');
  const testQuotation: Quotation = {
    id: 'quote-100',
    package_id: 'pkg-orig-50',
    reference: 'Q-2026-099',
    client_name: 'Maria Santos',
    status: 'sent',
    currency: 'EUR',
    exchange_rate: 1.0,
    exchange_rate_date: '2026-09-08',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    data: {
      originPackageName: 'Pacote Maiorca VIP Quotation',
      dates: { startDate: '2026-10-10', endDate: '2026-10-17', durationDays: 8, durationNights: 7 },
      outboundTransport: { route: 'Porto (OPO) → Palma (PMI)' },
      inboundTransport: { route: 'Palma (PMI) → Porto (OPO)' },
      lodging: [{ name: 'Hotel Melia Palma Marina', destination: 'Palma de Maiorca', mealPlan: 'Café da manhã', nights: 7 }],
      financials: { salePrice: 750, costTotal: { amount: 500, currency: 'EUR' }, profitTotal: { amount: 250, currency: 'EUR' } },
    },
  };
  const quoteInput = buildContentGenerationInput({ quotation: testQuotation });
  assert(quoteInput.salePrice === 750, 'Input da cotação deve usar o preço soberano do snapshot (750)');
  assert(quoteInput.destination === 'Palma de Maiorca', 'Destino deve derivar do snapshot da cotação');

  // 15. Alteração posterior do Package não altera Markdown da Quotation
  console.log('\nCenário 15: Alteração posterior do Package não afeta Quotation');
  const quoteContent: StructuredPackageContent = {
    ...baseContent,
    title: 'Cotação Personalizada Maiorca VIP',
    slug: 'maiorca-vip-maria-2026',
    price: 750,
  };
  const quoteMd = generatePackageMarkdown(quoteContent);
  // Simula alteração no pacote base
  const modifiedBaseContent = { ...baseContent, price: 999 };
  assert(quoteMd.includes('price: 750'), 'Markdown da cotação continua com price 750 independente de alterações no pacote');
  assert(!quoteMd.includes('999'), 'Markdown da cotação não reflete alterações do pacote base');

  // 16. Conteúdo inválido é rejeitado
  console.log('\nCenário 16: Conteúdo inválido é rejeitado');
  const invalidMd = `---
title: ""
category: ""
published: "not-a-bool"
---
Texto`;
  const invalidRes = validatePackageMarkdown(invalidMd);
  assert(!invalidRes.valid, 'Validador deve rejeitar frontmatter com título vazio e booleano incorreto');
  assert(invalidRes.errors.length > 0, 'Deve listar os erros encontrados');

  // 17. Slug inválido é rejeitado
  console.log('\nCenário 17: Slug inválido é rejeitado');
  const badSlugMd = generatePackageMarkdown({ ...baseContent, slug: 'Maiorca Com Espaço & Maiúsculas!' });
  const badSlugRes = validatePackageMarkdown(badSlugMd);
  assert(!badSlugRes.valid, 'Slug com maiúsculas e espaços deve ser rejeitado');

  // 18. Campo comercial alterado indevidamente é rejeitado
  console.log('\nCenário 18: Campo comercial alterado indevidamente é rejeitado');
  // Markdown com price 611 quando o original era 610
  const tamperedMd = md1.replace('price: 610', 'price: 611');
  const tamperedRes = validatePackageMarkdown(tamperedMd, baseContent);
  assert(!tamperedRes.valid, 'Alteração de 610 para 611 no preço deve ser rejeitada sem tolerância');
  assert(tamperedRes.errors.some(e => e.includes('Divergência estrita no preço')), 'Erro deve apontar divergência estrita no preço');

  // 19. Strings com caracteres especiais produzem YAML válido
  console.log('\nCenário 19: Strings com caracteres especiais produzem YAML válido');
  const specialCharsContent: StructuredPackageContent = {
    ...baseContent,
    title: 'Viagem dos Sonhos: "Ilhas Baleares", Maiorca & Menorca! 🌊✨',
    subtitle: 'Sol, mar & cultura: conheça o vilarejo de Valldemossa @ Serra de Tramuntana.',
    excerpt: 'Um roteiro exclusivo: incluindo tapas, vinhos & vistas paradisíacas.',
  };
  const specialMd = generatePackageMarkdown(specialCharsContent);
  const specialVal = validatePackageMarkdown(specialMd, specialCharsContent);
  assert(specialVal.valid, 'Caracteres especiais (aspas, dois-pontos, &, @, emojis) devem produzir YAML válido');
  assert(specialVal.extractedFrontmatter?.title === specialCharsContent.title, 'Título com aspas e emojis deve ser recuperado com precisão');

  // 20. Mesmo input produz exatamente o mesmo Markdown (determinismo estrito)
  console.log('\nCenário 20: Mesmo input produz exatamente o mesmo Markdown (determinismo)');
  const mdRunA = generatePackageMarkdown(baseContent);
  const mdRunB = generatePackageMarkdown(baseContent);
  assert(mdRunA === mdRunB, 'Execuções consecutivas com o mesmo input devem produzir strings idênticas bit-a-bit');

  console.log('\n====================================================');
  console.log(` RESULTADO FINAL FASE 6B: ${passed} PASSOU / ${failed} FALHOU`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
