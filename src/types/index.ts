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

export interface TransportDetails {
  type: 'flight' | 'train' | 'bus' | 'boat' | 'transfer' | 'other';
  carrier?: string;
  route?: string;
  departureDate?: string;
  arrivalDate?: string;
  departureTime?: string; // HH:MM
  arrivalTime?: string;   // HH:MM
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

// Categorias de componentes de custo financeiro
export type CostCategory =
  | 'outbound_transport' // Transporte de ida
  | 'inbound_transport'  // Transporte de volta
  | 'lodging'            // Hospedagem
  | 'services'           // Serviços adicionais
  | 'taxes'              // Impostos e taxas
  | 'other';             // Outros custos

// Componente de custo financeiro individual
export interface CostComponent {
  id: string;
  category: CostCategory;
  description: string;
  amount: number;
  currency: Currency;
  quantity: number;
  notes?: string;
}

// Resumo financeiro e cálculos determinísticos do motor financeiro
export interface FinancialSummary {
  currency: Currency;
  components: CostComponent[];
  totalCost: number;
  salePrice: number;
  pricePerPerson: number;
  profit: number;
  profitPercent: number;
  taxesAndFeesTotal: number;
  exchangeRateUsed?: number | null;
  conversionError?: string | null;
  // Campos para compatibilidade com exibições anteriores
  priceTotal?: MoneyAmount;
  pricePerPersonAmount?: MoneyAmount;
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
  transferService?: string;
  paymentConditions?: string;
  localTaxNotes?: string;
  extraServicesNotes?: string;
  customNotes?: string;
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

// ==========================================
// MODELO ESTRUTURADO DE CONTEÚDO (FASE 6A)
// ==========================================

export interface InclusoItem {
  icon?: string;
  title: string;
  desc?: string;
}

export interface RoteiroItem {
  title: string;
  desc?: string;
}

export interface SobreDestino {
  title: string;
  text: string;
  image?: string;
}

export interface InfoDestino {
  localizacao?: string;
  idiomaCultura?: string;
  clima?: string;
  documentacao?: string;
}

export interface PagamentoInfo {
  valor?: string;
  formas?: string[];
  observacao: string;
}

/**
 * Modelo completo e estruturado de conteúdo do pacote para o website S23
 * (Conforme docs/COMO_ADICIONAR_PACOTE.md e docs/perplexity_space.txt)
 */
export interface StructuredPackageContent {
  // Obrigatórios gerais
  title: string;
  category: string;
  excerpt: string;
  slug: string;
  price: number | string;
  published: boolean;
  featured: boolean;

  // Imagens (controladas pelo operador no Markdown final)
  heroImage?: string;
  cardImage?: string;
  imagemDestaque?: string;

  // Campos avançados
  subtitle?: string;
  duracao?: string;
  origem?: string;
  date?: string;
  ctaLabel?: string;
  customInfo?: string;

  // Blocos estruturados
  incluso: InclusoItem[];
  naoIncluso: string[];
  sobre: SobreDestino;
  infoDestino?: InfoDestino;
  roteiro?: RoteiroItem[];
  pagamento: PagamentoInfo;

  // SEO
  seoTitle: string;
  seoDescription: string;
}

/**
 * Input seguro fornecido ao backend de IA (Gemini + Grounding)
 * Protegido contra vazamento de custos internos, lucro, margem ou dados confidenciais de fornecedor.
 */
export interface ContentGenerationInput {
  sourceType: 'package' | 'quotation';
  sourceId: string;
  reference: string;
  name: string;
  destination: string;
  origin?: string;
  durationDays?: number;
  startDate?: string;
  endDate?: string;
  hotelName?: string;
  mealPlan?: string;
  nights?: number;
  salePrice: number;
  currency: Currency;
  includedServices: string[];
  notIncludedServices: string[];
  paymentConditions?: string;
  customNotes?: string;
  localTaxNotes?: string;
  transferService?: string;
}
