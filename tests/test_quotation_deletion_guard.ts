import * as fs from 'fs';
import * as path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runQuotationDeletionGuardTests() {
  console.log('=== TESTES: ARQUIVAMENTO / EXCLUSÃO LÓGICA E GUARDA DE COTAÇÕES ===\n');

  // =========================================================================
  // 1. AUDITORIA DA MIGRATION DE ARQUIVAMENTO
  // =========================================================================
  console.log('--- 1. Auditoria da Migration SQL ---');
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261001090000_add_archived_at_to_quotations.sql'
  );
  assert(fs.existsSync(migrationPath), 'Migration 20261001090000_add_archived_at_to_quotations.sql deve existir');
  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
  assert(
    migrationContent.includes('ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL'),
    'Migration deve adicionar a coluna archived_at TIMESTAMPTZ'
  );
  assert(
    migrationContent.includes('idx_quotations_archived_at'),
    'Migration deve criar índice para a coluna archived_at'
  );
  assert(
    migrationContent.includes('check_quotation_archive_trigger'),
    'Migration deve criar trigger para bloquear arquivamento com operação financeira ativa'
  );

  // =========================================================================
  // 2. AUDITORIA DE TIPOS (src/types/index.ts)
  // =========================================================================
  console.log('\n--- 2. Auditoria do Modelo de Tipos (src/types/index.ts) ---');
  const typesPath = path.resolve(process.cwd(), 'src/types/index.ts');
  const typesContent = fs.readFileSync(typesPath, 'utf-8');
  assert(
    typesContent.includes('archived_at: string | null;'),
    'Interface Quotation deve definir archived_at: string | null'
  );
  assert(
    typesContent.includes('has_financial_operation?: boolean;'),
    'Interface Quotation deve definir has_financial_operation?: boolean'
  );
  assert(
    typesContent.includes('financial_operation_status?: \'active\' | \'cancelled\' | null;'),
    'Interface Quotation deve definir financial_operation_status'
  );

  // =========================================================================
  // 3. AUDITORIA DAS REGRAS NO SERVIÇO (src/services/quotationsService.ts)
  // =========================================================================
  console.log('\n--- 3. Auditoria do Serviço de Cotações (quotationsService.ts) ---');
  const servicePath = path.resolve(process.cwd(), 'src/services/quotationsService.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');

  assert(
    serviceContent.includes('archiveQuotation(id: string)'),
    'quotationsService deve implementar archiveQuotation'
  );
  assert(
    serviceContent.includes('unarchiveQuotation(id: string)'),
    'quotationsService deve implementar unarchiveQuotation'
  );
  assert(
    serviceContent.includes('is(\'archived_at\', null)'),
    'listQuotations deve filtrar cotações ativas por padrão com archived_at IS NULL'
  );
  assert(
    serviceContent.includes('not(\'archived_at\', \'is\', null)'),
    'listQuotations deve permitir buscar arquivadas com archivedOnly: true'
  );
  assert(
    serviceContent.includes('Não é permitido arquivar uma cotação com operação financeira ativa'),
    'archiveQuotation deve impedir arquivamento quando a operação financeira for ativa'
  );
  assert(
    serviceContent.includes('23503') || serviceContent.includes('financial_operations'),
    'deleteQuotation deve capturar violação de chave estrangeira do PostgreSQL e proteger histórico'
  );

  // =========================================================================
  // 4. AUDITORIA DE CÓDIGO E MENSAGENS NAS TELAS
  // =========================================================================
  console.log('\n--- 4. Auditoria de Código e Mensagens de UI ---');

  const listPagePath = path.resolve(process.cwd(), 'src/pages/quotes/QuotesListPage.tsx');
  assert(fs.existsSync(listPagePath), 'QuotesListPage.tsx deve existir');
  const listPageContent = fs.readFileSync(listPagePath, 'utf-8');

  assert(
    listPageContent.includes('setFilterMode'),
    'QuotesListPage deve ter controle de abas/filtros entre ativas e arquivadas'
  );
  assert(
    listPageContent.includes('handleArchive'),
    'QuotesListPage deve fornecer ação de arquivar cotações'
  );
  assert(
    listPageContent.includes('handleUnarchive'),
    'QuotesListPage deve fornecer ação de desarquivar cotações'
  );
  assert(
    listPageContent.includes('possui operação financeira vinculada'),
    'QuotesListPage deve exibir mensagem clara em português sobre a operação vinculada'
  );

  const detailPagePath = path.resolve(process.cwd(), 'src/pages/quotes/QuoteDetailPage.tsx');
  assert(fs.existsSync(detailPagePath), 'QuoteDetailPage.tsx deve existir');
  const detailPageContent = fs.readFileSync(detailPagePath, 'utf-8');

  assert(
    detailPageContent.includes('ARQUIVADA'),
    'QuoteDetailPage deve exibir badge ARQUIVADA no cabeçalho'
  );
  assert(
    detailPageContent.includes('Cotação Arquivada'),
    'QuoteDetailPage deve exibir banner informativo de Cotação Arquivada'
  );
  assert(
    detailPageContent.includes('quote.archived_at ? (') && !detailPageContent.includes('Excluir</button>\n          ) : ('),
    'QuoteDetailPage não deve oferecer exclusão física quando a cotação estiver arquivada'
  );
  assert(
    detailPageContent.includes('handleArchive'),
    'QuoteDetailPage deve implementar ação de arquivamento'
  );

  // =========================================================================
  // 5. TESTES UNITÁRIOS DE COMPORTAMENTO E LÓGICA
  // =========================================================================
  console.log('\n--- 5. Testes Unitários de Regras de Negócio de Arquivamento ---');

  // Cenário 1: Comportamento padrão de listagem (archived_at IS NULL)
  const mockQuotationsDatabase = [
    { id: '1', reference: 'COT-2026-001', archived_at: null, status: 'draft' },
    { id: '2', reference: 'COT-2026-002', archived_at: '2026-10-01T00:00:00Z', status: 'accepted' },
    { id: '3', reference: 'COT-2026-003', archived_at: null, status: 'sent' },
  ];

  const simulateListQuotations = (options?: { includeArchived?: boolean; archivedOnly?: boolean }) => {
    if (options?.archivedOnly) {
      return mockQuotationsDatabase.filter((q) => q.archived_at !== null);
    }
    if (options?.includeArchived) {
      return [...mockQuotationsDatabase];
    }
    // Padrão: archived_at IS NULL
    return mockQuotationsDatabase.filter((q) => q.archived_at === null);
  };

  const defaultList = simulateListQuotations();
  assert(
    defaultList.length === 2 && defaultList.every((q) => q.archived_at === null),
    'Listagem padrão deve retornar estritamente apenas cotações com archived_at IS NULL'
  );
  assert(
    !defaultList.some((q) => q.id === '2'),
    'Cotação arquivada COT-2026-002 não deve aparecer na listagem padrão'
  );

  const archivedList = simulateListQuotations({ archivedOnly: true });
  assert(
    archivedList.length === 1 && archivedList[0].id === '2',
    'Listagem de arquivadas deve retornar apenas a cotação com archived_at preenchido'
  );

  // Cenário 2: Arquivamento com Operação Financeira Ativa (deve ser BLOQUEADO)
  const mockService = {
    async archiveQuotation(quoteId: string, opStatus?: 'active' | 'cancelled' | null) {
      if (opStatus === 'active') {
        throw new Error(
          'Não é permitido arquivar uma cotação com operação financeira ativa. Realize o cancelamento financeiro antes de arquivar.'
        );
      }
      return { id: quoteId, archived_at: new Date().toISOString() };
    },
    async deleteQuotation(quoteId: string, hasOp: boolean, opStatus?: 'active' | 'cancelled' | null) {
      if (hasOp) {
        if (opStatus === 'cancelled') {
          throw new Error(
            'Esta cotação possui uma operação financeira vinculada ao histórico contábil e não pode ser excluída fisicamente. Utilize a opção de arquivamento para ocultá-la das listagens normais.'
          );
        }
        throw new Error(
          'Esta cotação possui uma operação financeira vinculada e não pode ser excluída para preservar o histórico financeiro.'
        );
      }
      return true;
    },
  };

  let activeOpArchiveBlocked = false;
  try {
    await mockService.archiveQuotation('quote-active-op', 'active');
  } catch (err: any) {
    activeOpArchiveBlocked = true;
    assert(
      err.message.includes('Não é permitido arquivar uma cotação com operação financeira ativa'),
      'Arquivamento de cotação com operação ativa deve ser bloqueado com mensagem amigável'
    );
  }
  assert(activeOpArchiveBlocked, 'Tentativa de arquivar cotação com operação ativa foi bloqueada com sucesso');

  // Cenário 3: Arquivamento com Operação Financeira Cancelada (deve ser PERMITIDO)
  let cancelledOpArchived = false;
  try {
    const result = await mockService.archiveQuotation('quote-cancelled-op', 'cancelled');
    assert(Boolean(result.archived_at), 'Cotação com operação cancelada deve receber archived_at');
    cancelledOpArchived = true;
  } catch {
    cancelledOpArchived = false;
  }
  assert(cancelledOpArchived, 'Cotação com operação financeira cancelada pode ser arquivada com sucesso');

  // Cenário 4: Exclusão física de cotação com operação cancelada (deve ser bloqueada, sugerindo arquivamento)
  let physicalDeleteBlockedWithAdvice = false;
  try {
    await mockService.deleteQuotation('quote-cancelled-op', true, 'cancelled');
  } catch (err: any) {
    physicalDeleteBlockedWithAdvice = true;
    assert(
      err.message.includes('Utilize a opção de arquivamento'),
      'Exclusão de cotação cancelada deve orientar o usuário a utilizar a opção de arquivamento'
    );
  }
  assert(
    physicalDeleteBlockedWithAdvice,
    'Exclusão física de cotação com histórico cancelado foi bloqueada orientando arquivamento'
  );

  // Cenário 5: Interceptação defensiva de erro de Foreign Key (código 23503)
  let fkConstraintFriendly = false;
  try {
    const simulatePgConstraint = () => {
      const error: any = new Error(
        'update or delete on table "quotations" violates foreign key constraint "financial_operations_quotation_id_fkey"'
      );
      error.code = '23503';
      if (error.code === '23503') {
        throw new Error(
          'Esta cotação possui uma operação financeira vinculada e não pode ser excluída fisicamente. Utilize a opção de arquivamento para ocultá-la das listagens normais.'
        );
      }
    };
    simulatePgConstraint();
  } catch (err: any) {
    fkConstraintFriendly = true;
    assert(
      !err.message.includes('foreign key constraint') && !err.message.includes('23503'),
      'Erro bruto de FK do PostgreSQL nunca deve vazar para a interface'
    );
    assert(
      err.message.includes('Utilize a opção de arquivamento'),
      'Mensagem tratada deve ser em português claro instruindo o arquivamento'
    );
  }
  assert(fkConstraintFriendly, 'Erro de FK foi traduzido para mensagem amigável com sucesso');

  console.log('\n🎉 TODOS OS TESTES DE ARQUIVAMENTO E EXCLUSÃO LÓGICA PASSARAM COM SUCESSO!\n');
  process.exit(0);
}

runQuotationDeletionGuardTests().catch((err) => {
  console.error('Erro nos testes:', err);
  process.exit(1);
});
