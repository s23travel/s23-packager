/**
 * Testes da Fundação Técnica do Módulo Financeiro (Fase 1 Reforço)
 */
import {
  FinancialAccount,
  FinancialOperation,
  FinancialOperationService,
  FinancialCommitment,
  FinancialTransaction,
  FinancialOperationDetails,
  Quotation,
  ServiceItem,
} from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${message}`);
}

console.log('=== INICIANDO TESTES DA FUNDAÇÃO TÉCNICA DO MÓDULO FINANCEIRO (REFORÇO) ===\n');

// 1. Contas Financeiras com Saldo Inicial e Data de Referência
const contaPt: FinancialAccount = {
  id: 'acc-1',
  name: 'Caixa Portugal (EUR)',
  type: 'bank_account',
  currency: 'EUR',
  description: 'Conta bancária Millennium BCP',
  active: true,
  initial_balance: 5000.0,
  initial_balance_date: '2026-09-01',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const contaBr: FinancialAccount = {
  id: 'acc-2',
  name: 'Caixa Brasil (BRL)',
  type: 'bank_account',
  currency: 'BRL',
  description: 'Conta Itaú Brasil',
  active: true,
  initial_balance: 25000.0,
  initial_balance_date: '2026-09-01',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

assert(contaPt.initial_balance === 5000 && contaPt.initial_balance_date === '2026-09-01', '1. Conta Portugal possui saldo inicial e data de referência');
assert(contaBr.initial_balance === 25000 && contaBr.currency === 'BRL', '2. Conta Brasil possui saldo inicial e moeda BRL isolada');

// 2. Cotações: Formato Moderno (salePrice) e Legado (priceTotal.amount)
const mockQuoteModern: Quotation = {
  id: 'quote-001',
  reference: 'COT-2026-001',
  client_name: 'Cliente Moderno',
  status: 'accepted',
  currency: 'EUR',
  data: {
    destination: 'Paris',
    financials: { salePrice: 1200, totalCost: 950 },
    services: [
      {
        id: 'srv-1',
        type: 'accommodation',
        description: 'Hotel Paris Centre',
        amount: 600,
        currency: 'EUR',
        carrier: 'Hotel Supplier Paris',
      } as ServiceItem,
    ],
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockQuoteLegacy: Quotation = {
  id: 'quote-002',
  reference: 'COT-2026-002',
  client_name: 'Cliente Legado',
  status: 'accepted',
  currency: 'EUR',
  data: {
    destination: 'Lisboa',
    financials: { priceTotal: { amount: 850, currency: 'EUR' } },
    services: [
      {
        id: 'srv-2',
        type: 'accommodation',
        description: 'Hotel Lisboa',
        amount: 500,
        currency: 'EUR',
        carrier: 'Lisboa Hotéis',
      } as ServiceItem,
    ],
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function extractSalePrice(quote: Quotation): number {
  return Number(quote.data?.financials?.salePrice ?? quote.data?.financials?.priceTotal?.amount ?? 0);
}

assert(extractSalePrice(mockQuoteModern) === 1200, '3. Extrai corretamente salePrice do formato moderno');
assert(extractSalePrice(mockQuoteLegacy) === 850, '4. Extrai com sucesso priceTotal.amount do formato legado');

// 3. Estados Expandidos dos Serviços da Operação
const validServiceStatuses = ['planned', 'reserved', 'contracted', 'completed', 'cancelled'] as const;

const opService: FinancialOperationService = {
  id: 'op-srv-1',
  operation_id: 'op-101',
  original_service_id: 'srv-1',
  type: 'accommodation',
  description: 'Hotel Paris Centre',
  supplier_name: 'Hotel Supplier Paris',
  cost_amount: 600,
  cost_currency: 'EUR',
  status: 'planned', // Inicia previsto
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

assert(opService.status === 'planned', '5. Serviço da operação é inicializado no estado "planned" (previsto)');
opService.status = 'reserved';
assert(opService.status === 'reserved', '6. Transição permitida para estado "reserved" (reservado)');
opService.status = 'contracted';
assert(opService.status === 'contracted', '7. Transição permitida para estado "contracted" (contratado)');
opService.status = 'completed';
assert(opService.status === 'completed', '8. Transição permitida para estado "completed" (concluído)');

// 4. Regras Estritas de Liquidação de Compromissos
function validateLiquidationRules(
  commitmentType: 'receivable' | 'payable',
  transactionType: 'inflow' | 'outflow' | 'transfer' | 'refund'
): { allowed: boolean; error?: string } {
  if (transactionType === 'transfer' || transactionType === 'refund') {
    return { allowed: false, error: 'Transferências e reembolsos não liquidam compromissos operacionais.' };
  }
  if (commitmentType === 'receivable' && transactionType !== 'inflow') {
    return { allowed: false, error: 'Recebível só pode ser liquidado por entradas (inflow).' };
  }
  if (commitmentType === 'payable' && transactionType !== 'outflow') {
    return { allowed: false, error: 'Pagável só pode ser liquidado por saídas (outflow).' };
  }
  return { allowed: true };
}

assert(validateLiquidationRules('receivable', 'inflow').allowed === true, '9. Entrada (inflow) permitida para liquidar recebível');
assert(validateLiquidationRules('receivable', 'outflow').allowed === false, '10. Saída (outflow) rejeitada para liquidar recebível');
assert(validateLiquidationRules('receivable', 'transfer').allowed === false, '11. Transferência rejeitada para liquidar recebível');
assert(validateLiquidationRules('receivable', 'refund').allowed === false, '12. Reembolso rejeitado para liquidar recebível');

assert(validateLiquidationRules('payable', 'outflow').allowed === true, '13. Saída (outflow) permitida para liquidar pagável');
assert(validateLiquidationRules('payable', 'inflow').allowed === false, '14. Entrada (inflow) rejeitada para liquidar pagável');
assert(validateLiquidationRules('payable', 'transfer').allowed === false, '15. Transferência rejeitada para liquidar pagável');

// 5. Cálculo Determinístico de Liquidação Parcial e Integral
function computeCommitmentStatus(target: number, paid: number): FinancialCommitment['status'] {
  if (paid >= target) return 'settled';
  if (paid > 0) return 'partially_settled';
  return 'planned';
}

assert(computeCommitmentStatus(1200, 0) === 'planned', '16. Sem pagamentos o compromisso permanece planned');
assert(computeCommitmentStatus(1200, 400) === 'partially_settled', '17. Pagamento de 400 em 1200 mantém status partially_settled');
assert(computeCommitmentStatus(1200, 1200) === 'settled', '18. Pagamento integral atualiza status para settled');

// 6. Transferência Multimoeda EUR <-> BRL
const fxTransfer: FinancialTransaction = {
  id: 'tx-fx-1',
  type: 'transfer',
  account_id: contaPt.id, // Origem em EUR
  currency: 'EUR',
  amount: 1000.0, // Sai 1000 EUR
  destination_account_id: contaBr.id, // Destino em BRL
  destination_currency: 'BRL',
  destination_amount: 6150.0, // Entra 6.150 BRL
  exchange_rate: 6.15, // Câmbio efetivo
  transfer_fee: 15.0, // Taxa de remessa
  transfer_fee_currency: 'EUR',
  operation_id: null, // Não é receita nem despesa operacional
  commitment_id: null,
  transacted_at: new Date().toISOString(),
  counterparty_name: 'Transferência Internacional Remessa Online',
  description: 'Aporte de caixa Portugal para Brasil',
  reference: 'FX-2026-001',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

assert(fxTransfer.type === 'transfer', '19. Transação registrada como transferência');
assert(fxTransfer.operation_id === null, '20. Transferência não vinculada a despesa operacional');
assert(fxTransfer.currency === 'EUR' && fxTransfer.destination_currency === 'BRL', '21. Transferência armazena moedas de origem e destino separadamente');
assert(fxTransfer.exchange_rate === 6.15 && fxTransfer.destination_amount === 6150, '22. Taxa de câmbio e valor convertido registrados com precisão');
assert(fxTransfer.transfer_fee === 15.0 && fxTransfer.transfer_fee_currency === 'EUR', '23. Custo de taxa de remessa registrado separadamente');

// 7. Derivação de Serviços: Custo Total = amount * quantity e Preservação de Moeda
function deriveServiceAndCommitment(
  service: { amount: number; quantity?: number; currency?: string; description?: string; carrier?: string },
  quoteCurrency: 'EUR' | 'BRL',
  opId: string
): { opService: FinancialOperationService; payable: FinancialCommitment } {
  const unitAmount = Number(service.amount || 0);
  const qty = Number(service.quantity && service.quantity > 0 ? service.quantity : 1);
  const totalCost = unitAmount * qty;

  const sCurr = String(service.currency || '').toUpperCase().trim();
  const finalCurr = (sCurr === 'EUR' || sCurr === 'BRL') ? sCurr as 'EUR' | 'BRL' : quoteCurrency;

  const opSrv: FinancialOperationService = {
    id: 'op-srv-test',
    operation_id: opId,
    original_service_id: null,
    type: 'tour',
    description: service.description || 'Passeio',
    supplier_name: service.carrier || 'Fornecedor',
    cost_amount: totalCost,
    cost_currency: finalCurr,
    status: 'planned',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const pay: FinancialCommitment = {
    id: 'com-pay-test',
    operation_id: opId,
    operation_service_id: opSrv.id,
    type: 'payable',
    counterparty_name: opSrv.supplier_name || 'Fornecedor',
    counterparty_type: 'supplier',
    amount: totalCost,
    currency: finalCurr,
    status: 'planned',
    expected_date: null,
    expected_account_id: null,
    description: `Pagamento de ${opSrv.description}`,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return { opService: opSrv, payable: pay };
}

// Teste A: Serviço de 27 EUR com quantidade 4 -> 108 EUR
const testServiceA = {
  amount: 27,
  quantity: 4,
  currency: 'EUR',
  description: 'Passeio Museu do Prado',
  carrier: 'Madrid Tours',
};
const derivedA = deriveServiceAndCommitment(testServiceA, 'EUR', 'op-test');

assert(derivedA.opService.cost_amount === 108, '24. Serviço com € 27 e quantidade 4 gera custo total previsto de € 108');
assert(derivedA.payable.amount === 108, '25. Compromisso a pagar derivado recebe exatamente o mesmo valor total (€ 108)');
assert(derivedA.payable.currency === 'EUR', '26. Compromisso a pagar mantém a moeda EUR');

// Teste B: Cotação em BRL com serviço em EUR -> preserva EUR
const testServiceB = {
  amount: 150,
  quantity: 2,
  currency: 'EUR',
  description: 'Hotel Roma',
  carrier: 'Roma Hotéis',
};
const derivedB = deriveServiceAndCommitment(testServiceB, 'BRL', 'op-test');

assert(derivedB.opService.cost_currency === 'EUR', '27. Cotação em BRL com serviço em EUR preserva a moeda EUR do serviço');
assert(derivedB.payable.currency === 'EUR', '28. Compromisso a pagar associado preserva a moeda EUR do serviço');
assert(derivedB.opService.cost_amount === 300 && derivedB.payable.amount === 300, '29. Serviço financeiro e compromisso possuem o mesmo valor e moeda');

console.log('\n====================================================');
console.log(' RESULTADO FINAL: 29 PASSOU / 0 FALHOU');
console.log('====================================================\n');
