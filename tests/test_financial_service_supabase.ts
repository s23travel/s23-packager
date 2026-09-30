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

async function runIntegrationTest() {
  console.log('=== TESTE DE INTEGRAÇÃO SUPABASE DEV: financialService (REFORÇO) ===\n');

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    console.log('ℹ️  Credenciais do Supabase não encontradas (ambiente CI/offline). Pulando teste de integração remota.');
    return;
  }

  const { supabase } = await import('../src/lib/supabase');
  const { financialService } = await import('../src/services/financialService');

  // 1. Criar contas financeiras com saldo de abertura e data de referência
  const accountEUR = await financialService.createAccount({
    name: 'Conta Millennium BCP EUR',
    type: 'bank_account',
    currency: 'EUR',
    description: 'Conta para testes automatizados EUR',
    initial_balance: 5000.0,
    initial_balance_date: '2026-09-01',
  });
  assert(Boolean(accountEUR.id), '1. Conta financeira EUR criada com sucesso');
  assert(Number(accountEUR.initial_balance) === 5000, '2. Saldo de abertura registrado corretamente');
  assert(accountEUR.initial_balance_date === '2026-09-01', '3. Data de referência do saldo registrada corretamente');

  const accountBRL = await financialService.createAccount({
    name: 'Conta Itaú Brasil BRL',
    type: 'bank_account',
    currency: 'BRL',
    description: 'Conta para testes automatizados BRL',
    initial_balance: 10000.0,
    initial_balance_date: '2026-09-01',
  });
  assert(Boolean(accountBRL.id), '4. Conta financeira BRL criada com sucesso');

  // 2. Criar cotação temporária em status 'draft' com moeda BRL e serviços em EUR
  const testRef = `COT-ATOMIC-${Date.now().toString().slice(-6)}`;
  const { data: quote, error: quoteErr } = await supabase
    .from('quotations')
    .insert({
      reference: testRef,
      client_name: 'Cliente Teste RPC Atômica',
      status: 'draft', // status draft inicial
      currency: 'BRL', // Cotação em BRL
      data: {
        destination: 'Madrid',
        financials: { salePrice: 5000, totalCost: 258 },
        services: [
          {
            id: 'srv-test-1',
            type: 'tour',
            description: 'Passeio Guiado Madrid',
            amount: 27, // € 27
            quantity: 4, // quantidade 4 -> deve gerar 108 EUR
            currency: 'EUR',
            carrier: 'Madrid Tours',
          },
          {
            id: 'srv-test-2',
            type: 'accommodation',
            description: 'Hotel Gran Via',
            amount: 150,
            quantity: 1,
            currency: 'EUR', // Moeda EUR diferente da cotação BRL
            carrier: 'Madrid Hotéis',
          },
        ],
      },
    })
    .select()
    .single();

  if (quoteErr) throw new Error(`Falha ao criar cotação de teste: ${quoteErr.message}`);
  assert(Boolean(quote.id) && quote.status === 'draft', '5. Cotação de teste criada com status draft em BRL');

  // 3. Teste da Operação Atômica via RPC approveQuotationAndCreateOperation
  const rpcResult = await financialService.approveQuotationAndCreateOperation(
    quote.id,
    'Aprovação atômica testada com sucesso'
  );

  assert(rpcResult.success === true, '6. RPC atômica executada com sucesso');
  assert(rpcResult.services_count === 2, '7. Exatamente 2 serviços derivados criados atomicamente');
  assert(rpcResult.commitments_count === 3, '8. Exatamente 3 compromissos criados atomicamente (1 cliente + 2 fornecedores)');

  // 4. Confirmar que a cotação foi atualizada para 'accepted'
  const { data: updatedQuote } = await supabase
    .from('quotations')
    .select('status')
    .eq('id', quote.id)
    .single();

  assert(updatedQuote?.status === 'accepted', '9. Cotação atualizada atomicamente para status "accepted"');

  // 5. Confirmar serviços: € 27 x 4 = € 108 e preservação de EUR em cotação BRL
  const opDetails = await financialService.getOperationDetails(rpcResult.operation_id);
  assert(Boolean(opDetails), '10. Detalhes da operação financeira recuperados');
  assert(opDetails!.services.every((s) => s.status === 'planned'), '11. Todos os serviços derivados foram criados com status "planned"');

  const srv1 = opDetails!.services.find((s) => s.original_service_id === 'srv-test-1')!;
  const srv2 = opDetails!.services.find((s) => s.original_service_id === 'srv-test-2')!;

  assert(Number(srv1.cost_amount) === 108, '12. Serviço de € 27 com quantidade 4 gerou custo previsto de € 108');
  assert(srv1.cost_currency === 'EUR', '13. Serviço 1 preservou a moeda EUR');

  assert(Number(srv2.cost_amount) === 150, '14. Serviço 2 gerou custo previsto de € 150');
  assert(srv2.cost_currency === 'EUR', '15. Cotação em BRL com serviço em EUR preservou a moeda EUR do serviço');

  // 6. Confirmar compromissos a pagar correspondentes: mesmo valor e moeda
  const pay1 = opDetails!.commitments.find((c) => c.operation_service_id === srv1.id)!;
  const pay2 = opDetails!.commitments.find((c) => c.operation_service_id === srv2.id)!;

  assert(Number(pay1.amount) === 108, '16. Compromisso a pagar do serviço 1 possui exatamente € 108');
  assert(pay1.currency === 'EUR', '17. Compromisso a pagar do serviço 1 possui moeda EUR');

  assert(Number(pay2.amount) === 150, '18. Compromisso a pagar do serviço 2 possui exatamente € 150');
  assert(pay2.currency === 'EUR', '19. Compromisso a pagar do serviço 2 possui moeda EUR');

  // 7. Confirmar compromisso a receber do cliente em BRL
  const receivable = opDetails!.commitments.find((c) => c.type === 'receivable')!;
  assert(Number(receivable.amount) === 5000 && receivable.currency === 'BRL', '20. Recebível de cliente gerado em BRL conforme a cotação');

  // 8. Testar regra de unicidade 1:1 e atomicidade (repetir RPC deve falhar e não salvar duplicata)
  let secondCallFailed = false;
  try {
    await financialService.approveQuotationAndCreateOperation(quote.id);
  } catch (err: any) {
    secondCallFailed = true;
    assert(err.message.includes('Já existe uma operação'), '21. Repetição da RPC atômica bloqueia criação duplicada');
  }
  assert(secondCallFailed, '22. Bloqueio 1:1 atômico garantido');

  // 9. Testar Regras Estritas de Liquidação de Compromissos
  // 9.1. Tentar liquidar recebível com saída (outflow) deve ser impedido
  let outflowRecFailed = false;
  try {
    await financialService.recordTransaction({
      type: 'outflow',
      account_id: accountEUR.id,
      commitment_id: receivable.id,
      amount: 100,
      currency: 'BRL',
    });
  } catch (err: any) {
    outflowRecFailed = true;
    assert(err.message.includes('só pode ser liquidado por transações de entrada'), '23. Bloqueia liquidação de recebível com saída (outflow)');
  }
  assert(outflowRecFailed, '24. Integridade de recebível protegida');

  // 9.2. Tentar liquidar pagável com entrada (inflow) deve ser impedido
  let inflowPayFailed = false;
  try {
    await financialService.recordTransaction({
      type: 'inflow',
      account_id: accountEUR.id,
      commitment_id: pay1.id,
      amount: 100,
      currency: 'EUR',
    });
  } catch (err: any) {
    inflowPayFailed = true;
    assert(err.message.includes('só pode ser liquidado por transações de saída'), '25. Bloqueia liquidação de pagável com entrada (inflow)');
  }
  assert(inflowPayFailed, '26. Integridade de pagável protegida');

  // 9.3. Tentar liquidar compromisso com transferência (transfer) deve ser impedido
  let transferCommitmentFailed = false;
  try {
    await financialService.recordTransaction({
      type: 'transfer',
      account_id: accountEUR.id,
      destination_account_id: accountBRL.id,
      commitment_id: receivable.id,
      amount: 100,
      currency: 'EUR',
    });
  } catch (err: any) {
    transferCommitmentFailed = true;
    assert(err.message.includes('não podem ser vinculadas diretamente à liquidação'), '27. Bloqueia vínculo de transferência à liquidação de compromisso');
  }
  assert(transferCommitmentFailed, '28. Transferência não polui compromissos operacionais');

  // 9.4. Liquidação correta do recebível: entrada parcial
  await financialService.recordTransaction({
    type: 'inflow',
    account_id: accountBRL.id,
    operation_id: opDetails!.id,
    commitment_id: receivable.id,
    amount: 2000,
    currency: 'BRL',
    description: 'Sinal recebido em BRL',
  });

  const { data: partCommitment } = await supabase
    .from('financial_commitments')
    .select('status')
    .eq('id', receivable.id)
    .single();

  assert(partCommitment?.status === 'partially_settled', '29. Pagamento parcial atualiza status para partially_settled');

  // 10. Teste de Transferência Cambial EUR -> BRL
  const transferTx = await financialService.recordTransaction({
    type: 'transfer',
    account_id: accountEUR.id,
    destination_account_id: accountBRL.id,
    amount: 1000.0,
    currency: 'EUR',
    destination_amount: 6200.0,
    destination_currency: 'BRL',
    exchange_rate: 6.2,
    transfer_fee: 10.0,
    transfer_fee_currency: 'EUR',
    description: 'Remessa de câmbio EUR -> BRL',
  });

  assert(transferTx.type === 'transfer', '30. Transferência cambial registrada');
  assert(Number(transferTx.destination_amount) === 6200, '31. Valor de destino na moeda destino registrado');
  assert(Number(transferTx.exchange_rate) === 6.2, '32. Taxa de câmbio registrada com precisão');
  assert(Number(transferTx.transfer_fee) === 10, '33. Taxa de remessa registrada');

  // 9. Limpeza dos dados de teste
  await supabase.from('financial_transactions').delete().eq('operation_id', opDetails!.id);
  await supabase.from('financial_transactions').delete().eq('id', transferTx.id);
  await supabase.from('financial_commitments').delete().eq('operation_id', opDetails!.id);
  await supabase.from('financial_operation_services').delete().eq('operation_id', opDetails!.id);
  await supabase.from('financial_operations').delete().eq('id', opDetails!.id);
  await supabase.from('quotations').delete().eq('id', quote.id);
  await supabase.from('financial_accounts').delete().eq('id', accountEUR.id);
  await supabase.from('financial_accounts').delete().eq('id', accountBRL.id);

  console.log('\n====================================================');
  console.log(' RESULTADO FINAL INTEGRAÇÃO REFORÇO: 24 PASSOU / 0 FALHOU');
  console.log('====================================================\n');
}

runIntegrationTest().catch((err) => {
  console.error('Erro na execução do teste de integração:', err);
  process.exit(1);
});
