import { Currency } from './index';

// 1. Tipos para Contas Financeiras
export type FinancialAccountType = 'bank_account' | 'cash' | 'credit_card' | 'other';

export interface FinancialAccount {
  id: string;
  name: string;
  type: FinancialAccountType;
  currency: Currency;
  description: string | null;
  active: boolean;
  initial_balance: number;
  initial_balance_date: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export const ACCOUNT_TYPE_LABELS: Record<FinancialAccountType, string> = {
  bank_account: 'Conta Bancária',
  cash: 'Dinheiro / Caixa Físico',
  credit_card: 'Cartão de Crédito',
  other: 'Outro',
};

export interface CreateFinancialAccountInput {
  name: string;
  type: FinancialAccountType;
  currency: Currency;
  description?: string | null;
  active?: boolean;
  initial_balance?: number;
  initial_balance_date?: string;
}

export interface UpdateFinancialAccountInput {
  name?: string;
  type?: FinancialAccountType;
  currency?: Currency;
  description?: string | null;
  active?: boolean;
  initial_balance?: number;
  initial_balance_date?: string;
}

// 2. Tipos para Operação Financeira (1:1 com Cotação Aprovada)
export type FinancialOperationStatus = 'active' | 'completed' | 'cancelled';

export interface FinancialOperation {
  id: string;
  quotation_id: string;
  status: FinancialOperationStatus;
  notes: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFinancialOperationInput {
  quotation_id: string;
  status?: FinancialOperationStatus;
  notes?: string | null;
}

// 3. Tipos para Serviços da Operação Financeira (estados expandidos)
export type FinancialOperationServiceStatus =
  | 'planned'
  | 'reserved'
  | 'contracted'
  | 'completed'
  | 'cancelled';

export interface FinancialOperationService {
  id: string;
  operation_id: string;
  original_service_id: string | null;
  type: string;
  description: string;
  supplier_name: string | null;
  cost_amount: number;
  cost_currency: Currency;
  status: FinancialOperationServiceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFinancialOperationServiceInput {
  operation_id: string;
  original_service_id?: string | null;
  type: string;
  description: string;
  supplier_name?: string | null;
  cost_amount: number;
  cost_currency: Currency;
  status?: FinancialOperationServiceStatus;
  notes?: string | null;
}

// 4. Tipos para Compromissos Financeiros Previstos
export type FinancialCommitmentType = 'receivable' | 'payable';
export type FinancialCommitmentStatus = 'planned' | 'partially_settled' | 'settled' | 'cancelled';
export type FinancialCounterpartyType = 'client' | 'supplier' | 'other';
export type FinancialPaymentMethod = 'transfer' | 'card' | 'payment_link' | 'cash' | 'other';

export const PAYMENT_METHOD_LABELS: Record<FinancialPaymentMethod, string> = {
  transfer: 'Transferência',
  card: 'Cartão',
  payment_link: 'Link de pagamento',
  cash: 'Dinheiro',
  other: 'Outro',
};

export const SERVICE_STATUS_LABELS: Record<FinancialOperationServiceStatus, string> = {
  planned: 'Previsto',
  reserved: 'Reservado',
  contracted: 'Contratado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export const COMMITMENT_STATUS_LABELS: Record<FinancialCommitmentStatus, string> = {
  planned: 'Previsto',
  partially_settled: 'Parcial',
  settled: 'Liquidado',
  cancelled: 'Cancelado',
};


export type FinancialAdjustmentType =
  | 'client_refund'
  | 'supplier_refund'
  | 'cancellation_fee';

export const ADJUSTMENT_TYPE_LABELS: Record<FinancialAdjustmentType, string> = {
  client_refund: 'Reembolso ao Cliente',
  supplier_refund: 'Reembolso do Fornecedor',
  cancellation_fee: 'Multa de Cancelamento',
};

export interface FinancialCommitment {
  id: string;
  operation_id: string;
  operation_service_id: string | null;
  type: FinancialCommitmentType;
  counterparty_name: string;
  counterparty_type: FinancialCounterpartyType;
  amount: number;
  currency: Currency;
  status: FinancialCommitmentStatus;
  payment_method?: FinancialPaymentMethod | null;
  expected_date: string | null; // YYYY-MM-DD ou null
  expected_account_id: string | null;
  description: string | null;
  notes: string | null;
  is_credit_card_invoice?: boolean;
  origin_commitment_id?: string | null;
  credit_card_account_id?: string | null;
  is_cancellation_adjustment?: boolean;
  adjustment_type?: FinancialAdjustmentType | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFinancialCommitmentInput {
  operation_id: string;
  operation_service_id?: string | null;
  type: FinancialCommitmentType;
  counterparty_name: string;
  counterparty_type?: FinancialCounterpartyType;
  amount: number;
  currency: Currency;
  status?: FinancialCommitmentStatus;
  payment_method?: FinancialPaymentMethod | null;
  expected_date?: string | null;
  expected_account_id?: string | null;
  description?: string | null;
  notes?: string | null;
}

export interface UpdateFinancialCommitmentInput {
  amount?: number;
  currency?: Currency;
  status?: FinancialCommitmentStatus;
  payment_method?: FinancialPaymentMethod | null;
  expected_date?: string | null;
  expected_account_id?: string | null;
  description?: string | null;
  notes?: string | null;
  counterparty_name?: string;
  counterparty_type?: FinancialCounterpartyType;
}

// 5. Tipos para Movimentações Reais de Caixa (com suporte a transferências cambiais)
export type FinancialTransactionType = 'inflow' | 'outflow' | 'transfer' | 'refund' | 'balance_adjustment';
export type BalanceAdjustmentDirection = 'positive' | 'negative';

export interface FinancialTransaction {
  id: string;
  type: FinancialTransactionType;
  account_id: string;
  destination_account_id: string | null;
  operation_id: string | null;
  commitment_id: string | null;
  amount: number;
  currency: Currency;
  destination_amount: number | null;
  destination_currency: Currency | null;
  exchange_rate: number | null;
  transfer_fee: number | null;
  transfer_fee_currency: Currency | null;
  transacted_at: string;
  counterparty_name: string | null;
  description: string | null;
  reference: string | null;
  adjustment_direction?: BalanceAdjustmentDirection | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFinancialTransactionInput {
  type: FinancialTransactionType;
  account_id: string;
  destination_account_id?: string | null;
  operation_id?: string | null;
  commitment_id?: string | null;
  amount: number;
  currency: Currency;
  destination_amount?: number | null;
  destination_currency?: Currency | null;
  exchange_rate?: number | null;
  transfer_fee?: number | null;
  transfer_fee_currency?: Currency | null;
  adjustment_direction?: BalanceAdjustmentDirection | null;
  transacted_at?: string;
  counterparty_name?: string | null;
  description?: string | null;
  reference?: string | null;
}

// Retorno da chamada RPC atômica
export interface ApproveQuotationAndCreateOperationResult {
  success: boolean;
  operation_id: string;
  quotation_id: string;
  quotation_reference: string;
  services_count: number;
  commitments_count: number;
}

// Visão completa agregada da operação
export interface FinancialOperationDetails extends FinancialOperation {
  services: FinancialOperationService[];
  commitments: FinancialCommitment[];
  transactions: FinancialTransaction[];
}

export interface RecordCommitmentSettlementInput {
  commitment_id: string;
  account_id: string;
  amount: number;
  transacted_at?: string;
  reference?: string;
  description?: string;
  invoice_due_date?: string; // YYYY-MM-DD (obrigatório se a conta for credit_card)
}

export interface RecordCommitmentSettlementResult {
  transaction_id: string;
  commitment_id: string;
  commitment_status: 'settled' | 'partially_settled';
  type: 'inflow' | 'outflow';
  amount: number;
  currency: Currency;
  already_paid: number;
  pending_balance: number;
  invoice_commitment_id?: string | null;
}

export interface RecordAccountTransferInput {
  source_account_id: string;
  destination_account_id: string;
  amount: number;
  destination_amount?: number;
  exchange_rate?: number;
  transfer_fee?: number;
  transfer_fee_currency?: Currency;
  transacted_at?: string;
  reference?: string;
  description?: string;
  operation_id?: string;
}

export interface RecordAccountTransferResult {
  success: boolean;
  transaction_id: string;
  source_account_id: string;
  source_account_name: string;
  source_currency: Currency;
  source_amount: number;
  destination_account_id: string;
  destination_account_name: string;
  destination_currency: Currency;
  destination_amount: number;
  exchange_rate: number;
  transfer_fee: number;
  transacted_at: string;
}

// Ajuste Manual de Saldo de Conta Financeira
export interface RecordBalanceAdjustmentInput {
  account_id: string;
  amount: number;              // sempre positivo; direção via direction
  direction: BalanceAdjustmentDirection;
  reason: string;              // motivo obrigatório
  adjusted_at?: string;        // ISO datetime, default: agora
  reference?: string | null;
}

export interface RecordBalanceAdjustmentResult {
  success: boolean;
  transaction_id: string;
  account_id: string;
  account_name: string;
  currency: string;
  amount: number;
  direction: BalanceAdjustmentDirection;
  adjustment_direction?: BalanceAdjustmentDirection;
  reason: string;
  adjusted_at: string;
}

// 6. Tipos para Fase 2C: Cancelamentos, Reembolsos e Multas
export interface CancelFinancialOperationResult {
  success: boolean;
  operation_id: string;
  status: 'cancelled';
  cancellation_reason: string;
  cancelled_at: string;
  cancelled_services_count: number;
  cancelled_commitments_count: number;
}

export interface CancelOperationServiceWithAdjustmentsInput {
  service_id: string;
  reason: string;
  supplier_refund_amount?: number;
  supplier_refund_currency?: Currency;
  cancellation_fee_amount?: number;
  cancellation_fee_currency?: Currency;
  fee_counterparty_name?: string;
}

export interface CancelOperationServiceWithAdjustmentsResult {
  success: boolean;
  service_id: string;
  status: 'cancelled';
  cancellation_reason: string;
  cancelled_commitments_count: number;
  supplier_refund_id: string | null;
  cancellation_fee_id: string | null;
}

export interface CreateCancellationAdjustmentInput {
  operation_id: string;
  adjustment_type: FinancialAdjustmentType;
  counterparty_name: string;
  amount: number;
  currency: Currency;
  counterparty_type?: FinancialCounterpartyType;
  expected_date?: string;
  description?: string;
  notes?: string;
  operation_service_id?: string;
}

// 7. Tipos para Fase 3A: Motor de Consulta e Saldos Consolidados
export interface AccountBalanceSummary {
  account_id: string;
  account_name: string;
  account_type: FinancialAccountType;
  currency: Currency;
  active: boolean;
  initial_balance: number;
  initial_balance_date: string;
  current_balance: number;
  pending_receivables: number;
  pending_payables: number;
  projected_balance: number;
}

export interface CurrencyConsolidatedSummary {
  currency: Currency;
  current_balance: number;
  credit_card_balance: number;
  total_pending_receivables: number;
  total_pending_payables: number;
  projected_balance: number;
  overdue_receivables: number;
  overdue_payables: number;
}

export interface ConsolidatedBalancesResult {
  EUR: CurrencyConsolidatedSummary;
  BRL: CurrencyConsolidatedSummary;
  reference_date?: string;
}

export interface PeriodCashFlowForecast {
  currency: Currency;
  expected_inflows: number;
  expected_outflows: number;
  net_cash_flow: number;
  receivables_count: number;
  payables_count: number;
}

export interface PendingCommitmentItem {
  id: string;
  operation_id: string;
  operation_service_id: string | null;
  quotation_id: string | null;
  quotation_reference: string | null;
  quotation_client_name: string | null;
  type: FinancialCommitmentType;
  counterparty_name: string;
  counterparty_type: FinancialCounterpartyType;
  amount: number;
  currency: Currency;
  status: FinancialCommitmentStatus;
  expected_date: string | null;
  expected_account_id: string | null;
  expected_account_name: string | null;
  already_paid: number;
  pending_amount: number;
  is_overdue: boolean;
  payment_method: FinancialPaymentMethod | null;
  is_credit_card_invoice: boolean;
  origin_commitment_id: string | null;
  credit_card_account_id: string | null;
  is_cancellation_adjustment: boolean;
  adjustment_type: FinancialAdjustmentType | null;
  description: string | null;
  notes: string | null;
  created_at: string;
}

export interface PendingCommitmentFilters {
  startDate?: string;
  endDate?: string;
  currency?: Currency;
  type?: FinancialCommitmentType;
  accountId?: string;
  isOverdue?: boolean;
  referenceDate?: string;
}

export interface SettledCommitmentItem {
  id: string;
  operation_id: string;
  operation_service_id: string | null;
  quotation_id: string | null;
  quotation_reference: string | null;
  quotation_client_name: string | null;
  type: FinancialCommitmentType;
  counterparty_name: string;
  counterparty_type: FinancialCounterpartyType;
  original_amount: number;
  settled_amount: number;
  currency: Currency;
  status: FinancialCommitmentStatus;
  expected_date: string | null;
  last_settled_at: string | null;
  settled_account_id: string | null;
  settled_account_name: string | null;
  payment_method: FinancialPaymentMethod | null;
  is_credit_card_invoice: boolean;
  description: string | null;
  notes: string | null;
  transactions_count: number;
  created_at: string;
}

export interface SettledCommitmentFilters {
  currency?: Currency;
  type?: FinancialCommitmentType;
  search?: string;
}

export interface CashFlowForecastFilters {
  startDate: string;
  endDate: string;
}

// 6. Tipos para Alertas Financeiros e Ações Rápidas (Fase 3D)
export type FinancialAlertSeverity = 'critical' | 'warning' | 'info';

export type FinancialAlertType =
  | 'overdue_payable'
  | 'overdue_receivable'
  | 'credit_card_due_soon'
  | 'missing_expected_date'
  | 'negative_current_balance'
  | 'negative_weekly_projection';

export interface FinancialAlertAction {
  label: string;
  url: string;
}

export interface FinancialAlert {
  id: string;
  type: FinancialAlertType;
  severity: FinancialAlertSeverity;
  currency: Currency;
  title: string;
  message: string;
  counterparty_name?: string;
  amount?: number;
  expected_date?: string | null;
  account_id?: string;
  account_name?: string;
  quotation_id?: string | null;
  quotation_reference?: string | null;
  commitment_id?: string;
  action?: FinancialAlertAction;
}

export interface GroupedFinancialAlerts {
  EUR: FinancialAlert[];
  BRL: FinancialAlert[];
  totalCritical: number;
  totalWarning: number;
}
