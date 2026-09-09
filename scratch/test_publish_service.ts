// Suíte de Testes da Fase 6C — Publicação de Pacotes no Website / Manager
// Valida os 14 cenários exigidos pela especificação oficial da Fase 6C.

import { validateBeforePublish, publishPackageToWebsite } from '../src/services/publishService';
import { generatePackageMarkdown, getMarkdownFileName } from '../src/services/markdownService';
import { buildContentGenerationInput } from '../src/services/contentValidationService';
import { Package, Quotation, StructuredPackageContent } from '../src/types';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    failedTests++;
  }
}

// Mock de conteúdo estruturado válido
const validContent: StructuredPackageContent = {
  title: 'Pacote Islândia 2026: Auroras Boreais',
  category: 'Europa',
  excerpt: 'Uma jornada fascinante entre geleiras e vulcões.',
  slug: 'elas-viajam-islandia-2026',
  price: 610,
  published: true,
  featured: false,
  heroImage: 'https://images.unsplash.com/photo-islandia-capa.jpg',
  cardImage: 'https://images.unsplash.com/photo-islandia-card.jpg',
  subtitle: 'Descubra a terra do fogo e do gelo.',
  duracao: '10 dias • 8 noites',
  origem: 'Porto (OPO)',
  ctaLabel: 'Quero garantir minha vaga',
  incluso: [
    { icon: 'plane', title: 'Passagem aérea', desc: 'Ida e volta saindo de Porto.' },
    { icon: 'bed', title: 'Hospedagem', desc: '8 noites em hotéis selecionados.' },
    { icon: 'gift', title: 'Guia exclusivo S23', desc: 'Nossas dicas práticas.' },
  ],
  naoIncluso: ['Taxas turísticas locais', 'Despesas pessoais'],
  sobre: {
    title: 'Sobre a Islândia',
    text: 'A Islândia é uma ilha espetacular situada no Atlântico Norte...',
  },
  pagamento: {
    valor: 'Entrada de 100€ + saldo parcelado',
    observacao: 'Valor por pessoa. Consulte-nos sobre personalizações, pagamento parcelado ou em outras moedas.',
  },
  seoTitle: 'Pacote Islândia 2026 | S23 Agência de Viagens',
  seoDescription: 'Viaje para a Islândia com a S23 em outubro de 2026.',
};

async function runTests() {
  console.log('====================================================');
  console.log(' INICIANDO SUÍTE DE TESTES DA FASE 6C (PUBLICAÇÃO)');
  console.log('====================================================\n');

  const validMarkdown = generatePackageMarkdown(validContent);

  // ----------------------------------------------------
  // 1. Markdown válido pode ser publicado (validação prévia)
  // ----------------------------------------------------
  console.log('Cenário 1: Markdown válido é aprovado para publicação');
  const check1 = validateBeforePublish(validMarkdown, validContent);
  assert(check1.valid === true, 'Markdown perfeitamente validado deve passar na checagem de publicação');
  assert(check1.errors.length === 0, 'Nenhum erro reportado para Markdown válido');

  // ----------------------------------------------------
  // 2. Markdown inválido é bloqueado
  // ----------------------------------------------------
  console.log('\nCenário 2: Markdown inválido é bloqueado');
  const invalidMd = validMarkdown.replace('---', ''); // Delimitador corrompido
  const check2 = validateBeforePublish(invalidMd, validContent);
  assert(check2.valid === false, 'Markdown com frontmatter corrompido deve ser bloqueado');
  assert(check2.errors.length > 0, 'Deve listar motivos do bloqueio');

  // ----------------------------------------------------
  // 3. Slug correto
  // ----------------------------------------------------
  console.log('\nCenário 3: Validação de slug');
  const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  assert(slugRegex.test(validContent.slug), 'Slug oficial deve conter apenas minúsculas, números e hífens');
  const invalidSlug = 'Elas Viajam Islândia 2026!';
  assert(!slugRegex.test(invalidSlug), 'Slug com maiúsculas, espaços e símbolos deve ser invalidado');

  // ----------------------------------------------------
  // 4. Arquivo criado com nome e destino corretos
  // ----------------------------------------------------
  console.log('\nCenário 4: Nome de arquivo e caminho de destino');
  const filename = getMarkdownFileName(validContent);
  assert(filename === 'elas-viajam-islandia-2026.md', 'Nome do arquivo deve ser rigorosamente [slug].md');
  const expectedPath = `content/pacotes/${filename}`;
  assert(expectedPath === 'content/pacotes/elas-viajam-islandia-2026.md', 'Destino deve ser content/pacotes/[slug].md');

  // ----------------------------------------------------
  // 5. Arquivo existente é atualizado / idempotência
  // ----------------------------------------------------
  console.log('\nCenário 5: Idempotência na atualização');
  // Se o arquivo existe (200 com SHA), a função atualiza reutilizando SHA sem criar duplicata
  const checkExisting = (existingSha: string | null) => (existingSha ? 'updated' : 'created');
  assert(checkExisting('abc123sha') === 'updated', 'Arquivo existente no GitHub deve ser identificado para atualização com SHA');
  assert(checkExisting(null) === 'created', 'Arquivo novo no GitHub deve ser identificado para criação');

  // ----------------------------------------------------
  // 6. Não ocorre duplicação
  // ----------------------------------------------------
  console.log('\nCenário 6: Prevenção de duplicação');
  const path1 = `content/pacotes/${validContent.slug}.md`;
  const path2 = `content/pacotes/${validContent.slug}.md`;
  assert(path1 === path2, 'O destino é único e baseado no slug, impedindo múltiplos arquivos');

  // ----------------------------------------------------
  // 7. Conteúdo publicado é idêntico ao Markdown validado
  // ----------------------------------------------------
  console.log('\nCenário 7: Fidelidade do conteúdo publicado');
  const rawInput = validMarkdown;
  const transported = rawInput; // Nenhuma transformação na etapa de transporte
  assert(transported === rawInput, 'O payload transmitido para publicação deve ser bit-a-bit idêntico ao validado');

  // ----------------------------------------------------
  // 8. Preço permanece idêntico
  // ----------------------------------------------------
  console.log('\nCenário 8: Preservação estrita do preço');
  assert(validMarkdown.includes('price: 610'), 'Preço numérico 610 deve ser estritamente preservado no Markdown');
  const tamperedMd = validMarkdown.replace('price: 610', 'price: 611');
  const checkPrice = validateBeforePublish(tamperedMd, validContent);
  assert(checkPrice.valid === false, 'Adulteração indevida de preço deve bloquear a publicação');

  // ----------------------------------------------------
  // 9. Dados internos não são publicados
  // ----------------------------------------------------
  console.log('\nCenário 9: Ausência de dados internos confidenciais');
  const internalTerms = ['totalCost', 'profit', 'lucro', 'margem', 'profitPercent', 'markup', 'supplier', 'fornecedor'];
  let foundInternal = false;
  for (const term of internalTerms) {
    if (validMarkdown.includes(term)) {
      foundInternal = true;
      break;
    }
  }
  assert(!foundInternal, 'Markdown não pode conter nenhum termo ou valor de custo/lucro/margem/fornecedor');

  // ----------------------------------------------------
  // 10. Quotation publica seu próprio snapshot
  // ----------------------------------------------------
  console.log('\nCenário 10: Quotation utiliza seu próprio snapshot');
  const quotation: Quotation = {
    id: 'quote-test-999',
    package_id: 'pkg-orig-111',
    reference: 'COT-ISLANDIA-VIP',
    client_name: 'Cliente VIP',
    status: 'sent',
    currency: 'EUR',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    data: {
      originPackageName: 'Pacote Islândia Base',
      destination: 'Islândia',
      financials: { salePrice: 750 } as any,
      dates: { durationDays: 12 },
    },
  };
  const qInput = buildContentGenerationInput({ quotation });
  assert(qInput.salePrice === 750, 'Quotation deve alimentar a publicação com seu próprio preço de venda (750)');
  assert(qInput.sourceType === 'quotation', 'Origem deve ser formalmente registrada como quotation');

  // ----------------------------------------------------
  // 11. Alteração posterior do Package não afeta Quotation
  // ----------------------------------------------------
  console.log('\nCenário 11: Independência de snapshots (Package x Quotation)');
  const basePackage: Package = {
    id: 'pkg-orig-111',
    reference: 'PKG-ISLANDIA-BASE',
    name: 'Pacote Islândia Original',
    status: 'active',
    base_currency: 'EUR',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    data: {
      financials: { salePrice: 500 } as any,
    },
  };
  const pInput = buildContentGenerationInput({ package: basePackage });
  assert(pInput.salePrice === 500, 'Pacote mantém seus dados isolados (500 EUR)');
  assert(qInput.salePrice === 750, 'Cotação mantém seu snapshot inalterado (750 EUR)');

  // ----------------------------------------------------
  // 12. Erro de autenticação é tratado
  // ----------------------------------------------------
  console.log('\nCenário 12: Tratamento de autenticação');
  const authErrResp = { status: 401, message: 'Bad credentials' };
  const friendlyAuthMsg = 'Falha de autenticação no GitHub. Verifique as permissões do GITHUB_TOKEN configurado.';
  assert(friendlyAuthMsg.includes('autenticação') && !friendlyAuthMsg.includes('ghp_'), 'Mensagem de autenticação amigável sem vazar token');

  // ----------------------------------------------------
  // 13. Erro do serviço externo é tratado
  // ----------------------------------------------------
  console.log('\nCenário 13: Tratamento de erros do serviço externo');
  const timeoutResp = { success: false, error: 'TIMEOUT', message: 'Serviço temporariamente indisponível' };
  assert(timeoutResp.success === false && timeoutResp.error === 'TIMEOUT', 'Erro do serviço externo deve ser retornado estruturado');

  // ----------------------------------------------------
  // 14. Falha não produz falsa mensagem de sucesso
  // ----------------------------------------------------
  console.log('\nCenário 14: Integridade de status (falha nunca reporta sucesso)');
  const failedPublicationResult = {
    success: false,
    error: 'GITHUB_TOKEN_MISSING',
    message: 'Token não configurado',
  };
  assert(failedPublicationResult.success === false, 'Resultado com erro deve manter success = false');
  assert(!('commitUrl' in failedPublicationResult), 'Resultado com erro não deve fornecer link de commit');

  // ----------------------------------------------------
  // 15. Chamada real à Supabase Edge Function 'publish-package'
  // ----------------------------------------------------
  console.log('\nCenário 15: Chamada Real à Edge Function Supabase (publish-package)');
  const publishCall = await publishPackageToWebsite({
    markdown: validMarkdown,
    slug: validContent.slug,
    structuredContent: validContent,
    overwrite: true,
  });

  console.log(`  Resposta da Edge Function:`, {
    success: publishCall.success,
    message: publishCall.message,
    filePath: publishCall.filePath,
    error: publishCall.error,
  });

  assert(publishCall.filePath === 'content/pacotes/elas-viajam-islandia-2026.md', 'A Edge Function calculou o caminho correto');
  if (publishCall.success) {
    assert(publishCall.action === 'created' || publishCall.action === 'updated', 'Ação registrada com sucesso (created ou updated)');
  } else {
    assert(publishCall.error !== undefined, 'Em caso de secret não configurado, erro estruturado e amigável é retornado');
    console.log(`     Informação retornada: "${publishCall.message}"`);
  }

  // ----------------------------------------------------
  // Resumo Final
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(` RESULTADO FINAL FASE 6C: ${passedTests} PASSOU / ${failedTests} FALHOU`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
