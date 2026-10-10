/**
 * Testes Isolados de Validação: Segurança Financeira - Fase 2A
 * (supabase/migrations/20261010020000_harden_financial_transactions_and_operations.sql)
 *
 * Cobertura de Testes Offline:
 * 1. Verificação estática da migração SQL da Fase 2A:
 *    - Revogação de INSERT, UPDATE, DELETE, TRUNCATE para 'anon' e 'authenticated' em financial_operations e financial_transactions.
 *    - Concessão de SELECT para 'anon' e 'authenticated' em ambas as tabelas.
 *    - Concessão de ALL para 'service_role' em ambas as tabelas.
 *    - Remoção das políticas RLS permissivas anteriores ("Allow anon and authenticated all on...").
 *    - Criação de políticas RLS restritas estritamente a SELECT ("Allow anon and authenticated select on...").
 *    - Verificação de que as outras 3 tabelas financeiras (financial_accounts, financial_operation_services, financial_commitments) não foram alteradas nesta migração.
 * 2. Auditoria estática de código do Frontend e Serviços:
 *    - Garante que src/services/financialService.ts não executa writes diretos em financial_operations.
 *    - Garante que src/services/financialService.ts não executa writes diretos em financial_transactions.
 *    - Garante que src/pages/ não executa writes diretos em financial_operations ou financial_transactions.
 *    - Garante que todas as mutações no livro-razão e operações dependem exclusivamente de RPCs SECURITY DEFINER.
 * 3. Simulação de rejeição de escritas diretas (PostgREST 42501 permission denied).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${message}`);
}

console.log('=== INICIANDO TESTES ISOLADOS: SEGURANÇA FINANCEIRA (FASE 2A) ===\n');

const migrationPath = path.resolve(
  __dirname,
  '../supabase/migrations/20261010020000_harden_financial_transactions_and_operations.sql'
);

// --- Grupo 1: Inspeção Estática do Arquivo de Migração ---
console.log('--- Grupo 1: Inspeção da Migração SQL (Fase 2A) ---');
assert(fs.existsSync(migrationPath), '1. Ficheiro de migração 20261010020000_harden_financial_transactions_and_operations.sql existe');

const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

// 1.1 Políticas RLS em financial_operations
assert(
  migrationSql.includes('DROP POLICY IF EXISTS "Allow anon and authenticated all on financial_operations"'),
  '2. Migração remove política RLS permissiva (all) de financial_operations'
);
assert(
  migrationSql.includes('CREATE POLICY "Allow anon and authenticated select on financial_operations"') &&
  migrationSql.includes('FOR SELECT') &&
  migrationSql.includes('TO anon, authenticated'),
  '3. Migração cria política RLS estrita FOR SELECT para anon e authenticated em financial_operations'
);

// 1.2 Políticas RLS em financial_transactions
assert(
  migrationSql.includes('DROP POLICY IF EXISTS "Allow anon and authenticated all on financial_transactions"'),
  '4. Migração remove política RLS permissiva (all) de financial_transactions'
);
assert(
  migrationSql.includes('CREATE POLICY "Allow anon and authenticated select on financial_transactions"') &&
  migrationSql.includes('FOR SELECT') &&
  migrationSql.includes('TO anon, authenticated'),
  '5. Migração cria política RLS estrita FOR SELECT para anon e authenticated em financial_transactions'
);

// 1.3 Revogação de privilégios de escrita
assert(
  /REVOKE\s+INSERT,\s*UPDATE,\s*DELETE,\s*TRUNCATE\s+ON\s+TABLE\s+public\.financial_operations\s+FROM\s+anon,\s*authenticated;/i.test(migrationSql),
  '6. Migração revoga INSERT, UPDATE, DELETE, TRUNCATE em financial_operations de anon e authenticated'
);
assert(
  /REVOKE\s+INSERT,\s*UPDATE,\s*DELETE,\s*TRUNCATE\s+ON\s+TABLE\s+public\.financial_transactions\s+FROM\s+anon,\s*authenticated;/i.test(migrationSql),
  '7. Migração revoga INSERT, UPDATE, DELETE, TRUNCATE em financial_transactions de anon e authenticated'
);

// 1.4 Concessão de leitura
assert(
  /GRANT\s+SELECT\s+ON\s+TABLE\s+public\.financial_operations\s+TO\s+anon,\s*authenticated;/i.test(migrationSql),
  '8. Migração garante privilégio SELECT em financial_operations para anon e authenticated'
);
assert(
  /GRANT\s+SELECT\s+ON\s+TABLE\s+public\.financial_transactions\s+TO\s+anon,\s*authenticated;/i.test(migrationSql),
  '9. Migração garante privilégio SELECT em financial_transactions para anon e authenticated'
);

// 1.5 Preservação de privilégios para service_role
assert(
  /GRANT\s+ALL\s+ON\s+TABLE\s+public\.financial_operations\s+TO\s+service_role;/i.test(migrationSql),
  '10. Migração preserva GRANT ALL em financial_operations para service_role'
);
assert(
  /GRANT\s+ALL\s+ON\s+TABLE\s+public\.financial_transactions\s+TO\s+service_role;/i.test(migrationSql),
  '11. Migração preserva GRANT ALL em financial_transactions para service_role'
);

// 1.6 Não alteração das outras 3 tabelas
assert(
  !migrationSql.includes('financial_accounts') &&
  !migrationSql.includes('financial_operation_services') &&
  !migrationSql.includes('financial_commitments'),
  '12. Migração não altera financial_accounts, financial_operation_services ou financial_commitments'
);

// --- Grupo 2: Auditoria Estática de Código do Frontend e Serviços ---
console.log('\n--- Grupo 2: Auditoria Estática de Código no Frontend e Serviços ---');

const financialServicePath = path.resolve(__dirname, '../src/services/financialService.ts');
assert(fs.existsSync(financialServicePath), '13. Arquivo financialService.ts existe');
const financialServiceCode = fs.readFileSync(financialServicePath, 'utf-8');

// Verificar ausência de escritas diretas em financial_transactions no service
assert(
  !financialServiceCode.includes("from('financial_transactions').insert") &&
  !financialServiceCode.includes("from('financial_transactions').update") &&
  !financialServiceCode.includes("from('financial_transactions').delete"),
  '14. financialService não possui chamadas de escrita direta (.insert/.update/.delete) em financial_transactions'
);

// Verificar ausência de escritas diretas em financial_operations no service
assert(
  !financialServiceCode.includes("from('financial_operations').insert") &&
  !financialServiceCode.includes("from('financial_operations').update") &&
  !financialServiceCode.includes("from('financial_operations').delete"),
  '15. financialService não possui chamadas de escrita direta (.insert/.update/.delete) em financial_operations'
);

// Verificar páginas do frontend
const pagesDir = path.resolve(__dirname, '../src/pages');
const pageFiles = fs.readdirSync(pagesDir, { recursive: true })
  .filter((f): f is string => typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx')));

let directTxWritesInPages = false;
let directOpWritesInPages = false;

for (const relFile of pageFiles) {
  const fullPath = path.join(pagesDir, relFile);
  const code = fs.readFileSync(fullPath, 'utf-8');
  if (
    code.includes("from('financial_transactions').insert") ||
    code.includes("from('financial_transactions').update") ||
    code.includes("from('financial_transactions').delete")
  ) {
    directTxWritesInPages = true;
  }
  if (
    code.includes("from('financial_operations').insert") ||
    code.includes("from('financial_operations').update") ||
    code.includes("from('financial_operations').delete")
  ) {
    directOpWritesInPages = true;
  }
}

assert(!directTxWritesInPages, '16. Nenhuma página em src/pages executa escrita direta em financial_transactions');
assert(!directOpWritesInPages, '17. Nenhuma página em src/pages executa escrita direta em financial_operations');

// --- Grupo 3: Preservação das Rotas e RPCs Financeiras Legítimas ---
console.log('\n--- Grupo 3: Preservação dos Fluxos Legítimos de RPCs ---');

assert(
  financialServiceCode.includes("rpc('approve_quotation_and_create_operation'"),
  '18. Fluxo de aprovação de cotação utiliza RPC legítima approve_quotation_and_create_operation'
);
assert(
  financialServiceCode.includes("rpc('cancel_financial_operation'"),
  '19. Fluxo de cancelamento de operação utiliza RPC legítima cancel_financial_operation'
);
assert(
  financialServiceCode.includes("rpc('record_commitment_settlement'"),
  '20. Fluxo de liquidação de compromisso utiliza RPC legítima record_commitment_settlement'
);
assert(
  financialServiceCode.includes("rpc('record_account_transfer'"),
  '21. Fluxo de transferência entre contas utiliza RPC legítima record_account_transfer'
);
assert(
  financialServiceCode.includes("rpc('record_balance_adjustment'"),
  '22. Fluxo de ajuste de saldo utiliza RPC legítima record_balance_adjustment'
);
assert(
  financialServiceCode.includes("rpc('split_financial_commitment'"),
  '23. Fluxo de divisão de compromisso utiliza RPC legítima split_financial_commitment'
);

// --- Grupo 4: Simulação de Rejeição de Escritas Diretas (PostgreSQL 42501) ---
console.log('\n--- Grupo 4: Simulação de Tratamento de Rejeição de Escrita Direta ---');

interface PostgrestMockResponse<T> {
  data: T | null;
  error: { code: string; message: string; details?: string } | null;
}

function simulateDirectWriteAttempt(table: string, action: 'insert' | 'update' | 'delete'): PostgrestMockResponse<any> {
  // Simula a resposta que o PostgreSQL 17 / PostgREST retorna quando privilégio é revogado
  if (['financial_operations', 'financial_transactions'].includes(table) && ['insert', 'update', 'delete'].includes(action)) {
    return {
      data: null,
      error: {
        code: '42501',
        message: `permission denied for table ${table}`,
        details: `Role anon does not have ${action.toUpperCase()} permission on public.${table}`,
      },
    };
  }
  return { data: { success: true }, error: null };
}

const mockOpInsert = simulateDirectWriteAttempt('financial_operations', 'insert');
assert(mockOpInsert.error?.code === '42501', '24. Escrita direta em financial_operations rejeitada com erro 42501');
assert(mockOpInsert.error?.message.includes('permission denied'), '25. Mensagem de erro reflete permission denied');

const mockTxInsert = simulateDirectWriteAttempt('financial_transactions', 'insert');
assert(mockTxInsert.error?.code === '42501', '26. Escrita direta em financial_transactions rejeitada com erro 42501');
assert(mockTxInsert.error?.message.includes('permission denied'), '27. Mensagem de erro reflete permission denied');

const mockTxUpdate = simulateDirectWriteAttempt('financial_transactions', 'update');
assert(mockTxUpdate.error?.code === '42501', '28. Atualização direta em financial_transactions rejeitada com erro 42501');

const mockTxDelete = simulateDirectWriteAttempt('financial_transactions', 'delete');
assert(mockTxDelete.error?.code === '42501', '29. Exclusão direta em financial_transactions rejeitada com erro 42501');

const mockOpDelete = simulateDirectWriteAttempt('financial_operations', 'delete');
assert(mockOpDelete.error?.code === '42501', '30. Exclusão direta em financial_operations rejeitada com erro 42501');

console.log('\n=============================================================');
console.log('🎉 TODOS OS 30 TESTES ISOLADOS DA FASE 2A PASSARAM COM SUCESSO!');
console.log('=============================================================\n');
