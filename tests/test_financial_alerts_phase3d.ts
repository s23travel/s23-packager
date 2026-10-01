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

async function runFinancialAlertsPhase3DTests() {
  console.log('=== TESTES: FASE 3D — ALERTAS FINANCEIROS E AÇÕES RÁPIDAS ===\n');

  const { financialAlertsService, formatIsoDate, addDays, getMonday } = await import(
    '../src/services/financialAlertsService'
  );
  const { AccountBalanceSummary, PendingCommitmentItem } = await import('../src/types');

  const refDateStr = '2026-10-01'; // Quinta-feira de referência

  // =========================================================================
  // 1. TESTE DE AUSÊNCIA DE ALERTAS (ESTADO PERFEITO)
  // =========================================================================
  console.log('--- 1. Cenário: Ausência de alertas financeiros ---');

  const cleanAccounts: (typeof AccountBalanceSummary)[] = [
    {
      account_id: 'acc-clean-eur',
      account_name: 'Conta BCP Principal',
      account_type: 'bank_account',
      currency: 'EUR',
      active: true,
      initial_balance: 5000,
      initial_balance_date: '2026-01-01',
      current_balance: 5000,
      pending_receivables: 0,
      pending_payables: 0,
      projected_balance: 5000,
    } as any,
    {
      account_id: 'acc-clean-brl',
      account_name: 'Conta Itaú Principal',
      account_type: 'bank_account',
      currency: 'BRL',
      active: true,
      initial_balance: 20000,
      initial_balance_date: '2026-01-01',
      current_balance: 20000,
      pending_receivables: 0,
      pending_payables: 0,
      projected_balance: 20000,
    } as any,
  ];

  const emptyAlerts = financialAlertsService.generateFinancialAlerts({
    accounts: cleanAccounts as any,
    commitments: [],
    referenceDate: refDateStr,
  });

  assert(emptyAlerts.totalCritical === 0, 'Total de alertas críticos é 0 em estado limpo');
  assert(emptyAlerts.totalWarning === 0, 'Total de alertas de atenção é 0 em estado limpo');
  assert(emptyAlerts.EUR.length === 0, 'Zero alertas em EUR em estado limpo');
  assert(emptyAlerts.BRL.length === 0, 'Zero alertas em BRL em estado limpo');

  // =========================================================================
  // 2. TESTE: REGRA 1 — PAGÁVEIS VENCIDOS
  // =========================================================================
  console.log('\n--- 2. Cenário: Pagáveis vencidos (overdue_payable) ---');

  const overduePayableItem: any = {
    id: 'comm-overdue-pay-1',
    operation_id: 'op-1',
    quotation_id: 'quote-eur-123',
    quotation_reference: 'COT-2026-001',
    type: 'payable',
    counterparty_name: 'Hotel Lisboa Palace',
    amount: 1500.00,
    pending_amount: 1500.00,
    currency: 'EUR',
    status: 'planned',
    expected_date: '2026-09-20', // Vencido em relação a 2026-10-01
    is_overdue: true,
    is_credit_card_invoice: false,
    description: 'Reserva 3 noites',
  };

  const overduePayAlerts = financialAlertsService.generateFinancialAlerts({
    accounts: cleanAccounts as any,
    commitments: [overduePayableItem],
    referenceDate: refDateStr,
  });

  assert(overduePayAlerts.totalCritical === 1, 'Gera 1 alerta crítico para pagável vencido');
  assert(overduePayAlerts.EUR.length === 1, 'Alerta alocado em EUR');
  assert(overduePayAlerts.BRL.length === 0, 'Isolamento: zero alertas em BRL');
  const alertPay = overduePayAlerts.EUR[0];
  assert(alertPay.type === 'overdue_payable', 'Tipo do alerta é overdue_payable');
  assert(alertPay.severity === 'critical', 'Severidade é critical');
  assert(alertPay.action?.url === '/cotacoes/quote-eur-123/financeiro', 'Ação aponta para rota de liquidação da cotação');

  // =========================================================================
  // 3. TESTE: REGRA 2 — RECEBÍVEIS VENCIDOS
  // =========================================================================
  console.log('\n--- 3. Cenário: Recebíveis vencidos (overdue_receivable) ---');

  const overdueReceivableItem: any = {
    id: 'comm-overdue-rec-1',
    operation_id: 'op-2',
    quotation_id: 'quote-brl-456',
    quotation_reference: 'COT-BRL-002',
    type: 'receivable',
    counterparty_name: 'Cliente João Silva',
    amount: 8000.00,
    pending_amount: 8000.00,
    currency: 'BRL',
    status: 'planned',
    expected_date: '2026-09-25', // Vencido
    is_overdue: true,
    is_credit_card_invoice: false,
  };

  const overdueRecAlerts = financialAlertsService.generateFinancialAlerts({
    accounts: cleanAccounts as any,
    commitments: [overdueReceivableItem],
    referenceDate: refDateStr,
  });

  assert(overdueRecAlerts.totalCritical === 1, 'Gera 1 alerta crítico para recebível vencido');
  assert(overdueRecAlerts.BRL.length === 1, 'Alerta alocado em BRL');
  assert(overdueRecAlerts.EUR.length === 0, 'Isolamento: zero alertas em EUR');
  const alertRec = overdueRecAlerts.BRL[0];
  assert(alertRec.type === 'overdue_receivable', 'Tipo do alerta é overdue_receivable');
  assert(alertRec.severity === 'critical', 'Severidade é critical');
  assert(alertRec.action?.url === '/cotacoes/quote-brl-456/financeiro', 'Ação aponta para rota de liquidação da cotação BRL');

  // =========================================================================
  // 4. TESTE: REGRA 3 — FATURAS DE CARTÃO NOS PRÓXIMOS 3 DIAS
  // =========================================================================
  console.log('\n--- 4. Cenário: Faturas de cartão com vencimento próximo (credit_card_due_soon) ---');

  // refDateStr = 2026-10-01. Próximos 3 dias = até 2026-10-04.
  const ccInvoiceItem: any = {
    id: 'comm-cc-due-1',
    operation_id: 'op-3',
    type: 'payable',
    counterparty_name: 'Fatura Amex Corporativo',
    amount: 950.00,
    pending_amount: 950.00,
    currency: 'EUR',
    status: 'planned',
    expected_date: '2026-10-03', // Daqui a 2 dias (dentro do prazo de 3 dias)
    is_overdue: false,
    is_credit_card_invoice: true,
  };

  const ccDueAlerts = financialAlertsService.generateFinancialAlerts({
    accounts: cleanAccounts as any,
    commitments: [ccInvoiceItem],
    referenceDate: refDateStr,
  });

  assert(ccDueAlerts.totalWarning === 1, 'Gera 1 alerta de atenção para fatura próxima');
  assert(ccDueAlerts.EUR.length === 1, 'Alerta alocado em EUR');
  const alertCc = ccDueAlerts.EUR[0];
  assert(alertCc.type === 'credit_card_due_soon', 'Tipo do alerta é credit_card_due_soon');
  assert(alertCc.severity === 'warning', 'Severidade é warning');

  // =========================================================================
  // 5. TESTE: REGRA 4 — COMPROMISSOS SEM EXPECTED_DATE
  // =========================================================================
  console.log('\n--- 5. Cenário: Compromissos sem expected_date (missing_expected_date) ---');

  const missingDateItem: any = {
    id: 'comm-missing-date-1',
    operation_id: 'op-4',
    quotation_id: 'quote-eur-789',
    quotation_reference: 'COT-EUR-003',
    type: 'receivable',
    counterparty_name: 'Cliente Maria Santos',
    amount: 3000.00,
    pending_amount: 3000.00,
    currency: 'EUR',
    status: 'planned',
    expected_date: null, // Sem data definida!
    is_overdue: false,
    is_credit_card_invoice: false,
  };

  const missingDateAlerts = financialAlertsService.generateFinancialAlerts({
    accounts: cleanAccounts as any,
    commitments: [missingDateItem],
    referenceDate: refDateStr,
  });

  assert(missingDateAlerts.totalWarning === 1, 'Gera 1 alerta de atenção para compromisso sem data');
  assert(missingDateAlerts.EUR.length === 1, 'Alerta alocado em EUR');
  const alertMissing = missingDateAlerts.EUR[0];
  assert(alertMissing.type === 'missing_expected_date', 'Tipo do alerta é missing_expected_date');
  assert(alertMissing.severity === 'warning', 'Severidade é warning');
  assert(alertMissing.action?.url === '/cotacoes/quote-eur-789/financeiro', 'Ação aponta para cotação para preenchimento de data');

  // =========================================================================
  // 6. TESTE: REGRA 5 — CONTAS COM SALDO ATUAL NEGATIVO
  // =========================================================================
  console.log('\n--- 6. Cenário: Contas com saldo atual negativo (negative_current_balance) ---');

  const negativeAccounts: any[] = [
    {
      account_id: 'acc-neg-brl',
      account_name: 'Conta Itaú Devedora',
      account_type: 'bank_account',
      currency: 'BRL',
      active: true,
      current_balance: -450.00, // Negativo em caixa bancário!
      pending_receivables: 0,
      pending_payables: 0,
      projected_balance: -450.00,
    },
  ];

  const negBalAlerts = financialAlertsService.generateFinancialAlerts({
    accounts: negativeAccounts as any,
    commitments: [],
    referenceDate: refDateStr,
  });

  assert(negBalAlerts.totalCritical === 1, 'Gera 1 alerta crítico para saldo devedor');
  assert(negBalAlerts.BRL.length === 1, 'Alerta alocado em BRL');
  const alertNegBal = negBalAlerts.BRL[0];
  assert(alertNegBal.type === 'negative_current_balance', 'Tipo do alerta é negative_current_balance');
  assert(alertNegBal.severity === 'critical', 'Severidade é critical');

  // =========================================================================
  // 7. TESTE: REGRA 6 — CONTAS COM PROJEÇÃO SEMANAL NEGATIVA
  // =========================================================================
  console.log('\n--- 7. Cenário: Projeção semanal deficitária (negative_weekly_projection) ---');

  // 2026-10-01 (Quinta). A semana é 2026-09-28 a 2026-10-04.
  // Conta tem 500 EUR agora, mas tem uma saída de 800 EUR em 2026-10-02 -> Projeção semanal = 500 - 800 = -300 EUR
  const tightAccount: any = {
    account_id: 'acc-tight-eur',
    account_name: 'Conta BCP Caixa Operacional',
    account_type: 'bank_account',
    currency: 'EUR',
    active: true,
    current_balance: 500.00,
    pending_receivables: 0,
    pending_payables: 800.00,
    projected_balance: -300.00,
  };

  const weeklyOutflowCommitment: any = {
    id: 'comm-weekly-out-1',
    operation_id: 'op-5',
    type: 'payable',
    counterparty_name: 'Fornecedor Aéreo',
    amount: 800.00,
    pending_amount: 800.00,
    currency: 'EUR',
    status: 'planned',
    expected_date: '2026-10-02', // Dentro da semana corrente
    expected_account_id: 'acc-tight-eur',
    is_overdue: false,
    is_credit_card_invoice: false,
  };

  const projNegAlerts = financialAlertsService.generateFinancialAlerts({
    accounts: [tightAccount],
    commitments: [weeklyOutflowCommitment],
    referenceDate: refDateStr,
  });

  const projAlert = projNegAlerts.EUR.find((a) => a.type === 'negative_weekly_projection');
  assert(projAlert !== undefined, 'Gera alerta de negative_weekly_projection para a conta');
  assert(projAlert?.severity === 'warning', 'Severidade da projeção semanal é warning');
  assert(projAlert?.currency === 'EUR', 'Alerta de projeção atribuído a EUR');

  // =========================================================================
  // 8. TESTE: ISOLAMENTO TOTAL EUR VS BRL EM CENÁRIO MISTO
  // =========================================================================
  console.log('\n--- 8. Cenário: Isolamento estrito entre EUR e BRL em lote combinado ---');

  const combinedAlerts = financialAlertsService.generateFinancialAlerts({
    accounts: [...cleanAccounts, ...negativeAccounts, tightAccount] as any,
    commitments: [
      overduePayableItem,       // EUR
      overdueReceivableItem,    // BRL
      ccInvoiceItem,            // EUR
      missingDateItem,          // EUR
      weeklyOutflowCommitment,  // EUR
    ],
    referenceDate: refDateStr,
  });

  assert(combinedAlerts.EUR.every((a) => a.currency === 'EUR'), 'Todos os alertas em EUR têm currency EUR');
  assert(combinedAlerts.BRL.every((a) => a.currency === 'BRL'), 'Todos os alertas em BRL têm currency BRL');
  assert(combinedAlerts.totalCritical === 3, 'Total de críticos calculado corretamente (pay EUR, rec BRL, neg BRL)');
  assert(combinedAlerts.totalWarning >= 3, 'Total de alertas de atenção calculado');

  // =========================================================================
  // 9. CENÁRIO: CASOS DE BORDA (CANCELADOS, LIQUIDAÇÃO PARCIAL, FATURAS DISTANTES)
  // =========================================================================
  console.log('\n--- 9. Cenário: Casos de borda da revisão técnica ---');

  // A) Compromisso cancelado não gera alerta
  const cancelledCommitment: any = {
    id: 'comm-cancelled-1',
    operation_id: 'op-canc',
    type: 'payable',
    counterparty_name: 'Fornecedor Cancelado',
    amount: 5000.00,
    pending_amount: 5000.00,
    currency: 'EUR',
    status: 'cancelled',
    expected_date: '2026-09-01', // Data passada
    is_overdue: true,
  };

  const cancelledAlerts = financialAlertsService.generateFinancialAlerts({
    accounts: cleanAccounts as any,
    commitments: [cancelledCommitment],
    referenceDate: refDateStr,
  });
  assert(cancelledAlerts.totalCritical === 0, 'Compromisso cancelado NÃO gera alerta de vencido');
  assert(cancelledAlerts.EUR.length === 0, 'Zero alertas gerados para compromisso cancelado');

  // B) Liquidação parcial: alerta reflete estritamente o pending_amount
  const partialCommitment: any = {
    id: 'comm-partial-1',
    operation_id: 'op-part',
    quotation_id: 'quote-part-1',
    type: 'payable',
    counterparty_name: 'Fornecedor Parcial',
    amount: 2000.00,
    already_paid: 1500.00,
    pending_amount: 500.00,
    currency: 'EUR',
    status: 'partially_settled',
    expected_date: '2026-09-15',
    is_overdue: true,
  };

  const partialAlerts = financialAlertsService.generateFinancialAlerts({
    accounts: cleanAccounts as any,
    commitments: [partialCommitment],
    referenceDate: refDateStr,
  });
  assert(partialAlerts.totalCritical === 1, 'Liquidação parcial vencida gera alerta');
  assert(partialAlerts.EUR[0].amount === 500.00, 'Alerta considera estritamente pending_amount (500.00)');

  // C) Fatura de cartão com vencimento além de 3 dias (ex: 5 dias) não alerta
  const futureCardInvoice: any = {
    id: 'comm-card-far',
    operation_id: 'op-card-far',
    type: 'payable',
    counterparty_name: 'Fatura Distante',
    amount: 1000.00,
    pending_amount: 1000.00,
    currency: 'EUR',
    status: 'planned',
    expected_date: '2026-10-10', // Além de 3 dias
    is_overdue: false,
    is_credit_card_invoice: true,
  };

  const farCardAlerts = financialAlertsService.generateFinancialAlerts({
    accounts: cleanAccounts as any,
    commitments: [futureCardInvoice],
    referenceDate: refDateStr,
  });
  assert(farCardAlerts.totalWarning === 0, 'Fatura além dos 3 dias NÃO gera alerta prematuro');

  // D) Fatura de cartão vencida ontem vira overdue_payable (crítico) e NÃO credit_card_due_soon (warning)
  const overdueCardInvoice: any = {
    id: 'comm-card-overdue',
    operation_id: 'op-card-overdue',
    type: 'payable',
    counterparty_name: 'Fatura Vencida',
    amount: 1200.00,
    pending_amount: 1200.00,
    currency: 'EUR',
    status: 'planned',
    expected_date: '2026-09-30', // Ontem
    is_overdue: true,
    is_credit_card_invoice: true,
  };

  const overdueCardAlerts = financialAlertsService.generateFinancialAlerts({
    accounts: cleanAccounts as any,
    commitments: [overdueCardInvoice],
    referenceDate: refDateStr,
  });
  assert(overdueCardAlerts.totalCritical === 1, 'Fatura vencida entra como pagável crítico');
  assert(overdueCardAlerts.totalWarning === 0, 'Fatura vencida NÃO duplica em credit_card_due_soon');
  assert(overdueCardAlerts.EUR[0].type === 'overdue_payable', 'Tipo é overdue_payable');

  // E) Compromisso sem expected_date NÃO é classificado como vencido
  const nullDateCommitment: any = {
    id: 'comm-null-date',
    operation_id: 'op-null-date',
    type: 'receivable',
    counterparty_name: 'Cliente Sem Data',
    amount: 400.00,
    pending_amount: 400.00,
    currency: 'BRL',
    status: 'planned',
    expected_date: null,
    is_overdue: false,
  };

  const nullDateAlerts = financialAlertsService.generateFinancialAlerts({
    accounts: cleanAccounts as any,
    commitments: [nullDateCommitment],
    referenceDate: refDateStr,
  });
  assert(nullDateAlerts.totalCritical === 0, 'Compromisso sem expected_date NÃO entra como crítico/vencido');
  assert(nullDateAlerts.totalWarning === 1, 'Compromisso sem expected_date entra como atenção');
  assert(nullDateAlerts.BRL[0].type === 'missing_expected_date', 'Tipo é estritamente missing_expected_date');

  // =========================================================================
  // 10. CENÁRIO INTEGRADO NO BANCO: LEITURA REAL DA FASE 3A

  // =========================================================================
  if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
    console.log('\n--- 9. Cenário Integrado com Supabase real ---');
    const { financialService } = await import('../src/services/financialService');

    const accountsReal = await financialService.getAccountBalances({ activeOnly: true });
    const commitmentsReal = await financialService.getPendingCommitments();

    const realAlerts = financialAlertsService.generateFinancialAlerts({
      accounts: accountsReal,
      commitments: commitmentsReal,
    });

    assert(Array.isArray(realAlerts.EUR), 'Alertas EUR retornados como array');
    assert(Array.isArray(realAlerts.BRL), 'Alertas BRL retornados como array');
    assert(typeof realAlerts.totalCritical === 'number', 'totalCritical é numérico');
    assert(typeof realAlerts.totalWarning === 'number', 'totalWarning é numérico');
    console.log(
      `ℹ️  Estado real detectado: ${realAlerts.totalCritical} crítico(s), ${realAlerts.totalWarning} atenção (${realAlerts.EUR.length} EUR, ${realAlerts.BRL.length} BRL).`
    );
  }

  console.log('\n🎉 Todos os testes de regras e isolamento da Fase 3D passaram com sucesso!');
}

runFinancialAlertsPhase3DTests().catch((err) => {
  console.error('❌ Erro inesperado nos testes da Fase 3D:', err);
  process.exit(1);
});
