// Definições de tipos fundamentais da aplicação S23 Packages

export type NavigationItem = {
  label: string;
  path: string;
  badge?: string;
};

export type AppEnvironment = {
  supabaseConfigured: boolean;
  version: string;
};

// Placeholder para futuras entidades de pacote e cotação (sem lógica de negócio prematura)
export interface PackagePlaceholder {
  id: string;
  title: string;
  destination: string;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
}

export interface QuotePlaceholder {
  id: string;
  clientName: string;
  destination: string;
  totalValue: number;
  status: 'draft' | 'sent' | 'approved';
  createdAt: string;
}
