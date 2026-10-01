import * as fs from 'fs';
import * as path from 'path';

// Carregar .env.local no ambiente Node do runner de testes
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

async function runDashboardPhase3BTests() {
  console.log('=== TESTES: FASE 3B — POSIÇÃO DE CAIXA E NOVA VISÃO GERAL ===\n');

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    console.log('ℹ️  Credenciais do Supabase não encontradas. Pulando testes remotos.');
    return;
  }

  const { supabase } = await import('../src/lib/supabase');
  const { quotationsService } = await import('../src/services/quotationsService');
  const { financialService } = await import('../src/services/financialService');

  const createdAccountIds: string[] = [];
  const createdQuoteIds: string[] = [];

  try {
    // =========================================================================
    // 1. ESTADO EUR & BRL: CRIAÇÃO DE CENÁRIO OPERACIONAL CONTROLADO
    // =========================================================================
    console.log('\n--- 1. Preparando contas ativas em EUR e BRL ---');

    // Conta Bancária EUR 1 (com saldo e compromisso futuro)
    const accEur1 = await financialService.createAccount({
      name: `Conta BCP Principal EUR ${Date.now()}`,
      type: 'bank_account',
      currency: 'EUR',
      initial_balance: 2500.00,
      initial_balance_date: '2026-01-01',
    });
    createdAccountIds.push(accEur1.id);

    // Conta Bancária EUR 2 (sem compromissos vinculados)
    const accEur2 = await financialService.createAccount({
      name: `Conta Santander Reserva EUR ${Date.now()}`,
      type: 'bank_account',
      currency: 'EUR',
      initial_balance: 800.00,
      initial_balance_date: '2026-01-01',
    });
    createdAccountIds.push(accEur2.id);

    // Cartão de Crédito EUR
    const accEurCard = await financialService.createAccount({
      name: `Cartão Amex Corporativo EUR ${Date.now()}`,
      type: 'credit_card',
      currency: 'EUR',
      initial_balance: 0.00,
      initial_balance_date: '2026-01-01',
    });
    createdAccountIds.push(accEurCard.id);

    // Conta Bancária BRL (com saldo e compromisso em BRL)
    const accBrl1 = await financialService.createAccount({
      name: `Conta Itaú Operações BRL ${Date.now()}`,
      type: 'bank_account',
      currency: 'BRL',
      initial_balance: 15000.00,
      initial_balance_date: '2026-01-01',
    });
    createdAccountIds.push(accBrl1.id);

    // Conta Caixa Físico BRL (sem compromissos vinculados)
    const accBrlCash = await financialService.createAccount({
      name: `Caixa Dinheiro Rio BRL ${Date.now()}`,
      type: 'cash',
      currency: 'BRL',
      initial_balance: 1200.00,
      initial_balance_date: '2026-01-01',
    });
    createdAccountIds.push(accBrlCash.id);

    assert(createdAccountIds.length === 5, '5 contas operacionais criadas (3 em EUR, 2 em BRL)');

    // =========================================================================
    // 2. CONTAS SEM COMPROMISSOS (SALDO PROJETADO = SALDO ATUAL)
    // =========================================================================
    console.log('\n--- 2. Validando estado de contas sem compromissos ---');

    const accountsSnapshot = await financialService.getAccountBalances({ activeOnly: true });

    const eur2Bal = accountsSnapshot.find((a) => a.account_id === accEur2.id);
    assert(eur2Bal !== undefined, 'Conta Santander EUR localizada');
    assert(eur2Bal?.pending_receivables === 0, 'Conta sem compromissos tem pending_receivables = 0');
    assert(eur2Bal?.pending_payables === 0, 'Conta sem compromissos tem pending_payables = 0');
    assert(
      eur2Bal?.projected_balance === eur2Bal?.current_balance,
      `Saldo projetado (${eur2Bal?.projected_balance}) é rigorosamente igual ao saldo atual (${eur2Bal?.current_balance})`
    );

    const brlCashBal = accountsSnapshot.find((a) => a.account_id === accBrlCash.id);
    assert(brlCashBal !== undefined, 'Conta Caixa BRL localizada');
    assert(
      brlCashBal?.projected_balance === brlCashBal?.current_balance,
      `Saldo projetado BRL (${brlCashBal?.projected_balance}) é rigorosamente igual ao atual (${brlCashBal?.current_balance})`
    );

    // =========================================================================
    // 3. COMPROMISSOS PENDENTES COM expected_account_id
    // =========================================================================
    console.log('\n--- 3. Criando operação com compromissos pendentes e vinculados ---');

    const quote = await quotationsService.createQuotation({
      reference: `COT-DASH-F3B-${Date.now().toString().slice(-5)}`,
      client_name: 'Cliente Dashboard Fase 3B',
      currency: 'EUR',
      status: 'draft',
      data: {
        passengers: { adults: 2, children: 0, infants: 0 },
        dates: { startDate: '2026-11-15', endDate: '2026-11-22' },
        financials: { salePrice: 1200.00 },
        services: [
          {
            id: 'srv-transf-1',
            type: 'transfer',
            description: 'Transfer Privativo Aeroporto',
            supplier_name: 'Transfers Lisboa Lda',
            amount: 300.00,
            cost_amount: 300.00,
            quantity: 1,
            currency: 'EUR',
          },
        ],
      },
    });
    createdQuoteIds.push(quote.id);

    const approval = await financialService.approveQuotationAndCreateOperation(quote.id);
    assert(approval.success === true, 'Operação financeira da cotação criada com sucesso');

    // Vincular recebível à conta BCP EUR 1 (accEur1)
    const { data: commitments } = await supabase
      .from('financial_commitments')
      .select('*')
      .eq('operation_id', approval.operation_id);

    const rec = commitments!.find((c) => c.type === 'receivable')!;
    const pay = commitments!.find((c) => c.type === 'payable')!;

    await supabase
      .from('financial_commitments')
      .update({
        expected_account_id: accEur1.id,
        expected_date: '2026-11-10',
      })
      .eq('id', rec.id);

    await supabase
      .from('financial_commitments')
      .update({
        expected_account_id: accEur1.id,
        expected_date: '2026-11-12',
      })
      .eq('id', pay.id);

    // Validar atualização de saldos da conta accEur1:
    // Saldo atual = 2500.00
    // pending_receivables = 1200.00
    // pending_payables = 300.00
    // projected_balance = 2500 + 1200 - 300 = 3400.00
    const accountsAfterBindings = await financialService.getAccountBalances({ activeOnly: true });
    const eur1Bal = accountsAfterBindings.find((a) => a.account_id === accEur1.id)!;

    assert(eur1Bal.pending_receivables === 1200.00, 'pending_receivables da Conta 1 EUR confere com 1200.00');
    assert(eur1Bal.pending_payables === 300.00, 'pending_payables da Conta 1 EUR confere com 300.00');
    assert(
      eur1Bal.projected_balance === 3400.00,
      `Saldo projetado da Conta 1 EUR calculado corretamente: esperado 3400.00, obtido ${eur1Bal.projected_balance}`
    );

    // =========================================================================
    // 4. CARTÃO DE CRÉDITO SEPARADO DO CAIXA BANCÁRIO
    // =========================================================================
    console.log('\n--- 4. Validando cartão de crédito separado do caixa bancário ---');

    // Pagar o fornecedor (300 EUR) com o CARTÃO DE CRÉDITO (accEurCard)
    await financialService.recordCommitmentSettlement({
      commitment_id: pay.id,
      account_id: accEurCard.id,
      amount: 300.00,
      invoice_due_date: '2026-12-15',
      description: 'Pagamento transfer no cartão Amex',
    });

    const consolidated = await financialService.getConsolidatedBalances();

    // 1. Caixa bancário EUR deve permanecer intacto (2500 + 800 = 3300 EUR)
    // 2. Cartão de crédito EUR deve refletir -300 EUR
    assert(
      consolidated.EUR.current_balance >= 3300.00,
      `Caixa bancário EUR (${consolidated.EUR.current_balance}) NÃO sofreu saída antes da fatura`
    );
    assert(
      consolidated.EUR.credit_card_balance <= -300.00,
      `Saldo de cartão EUR (${consolidated.EUR.credit_card_balance}) reportado separadamente`
    );
    assert(
      consolidated.EUR.total_pending_payables >= 300.00,
      'Fatura do cartão de 300 EUR incluída nos pagáveis pendentes consolidados'
    );

    // =========================================================================
    // 5. COMPROMISSOS VENCIDOS E ALERTAS FINANCEIROS CRÍTICOS
    // =========================================================================
    console.log('\n--- 5. Validando compromissos vencidos e alertas críticos ---');

    // Criar um pagamento vencido na operação
    const overduePayable = await financialService.createCommitment({
      operation_id: approval.operation_id,
      type: 'payable',
      counterparty_name: 'Guia Histórico Sintra (Atrasado)',
      amount: 120.00,
      currency: 'EUR',
      expected_date: '2026-09-01', // Data anterior
      expected_account_id: accEur1.id,
    });

    const overdueList = await financialService.getOverdueCommitments();
    const foundOverdue = overdueList.find((c) => c.id === overduePayable.id);

    assert(foundOverdue !== undefined, 'Compromisso com data anterior detectado em getOverdueCommitments');
    assert(foundOverdue?.is_overdue === true, 'is_overdue é true');
    assert(foundOverdue?.pending_amount === 120.00, 'pending_amount confere com 120.00');

    // Validar consolidação de valores vencidos
    const consolidatedAfterOverdue = await financialService.getConsolidatedBalances();
    assert(
      consolidatedAfterOverdue.EUR.overdue_payables >= 120.00,
      `overdue_payables em EUR (${consolidatedAfterOverdue.EUR.overdue_payables}) reflete os 120.00 vencidos`
    );

    // Validar contagem de alertas críticos:
    // Deve haver pelo menos 1 compromisso vencido
    const criticalAlertsCount = overdueList.length;
    assert(criticalAlertsCount >= 1, `Contagem de alertas críticos detectou ${criticalAlertsCount} pendência(s)`);

    // =========================================================================
    // 6. ISOLAMENTO ESTRITO ENTRE BLOCO EUR E BLOCO BRL
    // =========================================================================
    console.log('\n--- 6. Validando isolamento estrito entre EUR e BRL ---');

    // As movimentações e compromissos criados foram em EUR.
    // O bloco BRL deve ter:
    // total_pending_receivables e total_pending_payables inalterados pelo teste em EUR
    assert(
      consolidatedAfterOverdue.BRL.currency === 'BRL',
      'Consolidado BRL tem currency BRL'
    );
    assert(
      consolidatedAfterOverdue.BRL.current_balance >= 16200.00,
      `Caixa BRL (${consolidatedAfterOverdue.BRL.current_balance}) preservado de forma estanque`
    );
    // =========================================================================
    // 7. VALIDAÇÃO DE ROTAS E LINKS DE NAVEGAÇÃO OPERACIONAL
    // =========================================================================
    console.log('\n--- 7. Validando integridade de rotas e links de navegação ---');

    const appContent = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
    const headerContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/layout/Header.tsx'), 'utf-8');
    const dashboardContent = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/DashboardPage.tsx'), 'utf-8');

    assert(
      appContent.includes('path="/" element={<DashboardPage />}'),
      'Rota raiz / vinculada estritamente à DashboardPage em App.tsx'
    );
    assert(
      appContent.includes('path="/cotacoes/:id/financeiro" element={<QuotationFinancialPage />}'),
      'Rota /cotacoes/:id/financeiro ativa para liquidador em App.tsx'
    );
    assert(
      headerContent.includes("label: 'Visão Geral', path: '/'"),
      'Item de menu "Visão Geral" aponta corretamente para / em Header.tsx'
    );
    assert(
      dashboardContent.includes('/cotacoes/${item.quotation_id}/financeiro'),
      'Tabela de vencidos direciona o administrador diretamente ao liquidador financeiro da cotação'
    );
    assert(
      dashboardContent.includes('Portugal') && dashboardContent.includes('Brasil'),
      'Dashboard contempla os blocos operacionais de Portugal e Brasil'
    );

    console.log('\n--- TODOS OS TESTES DA FASE 3B PASSARAM COM SUCESSO! ---');
  } finally {
    // =========================================================================
    // LIMPEZA
    // =========================================================================
    console.log('\n--- Limpando dados de teste ---');

    for (const quoteId of createdQuoteIds) {
      try {
        const { data: op } = await supabase
          .from('financial_operations')
          .select('id')
          .eq('quotation_id', quoteId)
          .maybeSingle();

        if (op) {
          await supabase.from('financial_transactions').delete().eq('operation_id', op.id);
          await supabase.from('financial_commitments').delete().eq('operation_id', op.id);
          await supabase.from('financial_operation_services').delete().eq('operation_id', op.id);
          await supabase.from('financial_operations').delete().eq('id', op.id);
        }
        await supabase.from('quotations').delete().eq('id', quoteId);
      } catch (err) {
        console.warn('Erro ao limpar quote:', err);
      }
    }

    for (const accId of createdAccountIds) {
      try {
        await supabase
          .from('financial_transactions')
          .delete()
          .or(`account_id.eq.${accId},destination_account_id.eq.${accId}`);
        await supabase
          .from('financial_commitments')
          .delete()
          .or(`expected_account_id.eq.${accId},credit_card_account_id.eq.${accId}`);
        await supabase.from('financial_accounts').delete().eq('id', accId);
      } catch (err) {
        console.warn('Erro ao limpar conta:', err);
      }
    }

    console.log('✅ Limpeza concluída.');
  }
}

runDashboardPhase3BTests().catch((err) => {
  console.error('❌ Erro inesperado nos testes da Fase 3B:', err);
  process.exit(1);
});
