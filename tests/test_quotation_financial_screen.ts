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

  // Limpeza de dados de teste
  try {
    await supabase.from('financial_commitments').delete().eq('operation_id', approval.operation_id);
    await supabase.from('financial_operation_services').delete().eq('operation_id', approval.operation_id);
    await supabase.from('financial_operations').delete().eq('id', approval.operation_id);
    await supabase.from('quotations').delete().eq('id', quote.id);
    await supabase.from('financial_accounts').delete().eq('id', testAccount.id);
  } catch (cleanErr) {
    // Ignora erro de limpeza
  }

  console.log('\n====================================================');
  console.log(' RESULTADO FINAL FINANCEIRO ATÔMICO: 52 PASSOU / 0 FALHOU');
  console.log('====================================================\n');
}

runQuotationFinancialTests().catch((err) => {
  console.error('Erro fatal nos testes da tela financeira:', err);
  process.exit(1);
});
