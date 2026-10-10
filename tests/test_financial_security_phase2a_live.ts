/**
 * Testes Reais de Integração: Segurança Financeira - Fase 2A (Supabase DEV)
 * Executado EXCLUSIVAMENTE contra o banco de dados DEV (rskhshtewkgrllbtamsr).
 *
 * NOTA: Este teste deve ser executado APENAS após a aplicação autorizada da migração
 * 20261010020000_harden_financial_transactions_and_operations.sql no Supabase DEV.
 *
 * Validações Reais:
 * 1. Confirma que o cliente anônimo (anon) tem escritas diretas RECUSADAS com erro 42501 (permission denied):
 *    - INSERT direto em public.financial_operations
 *    - UPDATE direto em public.financial_operations
 *    - DELETE direto em public.financial_operations
 *    - INSERT direto em public.financial_transactions
 *    - UPDATE direto em public.financial_transactions
 *    - DELETE direto em public.financial_transactions
 * 2. Confirma que o cliente anônimo (anon) mantém permissão de leitura (SELECT) em ambas as tabelas.
 * 3. Confirma que funções RPC legítimas com SECURITY DEFINER continuam a operar normalmente.
 */

import * as fs from 'fs';
import * as path from 'path';

// Carregar .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      if (!process.env[k]) {
        process.env[k] = v;
      }
    }
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runLiveSecurityAudit() {
  console.log('=== TESTES REAIS DE INTEGRAÇÃO: SEGURANÇA FINANCEIRA (FASE 2A) ===\n');

  // 1. Exigir opt-in explícito para execução remota
  const isExplicitOptIn = process.env.RUN_FINANCIAL_SECURITY_LIVE === 'true';
  if (!isExplicitOptIn) {
    console.warn(
      '⚠️  [EXECUÇÃO NÃO AUTORIZADA]:\n' +
      '    O teste live de segurança da Fase 2A requer confirmação explícita de opt-in.\n' +
      '    Para executar, defina RUN_FINANCIAL_SECURITY_LIVE=true no ambiente.\n' +
      '    Operação interrompida preventivamente sem efetuar chamadas remotas.'
    );
    return;
  }

  // 2. Guardião de ambiente DEV (proibido em PROD)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  if (!supabaseUrl.includes('rskhshtewkgrllbtamsr')) {
    console.error('❌ [FAIL] Operação abortada: Este teste só pode ser executado contra Supabase DEV (rskhshtewkgrllbtamsr).');
    process.exit(1);
  }

  // 3. Verificação de mecanismo de limpeza seguro comprovado:
  // Sob a Fase 2A, a presença isolada de SERVICE_ROLE_KEY não autoriza nem comprova por si só a limpeza segura,
  // pois inserções ou modificações deixam registros referenciados e imutáveis.
  // Este teste realiza exclusivamente tentativas de escrita rejeitadas (42501) que não persistem linhas e leituras (SELECT),
  // garantindo ausência de resíduos contábeis em DEV.
  console.log('🔒 Conectado com sucesso ao Supabase DEV (rskhshtewkgrllbtamsr)\n');

  const { supabase } = await import('../src/lib/supabase');
  const { financialService } = await import('../src/services/financialService');

  const dummyId = '00000000-0000-0000-0000-000000000000';

  // --- Bloco 1: Escritas Diretas em public.financial_operations ---
  console.log('--- Bloco 1: Validação de Bloqueio em public.financial_operations ---');

  // 1.1 INSERT direto
  const { data: insertOpData, error: insertOpErr } = await supabase
    .from('financial_operations')
    .insert({
      quotation_id: dummyId,
      status: 'active',
      notes: 'Tentativa de escrita direta maliciosa',
    } as any)
    .select();

  assert(
    insertOpErr !== null && (insertOpErr.code === '42501' || insertOpErr.message.toLowerCase().includes('permission denied')),
    `1. INSERT direto em financial_operations é recusado pelo PostgreSQL (erro: ${insertOpErr?.code} - ${insertOpErr?.message})`
  );
  assert(insertOpData === null, '2. Nenhum dado foi inserido em financial_operations');

  // 1.2 UPDATE direto
  const { error: updateOpErr } = await supabase
    .from('financial_operations')
    .update({ notes: 'Tentativa de update direto' } as any)
    .eq('id', dummyId);

  assert(
    updateOpErr !== null && (updateOpErr.code === '42501' || updateOpErr.message.toLowerCase().includes('permission denied')),
    `3. UPDATE direto em financial_operations é recusado pelo PostgreSQL (erro: ${updateOpErr?.code} - ${updateOpErr?.message})`
  );

  // 1.3 DELETE direto
  const { error: deleteOpErr } = await supabase
    .from('financial_operations')
    .delete()
    .eq('id', dummyId);

  assert(
    deleteOpErr !== null && (deleteOpErr.code === '42501' || deleteOpErr.message.toLowerCase().includes('permission denied')),
    `4. DELETE direto em financial_operations é recusado pelo PostgreSQL (erro: ${deleteOpErr?.code} - ${deleteOpErr?.message})`
  );

  // --- Bloco 2: Escritas Diretas em public.financial_transactions ---
  console.log('\n--- Bloco 2: Validação de Bloqueio em public.financial_transactions ---');

  // 2.1 INSERT direto
  const { data: insertTxData, error: insertTxErr } = await supabase
    .from('financial_transactions')
    .insert({
      account_id: dummyId,
      type: 'inflow',
      amount: 999999,
      currency: 'EUR',
      description: 'Tentativa de forjar movimentação contábil direta',
    } as any)
    .select();

  assert(
    insertTxErr !== null && (insertTxErr.code === '42501' || insertTxErr.message.toLowerCase().includes('permission denied')),
    `5. INSERT direto em financial_transactions é recusado pelo PostgreSQL (erro: ${insertTxErr?.code} - ${insertTxErr?.message})`
  );
  assert(insertTxData === null, '6. Nenhum dado foi inserido em financial_transactions');

  // 2.2 UPDATE direto
  const { error: updateTxErr } = await supabase
    .from('financial_transactions')
    .update({ amount: 1 } as any)
    .eq('id', dummyId);

  assert(
    updateTxErr !== null && (updateTxErr.code === '42501' || updateTxErr.message.toLowerCase().includes('permission denied')),
    `7. UPDATE direto em financial_transactions é recusado pelo PostgreSQL (erro: ${updateTxErr?.code} - ${updateTxErr?.message})`
  );

  // 2.3 DELETE direto
  const { error: deleteTxErr } = await supabase
    .from('financial_transactions')
    .delete()
    .eq('id', dummyId);

  assert(
    deleteTxErr !== null && (deleteTxErr.code === '42501' || deleteTxErr.message.toLowerCase().includes('permission denied')),
    `8. DELETE direto em financial_transactions é recusado pelo PostgreSQL (erro: ${deleteTxErr?.code} - ${deleteTxErr?.message})`
  );

  // --- Bloco 3: Leitura (SELECT) permitida para anon ---
  console.log('\n--- Bloco 3: Validação de Leitura (SELECT) para anon ---');

  const { data: selectOpData, error: selectOpErr } = await supabase
    .from('financial_operations')
    .select('id, quotation_id, status')
    .limit(1);

  assert(selectOpErr === null, '9. Leitura (SELECT) em financial_operations é permitida para anon');
  assert(Array.isArray(selectOpData), '10. Retorno de SELECT em financial_operations é um array válido');

  const { data: selectTxData, error: selectTxErr } = await supabase
    .from('financial_transactions')
    .select('id, type, amount, currency')
    .limit(1);

  assert(selectTxErr === null, '11. Leitura (SELECT) em financial_transactions é permitida para anon');
  assert(Array.isArray(selectTxData), '12. Retorno de SELECT em financial_transactions é um array válido');

  // --- Bloco 4: Operação Legítima de RPC via SECURITY DEFINER ---
  console.log('\n--- Bloco 4: RPCs Legítimas Operando via SECURITY DEFINER ---');

  // Obter saldos consolidados (chama RPC interna get_financial_account_balances)
  const balances = await financialService.getAccountBalances({ activeOnly: true });
  assert(Array.isArray(balances), '13. Chamada à RPC de consulta de saldos executa normalmente via SECURITY DEFINER');

  console.log('\n=============================================================');
  console.log('🎉 TODOS OS TESTES REAIS DE INTEGRAÇÃO DA FASE 2A PASSARAM!');
  console.log('=============================================================\n');
}

runLiveSecurityAudit().catch(err => {
  console.error('❌ [FAIL] Erro inesperado na execução do teste:', err);
  process.exit(1);
});
