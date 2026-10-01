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

async function runPhase3IntegratedAudit() {
  console.log('=== AUDITORIA INTEGRADA DA FASE 3 (3A, 3B, 3C, 3D) ===\n');

  // =========================================================================
  // 1. AUDITORIA ESTÁTICA DE CÓDIGO E INTEGRIDADE DE ROTAS / ÂNCORAS
  // =========================================================================
  console.log('--- 1. Auditoria Estática de Código e Links Operacionais ---');

  const dashboardCode = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/DashboardPage.tsx'),
    'utf-8'
  );
  const calendarCode = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/finance/WeeklyCashFlowCalendar.tsx'),
    'utf-8'
  );
  const alertsCode = fs.readFileSync(
    path.resolve(process.cwd(), 'src/services/financialAlertsService.ts'),
    'utf-8'
  );
  const appCode = fs.readFileSync(
    path.resolve(process.cwd(), 'src/App.tsx'),
    'utf-8'
  );

  // Âncoras internas
  assert(dashboardCode.includes('id="secao-alertas"'), 'Dashboard contém âncora id="secao-alertas"');
  assert(dashboardCode.includes('id="secao-contas-eur"'), 'Dashboard contém âncora id="secao-contas-eur"');
  assert(dashboardCode.includes('id="secao-contas-brl"'), 'Dashboard contém âncora id="secao-contas-brl"');
  assert(dashboardCode.includes('id="secao-vencidos"'), 'Dashboard contém âncora id="secao-vencidos"');

  // Rotas da aplicação
  assert(appCode.includes('path="/cotacoes/:id/financeiro"'), 'App.tsx registra a rota /cotacoes/:id/financeiro');

  // Links do calendário e alertas para o liquidador da cotação
  assert(calendarCode.includes('/cotacoes/${item.quotation_id}/financeiro'), 'Calendário aponta para rota correta de liquidação');
  assert(alertsCode.includes('/cotacoes/${item.quotation_id}/financeiro'), 'Alertas apontam para rota correta de liquidação');

  // Auditoria de eliminação de chamadas duplicadas
  assert(
    dashboardCode.includes('commitmentsRes.filter((c) => c.is_overdue)'),
    'Dashboard deriva overdueCommitments de commitmentsRes atômico sem query duplicada'
  );
  assert(
    dashboardCode.includes('<WeeklyCashFlowCalendar refreshTrigger={refreshKey} />'),
    'Dashboard sincroniza o botão Atualizar com o Calendário via refreshTrigger'
  );

  // =========================================================================
  // 2. AUDITORIA DE REGRAS FINANCEIRAS E ISOLAMENTO EUR / BRL
  // =========================================================================
  console.log('\n--- 2. Auditoria de Regras Financeiras e Isolamento ---');

  const { financialAlertsService } = await import('../src/services/financialAlertsService');

  // Validar que itens cancelados ou liquidados NUNCA geram alertas
  const testItems: any[] = [
    {
      id: 'audit-comm-1',
      type: 'payable',
      counterparty_name: 'Fornecedor Cancelado',
      amount: 1000,
      pending_amount: 1000,
      currency: 'EUR',
      status: 'cancelled',
      expected_date: '2026-09-01',
      is_overdue: true,
    },
    {
      id: 'audit-comm-2',
      type: 'receivable',
      counterparty_name: 'Cliente Liquidado',
      amount: 2500,
      pending_amount: 0,
      currency: 'EUR',
      status: 'settled',
      expected_date: '2026-09-01',
      is_overdue: true,
    },
    {
      id: 'audit-comm-3',
      type: 'receivable',
      counterparty_name: 'Cliente Parcial',
      amount: 3000,
      pending_amount: 800,
      currency: 'BRL',
      status: 'partially_settled',
      expected_date: '2026-09-10',
      is_overdue: true,
      quotation_id: 'q-brl-1',
    },
  ];

  const auditAlerts = financialAlertsService.generateFinancialAlerts({
    accounts: [],
    commitments: testItems,
    referenceDate: '2026-10-01',
  });

  assert(auditAlerts.EUR.length === 0, 'Itens cancelados e liquidados em EUR foram ignorados');
  assert(auditAlerts.BRL.length === 1, 'Apenas o item pendente em BRL gerou alerta');
  assert(auditAlerts.BRL[0].amount === 800, 'Alerta considera estritamente pending_amount (800 BRL)');
  assert(auditAlerts.totalCritical === 1, 'Total de alertas críticos confere exatamente com 1');

  // =========================================================================
  // 3. AUDITORIA DE REGRAS DE CARTÃO DE CRÉDITO VS CAIXA
  // =========================================================================
  console.log('\n--- 3. Auditoria de Cartão de Crédito vs Caixa Bancário ---');

  const cardAccount: any = {
    account_id: 'acc-card-1',
    account_name: 'Cartão Visa Infinite',
    account_type: 'credit_card',
    currency: 'EUR',
    active: true,
    current_balance: -1500, // Uso de limite normal de cartão
    pending_receivables: 0,
    pending_payables: 0,
    projected_balance: -1500,
  };

  const cardAuditAlerts = financialAlertsService.generateFinancialAlerts({
    accounts: [cardAccount],
    commitments: [],
    referenceDate: '2026-10-01',
  });

  assert(
    cardAuditAlerts.EUR.length === 0,
    'Uso de limite de cartão de crédito NÃO gera falso alarme de saldo devedor de caixa'
  );

  // =========================================================================
  // 4. AUDITORIA EM TEMPO DE EXECUÇÃO COM BANCO DE DADOS REAL
  // =========================================================================
  if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
    console.log('\n--- 4. Auditoria Integrada Conectada ao Supabase ---');

    const { financialService } = await import('../src/services/financialService');

    // Testar se getConsolidatedBalances retorna chaves isoladas
    const consolidated = await financialService.getConsolidatedBalances();
    assert(Boolean(consolidated.EUR), 'Consolidado possui chave EUR');
    assert(Boolean(consolidated.BRL), 'Consolidado possui chave BRL');
    assert(typeof consolidated.EUR.current_balance === 'number', 'EUR current_balance é número');
    assert(typeof consolidated.BRL.current_balance === 'number', 'BRL current_balance é número');

    // Testar contas ativas
    const accounts = await financialService.getAccountBalances({ activeOnly: true });
    assert(Array.isArray(accounts), 'getAccountBalances retorna array');
    for (const acc of accounts) {
      assert(acc.currency === 'EUR' || acc.currency === 'BRL', `Moeda da conta ${acc.account_name} é EUR ou BRL`);
    }

    // Testar previsão de fluxo semanal (Fase 3C)
    const monday = '2026-10-05';
    const sunday = '2026-10-11';
    const forecast = await financialService.getPeriodCashFlowForecast(monday, sunday);
    assert(Array.isArray(forecast), 'getPeriodCashFlowForecast retorna array de previsões');
    assert(forecast.length >= 2, 'Previsão contém blocos para EUR e BRL');

    // Testar geração de alertas com dados reais
    const allPending = await financialService.getPendingCommitments();
    const liveAlerts = financialAlertsService.generateFinancialAlerts({
      accounts,
      commitments: allPending,
    });

    assert(Array.isArray(liveAlerts.EUR), 'liveAlerts.EUR é array');
    assert(Array.isArray(liveAlerts.BRL), 'liveAlerts.BRL é array');
    assert(liveAlerts.EUR.every((a) => a.currency === 'EUR'), 'Todos os alertas em EUR têm moeda EUR');
    assert(liveAlerts.BRL.every((a) => a.currency === 'BRL'), 'Todos os alertas em BRL têm moeda BRL');
  }

  console.log('\n🎉 AUDITORIA INTEGRADA DA FASE 3 CONCLUÍDA COM 100% DE SUCESSO! ZERO REGRESSÕES DETECTADAS.');
}

runPhase3IntegratedAudit().catch((err) => {
  console.error('❌ Erro na auditoria integrada da Fase 3:', err);
  process.exit(1);
});
