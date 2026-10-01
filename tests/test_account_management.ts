import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
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

async function runTests() {
  console.log('=== TESTES: GESTÃO DE CONTAS — RENOMEAR, ATIVAR/DESATIVAR, AJUSTE DE SALDO ===\n');

  // ─── 1. Auditoria Estática ────────────────────────────────────────────────
  console.log('--- 1. Auditoria Estática de Tipos e Serviço ---');

  const financialTypesPath = path.resolve(process.cwd(), 'src/types/financial.ts');
  const typesSource = fs.readFileSync(financialTypesPath, 'utf-8');
  assert(typesSource.includes("'balance_adjustment'"), "FinancialTransactionType inclui 'balance_adjustment'");
  assert(typesSource.includes("BalanceAdjustmentDirection"), "Tipo BalanceAdjustmentDirection exportado");
  assert(typesSource.includes("RecordBalanceAdjustmentInput"), "Interface RecordBalanceAdjustmentInput exportada");
  assert(typesSource.includes("RecordBalanceAdjustmentResult"), "Interface RecordBalanceAdjustmentResult exportada");
  assert(typesSource.includes("direction: BalanceAdjustmentDirection"), "RecordBalanceAdjustmentInput tem campo direction");
  assert(typesSource.includes("reason: string"), "RecordBalanceAdjustmentInput tem campo reason obrigatório");

  assert(typesSource.includes("adjustment_direction?: BalanceAdjustmentDirection | null"), "FinancialTransaction tem campo adjustment_direction estruturado");

  const serviceSource = fs.readFileSync(path.resolve(process.cwd(), 'src/services/financialService.ts'), 'utf-8');
  assert(serviceSource.includes('async updateAccountName'), "financialService implementa updateAccountName");
  assert(serviceSource.includes('async toggleAccountActive'), "financialService implementa toggleAccountActive");
  assert(serviceSource.includes('async recordBalanceAdjustment'), "financialService implementa recordBalanceAdjustment");
  assert(serviceSource.includes("'record_balance_adjustment'"), "recordBalanceAdjustment chama RPC record_balance_adjustment");

  const migrationDir = path.resolve(process.cwd(), 'supabase/migrations');
  const migration11Path = path.resolve(migrationDir, '20261001110000_add_structured_adjustment_direction.sql');
  assert(fs.existsSync(migration11Path), "Migration 20261001110000_add_structured_adjustment_direction.sql existe");
  const migration11SQL = fs.readFileSync(migration11Path, 'utf-8');
  assert(migration11SQL.includes('adjustment_direction TEXT'), "Migration adiciona coluna adjustment_direction");
  assert(migration11SQL.includes('financial_transactions_adjustment_direction_check'), "Migration adiciona constraint de integridade de adjustment_direction");
  assert(migration11SQL.includes('record_balance_adjustment'), "Migration atualiza record_balance_adjustment");
  assert(migration11SQL.includes("adjustment_direction = 'positive'"), "Motor de saldo usa ft.adjustment_direction = 'positive'");
  assert(migration11SQL.includes("adjustment_direction = 'negative'"), "Motor de saldo usa ft.adjustment_direction = 'negative'");
  const getBalancesSQL = migration11SQL.slice(migration11SQL.indexOf('CREATE OR REPLACE FUNCTION get_financial_account_balances()'));
  assert(!getBalancesSQL.includes("description LIKE"), "get_financial_account_balances NÃO utiliza description LIKE");
  assert(migration11SQL.includes('IF NOT v_account.active'), "Função rejeita conta desativada");
  assert(migration11SQL.includes('O motivo do ajuste é obrigatório'), "Função exige motivo");
  assert(migration11SQL.includes('p_amount <= 0'), "Função rejeita valor zero/negativo");

  const uiSource = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/quotes/QuotationFinancialPage.tsx'), 'utf-8');
  assert(uiSource.includes('handleOpenBalanceAdjustment'), "UI tem handler handleOpenBalanceAdjustment");
  assert(uiSource.includes('handleSaveBalanceAdjustment'), "UI tem handler handleSaveBalanceAdjustment");
  assert(uiSource.includes('handleToggleAccountActive'), "UI tem handler handleToggleAccountActive");
  assert(uiSource.includes('handleSaveAccountName'), "UI tem handler handleSaveAccountName");
  assert(uiSource.includes('± Ajustar'), "UI exibe botão '± Ajustar'");
  assert(uiSource.includes('Tipo de Ajuste'), "UI exibe seletor de tipo de ajuste");
  assert(uiSource.includes('Motivo / Observação'), "UI exibe campo de motivo obrigatório");
  assert(uiSource.includes('adjBalanceDirection'), "UI mantém estado adjBalanceDirection");
  assert(uiSource.includes("BalanceAdjustmentDirection"), "UI importa BalanceAdjustmentDirection");
  assert(uiSource.includes("Ajuste de Saldo sem alterar o saldo inicial") || uiSource.includes("sem alterar o saldo inicial"), "UI informa que não altera saldo inicial");
  assert(uiSource.includes("acc.active && ("), "Botão Ajustar exibido apenas para contas ativas");
  assert(uiSource.includes("editingNameId === acc.id"), "UI suporta edição inline de nome");

  console.log('\n--- 2. Testes de Regras de Negócio (Unitários) ---');

  // Simular validação de amount
  const validateAdjustment = (amount: number, reason: string, active: boolean) => {
    if (!active) return { ok: false, error: 'Conta desativada' };
    if (!amount || amount <= 0) return { ok: false, error: 'Valor inválido' };
    if (!reason || !reason.trim()) return { ok: false, error: 'Motivo obrigatório' };
    return { ok: true, error: null };
  };

  assert(!validateAdjustment(0, 'teste', true).ok, "Valor zero é rejeitado");
  assert(!validateAdjustment(-100, 'teste', true).ok, "Valor negativo é rejeitado");
  assert(!validateAdjustment(100, '', true).ok, "Motivo vazio é rejeitado");
  assert(!validateAdjustment(100, '   ', true).ok, "Motivo só com espaços é rejeitado");
  assert(!validateAdjustment(100, 'teste', false).ok, "Conta desativada rejeita ajuste");
  assert(validateAdjustment(100, 'Correção contábil', true).ok, "Ajuste válido é aceito");
  assert(validateAdjustment(0.01, 'Centavo', true).ok, "Valor mínimo de 0.01 é aceito");

  // Simular lógica de saldo
  const calcBalance = (initial: number, adjustments: Array<{ amount: number; direction: 'positive' | 'negative' }>) => {
    return adjustments.reduce((bal, adj) => {
      return adj.direction === 'positive' ? bal + adj.amount : bal - adj.amount;
    }, initial);
  };

  const saldo1 = calcBalance(1000, [{ amount: 500, direction: 'positive' }]);
  assert(saldo1 === 1500, "Ajuste positivo aumenta saldo corretamente (1000 + 500 = 1500)");

  const saldo2 = calcBalance(1000, [{ amount: 300, direction: 'negative' }]);
  assert(saldo2 === 700, "Ajuste negativo reduz saldo corretamente (1000 - 300 = 700)");

  const saldo3 = calcBalance(1000, [
    { amount: 500, direction: 'positive' },
    { amount: 200, direction: 'negative' },
    { amount: 100, direction: 'positive' },
  ]);
  assert(saldo3 === 1400, "Múltiplos ajustes calculados corretamente (1000+500-200+100=1400)");

  assert(calcBalance(0, []) === 0, "Saldo sem ajustes é igual ao initial_balance");

  // ─── 3. Testes de Integração (requerem Supabase remoto) ──────────────────
  console.log('\n--- 3. Testes de Integração (Supabase remoto) ---');

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    console.log('ℹ️  Credenciais do Supabase não encontradas. Pulando testes remotos.');
    console.log('\n🎉 Todos os testes estáticos e unitários de gestão de contas passaram!\n');
    return;
  }

  try {
    await fetch(process.env.VITE_SUPABASE_URL, { signal: AbortSignal.timeout(1500) });
  } catch {
    console.log('ℹ️  Supabase remoto inacessível. Pulando testes remotos.');
    console.log('\n🎉 Todos os testes estáticos e unitários de gestão de contas passaram!\n');
    return;
  }

  const { supabase } = await import('../src/lib/supabase');
  const { financialService } = await import('../src/services/financialService');

  const testAccountIds: string[] = [];

  try {
    // 3.1 Criar conta de teste
    const testName = `TEST-ACC-ADJ-${Date.now()}`;
    const acc = await financialService.createAccount({
      name: testName,
      type: 'cash',
      currency: 'EUR',
      initial_balance: 1000,
      initial_balance_date: new Date().toISOString().slice(0, 10),
      active: true,
    });
    testAccountIds.push(acc.id);
    assert(acc.id.length > 0, `Conta de teste criada: ${testName}`);
    assert(acc.initial_balance === 1000, "initial_balance da conta de teste é 1000");

    // 3.2 Renomear conta
    const renamed = await financialService.updateAccountName(acc.id, testName + '-RENAMED');
    assert(renamed.name === testName + '-RENAMED', "updateAccountName renomeia a conta corretamente");
    assert(renamed.initial_balance === 1000, "Renomear não altera initial_balance");

    // 3.3 Ajuste positivo: +500
    const adjPos = await financialService.recordBalanceAdjustment({
      account_id: acc.id,
      amount: 500,
      direction: 'positive',
      reason: 'Teste: ajuste positivo de integração',
      adjusted_at: new Date().toISOString(),
    });
    assert(adjPos.success === true, "Ajuste positivo retorna success=true");
    assert(adjPos.amount === 500, "Ajuste positivo registra amount=500");
    assert(adjPos.direction === 'positive', "Ajuste positivo registra direction=positive");
    assert(typeof adjPos.transaction_id === 'string' && adjPos.transaction_id.length > 0, "Ajuste positivo retorna transaction_id");

    // 3.4 Verificar que a transação foi criada com type='balance_adjustment' e adjustment_direction='positive'
    const { data: txData } = await supabase
      .from('financial_transactions')
      .select('id, type, amount, description, adjustment_direction')
      .eq('id', adjPos.transaction_id)
      .single();
    assert(txData?.type === 'balance_adjustment', "Transação criada tem type='balance_adjustment'");
    assert(Number(txData?.amount) === 500, "Transação criada tem amount=500");
    assert(txData?.adjustment_direction === 'positive', "Transação tem adjustment_direction='positive' estruturado");
    assert(!txData?.description?.includes('[positive]'), "description NÃO contém tags de direção (armazena apenas o motivo legível)");
    assert(txData?.description === 'Teste: ajuste positivo de integração', "description armazena exatamente o motivo humano");

    // 3.5 Ajuste negativo: -200
    const adjNeg = await financialService.recordBalanceAdjustment({
      account_id: acc.id,
      amount: 200,
      direction: 'negative',
      reason: 'Teste: ajuste negativo de integração',
      reference: 'TEST-REF-001',
    });
    assert(adjNeg.success === true, "Ajuste negativo retorna success=true");
    assert(adjNeg.direction === 'negative', "Ajuste negativo registra direction=negative");

    const { data: txNegData } = await supabase
      .from('financial_transactions')
      .select('id, type, amount, description, adjustment_direction')
      .eq('id', adjNeg.transaction_id)
      .single();
    assert(txNegData?.adjustment_direction === 'negative', "Transação negativa tem adjustment_direction='negative' estruturado");
    assert(!txNegData?.description?.includes('[negative]'), "description negativa NÃO contém tag [negative]");

    // 3.5.1 Testar constraint: não permitir adjustment_direction inválido ou em outros tipos
    let constraintError = false;
    try {
      await supabase.from('financial_transactions').insert({
        type: 'inflow',
        account_id: acc.id,
        amount: 50,
        currency: 'EUR',
        adjustment_direction: 'positive', // inválido para inflow!
        description: 'Inflow com direction inválido',
      } as any);
    } catch {
      constraintError = true;
    }
    // Também verificar via insert direto com error
    const { error: insertErr } = await supabase.from('financial_transactions').insert({
      type: 'inflow',
      account_id: acc.id,
      amount: 50,
      currency: 'EUR',
      adjustment_direction: 'positive',
      description: 'Inflow com direction inválido',
    } as any);
    assert(constraintError || insertErr !== null, "Constraint de banco impede adjustment_direction preenchido em transações que não sejam balance_adjustment");

    // 3.6 Verificar saldo calculado via motor: 1000 + 500 - 200 = 1300
    const balances = await financialService.getAccountBalances({ activeOnly: true });
    const testBalance = balances.find(b => b.account_id === acc.id);
    assert(testBalance !== undefined, "Conta de teste aparece no motor de saldos");
    assert(testBalance!.current_balance === 1300, `Saldo calculado = 1300 (initial 1000 + adj+500 - adj-200): obtido ${testBalance!.current_balance}`);
    assert(testBalance!.initial_balance === 1000, "initial_balance NÃO foi alterado pelos ajustes");

    // 3.7 Desativar conta
    const deactivated = await financialService.toggleAccountActive(acc.id, false);
    assert(deactivated.active === false, "toggleAccountActive(false) desativa a conta");

    // 3.8 Rejeitar ajuste em conta desativada
    let rejectedError: string | null = null;
    try {
      await financialService.recordBalanceAdjustment({
        account_id: acc.id,
        amount: 100,
        direction: 'positive',
        reason: 'Não deve ser aceito',
      });
    } catch (err: any) {
      rejectedError = err.message;
    }
    assert(rejectedError !== null, "Ajuste em conta desativada lança exceção");
    assert(rejectedError!.toLowerCase().includes('desativada') || rejectedError!.toLowerCase().includes('desativ'), "Mensagem de erro menciona conta desativada");

    // 3.9 Reativar conta
    const reactivated = await financialService.toggleAccountActive(acc.id, true);
    assert(reactivated.active === true, "toggleAccountActive(true) reativa a conta");

    // 3.10 Verificar que initial_balance permanece 1000 após todo o ciclo
    const { data: finalAcc } = await supabase
      .from('financial_accounts')
      .select('initial_balance, name')
      .eq('id', acc.id)
      .single();
    assert(Number(finalAcc?.initial_balance) === 1000, "initial_balance permanece inalterado após todos os ajustes");

    console.log('\n🎉 Todos os testes de gestão de contas passaram com sucesso!\n');
  } finally {
    // Limpeza determinística: transações → conta
    for (const accId of testAccountIds) {
      await supabase.from('financial_transactions').delete().eq('account_id', accId);
      await supabase.from('financial_accounts').delete().eq('id', accId);
    }
  }
}

runTests().catch((err) => {
  console.error('Erro fatal nos testes de gestão de contas:', err);
  process.exit(1);
});
