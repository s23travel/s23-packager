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

interface SimulatedCommitment {
  id: string;
  operation_id: string;
  quotation_id: string | null;
  quotation_reference: string | null;
  type: 'receivable' | 'payable';
  counterparty_name: string;
  amount: number;
  currency: 'EUR' | 'BRL';
  status: 'planned' | 'partially_settled' | 'settled' | 'cancelled';
  expected_date: string;
  is_credit_card_invoice: boolean;
  origin_commitment_id?: string | null;
}

interface SimulatedTransaction {
  id: string;
  commitment_id: string;
  account_id: string;
  type: 'inflow' | 'outflow';
  amount: number;
  currency: 'EUR' | 'BRL';
  transacted_at: string;
  reference?: string;
  description?: string;
}

interface SimulatedAccount {
  id: string;
  name: string;
  type: 'bank_account' | 'credit_card' | 'cash';
  currency: 'EUR' | 'BRL';
  active: boolean;
}

/**
 * Motor contábil simulado seguindo as RPCs do Supabase
 * (record_commitment_settlement e get_pending_financial_commitments)
 */
class FinancialEngineSimulator {
  commitments: SimulatedCommitment[] = [];
  transactions: SimulatedTransaction[] = [];
  accounts: SimulatedAccount[] = [];

  recordCommitmentSettlement(input: {
    commitment_id: string;
    account_id: string;
    amount: number;
    transacted_at?: string;
    reference?: string;
    description?: string;
    invoice_due_date?: string;
  }) {
    const comm = this.commitments.find((c) => c.id === input.commitment_id);
    if (!comm) throw new Error('Compromisso financeiro informado não foi encontrado.');
    if (comm.status === 'cancelled') throw new Error('Não é possível registrar movimentações em compromissos cancelados.');
    if (comm.status === 'settled') throw new Error('Não é possível registrar movimentações em compromissos já liquidados.');

    const acc = this.accounts.find((a) => a.id === input.account_id);
    if (!acc) throw new Error('Conta financeira informada não foi encontrada.');
    if (!acc.active) throw new Error('A conta financeira selecionada está inativa.');

    // Regra de Cartão de Crédito para Recebimentos
    if (comm.type === 'receivable' && acc.type === 'credit_card') {
      throw new Error('Não é permitido utilizar conta do tipo cartão de crédito para registrar recebimentos de clientes.');
    }

    // Regra para faturas de cartão
    if (comm.is_credit_card_invoice && acc.type === 'credit_card') {
      throw new Error('Não é permitido pagar a fatura de um cartão com outro cartão de crédito.');
    }

    // Regra de moeda estrita
    if (acc.currency !== comm.currency) {
      throw new Error(`A moeda da conta selecionada (${acc.currency}) deve ser idêntica à moeda do compromisso (${comm.currency}).`);
    }

    // Validação de valor
    if (input.amount <= 0) {
      throw new Error('O valor da movimentação deve ser maior que zero.');
    }

    const txType = comm.type === 'receivable' ? 'inflow' : 'outflow';

    const alreadyPaid = this.transactions
      .filter((t) => t.commitment_id === comm.id && t.type === txType)
      .reduce((sum, t) => sum + t.amount, 0);

    const pendingBalance = comm.amount - alreadyPaid;
    if (input.amount > pendingBalance + 0.001) {
      throw new Error(`O valor informado (${input.amount}) excede o saldo pendente deste compromisso (${pendingBalance}).`);
    }

    if (comm.type === 'payable' && acc.type === 'credit_card' && !input.invoice_due_date) {
      throw new Error('A data de vencimento da fatura é obrigatória para pagamentos com cartão de crédito.');
    }

    // Inserir movimentação
    const newTx: SimulatedTransaction = {
      id: `tx-${Date.now()}-${Math.random()}`,
      commitment_id: comm.id,
      account_id: acc.id,
      type: txType,
      amount: input.amount,
      currency: comm.currency,
      transacted_at: input.transacted_at || new Date().toISOString(),
      reference: input.reference,
      description: input.description,
    };
    this.transactions.push(newTx);

    // Atualizar status do compromisso SEM alterar o amount original
    const newPaid = alreadyPaid + input.amount;
    const isSettled = newPaid >= comm.amount - 0.001;
    comm.status = isSettled ? 'settled' : 'partially_settled';

    let invoiceCommitmentId: string | null = null;
    if (comm.type === 'payable' && acc.type === 'credit_card') {
      const invoiceComm: SimulatedCommitment = {
        id: `inv-${Date.now()}-${Math.random()}`,
        operation_id: comm.operation_id,
        quotation_id: comm.quotation_id,
        quotation_reference: comm.quotation_reference,
        type: 'payable',
        counterparty_name: `Fatura ${acc.name}`,
        amount: input.amount,
        currency: comm.currency,
        status: 'planned',
        expected_date: input.invoice_due_date!,
        is_credit_card_invoice: true,
        origin_commitment_id: comm.id,
      };
      this.commitments.push(invoiceComm);
      invoiceCommitmentId = invoiceComm.id;
    }

    return {
      transaction_id: newTx.id,
      commitment_id: comm.id,
      commitment_status: comm.status,
      type: txType,
      amount: input.amount,
      currency: comm.currency,
      already_paid: newPaid,
      pending_balance: Math.max(0, comm.amount - newPaid),
      invoice_commitment_id: invoiceCommitmentId,
    };
  }

  getPendingCommitments() {
    return this.commitments
      .filter((c) => c.status === 'planned' || c.status === 'partially_settled')
      .map((c) => {
        const txType = c.type === 'receivable' ? 'inflow' : 'outflow';
        const alreadyPaid = this.transactions
          .filter((t) => t.commitment_id === c.id && t.type === txType)
          .reduce((sum, t) => sum + t.amount, 0);
        const pendingAmount = Math.max(0, c.amount - alreadyPaid);
        return {
          ...c,
          already_paid: alreadyPaid,
          pending_amount: pendingAmount,
        };
      })
      .filter((c) => c.pending_amount > 0);
  }
}

async function runCommitmentSettlementTests() {
  console.log('=== TESTES: LIQUIDAÇÃO OPERACIONAL DE COMPROMISSOS (MOTOR & REGRAS) ===\n');

  // Inicializar o simulador com contas e compromissos
  const sim = new FinancialEngineSimulator();

  sim.accounts = [
    { id: 'acc-bcp-eur', name: 'Millennium BCP EUR', type: 'bank_account', currency: 'EUR', active: true },
    { id: 'acc-itau-brl', name: 'Itaú Unibanco BRL', type: 'bank_account', currency: 'BRL', active: true },
    { id: 'acc-card-eur', name: 'Cartão Corporate Visa EUR', type: 'credit_card', currency: 'EUR', active: true },
  ];

  sim.commitments = [
    {
      id: 'rec-1',
      operation_id: 'op-101',
      quotation_id: 'quot-101',
      quotation_reference: 'COT-2026-101',
      type: 'receivable',
      counterparty_name: 'Maria Fernanda',
      amount: 1500.0,
      currency: 'EUR',
      status: 'planned',
      expected_date: '2026-10-15',
      is_credit_card_invoice: false,
    },
    {
      id: 'pay-1',
      operation_id: 'op-101',
      quotation_id: 'quot-101',
      quotation_reference: 'COT-2026-101',
      type: 'payable',
      counterparty_name: 'TAP Air Portugal',
      amount: 800.0,
      currency: 'EUR',
      status: 'planned',
      expected_date: '2026-10-10',
      is_credit_card_invoice: false,
    },
    {
      id: 'pay-2',
      operation_id: 'op-102',
      quotation_id: 'quot-102',
      quotation_reference: 'COT-2026-102',
      type: 'payable',
      counterparty_name: 'Pousada Bahia Sol',
      amount: 2400.0,
      currency: 'BRL',
      status: 'planned',
      expected_date: '2026-10-20',
      is_credit_card_invoice: false,
    },
  ];

  // -------------------------------------------------------------
  // CENÁRIO 1: Liquidação Parcial de Recebimento
  // -------------------------------------------------------------
  console.log('--- 1. Cenário: Liquidação Parcial de Recebimento de Cliente ---');
  const initialAmountRec = sim.commitments.find((c) => c.id === 'rec-1')!.amount;
  assert(initialAmountRec === 1500, 'Compromisso rec-1 original tem 1.500,00 EUR previsto');

  const resParcialRec = sim.recordCommitmentSettlement({
    commitment_id: 'rec-1',
    account_id: 'acc-bcp-eur',
    amount: 500.0,
    reference: 'PIX-001',
    description: 'Entrada parcial 1/3',
  });

  assert(resParcialRec.commitment_status === 'partially_settled', 'Status alterado para partially_settled');
  assert(resParcialRec.already_paid === 500.0, 'already_paid é 500,00 EUR');
  assert(resParcialRec.pending_balance === 1000.0, 'Saldo residual pendente calculado é 1.000,00 EUR');

  // Verificar que o valor original NÃO foi alterado retroativamente
  const currentCommRec = sim.commitments.find((c) => c.id === 'rec-1')!;
  assert(currentCommRec.amount === 1500.0, 'Valor original do compromisso (amount) permanece estritamente 1.500,00 EUR');
  assert(currentCommRec.quotation_id === 'quot-101', 'Vínculo com a cotação quot-101 preservado');

  // Verificar que continua pendente na lista de pendências
  const pendingAfterParcial = sim.getPendingCommitments();
  const pendingRec = pendingAfterParcial.find((c) => c.id === 'rec-1');
  assert(Boolean(pendingRec), 'Compromisso parcialmente liquidado continua presente na central de pendências');
  assert(pendingRec!.pending_amount === 1000.0, 'Saldo pendente residual na central é 1.000,00 EUR');
  assert(pendingRec!.already_paid === 500.0, 'Total já liquidado na central é 500,00 EUR');

  // -------------------------------------------------------------
  // CENÁRIO 2: Liquidação Complementar / Total do Recebimento
  // -------------------------------------------------------------
  console.log('\n--- 2. Cenário: Liquidação Total Complementar ---');
  const resTotalRec = sim.recordCommitmentSettlement({
    commitment_id: 'rec-1',
    account_id: 'acc-bcp-eur',
    amount: 1000.0,
    reference: 'PIX-002',
    description: 'Quitação dos 1.000 EUR restantes',
  });

  assert(resTotalRec.commitment_status === 'settled', 'Status do compromisso atualizado para settled');
  assert(resTotalRec.already_paid === 1500.0, 'already_paid consolidado é 1.500,00 EUR');
  assert(resTotalRec.pending_balance === 0.0, 'Saldo residual zera completamente (0,00 EUR)');

  // Verificar que deixa de aparecer na central de compromissos pendentes
  const pendingAfterTotal = sim.getPendingCommitments();
  const pendingRecSettled = pendingAfterTotal.find((c) => c.id === 'rec-1');
  assert(!pendingRecSettled, 'Compromisso 100% liquidado deixa de aparecer na lista de pendências operacionais');

  // -------------------------------------------------------------
  // CENÁRIO 3: Liquidação Total Direta em Parcela Única
  // -------------------------------------------------------------
  console.log('\n--- 3. Cenário: Liquidação Total Direta (Parcela Única BRL) ---');
  const resDirectBrl = sim.recordCommitmentSettlement({
    commitment_id: 'pay-2',
    account_id: 'acc-itau-brl',
    amount: 2400.0,
    reference: 'TED-889',
    description: 'Pagamento total Pousada Bahia Sol',
  });

  assert(resDirectBrl.commitment_status === 'settled', 'Status passa diretamente para settled');
  assert(resDirectBrl.pending_balance === 0, 'Saldo pendente zera imediatamente');
  assert(resDirectBrl.currency === 'BRL', 'Moeda BRL preservada');

  const pendingBrl = sim.getPendingCommitments().find((c) => c.id === 'pay-2');
  assert(!pendingBrl, 'Compromisso BRL totalmente pago não consta mais nos pendentes');

  // -------------------------------------------------------------
  // CENÁRIO 4: Pagamento a Fornecedor via Cartão de Crédito e Fatura
  // -------------------------------------------------------------
  console.log('\n--- 4. Cenário: Pagamento via Cartão de Crédito e Fatura Futura ---');

  // Validar exigência de invoice_due_date
  let errorCaught = false;
  try {
    sim.recordCommitmentSettlement({
      commitment_id: 'pay-1',
      account_id: 'acc-card-eur',
      amount: 800.0,
      // sem invoice_due_date
    });
  } catch (err: any) {
    errorCaught = true;
    assert(err.message.includes('data de vencimento da fatura é obrigatória'), 'Exige data de vencimento da fatura para cartão de crédito');
  }
  assert(errorCaught, 'Falha esperada ao omitir data de vencimento da fatura');

  // Pagamento com cartão de crédito com data de fatura
  const resCard = sim.recordCommitmentSettlement({
    commitment_id: 'pay-1',
    account_id: 'acc-card-eur',
    amount: 800.0,
    invoice_due_date: '2026-11-10',
    reference: 'AUTH-99128',
    description: 'Passagem emitida no cartão corporativo',
  });

  assert(resCard.commitment_status === 'settled', 'Compromisso com o fornecedor TAP Air Portugal é liquidado (settled)');
  assert(Boolean(resCard.invoice_commitment_id), 'Parcela prevista de fatura do cartão foi criada automaticamente');

  // Verificar a nova fatura do cartão criada
  const invoiceComm = sim.commitments.find((c) => c.id === resCard.invoice_commitment_id);
  assert(Boolean(invoiceComm), 'Compromisso de fatura encontrado na base');
  assert(invoiceComm!.is_credit_card_invoice === true, 'Fatura possui flag is_credit_card_invoice = true');
  assert(invoiceComm!.origin_commitment_id === 'pay-1', 'Fatura possui origin_commitment_id apontando para pay-1');
  assert(invoiceComm!.expected_date === '2026-11-10', 'Data de vencimento da fatura é 2026-11-10');
  assert(invoiceComm!.quotation_id === 'quot-101', 'Fatura mantém o vínculo com a Cotação original quot-101');

  // Verificar que a fatura do cartão aparece nos compromissos pendentes a pagar
  const pendingWithInvoice = sim.getPendingCommitments();
  const invoicePending = pendingWithInvoice.find((c) => c.id === resCard.invoice_commitment_id);
  assert(Boolean(invoicePending), 'Fatura do cartão consta na lista de compromissos pendentes');
  assert(invoicePending!.amount === 800.0, 'Valor da fatura do cartão pendente é 800,00 EUR');

  // Validar regra de bloqueio: Fatura do cartão NÃO pode ser paga com outro cartão de crédito!
  let cardOnCardBlocked = false;
  try {
    sim.recordCommitmentSettlement({
      commitment_id: invoiceComm!.id,
      account_id: 'acc-card-eur', // tentativa de pagar com cartão
      amount: 800.0,
    });
  } catch (err: any) {
    cardOnCardBlocked = true;
    assert(err.message.includes('Não é permitido pagar a fatura de um cartão com outro cartão de crédito'), 'Bloqueio estrito de pagar fatura com cartão de crédito');
  }
  assert(cardOnCardBlocked, 'Fatura de cartão não pode ser paga com cartão');

  // Liquidação da fatura do cartão usando conta bancária real
  const resInvoicePaid = sim.recordCommitmentSettlement({
    commitment_id: invoiceComm!.id,
    account_id: 'acc-bcp-eur', // conta corrente bancária
    amount: 800.0,
    reference: 'DEBIT-BCP-FATURA',
  });
  assert(resInvoicePaid.commitment_status === 'settled', 'Fatura do cartão liquidada com sucesso via conta bancária');
  assert(!sim.getPendingCommitments().find((c) => c.id === invoiceComm!.id), 'Fatura liquidada baixada das pendências');

  // -------------------------------------------------------------
  // CENÁRIO 5: Isolamento Estrito de Moedas (EUR e BRL)
  // -------------------------------------------------------------
  console.log('\n--- 5. Cenário: Isolamento Estrito de Moedas ---');

  // Criar compromisso EUR e tentar liquidar com conta BRL
  const commEurTest: SimulatedCommitment = {
    id: 'comm-eur-test',
    operation_id: 'op-99',
    quotation_id: 'quot-99',
    quotation_reference: 'COT-99',
    type: 'payable',
    counterparty_name: 'Guia Local Paris',
    amount: 300.0,
    currency: 'EUR',
    status: 'planned',
    expected_date: '2026-10-30',
    is_credit_card_invoice: false,
  };
  sim.commitments.push(commEurTest);

  let crossCurrencyBlocked = false;
  try {
    sim.recordCommitmentSettlement({
      commitment_id: 'comm-eur-test',
      account_id: 'acc-itau-brl', // BRL tentando liquidar EUR
      amount: 300.0,
    });
  } catch (err: any) {
    crossCurrencyBlocked = true;
    assert(err.message.includes('deve ser idêntica à moeda do compromisso'), 'Recusa incompatibilidade de moeda entre conta BRL e compromisso EUR');
  }
  assert(crossCurrencyBlocked, 'Incompatibilidade cambial bloqueada sem conversões espúrias');

  // -------------------------------------------------------------
  // CENÁRIO 6: Validações de Limite e Exceções
  // -------------------------------------------------------------
  console.log('\n--- 6. Cenário: Validações de Limite de Saldo e Recebimento no Cartão ---');

  // 6.1 Valor zero ou negativo
  let zeroAmountBlocked = false;
  try {
    sim.recordCommitmentSettlement({
      commitment_id: 'comm-eur-test',
      account_id: 'acc-bcp-eur',
      amount: 0,
    });
  } catch {
    zeroAmountBlocked = true;
  }
  assert(zeroAmountBlocked, 'Valor de liquidação <= 0 é recusado');

  // 6.2 Valor maior que saldo pendente (300 EUR previsto, tentar pagar 400 EUR)
  let overAmountBlocked = false;
  try {
    sim.recordCommitmentSettlement({
      commitment_id: 'comm-eur-test',
      account_id: 'acc-bcp-eur',
      amount: 400.0,
    });
  } catch (err: any) {
    overAmountBlocked = true;
    assert(err.message.includes('excede o saldo pendente'), 'Recusa valor que excede saldo pendente');
  }
  assert(overAmountBlocked, 'Valor excedente bloqueado com sucesso');

  // 6.3 Recebimento de cliente em conta cartão de crédito
  const commRecTest: SimulatedCommitment = {
    id: 'comm-rec-test',
    operation_id: 'op-99',
    quotation_id: 'quot-99',
    quotation_reference: 'COT-99',
    type: 'receivable',
    counterparty_name: 'Cliente Teste',
    amount: 1000.0,
    currency: 'EUR',
    status: 'planned',
    expected_date: '2026-10-30',
    is_credit_card_invoice: false,
  };
  sim.commitments.push(commRecTest);

  let recCardBlocked = false;
  try {
    sim.recordCommitmentSettlement({
      commitment_id: 'comm-rec-test',
      account_id: 'acc-card-eur',
      amount: 1000.0,
    });
  } catch (err: any) {
    recCardBlocked = true;
    assert(err.message.includes('Não é permitido utilizar conta do tipo cartão de crédito para registrar recebimentos'), 'Recebimento em cartão de crédito proibido');
  }
  assert(recCardBlocked, 'Recebimento de cliente em cartão de crédito bloqueado');

  console.log('\n🎉 TODOS OS TESTES DE LIQUIDAÇÃO OPERACIONAL E REGRAS FINANCEIRAS FORAM CONCLUÍDOS COM SUCESSO!\n');
}

runCommitmentSettlementTests().catch((err) => {
  console.error('Erro nos testes de liquidação:', err);
  process.exit(1);
});
