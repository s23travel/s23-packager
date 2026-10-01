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

async function runPhase3ATests() {
  console.log('=== TESTES: FASE 3A — MOTOR DE CONSULTA E SALDOS CONSOLIDADOS ===\n');

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    console.log('ℹ️  Credenciais do Supabase não encontradas. Pulando testes remotos.');
    return;
  }

  try {
    await fetch(process.env.VITE_SUPABASE_URL, { signal: AbortSignal.timeout(1500) });
  } catch {
    console.log('ℹ️  Supabase remoto inacessível na rede atual. Pulando testes remotos.');
    return;
  }

  const { supabase } = await import('../src/lib/supabase');
  const { quotationsService } = await import('../src/services/quotationsService');
  const { financialService } = await import('../src/services/financialService');

  const createdAccountIds: string[] = [];
  const createdQuoteIds: string[] = [];

  try {
    // =========================================================================
    // ETAPA 1: CRIAÇÃO DE CONTAS FINANCEIRAS COM SALDO INICIAL
    // =========================================================================
    console.log('\n--- 1. Criando contas financeiras de teste ---');

    const eurBank = await financialService.createAccount({
      name: `Conta BCP EUR Test ${Date.now()}`,
      type: 'bank_account',
      currency: 'EUR',
      initial_balance: 1000.00,
      initial_balance_date: '2026-01-01',
    });
    createdAccountIds.push(eurBank.id);
    assert(eurBank.id !== undefined, 'Conta Bancária EUR criada com saldo inicial de 1000.00 EUR');

    const brlBank = await financialService.createAccount({
      name: `Conta Itaú BRL Test ${Date.now()}`,
      type: 'bank_account',
      currency: 'BRL',
      initial_balance: 5000.00,
      initial_balance_date: '2026-01-01',
    });
    createdAccountIds.push(brlBank.id);
    assert(brlBank.id !== undefined, 'Conta Bancária BRL criada com saldo inicial de 5000.00 BRL');

    const eurCard = await financialService.createAccount({
      name: `Cartão Amex EUR Test ${Date.now()}`,
      type: 'credit_card',
      currency: 'EUR',
      initial_balance: 0.00,
      initial_balance_date: '2026-01-01',
    });
    createdAccountIds.push(eurCard.id);
    assert(eurCard.id !== undefined, 'Conta Cartão de Crédito EUR criada com saldo inicial 0.00 EUR');

    // Validar saldos atuais iniciais via getAccountBalances
    const initialBalances = await financialService.getAccountBalances({ activeOnly: true });
    const eurBankBal = initialBalances.find((a) => a.account_id === eurBank.id);
    const brlBankBal = initialBalances.find((a) => a.account_id === brlBank.id);
    const eurCardBal = initialBalances.find((a) => a.account_id === eurCard.id);

    assert(eurBankBal?.current_balance === 1000.00, 'Saldo atual inicial da conta EUR é 1000.00');
    assert(brlBankBal?.current_balance === 5000.00, 'Saldo atual inicial da conta BRL é 5000.00');
    assert(eurCardBal?.current_balance === 0.00, 'Saldo atual inicial do cartão EUR é 0.00');

    // =========================================================================
    // ETAPA 2: TRANSFERÊNCIAS ENTRE CONTAS (EUR -> BRL COM CÂMBIO E TARIFA)
    // =========================================================================
    console.log('\n--- 2. Testando transferência EUR -> BRL com câmbio e tarifa ---');

    // Transferir 300.00 EUR -> 1800.00 BRL com taxa de câmbio 6.0 e tarifa de 5.00 EUR
    const transferResult = await financialService.recordAccountTransfer({
      source_account_id: eurBank.id,
      destination_account_id: brlBank.id,
      amount: 300.00,
      destination_amount: 1800.00,
      exchange_rate: 6.0,
      transfer_fee: 5.00,
      transfer_fee_currency: 'EUR',
      description: 'Transferência teste EUR para BRL com remessa',
    });

    assert(transferResult.success === true, 'Transferência atômica entre contas executada com sucesso');

    // Validar saldos após transferência
    const postTransferBalances = await financialService.getAccountBalances({ activeOnly: true });
    const postEurBank = postTransferBalances.find((a) => a.account_id === eurBank.id);
    const postBrlBank = postTransferBalances.find((a) => a.account_id === brlBank.id);

    // eurBank: 1000 - 300 - 5 = 695.00
    assert(
      postEurBank?.current_balance === 695.00,
      `Saldo atual EUR após saída e tarifa: esperado 695.00, obtido ${postEurBank?.current_balance}`
    );
    // brlBank: 5000 + 1800 = 6800.00
    assert(
      postBrlBank?.current_balance === 6800.00,
      `Saldo atual BRL após crédito de destination_amount: esperado 6800.00, obtido ${postBrlBank?.current_balance}`
    );

    // =========================================================================
    // ETAPA 3: OPERAÇÃO COM COMPROMISSOS, SALDO PROJETADO E LIQUIDAÇÕES PARCIAIS
    // =========================================================================
    console.log('\n--- 3. Testando saldo projetado e liquidação parcial ---');

    // Criar cotação de rascunho para gerar operação financeira via aprovação
    const testQuote = await quotationsService.createQuotation({
      reference: `COT-TEST-F3A-${Date.now().toString().slice(-5)}`,
      client_name: 'Cliente Teste Fase 3A',
      currency: 'EUR',
      status: 'draft',
      data: {
        passengers: { adults: 2, children: 0, infants: 0 },
        dates: { startDate: '2026-11-01', endDate: '2026-11-08' },
        financials: { salePrice: 500.00 },
        services: [
          {
            id: 'srv-hotel-1',
            type: 'hotel',
            description: 'Hotel Lisboa 7 noites',
            supplier_name: 'Lisboa Hotels SA',
            amount: 200.00,
            cost_amount: 200.00,
            quantity: 1,
            currency: 'EUR',
          },
        ],
      },
    });
    createdQuoteIds.push(testQuote.id);

    const approveResult = await financialService.approveQuotationAndCreateOperation(testQuote.id);
    assert(approveResult.success === true, 'Cotação aprovada gerou operação financeira');

    // Associar os compromissos criados à conta bancária EUR (expected_account_id)
    const { data: commitments } = await supabase
      .from('financial_commitments')
      .select('*')
      .eq('operation_id', approveResult.operation_id);

    assert(commitments && commitments.length >= 2, 'Compromissos gerados automaticamente na operação');

    const recCommitment = commitments!.find((c) => c.type === 'receivable');
    const payCommitment = commitments!.find((c) => c.type === 'payable');

    assert(recCommitment !== undefined && payCommitment !== undefined, 'Recebível e pagável localizados');

    // Atualizar expected_account_id para eurBank e definir expected_date no futuro
    await supabase
      .from('financial_commitments')
      .update({
        expected_account_id: eurBank.id,
        expected_date: '2026-11-05',
      })
      .eq('id', recCommitment!.id);

    await supabase
      .from('financial_commitments')
      .update({
        expected_account_id: eurBank.id,
        expected_date: '2026-11-10',
      })
      .eq('id', payCommitment!.id);

    // Verificar saldos projetados da conta eurBank antes de qualquer liquidação:
    // Saldo atual = 695.00
    // pending_receivables = 500.00
    // pending_payables = 200.00
    // Saldo projetado = 695 + 500 - 200 = 995.00
    const preSettleBalances = await financialService.getAccountBalances({ activeOnly: true });
    const preSettleEur = preSettleBalances.find((a) => a.account_id === eurBank.id);

    assert(preSettleEur?.pending_receivables === 500.00, 'Recebíveis pendentes da conta EUR conferem (500.00)');
    assert(preSettleEur?.pending_payables === 200.00, 'Pagáveis pendentes da conta EUR conferem (200.00)');
    assert(
      preSettleEur?.projected_balance === 995.00,
      `Saldo projetado da conta EUR confere: esperado 995.00, obtido ${preSettleEur?.projected_balance}`
    );

    // Liquidar PARCIALMENTE o recebível (150.00 de 500.00) na conta eurBank
    const partialSettlement = await financialService.recordCommitmentSettlement({
      commitment_id: recCommitment!.id,
      account_id: eurBank.id,
      amount: 150.00,
      description: 'Recebimento parcial entrada',
    });

    assert(partialSettlement.commitment_status === 'partially_settled', 'Status do compromisso atualizado para partially_settled');
    assert(partialSettlement.pending_balance === 350.00, 'Saldo pendente do compromisso calculado como 350.00');

    // Verificar saldos da conta eurBank após liquidação parcial:
    // Saldo atual = 695 + 150 = 845.00
    // pending_receivables restante = 350.00
    // pending_payables = 200.00
    // projected_balance = 845 + 350 - 200 = 995.00 (invariante do saldo projetado preservada!)
    const postPartialBalances = await financialService.getAccountBalances({ activeOnly: true });
    const postPartialEur = postPartialBalances.find((a) => a.account_id === eurBank.id);

    assert(
      postPartialEur?.current_balance === 845.00,
      `Saldo atual após recebimento parcial: esperado 845.00, obtido ${postPartialEur?.current_balance}`
    );
    assert(
      postPartialEur?.pending_receivables === 350.00,
      `Recebível pendente restante: esperado 350.00, obtido ${postPartialEur?.pending_receivables}`
    );
    assert(
      postPartialEur?.projected_balance === 995.00,
      `Saldo projetado permanece consistente em 995.00 após liquidação parcial: obtido ${postPartialEur?.projected_balance}`
    );

    // =========================================================================
    // ETAPA 4: PAGAMENTO COM CARTÃO DE CRÉDITO E FATURA DO CARTÃO
    // =========================================================================
    console.log('\n--- 4. Testando pagamento com cartão de crédito e faturas ---');

    // Liquidar o pagamento ao fornecedor (200.00 EUR) com o CARTÃO DE CRÉDITO (eurCard)
    const cardSettlement = await financialService.recordCommitmentSettlement({
      commitment_id: payCommitment!.id,
      account_id: eurCard.id,
      amount: 200.00,
      invoice_due_date: '2026-12-10',
      description: 'Pagamento ao hotel com cartão Amex',
    });

    assert(cardSettlement.commitment_status === 'settled', 'Pagamento ao fornecedor liquidado via cartão');
    assert(Boolean(cardSettlement.invoice_commitment_id), 'Compromisso da fatura do cartão gerado atomicamente');

    // Verificar:
    // 1. O saldo da conta bancária eurBank NÃO PODE ter sido debitado (permanece 845.00)
    // 2. O cartão Amex EUR agora tem saldo atual de -200.00
    // 3. A fatura do cartão é um novo compromisso a pagar de 200.00 EUR com vencimento em 2026-12-10
    const postCardBalances = await financialService.getAccountBalances({ activeOnly: true });
    const bankAfterCard = postCardBalances.find((a) => a.account_id === eurBank.id);
    const cardAfterPay = postCardBalances.find((a) => a.account_id === eurCard.id);

    assert(
      bankAfterCard?.current_balance === 845.00,
      `Saldo bancário NÃO sofreu saída antes da liquidação da fatura: ${bankAfterCard?.current_balance}`
    );
    assert(
      cardAfterPay?.current_balance === -200.00,
      `Saldo da conta cartão reflete débito de -200.00: ${cardAfterPay?.current_balance}`
    );

    // =========================================================================
    // ETAPA 5: CONSOLIDADO POR MOEDA (EUR e BRL)
    // =========================================================================
    console.log('\n--- 5. Testando saldos consolidados por moeda ---');

    const consolidated = await financialService.getConsolidatedBalances('2026-11-01');
    assert(consolidated.EUR !== undefined && consolidated.BRL !== undefined, 'Consolidado contém chaves EUR e BRL');

    // EUR:
    // current_balance disponível (bancos/caixa) deve ser 845.00
    // credit_card_balance deve ser -200.00
    // total_pending_receivables deve incluir 350.00
    // total_pending_payables deve incluir a fatura do cartão de 200.00
    assert(
      consolidated.EUR.current_balance >= 845.00,
      `Consolidado EUR: current_balance disponível (${consolidated.EUR.current_balance}) >= 845.00`
    );
    assert(
      consolidated.EUR.credit_card_balance <= -200.00,
      `Consolidado EUR: credit_card_balance (${consolidated.EUR.credit_card_balance}) reflete cartão`
    );
    assert(
      consolidated.EUR.total_pending_payables >= 200.00,
      `Consolidado EUR: total_pending_payables (${consolidated.EUR.total_pending_payables}) inclui fatura pendente`
    );

    // BRL:
    // current_balance deve ser pelo menos 6800.00
    assert(
      consolidated.BRL.current_balance >= 6800.00,
      `Consolidado BRL: current_balance (${consolidated.BRL.current_balance}) >= 6800.00`
    );

    // =========================================================================
    // ETAPA 6: COMPROMISSOS VENCIDOS E POR INTERVALO DE DATAS
    // =========================================================================
    console.log('\n--- 6. Testando compromissos pendentes e vencidos ---');

    // Criar um compromisso avulso vencido na operação para teste
    const overdueCommitment = await financialService.createCommitment({
      operation_id: approveResult.operation_id,
      type: 'payable',
      counterparty_name: 'Guia Local Vencido',
      amount: 80.00,
      currency: 'EUR',
      expected_date: '2026-09-15', // Data no passado
      expected_account_id: eurBank.id,
    });

    // Consultar vencidos com data de corte em 2026-10-01
    const overdueList = await financialService.getOverdueCommitments('2026-10-01', 'EUR');
    const foundOverdue = overdueList.find((c) => c.id === overdueCommitment.id);

    assert(foundOverdue !== undefined, 'Compromisso com data anterior à referência detectado em getOverdueCommitments');
    assert(foundOverdue?.is_overdue === true, 'Flag is_overdue é true');
    assert(foundOverdue?.pending_amount === 80.00, 'pending_amount confere com saldo pendente de 80.00');

    // Consultar compromissos em intervalo de datas (2026-11-01 a 2026-11-30)
    const novemberPending = await financialService.getPendingCommitments({
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      currency: 'EUR',
    });

    const foundNovRec = novemberPending.find((c) => c.id === recCommitment!.id);
    assert(foundNovRec !== undefined, 'Compromisso de novembro retornado no filtro de intervalo de datas');
    assert(foundNovRec?.pending_amount === 350.00, 'Saldo pendente do compromisso de novembro é 350.00');

    // Previsão de fluxo de caixa para novembro de 2026
    const forecastNov = await financialService.getPeriodCashFlowForecast('2026-11-01', '2026-11-30');
    const eurForecast = forecastNov.find((f) => f.currency === 'EUR');

    assert(eurForecast !== undefined, 'Previsão de fluxo de caixa em EUR gerada com sucesso');
    assert(
      eurForecast!.expected_inflows >= 350.00,
      `Previsão EUR: entradas previstas (${eurForecast!.expected_inflows}) >= 350.00`
    );

    // =========================================================================
    // ETAPA 7: TRANSFERÊNCIA INTERNA MESMA MOEDA NÃO DUPLICA SALDO
    // =========================================================================
    console.log('\n--- 7. Testando transferência interna mesma moeda (EUR -> EUR) ---');

    const eurBank2 = await financialService.createAccount({
      name: `Conta BCP EUR 2 Test ${Date.now()}`,
      type: 'bank_account',
      currency: 'EUR',
      initial_balance: 0.00,
      initial_balance_date: '2026-01-01',
    });
    createdAccountIds.push(eurBank2.id);

    const prevBalances = await financialService.getAccountBalances({ activeOnly: true });
    const prevEur1 = prevBalances.find((a) => a.account_id === eurBank.id)!.current_balance;
    const prevEur2 = prevBalances.find((a) => a.account_id === eurBank2.id)!.current_balance;

    await financialService.recordAccountTransfer({
      source_account_id: eurBank.id,
      destination_account_id: eurBank2.id,
      amount: 100.00,
      destination_amount: 100.00,
      description: 'Transferência interna EUR mesma moeda',
    });

    const currBalances = await financialService.getAccountBalances({ activeOnly: true });
    const currEur1 = currBalances.find((a) => a.account_id === eurBank.id)!.current_balance;
    const currEur2 = currBalances.find((a) => a.account_id === eurBank2.id)!.current_balance;

    assert(currEur1 === prevEur1 - 100.00, `Conta de origem debitada em exatamente 100 EUR (${currEur1})`);
    assert(currEur2 === prevEur2 + 100.00, `Conta de destino creditada em exatamente 100 EUR (${currEur2})`);
    assert(
      currEur1 + currEur2 === prevEur1 + prevEur2,
      'Soma combinada das contas EUR permanece rigorosamente constante (saldo não duplica nem se perde)'
    );

    // =========================================================================
    // ETAPA 8: COMPROMISSO SEM CONTA ESPERADA NÃO É ATRIBUÍDO A NENHUMA CONTA
    // =========================================================================
    console.log('\n--- 8. Testando compromisso sem expected_account_id ---');

    const balancesBeforeAccountless = await financialService.getAccountBalances({ activeOnly: true });
    const bcp1Before = balancesBeforeAccountless.find((a) => a.account_id === eurBank.id)!;
    const bcp2Before = balancesBeforeAccountless.find((a) => a.account_id === eurBank2.id)!;

    const accountlessCommitment = await financialService.createCommitment({
      operation_id: approveResult.operation_id,
      type: 'payable',
      counterparty_name: 'Fornecedor Avulso Sem Conta Definida',
      amount: 45.00,
      currency: 'EUR',
      expected_account_id: null,
      expected_date: '2026-11-20',
    });

    const accountBalancesAfterAccountless = await financialService.getAccountBalances({ activeOnly: true });
    const bcp1After = accountBalancesAfterAccountless.find((a) => a.account_id === eurBank.id)!;
    const bcp2After = accountBalancesAfterAccountless.find((a) => a.account_id === eurBank2.id)!;

    assert(
      bcp1After.pending_payables === bcp1Before.pending_payables,
      `Conta EUR 1 não absorveu compromisso sem conta: pending_payables permaneceu ${bcp1After.pending_payables}`
    );
    assert(
      bcp2After.pending_payables === bcp2Before.pending_payables,
      `Conta EUR 2 não absorveu compromisso sem conta: pending_payables permaneceu ${bcp2After.pending_payables}`
    );
    assert(
      bcp1After.projected_balance === bcp1After.current_balance + bcp1After.pending_receivables - bcp1After.pending_payables,
      'Saldo projetado da conta usa estritamente apenas seus compromissos vinculados'
    );

    // No consolidado da moeda, o compromisso sem conta entra normalmente
    const consolidAfterAccountless = await financialService.getConsolidatedBalances();
    assert(
      consolidAfterAccountless.EUR.total_pending_payables >= 45.00,
      'Consolidado EUR contabiliza compromisso sem conta esperada na moeda'
    );

    // =========================================================================
    // ETAPA 9: CANCELAMENTO DE OPERAÇÃO E AJUSTES DE CANCELAMENTO
    // =========================================================================
    console.log('\n--- 9. Testando cancelamento de operação e ajustes ---');

    // Cancelar a operação financeira
    await financialService.cancelFinancialOperation(
      approveResult.operation_id,
      'Cliente solicitou cancelamento por motivos de força maior'
    );

    // Após cancelamento da operação, compromissos normais da operação não devem aparecer em getPendingCommitments
    const pendingAfterOpCancelled = await financialService.getPendingCommitments({
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      currency: 'EUR',
    });

    const foundCancelledQuoteCommitment = pendingAfterOpCancelled.find(
      (c) => c.operation_id === approveResult.operation_id && !c.is_cancellation_adjustment
    );
    assert(
      foundCancelledQuoteCommitment === undefined,
      'Compromissos normais de operação cancelada NÃO entram na lista de compromissos pendentes nem nas projeções'
    );

    // Criar um ajuste de cancelamento (reembolso ao cliente)
    const refundAdjustment = await financialService.createCancellationAdjustment({
      operation_id: approveResult.operation_id,
      adjustment_type: 'client_refund',
      counterparty_name: 'Cliente Teste Fase 3A',
      amount: 150.00,
      currency: 'EUR',
      expected_date: '2026-11-25',
    });

    assert(refundAdjustment.is_cancellation_adjustment === true, 'Ajuste de cancelamento criado com sucesso');

    // O ajuste de cancelamento DEVE aparecer na lista de compromissos pendentes
    const pendingWithAdjustment = await financialService.getPendingCommitments({
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      currency: 'EUR',
    });

    const foundAdjustment = pendingWithAdjustment.find((c) => c.id === refundAdjustment.id);
    assert(foundAdjustment !== undefined, 'Ajuste de cancelamento pendente aparece corretamente na projeção futura');
    assert(foundAdjustment?.pending_amount === 150.00, 'Saldo pendente do ajuste é exatamente 150.00 EUR');

    // =========================================================================
    // ETAPA 10: ISOLAMENTO RIGOROSO ENTRE EUR E BRL
    // =========================================================================
    console.log('\n--- 10. Testando isolamento rigoroso entre EUR e BRL ---');

    const finalConsolidation = await financialService.getConsolidatedBalances();
    assert(finalConsolidation.EUR.currency === 'EUR', 'Chave EUR contém moeda EUR');
    assert(finalConsolidation.BRL.currency === 'BRL', 'Chave BRL contém moeda BRL');
    assert(
      typeof finalConsolidation.EUR.current_balance === 'number' && !isNaN(finalConsolidation.EUR.current_balance),
      'Saldo EUR numérico válido'
    );
    assert(
      typeof finalConsolidation.BRL.current_balance === 'number' && !isNaN(finalConsolidation.BRL.current_balance),
      'Saldo BRL numérico válido'
    );

    // =========================================================================
    // ETAPA 11: CHAMADAS SEM REFERENCEDATE (FALLBACK DEFENSIVO PARA DATA CORRENTE)
    // =========================================================================
    console.log('\n--- 11. Testando chamadas sem data de referência ---');

    const overdueDefault = await financialService.getOverdueCommitments();
    assert(Array.isArray(overdueDefault), 'getOverdueCommitments() sem argumentos executa com sucesso usando CURRENT_DATE');

    const consolidDefault = await financialService.getConsolidatedBalances();
    assert(Boolean(consolidDefault.EUR && consolidDefault.BRL), 'getConsolidatedBalances() sem argumentos executa com sucesso');

    console.log('\n--- TODOS OS CENÁRIOS EXPANDIDOS E DE REVISÃO DA FASE 3A PASSARAM COM SUCESSO! ---');
  } finally {
    // =========================================================================
    // LIMPEZA DOS REGISTROS DE TESTE
    // =========================================================================
    console.log('\n--- Limpeza dos dados de teste ---');

    for (const quoteId of createdQuoteIds) {
      try {
        // Obter operation_id vinculado
        const { data: op } = await supabase
          .from('financial_operations')
          .select('id')
          .eq('quotation_id', quoteId)
          .maybeSingle();

        if (op) {
          // Deletar transações vinculadas à operação
          await supabase.from('financial_transactions').delete().eq('operation_id', op.id);
          // Deletar compromissos vinculados
          await supabase.from('financial_commitments').delete().eq('operation_id', op.id);
          // Deletar serviços vinculados
          await supabase.from('financial_operation_services').delete().eq('operation_id', op.id);
          // Deletar operação
          await supabase.from('financial_operations').delete().eq('id', op.id);
        }
        await supabase.from('quotations').delete().eq('id', quoteId);
      } catch (err) {
        console.warn(`Aviso ao limpar quote ${quoteId}:`, err);
      }
    }

    for (const accId of createdAccountIds) {
      try {
        // Deletar transações vinculadas à conta (incluindo transferências)
        await supabase
          .from('financial_transactions')
          .delete()
          .or(`account_id.eq.${accId},destination_account_id.eq.${accId}`);
        // Deletar compromissos com expected_account_id
        await supabase
          .from('financial_commitments')
          .delete()
          .or(`expected_account_id.eq.${accId},credit_card_account_id.eq.${accId}`);
        await supabase.from('financial_accounts').delete().eq('id', accId);
      } catch (err) {
        console.warn(`Aviso ao limpar conta ${accId}:`, err);
      }
    }

    console.log('✅ Limpeza concluída.');
  }
}

runPhase3ATests().catch((err) => {
  if (
    err?.message?.includes('fetch failed') ||
    err?.message?.includes('timeout') ||
    err?.message?.includes('Connect Timeout') ||
    err?.code === 'UND_ERR_CONNECT_TIMEOUT'
  ) {
    console.warn('⚠️  Supabase remoto inacessível na rede atual. Pulando teste de integração remota.');
    process.exit(0);
  }
  console.error('❌ Erro inesperado nos testes:', err);
  process.exit(1);
});
