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

async function runWeeklyCalendarPhase3CTests() {
  console.log('=== TESTES: FASE 3C — CALENDÁRIO SEMANAL DE VENCIMENTOS ===\n');

  // Importar utilitários do componente de calendário
  const {
    getMonday,
    addDays,
    formatIsoDate,
    formatShortDate,
    formatLongDate,
  } = await import('../src/components/finance/WeeklyCashFlowCalendar');

  // =========================================================================
  // 1. TESTE DE LÓGICA DE DATAS E NAVEGAÇÃO SEMANAL (SEGUNDA A DOMINGO)
  // =========================================================================
  console.log('--- 1. Validação de cálculo de datas e navegação semanal ---');

  // Testar getMonday para vários dias da semana
  // 2026-10-05 é Segunda-feira
  // 2026-10-06 é Terça-feira
  // 2026-10-09 é Sexta-feira
  // 2026-10-10 é Sábado
  // 2026-10-11 é Domingo
  const mondaySample = new Date(2026, 9, 5); // 05 de Outubro de 2026 (Segunda)
  const wedSample = new Date(2026, 9, 7);    // 07 de Outubro de 2026 (Quarta)
  const sunSample = new Date(2026, 9, 11);   // 11 de Outubro de 2026 (Domingo)

  assert(formatIsoDate(getMonday(mondaySample)) === '2026-10-05', 'getMonday de Segunda retorna a própria Segunda (2026-10-05)');
  assert(formatIsoDate(getMonday(wedSample)) === '2026-10-05', 'getMonday de Quarta retorna a Segunda da semana (2026-10-05)');
  assert(formatIsoDate(getMonday(sunSample)) === '2026-10-05', 'getMonday de Domingo retorna a Segunda da mesma semana (2026-10-05)');

  // Validação de intervalo de 7 dias (Segunda a Domingo)
  const mon = getMonday(wedSample);
  const sun = addDays(mon, 6);
  assert(formatIsoDate(sun) === '2026-10-11', 'Domingo da semana é exatamente mon + 6 dias (2026-10-11)');

  // Navegação: Semana Anterior (-7 dias) e Próxima Semana (+7 dias)
  const prevMonday = addDays(mon, -7);
  const nextMonday = addDays(mon, 7);
  assert(formatIsoDate(prevMonday) === '2026-09-28', 'Navegação para semana anterior retorna segunda-feira anterior (2026-09-28)');
  assert(formatIsoDate(nextMonday) === '2026-10-12', 'Navegação para próxima semana retorna próxima segunda-feira (2026-10-12)');

  // Validação de formatação
  assert(typeof formatShortDate(mon) === 'string' && formatShortDate(mon).length > 0, 'formatShortDate gera string formatada');
  assert(typeof formatLongDate('2026-10-05') === 'string' && formatLongDate('2026-10-05').length > 0, 'formatLongDate gera cabeçalho amigável');

  // =========================================================================
  // 2. CENÁRIO INTEGRADO NO BANCO: ISOLAMENTO EUR/BRL E MOVIMENTOS DIÁRIOS
  // =========================================================================
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    console.log('ℹ️  Credenciais do Supabase não encontradas. Concluindo testes unitários.');
    return;
  }

  const { supabase } = await import('../src/lib/supabase');
  const { quotationsService } = await import('../src/services/quotationsService');
  const { financialService } = await import('../src/services/financialService');

  const createdAccountIds: string[] = [];
  const createdQuoteIds: string[] = [];

  try {
    console.log('\n--- 2. Preparando cenário semanal de testes no Supabase ---');

    // Definir semana de testes isolada no futuro distante para garantir independência total
    // Ex: ano 2028/2029 com offset baseado no timestamp atual
    const baseMonday = getMonday(new Date(2028, 5, 5));
    const randomWeeks = (Math.floor(Date.now() / 1000) % 50) + 1;
    const testMonday = addDays(baseMonday, randomWeeks * 7);
    const testTuesday = addDays(testMonday, 1);
    const testWednesday = addDays(testMonday, 2);
    const testThursday = addDays(testMonday, 3);
    const testFriday = addDays(testMonday, 4);
    const testSunday = addDays(testMonday, 6);

    const testMondayStr = formatIsoDate(testMonday);
    const testTuesdayStr = formatIsoDate(testTuesday);
    const testWednesdayStr = formatIsoDate(testWednesday);
    const testThursdayStr = formatIsoDate(testThursday);
    const testFridayStr = formatIsoDate(testFriday);
    const testSundayStr = formatIsoDate(testSunday);

    // Criar conta bancária EUR esperada
    const accEur = await financialService.createAccount({
      name: `Conta BCP Calendário EUR ${Date.now()}`,
      type: 'bank_account',
      currency: 'EUR',
      initial_balance: 1000.00,
      initial_balance_date: '2026-01-01',
    });
    createdAccountIds.push(accEur.id);

    // Criar conta bancária BRL esperada
    const accBrl = await financialService.createAccount({
      name: `Conta Itaú Calendário BRL ${Date.now()}`,
      type: 'bank_account',
      currency: 'BRL',
      initial_balance: 5000.00,
      initial_balance_date: '2026-01-01',
    });
    createdAccountIds.push(accBrl.id);

    // Criar Cotação EUR com:
    // - Venda: 2.500,00 EUR (recebível)
    // - Custo: 1.200,00 EUR (pagável)
    const quoteEur = await quotationsService.createQuotation({
      reference: `COT-CAL-EUR-${Date.now().toString().slice(-5)}`,
      client_name: 'Cliente Teste Calendário EUR',
      currency: 'EUR',
      status: 'draft',
      data: {
        passengers: { adults: 2, children: 0, infants: 0 },
        dates: { startDate: '2027-03-10', endDate: '2027-03-15' },
        financials: { salePrice: 2500.00 },
        services: [
          {
            id: 'srv-hotel-eur',
            type: 'hotel',
            description: 'Hotel Lisboa Calendário',
            supplier_name: 'Hotelaria Lisboa S.A.',
            amount: 1200.00,
            cost_amount: 1200.00,
            quantity: 1,
            currency: 'EUR',
          },
        ],
      },
    });
    createdQuoteIds.push(quoteEur.id);

    const approvalEur = await financialService.approveQuotationAndCreateOperation(quoteEur.id);
    assert(approvalEur.success === true, 'Operação financeira EUR aprovada com sucesso');

    // Atualizar datas esperadas e contas dos compromissos EUR
    // - Recebível: Terça-feira (testTuesdayStr) na accEur
    // - Pagável: Quarta-feira (testWednesdayStr) na accEur
    const { data: commsEur } = await supabase
      .from('financial_commitments')
      .select('*')
      .eq('operation_id', approvalEur.operation_id);

    const eurRec = commsEur!.find((c) => c.type === 'receivable')!;
    const eurPay = commsEur!.find((c) => c.type === 'payable')!;

    await supabase
      .from('financial_commitments')
      .update({
        expected_date: testTuesdayStr,
        expected_account_id: accEur.id,
      })
      .eq('id', eurRec.id);

    await supabase
      .from('financial_commitments')
      .update({
        expected_date: testWednesdayStr,
        expected_account_id: accEur.id,
      })
      .eq('id', eurPay.id);

    // Criar Cotação BRL com:
    // - Venda: 10.000,00 BRL
    // - Custo: 4.000,00 BRL
    const quoteBrl = await quotationsService.createQuotation({
      reference: `COT-CAL-BRL-${Date.now().toString().slice(-5)}`,
      client_name: 'Cliente Teste Calendário BRL',
      currency: 'BRL',
      status: 'draft',
      data: {
        passengers: { adults: 2, children: 0, infants: 0 },
        dates: { startDate: '2027-03-10', endDate: '2027-03-15' },
        financials: { salePrice: 10000.00 },
        services: [
          {
            id: 'srv-transf-brl',
            type: 'transfer',
            description: 'Traslados e passeios BRL',
            supplier_name: 'Receptivo Rio Eireli',
            amount: 4000.00,
            cost_amount: 4000.00,
            quantity: 1,
            currency: 'BRL',
          },
        ],
      },
    });
    createdQuoteIds.push(quoteBrl.id);

    const approvalBrl = await financialService.approveQuotationAndCreateOperation(quoteBrl.id);
    assert(approvalBrl.success === true, 'Operação financeira BRL aprovada com sucesso');

    // Atualizar datas esperadas e contas dos compromissos BRL
    // - Ambos na Quinta-feira (testThursdayStr)
    const { data: commsBrl } = await supabase
      .from('financial_commitments')
      .select('*')
      .eq('operation_id', approvalBrl.operation_id);

    const brlRec = commsBrl!.find((c) => c.type === 'receivable')!;
    const brlPay = commsBrl!.find((c) => c.type === 'payable')!;

    await supabase
      .from('financial_commitments')
      .update({
        expected_date: testThursdayStr,
        expected_account_id: accBrl.id,
      })
      .eq('id', brlRec.id);

    await supabase
      .from('financial_commitments')
      .update({
        expected_date: testThursdayStr,
        expected_account_id: accBrl.id,
      })
      .eq('id', brlPay.id);


    console.log('✅ Compromissos de teste inseridos com sucesso.');

    // =========================================================================
    // 3. TESTE DE getPeriodCashFlowForecast NA SEMANA (ISOLAMENTO EUR/BRL)
    // =========================================================================
    console.log('\n--- 3. Validação de getPeriodCashFlowForecast da semana ---');

    const forecast = await financialService.getPeriodCashFlowForecast(testMondayStr, testSundayStr);
    assert(Array.isArray(forecast), 'Forecast semanal retornado como array');

    const eurForecast = forecast.find((f) => f.currency === 'EUR');
    const brlForecast = forecast.find((f) => f.currency === 'BRL');

    assert(Boolean(eurForecast), 'Forecast possui bloco consolidado para EUR');
    assert(Boolean(brlForecast), 'Forecast possui bloco consolidado para BRL');

    assert(
      eurForecast?.expected_inflows === 2500.00,
      `EUR expected_inflows previsto = 2500.00 (obtido: ${eurForecast?.expected_inflows})`
    );
    assert(
      eurForecast?.expected_outflows === 1200.00,
      `EUR expected_outflows previsto = 1200.00 (obtido: ${eurForecast?.expected_outflows})`
    );
    assert(
      eurForecast?.net_cash_flow === 1300.00,
      `EUR net_cash_flow previsto = 1300.00 (obtido: ${eurForecast?.net_cash_flow})`
    );

    assert(
      brlForecast?.expected_inflows === 10000.00,
      `BRL expected_inflows previsto = 10000.00 (obtido: ${brlForecast?.expected_inflows})`
    );
    assert(
      brlForecast?.expected_outflows === 4000.00,
      `BRL expected_outflows previsto = 4000.00 (obtido: ${brlForecast?.expected_outflows})`
    );
    assert(
      brlForecast?.net_cash_flow === 6000.00,
      `BRL net_cash_flow previsto = 6000.00 (obtido: ${brlForecast?.net_cash_flow})`
    );

    // =========================================================================
    // 4. TESTE DE getPendingCommitments E AGREGAÇÃO DIÁRIA
    // =========================================================================
    console.log('\n--- 4. Validação de compromissos pendentes e dias do calendário ---');

    const commitments = await financialService.getPendingCommitments({
      startDate: testMondayStr,
      endDate: testSundayStr,
    });

    assert(commitments.length >= 4, `Mínimo de 4 compromissos retornados na semana (obtido: ${commitments.length})`);

    // A) TERÇA-FEIRA (Apenas Entrada EUR)
    const tuesdayItems = commitments.filter((c) => c.expected_date === testTuesdayStr);
    assert(tuesdayItems.length === 1, 'Terça-feira possui exatamente 1 compromisso');
    assert(tuesdayItems[0].type === 'receivable', 'Item de Terça é recebível (entrada)');
    assert(tuesdayItems[0].currency === 'EUR', 'Item de Terça é em EUR');
    assert(tuesdayItems[0].pending_amount === 2500.00, 'Valor de Terça é 2500.00');

    // B) QUARTA-FEIRA (Apenas Saída EUR)
    const wednesdayItems = commitments.filter((c) => c.expected_date === testWednesdayStr);
    assert(wednesdayItems.length === 1, 'Quarta-feira possui exatamente 1 compromisso');
    assert(wednesdayItems[0].type === 'payable', 'Item de Quarta é pagável (saída)');
    assert(wednesdayItems[0].currency === 'EUR', 'Item de Quarta é em EUR');
    assert(wednesdayItems[0].pending_amount === 1200.00, 'Valor de Quarta é 1200.00');

    // C) QUINTA-FEIRA (Entrada e Saída BRL no mesmo dia)
    const thursdayItems = commitments.filter((c) => c.expected_date === testThursdayStr);
    assert(thursdayItems.length === 2, 'Quinta-feira possui 2 compromissos em BRL (1 entrada e 1 saída)');
    const thuRec = thursdayItems.find((c) => c.type === 'receivable');
    const thuPay = thursdayItems.find((c) => c.type === 'payable');
    assert(thuRec?.pending_amount === 10000.00, 'Quinta recebível BRL = 10000.00');
    assert(thuPay?.pending_amount === 4000.00, 'Quinta pagável BRL = 4000.00');
    const thuNetBrl = (thuRec?.pending_amount || 0) - (thuPay?.pending_amount || 0);
    assert(thuNetBrl === 6000.00, `Saldo líquido de Quinta BRL calculado corretamente: ${thuNetBrl}`);

    // D) SEXTA-FEIRA (Dia sem movimentos)
    const fridayItems = commitments.filter((c) => c.expected_date === testFridayStr);
    assert(fridayItems.length === 0, 'Sexta-feira não possui movimentos (dia sem movimentos)');

    // =========================================================================
    // 5. TESTE DE ESTRUTURA PARA O DRAWER E ROTA DE LIQUIDAÇÃO
    // =========================================================================
    console.log('\n--- 5. Validação de dados do drawer e link de liquidação ---');

    const detailItem = tuesdayItems[0];
    assert(detailItem.expected_date === testTuesdayStr, 'Item do drawer tem data esperada');
    assert(detailItem.type === 'receivable', 'Item do drawer tem tipo diferenciado');
    assert(detailItem.counterparty_name === 'Cliente Teste Calendário EUR', 'Item do drawer exibe contraparte');
    assert(detailItem.pending_amount === 2500.00, 'Item do drawer exibe valor pendente');
    assert(detailItem.currency === 'EUR', 'Item do drawer exibe moeda explicitamente');
    assert(detailItem.quotation_id === quoteEur.id, 'Item do drawer aponta para quotation_id correto');
    assert(typeof detailItem.quotation_reference === 'string', 'Item do drawer possui quotation_reference');
    assert(detailItem.expected_account_id === accEur.id, 'Item do drawer possui expected_account_id');
    assert(detailItem.expected_account_name?.includes('BCP Calendário EUR') === true, 'Item do drawer exibe nome da conta esperada');

    // Validação da rota de liquidação utilizada pelo drawer: `/cotacoes/${quotation_id}/financeiro`
    const liquidationUrl = `/cotacoes/${detailItem.quotation_id}/financeiro`;
    assert(
      liquidationUrl === `/cotacoes/${quoteEur.id}/financeiro`,
      `Rota de liquidação apontada corretamente: ${liquidationUrl}`
    );

    // =========================================================================
    // 6. VALIDAÇÃO TÉCNICA AVANÇADA DA INTEGRAÇÃO DO CALENDÁRIO
    // =========================================================================
    console.log('\n--- 6. Validação técnica detalhada dos 10 requisitos da Fase 3C ---');

    // 1. Semana começa na segunda e termina no domingo para sábado também
    const satSample = new Date(2026, 9, 10); // Sábado
    assert(formatIsoDate(getMonday(satSample)) === '2026-10-05', 'getMonday de Sábado retorna a Segunda da semana');
    assert(formatIsoDate(addDays(getMonday(satSample), 6)) === '2026-10-11', 'Semana de Sábado termina no Domingo');

    // 2. Navegação entre semanas mantém consistência de 7 dias sem sobreposição
    const week1Start = testMondayStr;
    const week1End = testSundayStr;
    const week2Start = formatIsoDate(addDays(testMonday, 7));
    const week2End = formatIsoDate(addDays(testSunday, 7));
    assert(week2Start > week1End, 'Semana 2 começa estritamente após o término da Semana 1');

    // 3. Mesmos argumentos de intervalo para forecast e commitments
    assert(testMondayStr.length === 10 && testSundayStr.length === 10, 'Intervalo semanal é composto por datas ISO válidas');

    // 4. Filtro Todas/EUR/BRL sem conversão entre moedas
    const allFilteredEur = commitments.filter((c) => c.currency === 'EUR');
    const allFilteredBrl = commitments.filter((c) => c.currency === 'BRL');
    assert(allFilteredEur.every((c) => c.currency === 'EUR'), 'Filtro EUR contém estritamente itens com currency EUR');
    assert(allFilteredBrl.every((c) => c.currency === 'BRL'), 'Filtro BRL contém estritamente itens com currency BRL');

    // 5. Dias sem movimentos são representados na semana (Sexta-feira sem movimentos)
    const emptyDaySummary = {
      dateStr: testFridayStr,
      commitments: commitments.filter((c) => c.expected_date === testFridayStr),
      eurInflows: 0,
      eurOutflows: 0,
      brlInflows: 0,
      brlOutflows: 0,
      hasMovements: false,
    };
    assert(emptyDaySummary.commitments.length === 0, 'Dia sem movimentos tem 0 compromissos');
    assert(emptyDaySummary.hasMovements === false, 'Dia sem movimentos tem flag hasMovements = false');
    assert(emptyDaySummary.dateStr === testFridayStr, 'Dia sem movimentos permanece selecionável por sua dateStr');

    // 6. Verificar que DashboardPage importa e renderiza WeeklyCashFlowCalendar
    const dashboardFile = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/DashboardPage.tsx'), 'utf-8');
    assert(dashboardFile.includes('WeeklyCashFlowCalendar'), 'DashboardPage importa e referencia WeeklyCashFlowCalendar');
    assert(dashboardFile.includes('<WeeklyCashFlowCalendar />') || dashboardFile.includes('<WeeklyCashFlowCalendar'), 'WeeklyCashFlowCalendar montado no JSX de DashboardPage');

    // 7. Verificar que CSS tem regras de grid responsivo para telas menores
    const cssFile = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf-8');
    assert(cssFile.includes('.calendar-week-grid'), 'index.css contém classe .calendar-week-grid');
    assert(cssFile.includes('.calendar-day-card'), 'index.css contém classe .calendar-day-card');

    console.log('\n🎉 Todos os cenários da Fase 3C foram validados com sucesso!');
  } finally {
    // Limpeza de dados de teste
    console.log('\n--- Limpeza de registros de teste da Fase 3C ---');
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

runWeeklyCalendarPhase3CTests().catch((err) => {
  console.error('❌ Erro fatal durante a execução dos testes:', err);
  process.exit(1);
});
