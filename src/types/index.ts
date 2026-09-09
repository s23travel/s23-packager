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

/**
 * Representa um pacote base de viagem (Tabela: packages)
 */
export interface Package {
  id: string;
  reference: string;
  name: string;
  status: PackageStatus;
  data: Record<string, unknown>;
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
  data: Record<string, unknown>;
  currency: Currency;
  exchange_rate: number | null;
  exchange_rate_date: string | null;
  created_at: string;
  updated_at: string;
}

