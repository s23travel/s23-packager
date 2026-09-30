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

export interface CreateFinancialAccountInput {
  name: string;
  type: FinancialAccountType;
  currency: Currency;
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
export type FinancialTransactionType = 'inflow' | 'outflow' | 'transfer' | 'refund';

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
