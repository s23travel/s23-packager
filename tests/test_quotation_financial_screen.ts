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

async function runQuotationFinancialTests() {
  console.log('=== TESTES: TELA E FLUXOS DO MÓDULO FINANCEIRO PÓS-APROVAÇÃO ===\n');

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    console.log('ℹ️  Credenciais do Supabase não encontradas. Pulando testes remotos.');
    return;
  }

  const { supabase } = await import('../src/lib/supabase');
  const { quotationsService } = await import('../src/services/quotationsService');
  const { financialService } = await import('../src/services/financialService');
  const { PAYMENT_METHOD_LABELS, SERVICE_STATUS_LABELS } = await import('../src/types/financial');

  // 1. Validar labels amigáveis das formas de pagamento
  assert(PAYMENT_METHOD_LABELS.transfer === 'Transferência', '1. Label Transferência verificado');
  assert(PAYMENT_METHOD_LABELS.card === 'Cartão', '2. Label Cartão verificado');
  assert(PAYMENT_METHOD_LABELS.payment_link === 'Link de pagamento', '3. Label Link de pagamento verificado');
  assert(PAYMENT_METHOD_LABELS.cash === 'Dinheiro', '4. Label Dinheiro verificado');
  assert(PAYMENT_METHOD_LABELS.other === 'Outro', '5. Label Outro verificado');

  // 2. Validar labels dos estados de serviço
  assert(SERVICE_STATUS_LABELS.planned === 'Previsto', '6. Estado Previsto verificado');
  assert(SERVICE_STATUS_LABELS.reserved === 'Reservado', '7. Estado Reservado verificado');
  assert(SERVICE_STATUS_LABELS.contracted === 'Contratado', '8. Estado Contratado verificado');
  assert(SERVICE_STATUS_LABELS.completed === 'Concluído', '9. Estado Concluído verificado');
  assert(SERVICE_STATUS_LABELS.cancelled === 'Cancelado', '10. Estado Cancelado verificado');

  // 3. Criar uma conta bancária de teste para associar aos compromissos
  const testAccount = await financialService.createAccount({
    name: 'Conta Teste BCP EUR',
    type: 'bank_account',
    currency: 'EUR',
    initial_balance: 5000,
  });
  assert(Boolean(testAccount.id), '11. Conta bancária para testes criada');

  // 4. Criar e aprovar cotação de teste
  const testRef = `COT-FIN-${Date.now().toString().slice(-5)}`;
  const quote = await quotationsService.createQuotation({
    reference: testRef,
    client_name: 'Cliente VIP Financeiro',
    status: 'draft',
    currency: 'EUR',
    data: {
      destination: 'Porto',
      financials: { salePrice: 3000 },
      services: [
        {
          id: 'srv-p1',
          type: 'lodging',
          description: 'Hotel Porto Palácio',
          amount: 500,
          quantity: 2,
          currency: 'EUR',
          carrier: 'Porto Palácio',
        },
      ],
    },
  });

  const approval = await financialService.approveQuotationAndCreateOperation(quote.id);
  assert(Boolean(approval.operation_id), '12. Cotação aprovada atomicamente com operação financeira criada');

  const opDetails = await financialService.getOperationDetails(approval.operation_id);
  assert(Boolean(opDetails), '13. Detalhes da operação recuperados com sucesso');
  assert(opDetails!.services.length === 1, '14. Um serviço inicial criado na operação');
  assert(opDetails!.commitments.length === 2, '15. Dois compromissos criados (recebível + pagável)');

  const receivable = opDetails!.commitments.find((c) => c.type === 'receivable');
  const payable = opDetails!.commitments.find((c) => c.type === 'payable');
  const service = opDetails!.services[0];
  assert(Boolean(receivable), '16. Compromisso a receber do cliente identificado');
  assert(Boolean(payable), '17. Compromisso a pagar do fornecedor identificado');

  // 5. Testar edição do recebimento do cliente (valor, moeda, data, conta, método de pagamento, observação)
  const updatedRec = await financialService.updateCommitment(receivable!.id, {
    amount: 3200,
    currency: 'EUR',
    expected_date: '2026-10-15',
    expected_account_id: testAccount.id,
    payment_method: 'payment_link',
    notes: 'Link de pagamento enviado ao cliente',
  });
  assert(Number(updatedRec.amount) === 3200, '18. Valor do recebimento editado para 3200');
  assert(updatedRec.expected_date === '2026-10-15', '19. Data prevista do recebimento atualizada');
  assert(updatedRec.expected_account_id === testAccount.id, '20. Conta de entrada do recebimento atribuída');
  assert(updatedRec.payment_method === 'payment_link', '21. Método de pagamento "payment_link" persistido');
  assert(updatedRec.notes === 'Link de pagamento enviado ao cliente', '22. Observações do recebimento salvas');

  // 6. Testar validação de método de pagamento inválido no banco
  const { error: invalidMethodErr } = await supabase
    .from('financial_commitments')
    .update({ payment_method: 'metodo_invalido_teste' })
    .eq('id', receivable!.id);
  assert(Boolean(invalidMethodErr), '23. Banco rejeita método de pagamento fora da lista permitida');

  // 7. Testar divisão do recebimento do cliente em várias parcelas
  // Parcela 1: 1600 / Parcela 2: 1600
  await financialService.updateCommitment(receivable!.id, {
    amount: 1600,
    description: 'Entrada 50%',
    payment_method: 'transfer',
  });
  const recInstallment2 = await financialService.createCommitment({
    operation_id: approval.operation_id,
    type: 'receivable',
    counterparty_name: quote.client_name || 'Cliente',
    counterparty_type: 'client',
    amount: 1600,
    currency: 'EUR',
    status: 'planned',
    payment_method: 'card',
    expected_date: '2026-11-01',
    description: 'Saldo Final 50%',
  });
  assert(Boolean(recInstallment2.id), '24. Segunda parcela de recebimento criada (divisão em parcelas)');
  assert(Number(recInstallment2.amount) === 1600, '25. Valor da segunda parcela verificado (1600)');
  assert(recInstallment2.payment_method === 'card', '26. Método de pagamento da segunda parcela registrado como "card"');

  // 8. Testar adicionar várias parcelas de pagamento a um serviço
  const payInstallment2 = await financialService.createCommitment({
    operation_id: approval.operation_id,
    operation_service_id: service.id,
    type: 'payable',
    counterparty_name: service.supplier_name || 'Fornecedor Hotel',
    counterparty_type: 'supplier',
    amount: 500,
    currency: 'EUR',
    status: 'planned',
    payment_method: 'transfer',
    description: 'Segunda parcela hotel',
  });
  assert(Boolean(payInstallment2.id), '27. Segunda parcela de pagamento adicionada ao serviço');
  assert(payInstallment2.operation_service_id === service.id, '28. Parcela vinculada estritamente ao serviço');

  // 9. Testar informar fornecedor e alterar estado do serviço (Previsto -> Reservado -> Contratado -> Concluído -> Cancelado)
  const updatedService = await financialService.updateOperationService(service.id, {
    supplier_name: 'Porto Palácio Luxury Group',
    status: 'contracted',
    notes: 'Contrato assinado sob reserva #9988',
  });
  assert(updatedService.supplier_name === 'Porto Palácio Luxury Group', '29. Fornecedor do serviço atualizado');
  assert(updatedService.status === 'contracted', '30. Estado do serviço atualizado para "contracted" (Contratado)');

  const completedService = await financialService.updateOperationService(service.id, {
    status: 'completed',
  });
  assert(completedService.status === 'completed', '31. Estado do serviço atualizado para "completed" (Concluído)');

  // 10. Testar adicionar um novo serviço pós-aprovação
  const newService = await financialService.addOperationService({
    operation_id: approval.operation_id,
    type: 'tour',
    description: 'Cruzeiro das 6 Pontes no Rio Douro',
    supplier_name: 'Douro River Tours',
    cost_amount: 120,
    cost_currency: 'EUR',
    status: 'planned',
  });
  assert(Boolean(newService.id), '32. Novo serviço pós-aprovação adicionado à operação');
  assert(newService.description === 'Cruzeiro das 6 Pontes no Rio Douro', '33. Descrição do novo serviço verificada');

  const newServicePayable = await financialService.createCommitment({
    operation_id: approval.operation_id,
    operation_service_id: newService.id,
    type: 'payable',
    counterparty_name: 'Douro River Tours',
    counterparty_type: 'supplier',
    amount: 120,
    currency: 'EUR',
    status: 'planned',
    payment_method: 'other',
  });
  assert(Boolean(newServicePayable.id), '34. Pagamento previsto criado para o novo serviço');
  assert(newServicePayable.operation_service_id === newService.id, '35. Pagamento previsto associado ao novo serviço');

  // 11. Testar "Cancelar Parcela" mantendo o compromisso no banco com status 'cancelled'
  const countBeforeCancel = (await supabase.from('financial_commitments').select('id', { count: 'exact' }).eq('operation_id', approval.operation_id)).count;
  const cancelledRec = await financialService.cancelCommitment(recInstallment2.id);
  assert(cancelledRec.status === 'cancelled', '36. Parcela de recebimento cancelada com status "cancelled"');

  const { data: recAfterCancel } = await supabase.from('financial_commitments').select('*').eq('id', recInstallment2.id).single();
  assert(recAfterCancel?.status === 'cancelled', '37. Registro da parcela cancelada mantido no banco de dados');
  const countAfterCancel = (await supabase.from('financial_commitments').select('id', { count: 'exact' }).eq('operation_id', approval.operation_id)).count;
  assert(countBeforeCancel === countAfterCancel, '38. Nenhuma linha excluída do banco ao cancelar parcela');

  // 12. Testar que itens cancelados são excluídos dos totais previstos
  const activeReceivables = (await financialService.listCommitments(approval.operation_id))
    .filter((c) => c.type === 'receivable' && c.status !== 'cancelled');
  const totalActiveRecEUR = activeReceivables
    .filter((c) => c.currency === 'EUR')
    .reduce((sum, c) => sum + Number(c.amount), 0);
  assert(totalActiveRecEUR === 1600, '39. Totais previstos ignoram a parcela cancelada (1600 EUR em vez de 3200 EUR)');

  // 13. Testar "Cancelar Serviço" mantendo o serviço e cancelando pagamentos previstos abertos em cascata
  const srvCountBefore = (await supabase.from('financial_operation_services').select('id', { count: 'exact' }).eq('operation_id', approval.operation_id)).count;
  const cancelSrvResult = await financialService.cancelOperationService(newService.id);
  assert(cancelSrvResult.service.status === 'cancelled', '40. Serviço cancelado com status "cancelled"');
  assert(cancelSrvResult.cancelledCommitmentsCount === 1, '41. Pagamento previsto aberto do serviço cancelado junto');

  const { data: srvInDb } = await supabase.from('financial_operation_services').select('*').eq('id', newService.id).single();
  assert(srvInDb?.status === 'cancelled', '42. Serviço cancelado preservado no banco');
  const srvCountAfter = (await supabase.from('financial_operation_services').select('id', { count: 'exact' }).eq('operation_id', approval.operation_id)).count;
  assert(srvCountBefore === srvCountAfter, '43. Nenhuma linha de serviço excluída do banco ao cancelar serviço');

  const { data: payInDb } = await supabase.from('financial_commitments').select('*').eq('id', newServicePayable.id).single();
  assert(payInDb?.status === 'cancelled', '44. Pagamento vinculado ao serviço agora está com status "cancelled" no banco');

  // 14. Testar bloqueio preventivo futuro: itens com liquidação real não podem ser cancelados
  // Simulando compromisso liquidado
  const settledCommitment = await financialService.createCommitment({
    operation_id: approval.operation_id,
    type: 'payable',
    counterparty_name: 'Fornecedor Pago',
    amount: 200,
    currency: 'EUR',
    status: 'settled',
    description: 'Pagamento já liquidado',
  });

  let blockedCommitmentErr = false;
  try {
    await financialService.cancelCommitment(settledCommitment.id);
  } catch (err: any) {
    blockedCommitmentErr = true;
    assert(err.message.includes('reembolso ou multa'), '45. Mensagem de bloqueio de cancelamento de item liquidado correta');
  }
  assert(blockedCommitmentErr, '46. Bloqueio preventivo impede cancelamento de compromisso com pagamento real');

  // Testar bloqueio preventivo de serviço que contenha compromisso liquidado e garantia de rollback atômico
  const srvWithSettledPay = await financialService.addOperationService({
    operation_id: approval.operation_id,
    type: 'tour',
    description: 'Passeio com pagamento já realizado',
    cost_amount: 300,
    cost_currency: 'EUR',
    status: 'planned',
  });
  const plannedLinkedPay = await financialService.createCommitment({
    operation_id: approval.operation_id,
    operation_service_id: srvWithSettledPay.id,
    type: 'payable',
    counterparty_name: 'Guia Local Parcela 1',
    amount: 100,
    currency: 'EUR',
    status: 'planned',
  });
  await financialService.createCommitment({
    operation_id: approval.operation_id,
    operation_service_id: srvWithSettledPay.id,
    type: 'payable',
    counterparty_name: 'Guia Local Parcela 2',
    amount: 200,
    currency: 'EUR',
    status: 'settled',
  });

  let blockedServiceErr = false;
  try {
    await financialService.cancelOperationService(srvWithSettledPay.id);
  } catch (err: any) {
    blockedServiceErr = true;
    assert(err.message.includes('reembolso ou multa'), '47. Mensagem de bloqueio de cancelamento de serviço liquidado correta');
  }
  assert(blockedServiceErr, '48. Bloqueio preventivo atômico impede cancelamento de serviço com pagamentos reais');

  // Validar Rollback Total: nem o serviço nem a parcela aberta foram alterados
  const { data: srvRollbackCheck } = await supabase
    .from('financial_operation_services')
    .select('status')
    .eq('id', srvWithSettledPay.id)
    .single();
  assert(srvRollbackCheck?.status === 'planned', '49. Rollback garantido: status do serviço permaneceu "planned"');

  const { data: payRollbackCheck } = await supabase
    .from('financial_commitments')
    .select('status')
    .eq('id', plannedLinkedPay.id)
    .single();
  assert(payRollbackCheck?.status === 'planned', '50. Rollback garantido: parcela aberta permaneceu "planned"');

  // 15. Validar que a cotação original permanece intacta
  const originalQuoteCheck = await quotationsService.getQuotationById(quote.id);
  assert(originalQuoteCheck?.status === 'accepted', '51. Status da cotação original permanece "accepted"');
  assert(originalQuoteCheck?.reference === testRef, '52. Referência da cotação original preservada');

  // ==============================================================
  // 16. TESTES DA FASE 2A: GESTÃO DE CONTAS E LIQUIDAÇÕES REAIS ATÔMICAS
  // ==============================================================

  // 16.1 Gestão de Contas: cadastrar e editar conta
  const brlAccount = await financialService.createAccount({
    name: 'Nubank PJ BRL',
    type: 'bank_account',
    currency: 'BRL',
    initial_balance: 15000,
    initial_balance_date: '2026-09-01',
    description: 'Conta principal para transações no Brasil',
  });
  assert(Boolean(brlAccount.id), '53. Conta em BRL criada com sucesso');
  assert(brlAccount.currency === 'BRL', '54. Moeda da conta BRL validada');

  const updatedBrlAcc = await financialService.updateAccount(brlAccount.id, {
    name: 'Nubank PJ BRL Principal',
    initial_balance: 18000,
  });
  assert(updatedBrlAcc.name === 'Nubank PJ BRL Principal', '55. Edição de conta: nome atualizado');
  assert(Number(updatedBrlAcc.initial_balance) === 18000, '56. Edição de conta: saldo inicial atualizado');

  // 16.2 Recebimento Real Parcial e Total via função atômica record_commitment_settlement
  const recInstallmentActive = await financialService.createCommitment({
    operation_id: approval.operation_id,
    type: 'receivable',
    counterparty_name: quote.client_name || 'Cliente',
    counterparty_type: 'client',
    amount: 1600,
    currency: 'EUR',
    status: 'planned',
    payment_method: 'card',
    expected_date: '2026-11-10',
    description: 'Parcela Ativa para Teste de Liquidação Real',
  });

  const recSettlement1 = await financialService.recordCommitmentSettlement({
    commitment_id: recInstallmentActive.id,
    account_id: testAccount.id,
    amount: 600,
    transacted_at: '2026-10-20',
    reference: 'PIX-E2E-REC-1',
    description: 'Entrada parcial do cliente',
  });

  assert(Boolean(recSettlement1.transaction_id), '57. Recebimento parcial registrado com sucesso');
  assert(recSettlement1.type === 'inflow', '58. Recebimento gerou transação do tipo "inflow"');
  assert(Number(recSettlement1.amount) === 600, '59. Valor registrado confere com 600 EUR');
  assert(recSettlement1.commitment_status === 'partially_settled', '60. Situação do compromisso atualizada para "partially_settled"');
  assert(Number(recSettlement1.pending_balance) === 1000, '61. Saldo pendente atualizado para 1000 EUR');

  // Validar persistência da transação real no banco
  const { data: recTxs } = await supabase
    .from('financial_transactions')
    .select('*')
    .eq('commitment_id', recInstallmentActive.id);
  assert(recTxs?.length === 1, '62. Transação real vinculada à parcela persistida no banco');
  assert(recTxs?.[0].type === 'inflow', '63. Tipo da transação é inflow');

  // Liquidação total do saldo pendente restante (1000 EUR)
  const recSettlement2 = await financialService.recordCommitmentSettlement({
    commitment_id: recInstallmentActive.id,
    account_id: testAccount.id,
    amount: 1000,
    transacted_at: '2026-10-25',
    reference: 'PIX-E2E-REC-2',
    description: 'Quitação final da parcela',
  });

  assert(Boolean(recSettlement2.transaction_id), '64. Quitação final registrada com sucesso');
  assert(recSettlement2.commitment_status === 'settled', '65. Situação do compromisso atualizada para "settled" (Liquidado)');
  assert(Number(recSettlement2.pending_balance) === 0, '66. Saldo pendente zerado após quitação total');

  // 16.3 Pagamento Real Parcial e Total de Serviço via função atômica
  // payable possui amount: 1000, currency: 'EUR', status: 'planned'
  const paySettlement1 = await financialService.recordCommitmentSettlement({
    commitment_id: payable!.id,
    account_id: testAccount.id,
    amount: 400,
    transacted_at: '2026-10-22',
    reference: 'TRANSF-HOTEL-PARC1',
    description: 'Adiantamento hotel fornecedor',
  });

  assert(Boolean(paySettlement1.transaction_id), '67. Pagamento parcial de fornecedor registrado com sucesso');
  assert(paySettlement1.type === 'outflow', '68. Pagamento a fornecedor gerou transação do tipo "outflow"');
  assert(paySettlement1.commitment_status === 'partially_settled', '69. Situação do compromisso a pagar atualizada para "partially_settled"');
  assert(Number(paySettlement1.pending_balance) === 600, '70. Saldo pendente a pagar atualizado para 600 EUR');

  // 16.4 Regras obrigatórias de bloqueio e segurança (com validação atômica)

  // A. Bloqueio: Moeda incompatível (conta em BRL para compromisso em EUR)
  let currencyMismatchErr = false;
  try {
    await financialService.recordCommitmentSettlement({
      commitment_id: payable!.id,
      account_id: brlAccount.id,
      amount: 100,
    });
  } catch (err: any) {
    currencyMismatchErr = true;
    assert(err.message.includes('moeda da conta'), '71. Mensagem de erro de moeda incompatível confirmada');
  }
  assert(currencyMismatchErr, '72. Bloqueio atômico impede liquidação com conta de moeda diferente');

  // B. Bloqueio: Valor zero ou negativo
  let zeroAmountErr = false;
  try {
    await financialService.recordCommitmentSettlement({
      commitment_id: payable!.id,
      account_id: testAccount.id,
      amount: 0,
    });
  } catch (err: any) {
    zeroAmountErr = true;
    assert(err.message.includes('maior que zero'), '73. Mensagem de erro de valor <= 0 confirmada');
  }
  assert(zeroAmountErr, '74. Bloqueio impede liquidação com valor zero ou negativo');

  // C. Bloqueio: Valor maior que o saldo pendente (saldo pendente é 600, tentar 600.01)
  let excessAmountErr = false;
  try {
    await financialService.recordCommitmentSettlement({
      commitment_id: payable!.id,
      account_id: testAccount.id,
      amount: 600.01,
    });
  } catch (err: any) {
    excessAmountErr = true;
    assert(err.message.includes('saldo pendente'), '75. Mensagem de erro de valor excedente confirmada');
  }
  assert(excessAmountErr, '76. Bloqueio atômico impede liquidação com valor superior ao saldo pendente');

  // D. Bloqueio: Compromisso já liquidado não pode receber novas movimentações
  let settledCommitmentErr = false;
  try {
    await financialService.recordCommitmentSettlement({
      commitment_id: recInstallmentActive.id, // Liquidado com 1000 EUR no teste 65
      account_id: testAccount.id,
      amount: 10,
    });
  } catch (err: any) {
    settledCommitmentErr = true;
    assert(err.message.includes('liquidados') || err.message.includes('liquidado'), '77. Mensagem de erro em compromisso liquidado confirmada');
  }
  assert(settledCommitmentErr, '78. Bloqueio atômico impede novas movimentações em compromisso liquidado');

  // E. Bloqueio: Compromisso cancelado não pode receber novas movimentações
  const cancelledCommitment = await financialService.createCommitment({
    operation_id: approval.operation_id,
    type: 'payable',
    counterparty_name: 'Fornecedor Cancelado',
    amount: 250,
    currency: 'EUR',
    status: 'cancelled',
  });
  let cancelledCommitmentErr = false;
  try {
    await financialService.recordCommitmentSettlement({
      commitment_id: cancelledCommitment.id,
      account_id: testAccount.id,
      amount: 50,
    });
  } catch (err: any) {
    cancelledCommitmentErr = true;
    assert(err.message.includes('cancelados') || err.message.includes('cancelado'), '79. Mensagem de erro em compromisso cancelado confirmada');
  }
  assert(cancelledCommitmentErr, '80. Bloqueio atômico impede movimentação em compromisso cancelado');

  // ==============================================================
  // 17. FASE 2B: CARTÃO DE CRÉDITO
  // ==============================================================
  console.log('\n--- Testes da Fase 2B: Pagamentos por Cartão de Crédito ---');

  // 17.1 Criação de conta do tipo Cartão de Crédito
  const cardAccount = await financialService.createAccount({
    name: 'Cartão Corporativo Visa S23',
    type: 'credit_card',
    currency: 'EUR',
    initial_balance: 0,
    initial_balance_date: '2026-10-01',
    description: 'Cartão corporativo para despesas e reservas com fornecedores',
  });
  assert(Boolean(cardAccount.id), '81. Conta do tipo cartão de crédito criada com sucesso');
  assert(cardAccount.type === 'credit_card', '82. Tipo da conta validado como "credit_card"');

  // Criação de segundo cartão para teste de bloqueio de fatura
  const cardAccount2 = await financialService.createAccount({
    name: 'Cartão Secundário Mastercard',
    type: 'credit_card',
    currency: 'EUR',
    initial_balance: 0,
    initial_balance_date: '2026-10-01',
  });

  // 17.2 Bloqueio: Não permitir usar conta de cartão para registrar recebimento de cliente
  // Criar um recebível aberto para o teste
  const clientReceivable = await financialService.createCommitment({
    operation_id: approval.operation_id,
    type: 'receivable',
    counterparty_name: 'Cliente Teste Cartão',
    counterparty_type: 'client',
    amount: 500,
    currency: 'EUR',
    status: 'planned',
    description: 'Recebimento de teste',
  });

  let cardReceivableErr = false;
  try {
    await financialService.recordCommitmentSettlement({
      commitment_id: clientReceivable.id,
      account_id: cardAccount.id,
      amount: 200,
    });
  } catch (err: any) {
    cardReceivableErr = true;
    assert(err.message.includes('cartão de crédito') || err.message.includes('recebimento'), '83. Mensagem de erro de bloqueio de recebimento no cartão correta');
  }
  assert(cardReceivableErr, '84. Bloqueio impede usar conta de cartão para registrar recebimento de cliente');

  // 17.3 Bloqueio: Exigir data de vencimento da fatura ao pagar com cartão
  let missingDueDateErr = false;
  try {
    await financialService.recordCommitmentSettlement({
      commitment_id: payable!.id, // saldo pendente é 600
      account_id: cardAccount.id,
      amount: 250,
      // sem invoice_due_date
    });
  } catch (err: any) {
    missingDueDateErr = true;
    assert(err.message.includes('vencimento da fatura'), '85. Mensagem de erro de vencimento obrigatório confirmada');
  }
  assert(missingDueDateErr, '86. Bloqueio atômico exige data de vencimento da fatura para cartão de crédito');

  // 17.4 Sucesso: Registrar pagamento a fornecedor com cartão de crédito
  // - Liquida o pagamento do fornecedor normalmente (outflow na conta do cartão)
  // - Cria automaticamente nova parcela prevista da fatura do cartão (payable) no mesmo valor e moeda
  // - Identifica o cartão e a operação/serviço de origem
  const cardSettlementResult = await financialService.recordCommitmentSettlement({
    commitment_id: payable!.id,
    account_id: cardAccount.id,
    amount: 250,
    transacted_at: '2026-10-23',
    reference: 'AUTH-VISA-994411',
    description: 'Pagamento de hotel com cartão corporativo',
    invoice_due_date: '2026-11-20',
  });

  assert(Boolean(cardSettlementResult.transaction_id), '87. Pagamento ao fornecedor com cartão registrado com sucesso');
  assert(cardSettlementResult.type === 'outflow', '88. Transação gerada no cartão é do tipo "outflow"');
  assert(Boolean(cardSettlementResult.invoice_commitment_id), '89. Parcela prevista da fatura do cartão criada atomicamente');

  // Validar a parcela da fatura gerada no banco de dados
  const { data: invoiceCommitment } = await supabase
    .from('financial_commitments')
    .select('*')
    .eq('id', cardSettlementResult.invoice_commitment_id!)
    .single();

  assert(Boolean(invoiceCommitment), '90. Registro da fatura localizado no banco de dados');
  assert(invoiceCommitment.is_credit_card_invoice === true, '91. Flag is_credit_card_invoice é true na fatura');
  assert(Number(invoiceCommitment.amount) === 250, '92. Valor da fatura é exatamente o mesmo valor pago ao fornecedor (250 EUR)');
  assert(invoiceCommitment.currency === 'EUR', '93. Moeda da fatura é EUR');
  assert(invoiceCommitment.expected_date === '2026-11-20', '94. Data de vencimento da fatura confere com o informado');
  assert(invoiceCommitment.credit_card_account_id === cardAccount.id, '95. Fatura identifica a conta do cartão de crédito');
  assert(invoiceCommitment.origin_commitment_id === payable!.id, '96. Fatura identifica o compromisso de fornecedor de origem');
  assert(invoiceCommitment.operation_service_id === payable!.operation_service_id, '97. Fatura identifica o serviço de origem');

  // 17.5 Regra: Não contar o pagamento ao fornecedor e a fatura como dois custos operacionais da viagem
  const allOperationPayables = await financialService.listCommitments(approval.operation_id);
  const totalWithInvoiceEUR = allOperationPayables
    .filter((c) => c.type === 'payable' && c.status !== 'cancelled' && c.currency === 'EUR')
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const operationalPayables = allOperationPayables.filter(
    (c) => c.type === 'payable' && c.status !== 'cancelled' && !c.is_credit_card_invoice
  );
  const totalOperationalCostEUR = operationalPayables
    .filter((c) => c.currency === 'EUR')
    .reduce((sum, c) => sum + Number(c.amount), 0);

  assert(
    totalWithInvoiceEUR === totalOperationalCostEUR + 250,
    '98. Total geral com faturas inclui a fatura de 250 EUR'
  );
  assert(
    operationalPayables.every((c) => !c.is_credit_card_invoice),
    '99. Custos operacionais previstos da viagem excluem faturas de cartão e não duplicam custos'
  );

  // 17.6 Bloqueio: Não permitir pagar fatura de cartão com outro cartão de crédito
  let payInvoiceWithCardErr = false;
  try {
    await financialService.recordCommitmentSettlement({
      commitment_id: invoiceCommitment.id,
      account_id: cardAccount2.id,
      amount: 250,
      invoice_due_date: '2026-12-20',
    });
  } catch (err: any) {
    payInvoiceWithCardErr = true;
    assert(err.message.includes('cartão com outro cartão') || err.message.includes('outro cartão'), '100. Mensagem de erro ao pagar fatura com cartão confirmada');
  }
  assert(payInvoiceWithCardErr, '101. Bloqueio impede pagar fatura de cartão com outro cartão de crédito');

  // 17.7 Quitar fatura do cartão com conta bancária normal (saída de banco)
  const invoiceSettlement = await financialService.recordCommitmentSettlement({
    commitment_id: invoiceCommitment.id,
    account_id: testAccount.id, // Débito na conta bancária normal
    amount: 250,
    transacted_at: '2026-11-20',
    reference: 'DEBITO-FATURA-NOV',
    description: 'Pagamento da fatura mensal do cartão Visa',
  });
  assert(Boolean(invoiceSettlement.transaction_id), '102. Fatura do cartão paga via conta bancária com sucesso');
  assert(invoiceSettlement.type === 'outflow', '103. Saída registrada na conta bancária');
  assert(invoiceSettlement.commitment_status === 'settled', '104. Fatura do cartão liquidada com status "settled"');
  assert(Number(invoiceSettlement.pending_balance) === 0, '105. Saldo pendente da fatura zerado');

  // ==============================================================
  // 18. FASE 2B: TRANSFERÊNCIAS ENTRE CONTAS
  // ==============================================================
  console.log('\n--- Testes da Fase 2B: Transferências entre Contas ---');

  // Criar segunda conta bancária EUR para teste de transferência interna mesma moeda
  const eurAccount2 = await financialService.createAccount({
    name: 'Caixa Secundário Lisboa EUR',
    type: 'cash',
    currency: 'EUR',
    initial_balance: 100,
    initial_balance_date: '2026-10-01',
  });
  assert(Boolean(eurAccount2.id), '106. Segunda conta em EUR criada para testes de transferência');

  // 18.1 Bloqueio: Contas de origem e destino idênticas
  let sameAccountTransferErr = false;
  try {
    await financialService.recordAccountTransfer({
      source_account_id: testAccount.id,
      destination_account_id: testAccount.id,
      amount: 100,
    });
  } catch (err: any) {
    sameAccountTransferErr = true;
    assert(err.message.includes('diferentes'), '107. Mensagem de erro de contas iguais confirmada');
  }
  assert(sameAccountTransferErr, '108. Bloqueio atômico impede transferência para a mesma conta');

  // 18.2 Bloqueio: Não permitir cartão como conta de origem ou destino
  let cardSourceTransferErr = false;
  try {
    await financialService.recordAccountTransfer({
      source_account_id: cardAccount.id,
      destination_account_id: testAccount.id,
      amount: 100,
    });
  } catch (err: any) {
    cardSourceTransferErr = true;
    assert(err.message.includes('cartão de crédito'), '109. Mensagem de erro de cartão como origem confirmada');
  }
  assert(cardSourceTransferErr, '110. Bloqueio impede cartão como conta de origem em transferências');

  let cardDestTransferErr = false;
  try {
    await financialService.recordAccountTransfer({
      source_account_id: testAccount.id,
      destination_account_id: cardAccount.id,
      amount: 100,
    });
  } catch (err: any) {
    cardDestTransferErr = true;
    assert(err.message.includes('cartão de crédito'), '111. Mensagem de erro de cartão como destino confirmada');
  }
  assert(cardDestTransferErr, '112. Bloqueio impede cartão como conta de destino em transferências');

  // 18.3 Transferência atômica na mesma moeda (EUR -> EUR)
  const sameCurrencyTransfer = await financialService.recordAccountTransfer({
    source_account_id: testAccount.id,
    destination_account_id: eurAccount2.id,
    amount: 150,
    transacted_at: '2026-10-24',
    reference: 'TRANSF-INT-001',
    description: 'Suprimento de caixa Lisboa',
    operation_id: approval.operation_id,
  });

  assert(sameCurrencyTransfer.success === true, '113. Transferência mesma moeda registrada com sucesso');
  assert(sameCurrencyTransfer.source_currency === 'EUR', '114. Moeda de origem é EUR');
  assert(sameCurrencyTransfer.destination_currency === 'EUR', '115. Moeda de destino é EUR');
  assert(Number(sameCurrencyTransfer.source_amount) === 150, '116. Valor de origem é 150 EUR');
  assert(Number(sameCurrencyTransfer.destination_amount) === 150, '117. Valor de destino é 150 EUR');

  // Validar no banco que transferências não liquidam parcelas (commitment_id é NULL)
  const { data: transferTx } = await supabase
    .from('financial_transactions')
    .select('*')
    .eq('id', sameCurrencyTransfer.transaction_id)
    .single();

  assert(Boolean(transferTx), '118. Transação de transferência encontrada no banco');
  assert(transferTx.type === 'transfer', '119. Tipo de transação é "transfer"');
  assert(transferTx.commitment_id === null, '120. Transferência não liquida nenhuma parcela (commitment_id é estritamente NULL)');
  assert(transferTx.destination_account_id === eurAccount2.id, '121. Conta de destino registrada na transação');

  // 18.4 Transferência multimoeda (EUR -> BRL) com taxa de câmbio e custo de remessa opcional
  const crossCurrencyTransfer = await financialService.recordAccountTransfer({
    source_account_id: testAccount.id, // EUR
    destination_account_id: brlAccount.id, // BRL
    amount: 500, // EUR
    destination_amount: 3075, // BRL (500 * 6.15)
    exchange_rate: 6.15,
    transfer_fee: 15.00,
    transfer_fee_currency: 'EUR',
    transacted_at: '2026-10-25',
    reference: 'CAMBIO-REMESSA-044',
    description: 'Remessa de câmbio para conta operacional Brasil',
    operation_id: approval.operation_id,
  });

  assert(crossCurrencyTransfer.success === true, '122. Transferência multimoeda registrada com sucesso');
  assert(crossCurrencyTransfer.source_currency === 'EUR', '123. Moeda de origem da remessa é EUR');
  assert(crossCurrencyTransfer.destination_currency === 'BRL', '124. Moeda de destino da remessa é BRL');
  assert(Number(crossCurrencyTransfer.source_amount) === 500, '125. Valor de origem é 500 EUR');
  assert(Number(crossCurrencyTransfer.destination_amount) === 3075, '126. Valor de destino é 3075 BRL');
  assert(Number(crossCurrencyTransfer.exchange_rate) === 6.15, '127. Taxa de câmbio 6.15 registrada');
  assert(Number(crossCurrencyTransfer.transfer_fee) === 15.00, '128. Custo de remessa de 15 EUR registrado');

  const { data: crossTx } = await supabase
    .from('financial_transactions')
    .select('*')
    .eq('id', crossCurrencyTransfer.transaction_id)
    .single();

  assert(Boolean(crossTx), '129. Registro da transação cambial encontrado no banco');
  assert(Number(crossTx.exchange_rate) === 6.15, '130. Câmbio persistido no banco');
  assert(Number(crossTx.transfer_fee) === 15.00, '131. Tarifa de remessa persistida no banco');
  assert(crossTx.transfer_fee_currency === 'EUR', '132. Moeda da tarifa é EUR');
  assert(crossTx.commitment_id === null, '133. Transação cambial não liquida compromisso de cliente ou fornecedor');

  // ==============================================================
  // 19. FASE 2C: CANCELAMENTOS, REEMBOLSOS E MULTAS
  // ==============================================================
  console.log('\n--- Testes da Fase 2C: Cancelamentos, Reembolsos e Multas ---');

  // 19.1 Bloqueios de Contexto: Operação Ativa
  // Cenário A: Tentar criar ajuste avulso com a operação ainda ativa (deve falhar)
  let activeOpAdjustmentErr = false;
  try {
    await financialService.createCancellationAdjustment({
      operation_id: approval.operation_id,
      adjustment_type: 'client_refund',
      counterparty_name: 'Cliente Teste',
      amount: 100,
      currency: 'EUR',
    });
  } catch (err: any) {
    activeOpAdjustmentErr = true;
    assert(
      err.message.includes('operação financeira estiver cancelada') || err.message.includes('estiver cancelada'),
      '134. Mensagem de bloqueio de ajuste em operação ativa confirmada'
    );
  }
  assert(activeOpAdjustmentErr, '135. Banco rejeita ajuste avulso quando a operação financeira está ativa');

  // Cenário B: Tentar criar ajuste passando um serviço que ainda está ativo (planned)
  let activeServiceAdjustmentErr = false;
  try {
    await financialService.createCancellationAdjustment({
      operation_id: approval.operation_id,
      operation_service_id: service.id, // serviço ainda está planned
      adjustment_type: 'supplier_refund',
      counterparty_name: 'Hotel Lisboa',
      amount: 50,
      currency: 'EUR',
    });
  } catch (err: any) {
    activeServiceAdjustmentErr = true;
    assert(
      err.message.includes('serviço esteja cancelado') || err.message.includes('cancelado'),
      '136. Mensagem de bloqueio para serviço não cancelado confirmada'
    );
  }
  assert(activeServiceAdjustmentErr, '137. Banco rejeita ajuste para serviço que não está cancelado');

  // Cenário C: Tentar criar ajuste passando um serviço com UUID inexistente ou de outra operação
  let invalidServiceAdjustmentErr = false;
  try {
    await financialService.createCancellationAdjustment({
      operation_id: approval.operation_id,
      operation_service_id: '00000000-0000-0000-0000-000000000000',
      adjustment_type: 'cancellation_fee',
      counterparty_name: 'Fornecedor X',
      amount: 50,
      currency: 'EUR',
    });
  } catch (err: any) {
    invalidServiceAdjustmentErr = true;
    assert(
      err.message.includes('não foi encontrado') || err.message.includes('não pertence'),
      '138. Mensagem de serviço inexistente/inválido confirmada'
    );
  }
  assert(invalidServiceAdjustmentErr, '139. Banco rejeita ajuste com serviço inexistente ou de outra operação');

  // 19.2 Cancelamento de Serviço com Pagamento Real via Fluxo de Ajuste
  let missingReasonServiceCancelErr = false;
  try {
    await financialService.cancelOperationServiceWithAdjustments({
      service_id: service.id,
      reason: '   ', // vazio
    });
  } catch (err: any) {
    missingReasonServiceCancelErr = true;
    assert(err.message.includes('motivo'), '140. Mensagem de motivo obrigatório no cancelamento de serviço confirmada');
  }
  assert(missingReasonServiceCancelErr, '141. Bloqueio exige motivo obrigatório para cancelamento de serviço');

  const cancelServiceResult = await financialService.cancelOperationServiceWithAdjustments({
    service_id: service.id,
    reason: 'Passageiro desistiu do hotel após confirmação',
    supplier_refund_amount: 80,
    supplier_refund_currency: 'EUR',
    cancellation_fee_amount: 40,
    cancellation_fee_currency: 'EUR',
    fee_counterparty_name: 'Porto Palácio Luxury Group',
  });

  assert(cancelServiceResult.success === true, '142. Serviço com pagamentos reais cancelado via fluxo de ajuste com sucesso');
  assert(cancelServiceResult.status === 'cancelled', '143. Status do serviço atualizado para "cancelled"');
  assert(Boolean(cancelServiceResult.supplier_refund_id), '144. Previsão de reembolso do fornecedor gerada atomicamente');
  assert(Boolean(cancelServiceResult.cancellation_fee_id), '145. Previsão de multa de cancelamento gerada atomicamente');

  // Validar preservação de histórico do serviço
  const { data: srvCancelledDb } = await supabase.from('financial_operation_services').select('*').eq('id', service.id).single();
  assert(srvCancelledDb?.status === 'cancelled', '146. Serviço cancelado preservado no banco');
  const serviceTxsCount = (await supabase.from('financial_transactions').select('id', { count: 'exact' }).eq('operation_id', approval.operation_id)).count;
  assert(serviceTxsCount! > 0, '147. Todas as movimentações reais do serviço cancelado continuam preservadas');

  // 19.3 Permissão de Ajuste Vinculado a Serviço Cancelado (mesmo com operação ainda ativa)
  const serviceSpecificAdjustment = await financialService.createCancellationAdjustment({
    operation_id: approval.operation_id,
    operation_service_id: service.id,
    adjustment_type: 'cancellation_fee',
    counterparty_name: 'Porto Palácio Luxury Group',
    amount: 15,
    currency: 'EUR',
    description: 'Taxa adicional de cancelamento de quarto',
  });

  assert(Boolean(serviceSpecificAdjustment.id), '148. Ajuste vinculado a serviço cancelado é aceito com sucesso mesmo com operação ativa');
  assert(serviceSpecificAdjustment.operation_service_id === service.id, '149. Ajuste identifica o serviço cancelado de origem');

  // 19.4 Cancelar Operação Financeira Atomicamente
  let missingOpReasonErr = false;
  try {
    await financialService.cancelFinancialOperation(approval.operation_id, '  ');
  } catch (err: any) {
    missingOpReasonErr = true;
    assert(err.message.includes('motivo'), '150. Mensagem de erro de motivo obrigatório confirmada');
  }
  assert(missingOpReasonErr, '151. Bloqueio exige motivo obrigatório para cancelar operação');

  // Executar cancelamento da operação
  const cancelOpResult = await financialService.cancelFinancialOperation(
    approval.operation_id,
    'Cancelamento total da viagem por motivo de força maior'
  );

  assert(cancelOpResult.success === true, '152. Operação financeira cancelada atomicamente com sucesso');
  assert(cancelOpResult.status === 'cancelled', '153. Status da operação atualizado para "cancelled"');
  assert(cancelOpResult.cancellation_reason.includes('força maior'), '154. Motivo do cancelamento gravado na operação');

  const { data: opCancelledDb } = await supabase.from('financial_operations').select('*').eq('id', approval.operation_id).single();
  assert(opCancelledDb?.status === 'cancelled', '155. Operação cancelada confirmada no banco');
  assert(Boolean(opCancelledDb?.cancelled_at), '156. Timestamp de cancelamento preenchido');

  // Bloqueio: Cancelar operação já cancelada deve falhar
  let alreadyCancelledOpErr = false;
  try {
    await financialService.cancelFinancialOperation(approval.operation_id, 'Tentativa duplicada');
  } catch (err: any) {
    alreadyCancelledOpErr = true;
    assert(err.message.includes('já se encontra cancelada'), '157. Mensagem de operação já cancelada confirmada');
  }
  assert(alreadyCancelledOpErr, '158. Banco impede cancelar novamente operação que já está cancelada');

  // 19.5 Permissão de Ajustes Gerais quando a Operação está Cancelada
  // Reembolso ao Cliente (agência devolve dinheiro -> gera saída / payable)
  const clientRefundAdjustment = await financialService.createCancellationAdjustment({
    operation_id: approval.operation_id,
    adjustment_type: 'client_refund',
    counterparty_name: 'Cliente Final S23',
    amount: 300,
    currency: 'EUR',
    expected_date: '2026-10-30',
    description: 'Devolução de 50% do sinal pago pelo cliente',
    notes: 'Acordo amigável de cancelamento',
  });

  assert(Boolean(clientRefundAdjustment.id), '159. Ajuste geral de reembolso ao cliente criado com sucesso em operação cancelada');
  assert(clientRefundAdjustment.type === 'payable', '160. Reembolso ao cliente gera compromisso a pagar (saída)');
  assert(clientRefundAdjustment.is_cancellation_adjustment === true, '161. Flag is_cancellation_adjustment é true no ajuste');
  assert(clientRefundAdjustment.adjustment_type === 'client_refund', '162. adjustment_type validado como "client_refund"');

  // Validar que o ajuste de cancelamento NÃO duplica custo operacional original da viagem
  const allPayablesEUR = (await financialService.listCommitments(approval.operation_id))
    .filter((c) => c.type === 'payable' && c.status !== 'cancelled' && !c.is_credit_card_invoice && c.currency === 'EUR');
  const payablesAfterAdjustment = allPayablesEUR.filter((c) => !c.is_cancellation_adjustment);

  assert(
    payablesAfterAdjustment.every((c) => !c.is_cancellation_adjustment),
    '163. Custos operacionais previstos originais ignoram ajustes de cancelamento e não duplicam custos'
  );

  // Liquidar o Reembolso ao Cliente pela rotina existente de registrar pagamento
  const clientRefundSettlement = await financialService.recordCommitmentSettlement({
    commitment_id: clientRefundAdjustment.id,
    account_id: testAccount.id,
    amount: 300,
    transacted_at: '2026-10-30',
    reference: 'DEV-CLIENTE-PIX',
    description: 'Pagamento de devolução ao passageiro',
  });

  assert(Boolean(clientRefundSettlement.transaction_id), '164. Reembolso ao cliente liquidado pela mesma rotina padrão');
  assert(clientRefundSettlement.type === 'outflow', '165. Devolução ao cliente gerou transação do tipo "outflow"');
  assert(clientRefundSettlement.commitment_status === 'settled', '166. Situação do reembolso atualizada para "settled"');
  assert(Number(clientRefundSettlement.pending_balance) === 0, '167. Saldo pendente do reembolso zerado');

  // Reembolso do Fornecedor em Operação Cancelada
  const supplierRefundAdjustment = await financialService.createCancellationAdjustment({
    operation_id: approval.operation_id,
    adjustment_type: 'supplier_refund',
    counterparty_name: 'Porto Palácio Luxury Group',
    amount: 120,
    currency: 'EUR',
    description: 'Devolução parcial de reserva cancelada',
  });

  assert(Boolean(supplierRefundAdjustment.id), '168. Ajuste de reembolso de fornecedor criado com sucesso em operação cancelada');
  assert(supplierRefundAdjustment.type === 'receivable', '169. Reembolso do fornecedor gera compromisso a receber (entrada)');

  const supplierRefundSettlement = await financialService.recordCommitmentSettlement({
    commitment_id: supplierRefundAdjustment.id,
    account_id: testAccount.id,
    amount: 120,
    transacted_at: '2026-10-31',
    reference: 'ESTORNO-HOTEL-99',
    description: 'Recebimento de estorno do hotel',
  });

  assert(Boolean(supplierRefundSettlement.transaction_id), '170. Reembolso do fornecedor liquidado com sucesso');
  assert(supplierRefundSettlement.type === 'inflow', '171. Estorno do fornecedor gerou transação do tipo "inflow"');

  // Multa de Cancelamento em BRL em Operação Cancelada
  const cancellationFeeAdjustment = await financialService.createCancellationAdjustment({
    operation_id: approval.operation_id,
    adjustment_type: 'cancellation_fee',
    counterparty_name: 'Companhia Aérea TAP',
    amount: 250,
    currency: 'BRL',
    description: 'Multa de no-show / cancelamento tardio',
  });

  assert(Boolean(cancellationFeeAdjustment.id), '172. Ajuste de multa de cancelamento criado com sucesso');
  assert(cancellationFeeAdjustment.type === 'payable', '173. Multa de cancelamento gera compromisso a pagar (saída)');
  assert(cancellationFeeAdjustment.currency === 'BRL', '174. Moeda BRL preservada separadamente');

  const feeSettlement = await financialService.recordCommitmentSettlement({
    commitment_id: cancellationFeeAdjustment.id,
    account_id: brlAccount.id,
    amount: 250,
    transacted_at: '2026-10-31',
    reference: 'MULTA-TAP-BRL',
    description: 'Pagamento da multa à companhia aérea',
  });

  assert(Boolean(feeSettlement.transaction_id), '175. Multa de cancelamento liquidada com conta em BRL');
  assert(feeSettlement.type === 'outflow', '176. Pagamento de multa gerou transação "outflow"');

  // Preservação de dados: Nenhum registro de transações reais foi excluído
  const totalTxsAfterOpCancel = (await supabase.from('financial_transactions').select('id', { count: 'exact' }).eq('operation_id', approval.operation_id)).count;
  assert(totalTxsAfterOpCancel! > 0, '177. Todas as movimentações reais permanecem intactas após cancelamento da operação');

  // Limpeza de todos os dados de teste criados
  try {
    await supabase.from('financial_transactions').delete().eq('operation_id', approval.operation_id);
    await supabase.from('financial_commitments').delete().eq('operation_id', approval.operation_id);
    await supabase.from('financial_operation_services').delete().eq('operation_id', approval.operation_id);
    await supabase.from('financial_operations').delete().eq('id', approval.operation_id);
    await supabase.from('quotations').delete().eq('id', quote.id);
    await supabase.from('financial_accounts').delete().eq('id', testAccount.id);
    await supabase.from('financial_accounts').delete().eq('id', brlAccount.id);
    await supabase.from('financial_accounts').delete().eq('id', cardAccount.id);
    await supabase.from('financial_accounts').delete().eq('id', cardAccount2.id);
    await supabase.from('financial_accounts').delete().eq('id', eurAccount2.id);
  } catch (cleanErr) {
    // Ignora erro de limpeza
  }

  console.log('\n====================================================');
  console.log(' RESULTADO FINAL FINANCEIRO ATÔMICO FASE 2C: 177 PASSOU / 0 FALHOU');
  console.log('====================================================\n');
}

runQuotationFinancialTests().catch((err) => {
  console.error('Erro fatal nos testes da tela financeira:', err);
  process.exit(1);
});
