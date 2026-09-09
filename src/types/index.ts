// Definições de tipos fundamentais da aplicação Packager

export type NavigationItem = {
  label: string;
  path: string;
  badge?: string;
};

export type AppEnvironment = {
  supabaseConfigured: boolean;
  version: string;
};

// Moedas suportadas
export type Currency = 'EUR' | 'BRL';

// Status de pacotes e cotações
export type PackageStatus = 'draft' | 'active' | 'archived';
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'archived';

// Estrutura para valores monetários
export interface MoneyAmount {
  amount: number;
  currency: Currency;
}

// Configuração de passageiros
export interface PassengerConfig {
  adults: number;
  children: number;
  infants: number;
  notes?: string;
}

// Datas da viagem
export interface TravelDates {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  durationDays?: number;
  durationNights?: number;
}

// Detalhes de transporte (aéreo, trem, transfer, etc.)
export interface TransportDetails {
  type: 'flight' | 'train' | 'bus' | 'boat' | 'transfer' | 'other';
  carrier?: string;
  route?: string;
  departureDate?: string;
  arrivalDate?: string;
  notes?: string;
}

// Detalhes de hospedagem
export interface LodgingDetails {
  id: string;
  name: string;
  destination: string;
  roomType?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  mealPlan?: string;
}

// Serviços adicionais (passeios, seguros, ingressos, etc.)
export interface AdditionalServiceItem {
  id: string;
  name: string;
  type: string;
  included: boolean;
  notes?: string;
}

// Resumo financeiro e estimativas (preparação para Fase 4)
export interface FinancialSummary {
  priceTotal?: MoneyAmount;
  pricePerPerson?: MoneyAmount;
  estimatedCostTotal?: MoneyAmount;
  estimatedMarginPercent?: number;
  taxesAndFees?: MoneyAmount;
}

/**
 * Estrutura rica de dados armazenada no campo JSONB `packages.data`
 */
export interface PackageData {
  passengers?: PassengerConfig;
  dates?: TravelDates;
  outboundTransport?: TransportDetails;
  inboundTransport?: TransportDetails;
  lodging?: LodgingDetails[];
  additionalServices?: AdditionalServiceItem[];
  financials?: FinancialSummary;
  supplier?: string;
  additionalInfo?: string;
  [key: string]: unknown;
}

/**
 * Estrutura de dados armazenada no campo JSONB `quotations.data`
 * Representa um snapshot completo e independente do pacote no momento da cotação.
 */
export interface QuotationData extends PackageData {
  snapshotCreatedAt?: string;
  originPackageName?: string;
  originPackageReference?: string;
  customNotes?: string;
}

/**
 * Representa um pacote base de viagem (Tabela: packages)
 */
export interface Package {
  id: string;
  reference: string;
  name: string;
  status: PackageStatus;
  data: PackageData;
  base_currency: Currency;
  created_at: string;
  updated_at: string;
}

/**
 * Representa uma cotação derivada de um pacote com snapshot independente (Tabela: quotations)
 */
export interface Quotation {
  id: string;
  package_id: string | null;
  reference: string;
  client_name: string | null;
  status: QuotationStatus;
  data: QuotationData;
  currency: Currency;
  exchange_rate: number | null;
  exchange_rate_date: string | null;
  created_at: string;
  updated_at: string;
  // Campos populados em listagens com join
  origin_package_name?: string;
}

export type CreatePackageInput = {
  reference: string;
  name: string;
  status?: PackageStatus;
  data?: PackageData;
  base_currency?: Currency;
};

export type UpdatePackageInput = Partial<CreatePackageInput>;

export type CreateQuotationInput = {
  package_id?: string | null;
  reference: string;
  client_name?: string | null;
  status?: QuotationStatus;
  data?: QuotationData;
  currency?: Currency;
  exchange_rate?: number | null;
  exchange_rate_date?: string | null;
};

export type UpdateQuotationInput = Partial<CreateQuotationInput>;
