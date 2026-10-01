import * as fs from 'fs';
import * as path from 'path';

// Carregar .env.local se existir
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
  quotation_client_name: string | null;
  type: 'receivable' | 'payable';
  counterparty_name: string;
  counterparty_type: 'client' | 'supplier' | 'internal';
  amount: number;
  currency: 'EUR' | 'BRL';
  status: 'planned' | 'partially_settled' | 'settled' | 'cancelled';
  expected_date: string | null;
  is_credit_card_invoice: boolean;
  description: string | null;
  notes: string | null;
}

interface SimulatedTransaction {
  id: string;
  commitment_id: string;
  account_id: string;
  account_name: string;
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
 * Simulador fiel do motor de compromissos e histórico de liquidações
 */
class FinancialHistorySimulator {
  commitments: SimulatedCommitment[] = [];
  transactions: SimulatedTransaction[] = [];
  accounts: SimulatedAccount[] = [];

  // Liquidação de compromisso
  recordSettlement(input: {
    commitment_id: string;
    account_id: string;
    amount: number;
    transacted_at?: string;
    reference?: string;
    description?: string;
  }) {
    const comm = this.commitments.find((c) => c.id === input.commitment_id);
    if (!comm) throw new Error('Compromisso não encontrado');
    if (comm.status === 'settled') throw new Error('Compromisso já está liquidado');

    const acc = this.accounts.find((a) => a.id === input.account_id);
    if (!acc) throw new Error('Conta não encontrada');
    if (acc.currency !== comm.currency) throw new Error('Moeda divergente');

    const alreadyPaid = this.transactions
      .filter((t) => t.commitment_id === comm.id)
      .reduce((sum, t) => sum + t.amount, 0);

    const pendingBalance = comm.amount - alreadyPaid;
    if (input.amount > pendingBalance + 0.001) throw new Error('Valor excede saldo pendente');

    const txType = comm.type === 'receivable' ? 'inflow' : 'outflow';
    this.transactions.push({
      id: `tx-${Date.now()}-${Math.random()}`,
      commitment_id: comm.id,
      account_id: acc.id,
      account_name: acc.name,
      type: txType,
      amount: input.amount,
      currency: comm.currency,
      transacted_at: input.transacted_at || new Date().toISOString(),
      reference: input.reference,
      description: input.description,
    });

    const newTotal = alreadyPaid + input.amount;
    if (newTotal >= comm.amount - 0.001) {
      comm.status = 'settled';
    } else {
      comm.status = 'partially_settled';
    }
  }

  // Leitura de Pendentes (get_pending_financial_commitments)
  getPendingCommitments() {
    return this.commitments
      .filter((c) => c.status === 'planned' || c.status === 'partially_settled')
      .map((c) => {
        const alreadyPaid = this.transactions
          .filter((t) => t.commitment_id === c.id)
          .reduce((sum, t) => sum + t.amount, 0);
        return {
          ...c,
          already_paid: alreadyPaid,
          pending_amount: c.amount - alreadyPaid,
        };
      });
  }

  // Leitura do Histórico Liquidado (getSettledCommitments)
  getSettledCommitments(filters?: {
    currency?: 'EUR' | 'BRL';
    type?: 'receivable' | 'payable';
    search?: string;
  }) {
    // REGRA FUNDAMENTAL: Apenas status === 'settled' (totalmente quitados) entram no histórico
    const settledList = this.commitments.filter((c) => c.status === 'settled');

    const mapped = settledList.map((c) => {
      const relevantTxs = this.transactions.filter((t) => t.commitment_id === c.id);
      const totalSettled = relevantTxs.reduce((sum, t) => sum + t.amount, 0);

      // Data da última liquidação
      const sortedTxs = [...relevantTxs].sort(
        (a, b) => new Date(b.transacted_at).getTime() - new Date(a.transacted_at).getTime()
      );
      const lastSettledAt = sortedTxs[0]?.transacted_at || null;

      // Conta utilizada na liquidação
      const accountNames = Array.from(new Set(sortedTxs.map((t) => t.account_name).filter(Boolean)));
      const settledAccountName = accountNames.join(', ') || null;
      const settledAccountId = sortedTxs[0]?.account_id || null;

      return {
        id: c.id,
        operation_id: c.operation_id,
        quotation_id: c.quotation_id,
        quotation_reference: c.quotation_reference,
        quotation_client_name: c.quotation_client_name,
        type: c.type,
        counterparty_name: c.counterparty_name,
        counterparty_type: c.counterparty_type,
        original_amount: c.amount,
        settled_amount: totalSettled > 0 ? totalSettled : c.amount,
        currency: c.currency,
        status: c.status,
        expected_date: c.expected_date,
        last_settled_at: lastSettledAt,
        settled_account_id: settledAccountId,
        settled_account_name: settledAccountName,
        is_credit_card_invoice: c.is_credit_card_invoice,
        description: c.description,
        notes: c.notes,
        transactions_count: relevantTxs.length,
      };
    });

    return mapped.filter((item) => {
      if (filters?.type && item.type !== filters.type) return false;
      if (filters?.currency && item.currency !== filters.currency) return false;
      if (filters?.search?.trim()) {
        const q = filters.search.toLowerCase();
        const ref = (item.quotation_reference || '').toLowerCase();
        const client = (item.quotation_client_name || '').toLowerCase();
        const party = (item.counterparty_name || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const notes = (item.notes || '').toLowerCase();
        const acc = (item.settled_account_name || '').toLowerCase();
        if (!ref.includes(q) && !client.includes(q) && !party.includes(q) && !desc.includes(q) && !notes.includes(q) && !acc.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }
}

async function runSettledCommitmentsHistoryTests() {
  console.log('=== TESTE DE REGRA OPERACIONAL: HISTÓRICO DE COMPROMISSOS LIQUIDADOS ===\n');

  const sim = new FinancialHistorySimulator();

  // Contas
  sim.accounts = [
    { id: 'acc-bcp-eur', name: 'Millennium BCP EUR', type: 'bank_account', currency: 'EUR', active: true },
    { id: 'acc-itau-brl', name: 'Itaú Empresas BRL', type: 'bank_account', currency: 'BRL', active: true },
  ];

  // Compromisso 1: Recebimento EUR €1.000,00 (vinculado a cotação)
  sim.commitments.push({
    id: 'comm-rec-eur-1',
    operation_id: 'op-quote-101',
    quotation_id: 'quote-101',
    quotation_reference: 'COT-2026-101',
    quotation_client_name: 'Dra. Maria Santos',
    type: 'receivable',
    counterparty_name: 'Dra. Maria Santos',
    counterparty_type: 'client',
    amount: 1000.0,
    currency: 'EUR',
    status: 'planned',
    expected_date: '2026-10-15',
    is_credit_card_invoice: false,
    description: 'Sinal 50% Pacote Ilhas Gregas',
    notes: 'Transferência SEPA',
  });

  // Compromisso 2: Pagamento EUR €600,00 a Fornecedor
  sim.commitments.push({
    id: 'comm-pay-eur-2',
    operation_id: 'op-quote-101',
    quotation_id: 'quote-101',
    quotation_reference: 'COT-2026-101',
    quotation_client_name: 'Dra. Maria Santos',
    type: 'payable',
    counterparty_name: 'Aegean Airlines SA',
    counterparty_type: 'supplier',
    amount: 600.0,
    currency: 'EUR',
    status: 'planned',
    expected_date: '2026-10-18',
    is_credit_card_invoice: false,
    description: 'Emissão bilhetes Atenas-Santorini',
    notes: 'Pagamento faturado',
  });

  // Compromisso 3: Recebimento BRL R$ 3.000,00 (vinculado a cotação nacional)
  sim.commitments.push({
    id: 'comm-rec-brl-3',
    operation_id: 'op-quote-102',
    quotation_id: 'quote-102',
    quotation_reference: 'COT-2026-102',
    quotation_client_name: 'Carlos Drummond',
    type: 'receivable',
    counterparty_name: 'Carlos Drummond',
    counterparty_type: 'client',
    amount: 3000.0,
    currency: 'BRL',
    status: 'planned',
    expected_date: '2026-10-25',
    is_credit_card_invoice: false,
    description: 'Pacote Gramado Serra Gaúcha',
    notes: 'PIX',
  });

  // Compromisso 4: Pagamento BRL R$ 1.500,00 (Avulso sem cotação vinculada)
  sim.commitments.push({
    id: 'comm-pay-brl-4',
    operation_id: 'op-avulso-1',
    quotation_id: null,
    quotation_reference: null,
    quotation_client_name: null,
    type: 'payable',
    counterparty_name: 'Hotel Colina São Francisco',
    counterparty_type: 'supplier',
    amount: 1500.0,
    currency: 'BRL',
    status: 'planned',
    expected_date: '2026-10-28',
    is_credit_card_invoice: false,
    description: 'Diárias de hospedagem avulsa',
    notes: 'Transferência Bancária',
  });

  // -------------------------------------------------------------
  // CENÁRIO 1: Estado Inicial (Todos Pendentes / Planejados)
  // -------------------------------------------------------------
  console.log('--- Cenário 1: Estado Inicial (Compromissos Planejados) ---');
  let pending = sim.getPendingCommitments();
  let settled = sim.getSettledCommitments();

  assert(pending.length === 4, 'Todos os 4 compromissos constam em Pendentes');
  assert(settled.length === 0, 'Histórico Liquidado está vazio (0 itens)');

  // -------------------------------------------------------------
  // CENÁRIO 2: Liquidação Parcial de Compromisso (Regra de Ouro)
  // -------------------------------------------------------------
  console.log('\n--- Cenário 2: Liquidação Parcial (NÃO pode entrar no histórico) ---');
  // Liquida €400,00 de €1.000,00 do Compromisso 1
  sim.recordSettlement({
    commitment_id: 'comm-rec-eur-1',
    account_id: 'acc-bcp-eur',
    amount: 400.0,
    transacted_at: '2026-10-10T10:00:00Z',
    reference: 'PARC-01',
    description: 'Entrada parcial do sinal',
  });

  pending = sim.getPendingCommitments();
  settled = sim.getSettledCommitments();

  const c1Pending = pending.find((c) => c.id === 'comm-rec-eur-1');
  assert(c1Pending !== undefined, 'Compromisso parcialmente liquidado PERMANECE na lista de Pendentes');
  assert(c1Pending?.status === 'partially_settled', 'Status é "partially_settled"');
  assert(c1Pending?.pending_amount === 600.0, 'Saldo residual correto em Pendentes: €600,00');
  assert(c1Pending?.already_paid === 400.0, 'Valor já pago registrado: €400,00');

  // VERIFICAÇÃO CRÍTICA DO HISTÓRICO:
  const c1InSettled = settled.find((c) => c.id === 'comm-rec-eur-1');
  assert(c1InSettled === undefined, 'Compromisso parcialmente liquidado NÃO APARECE no Histórico Liquidado');
  assert(settled.length === 0, 'Histórico Liquidado continua rigorosamente vazio (0 itens)');

  // -------------------------------------------------------------
  // CENÁRIO 3: Liquidação Total de Compromisso Parcial (Segunda Parcela)
  // -------------------------------------------------------------
  console.log('\n--- Cenário 3: Quitação Total da Parcela Residual (€600,00) ---');
  // Liquida os €600,00 restantes
  sim.recordSettlement({
    commitment_id: 'comm-rec-eur-1',
    account_id: 'acc-bcp-eur',
    amount: 600.0,
    transacted_at: '2026-10-12T14:30:00Z',
    reference: 'PARC-02-FINAL',
    description: 'Quitação final do sinal',
  });

  pending = sim.getPendingCommitments();
  settled = sim.getSettledCommitments();

  const c1InPendingAfterFull = pending.find((c) => c.id === 'comm-rec-eur-1');
  assert(c1InPendingAfterFull === undefined, 'Compromisso 100% quitado DEIXA DE APARECER em Pendentes');

  const c1Settled = settled.find((c) => c.id === 'comm-rec-eur-1');
  assert(c1Settled !== undefined, 'Compromisso 100% quitado ENTRA com sucesso no Histórico Liquidado');
  assert(c1Settled?.original_amount === 1000.0, 'Valor original preservado: €1.000,00');
  assert(c1Settled?.settled_amount === 1000.0, 'Valor total efetivamente liquidado: €1.000,00');
  assert(c1Settled?.currency === 'EUR', 'Moeda EUR estritamente preservada');
  assert(c1Settled?.type === 'receivable', 'Tipo recebível (Recebimento de Cliente) preservado');
  assert(c1Settled?.status === 'settled', 'Status é "settled"');
  assert(c1Settled?.quotation_id === 'quote-101', 'Vínculo com cotação preservado: quote-101');
  assert(c1Settled?.quotation_reference === 'COT-2026-101', 'Referência da cotação preservada: COT-2026-101');
  assert(c1Settled?.quotation_client_name === 'Dra. Maria Santos', 'Nome do cliente preservado');
  assert(c1Settled?.settled_account_name === 'Millennium BCP EUR', 'Conta utilizada na liquidação exibida');
  assert(c1Settled?.last_settled_at === '2026-10-12T14:30:00Z', 'Data da última liquidação reflete a parcela final');
  assert(c1Settled?.transactions_count === 2, 'Histórico computa as 2 movimentações contábeis que quitaram o item');

  // -------------------------------------------------------------
  // CENÁRIO 4: Liquidação Total Imediata de Pagamento a Fornecedor (€600,00)
  // -------------------------------------------------------------
  console.log('\n--- Cenário 4: Quitação Total de Pagamento a Fornecedor (1x €600,00) ---');
  sim.recordSettlement({
    commitment_id: 'comm-pay-eur-2',
    account_id: 'acc-bcp-eur',
    amount: 600.0,
    transacted_at: '2026-10-15T09:00:00Z',
    reference: 'FAT-AEGEAN-991',
    description: 'Pagamento total da fatura aérea',
  });

  pending = sim.getPendingCommitments();
  settled = sim.getSettledCommitments();

  assert(pending.find((c) => c.id === 'comm-pay-eur-2') === undefined, 'Pagamento quitado deixa de constar em pendentes');
  const c2Settled = settled.find((c) => c.id === 'comm-pay-eur-2');
  assert(c2Settled !== undefined, 'Pagamento fornecedor entra no Histórico Liquidado');
  assert(c2Settled?.type === 'payable', 'Tipo é "payable"');
  assert(c2Settled?.counterparty_name === 'Aegean Airlines SA', 'Fornecedor Aegean Airlines identificado');
  assert(c2Settled?.original_amount === 600.0, 'Valor original: €600,00');
  assert(c2Settled?.settled_amount === 600.0, 'Valor liquidado: €600,00');
  assert(c2Settled?.settled_account_name === 'Millennium BCP EUR', 'Conta Millennium BCP utilizada');

  // -------------------------------------------------------------
  // CENÁRIO 5: Quitação em Moeda BRL e Pagamento Avulso (Sem Cotação)
  // -------------------------------------------------------------
  console.log('\n--- Cenário 5: Moeda BRL e Compromisso Avulso ---');
  // Liquida R$ 1.500,00 do Compromisso 4 (Avulso em BRL)
  sim.recordSettlement({
    commitment_id: 'comm-pay-brl-4',
    account_id: 'acc-itau-brl',
    amount: 1500.0,
    transacted_at: '2026-10-20T11:00:00Z',
    reference: 'TED-COLINA',
    description: 'Liquidação hospedagem avulsa',
  });

  // Compromisso 3 (R$ 3.000,00) recebe apenas liquidação parcial de R$ 1.000,00
  sim.recordSettlement({
    commitment_id: 'comm-rec-brl-3',
    account_id: 'acc-itau-brl',
    amount: 1000.0,
    transacted_at: '2026-10-21T16:00:00Z',
    reference: 'PIX-SINAL',
    description: 'Primeira parcela PIX Gramado',
  });

  pending = sim.getPendingCommitments();
  settled = sim.getSettledCommitments();

  // Compromisso 3 é parcial -> NÃO entra no histórico
  assert(pending.some((c) => c.id === 'comm-rec-brl-3'), 'Compromisso BRL parcial permanece em Pendentes com saldo R$ 2.000,00');
  assert(!settled.some((c) => c.id === 'comm-rec-brl-3'), 'Compromisso BRL parcial NÃO entra no Histórico Liquidado');

  // Compromisso 4 é total e avulso -> ENTRA no histórico com quotation_id = null
  const c4Settled = settled.find((c) => c.id === 'comm-pay-brl-4');
  assert(c4Settled !== undefined, 'Compromisso avulso BRL totalmente liquidado entra no histórico');
  assert(c4Settled?.quotation_id === null, 'Cotação vinculada é nula (compromisso avulso)');
  assert(c4Settled?.currency === 'BRL', 'Moeda BRL preservada separadamente de EUR');
  assert(c4Settled?.original_amount === 1500.0, 'Valor original R$ 1.500,00');
  assert(c4Settled?.settled_amount === 1500.0, 'Valor liquidado R$ 1.500,00');
  assert(c4Settled?.settled_account_name === 'Itaú Empresas BRL', 'Conta Itaú BRL utilizada');

  // Total de quitados no histórico agora: 3 (comm-rec-eur-1, comm-pay-eur-2, comm-pay-brl-4)
  assert(settled.length === 3, 'Histórico contém exatamente os 3 compromissos totalmente liquidados');

  // -------------------------------------------------------------
  // CENÁRIO 6: Filtros Compatíveis do Histórico
  // -------------------------------------------------------------
  console.log('\n--- Cenário 6: Filtros Compatíveis do Histórico Liquidado ---');

  // Filtro por Moeda EUR
  const eurSettled = sim.getSettledCommitments({ currency: 'EUR' });
  assert(eurSettled.length === 2, 'Filtro Moeda EUR retorna exatamente os 2 itens em EUR');
  assert(eurSettled.every((c) => c.currency === 'EUR'), 'Todos os itens filtrados têm moeda EUR');

  // Filtro por Moeda BRL
  const brlSettled = sim.getSettledCommitments({ currency: 'BRL' });
  assert(brlSettled.length === 1, 'Filtro Moeda BRL retorna exatamente o item em BRL');
  assert(brlSettled[0].id === 'comm-pay-brl-4', 'Item retornado é o pagamento avulso BRL');

  // Filtro por Tipo: Recebimentos
  const recSettled = sim.getSettledCommitments({ type: 'receivable' });
  assert(recSettled.length === 1, 'Filtro Tipo Recebimentos retorna 1 recebimento');
  assert(recSettled[0].id === 'comm-rec-eur-1', 'Recebimento retornado é Dra. Maria Santos');

  // Filtro por Tipo: Pagamentos
  const paySettled = sim.getSettledCommitments({ type: 'payable' });
  assert(paySettled.length === 2, 'Filtro Tipo Pagamentos retorna 2 pagamentos a fornecedores');

  // Filtro por Busca de Texto: Referência da Cotação
  const searchRef = sim.getSettledCommitments({ search: 'COT-2026-101' });
  assert(searchRef.length === 2, 'Busca por COT-2026-101 encontra os 2 compromissos vinculados a esta cotação');

  // Filtro por Busca de Texto: Nome do Fornecedor
  const searchSupplier = sim.getSettledCommitments({ search: 'Aegean' });
  assert(searchSupplier.length === 1 && searchSupplier[0].counterparty_name === 'Aegean Airlines SA', 'Busca por "Aegean" localiza o compromisso correto');

  // Filtro por Busca de Texto: Nome da Conta
  const searchAccount = sim.getSettledCommitments({ search: 'Itaú' });
  assert(searchAccount.length === 1 && searchAccount[0].settled_account_name === 'Itaú Empresas BRL', 'Busca por conta "Itaú" localiza o compromisso liquidado nela');

  console.log('\n🎉 TODOS OS TESTES DO HISTÓRICO DE COMPROMISSOS LIQUIDADOS PASSARAM COM SUCESSO!\n');
}

runSettledCommitmentsHistoryTests().catch((err) => {
  console.error('Erro nos testes de histórico liquidado:', err);
  process.exit(1);
});
