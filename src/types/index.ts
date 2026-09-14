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

// Opções padronizadas de Regime de Acomodação / Alimentação
export const MEAL_PLAN_OPTIONS = [
  'Apenas alojamento (RO)',
  'Café da manhã (BB)',
  'Meia-pensão (HB)',
  'Pensão completa (FB)',
  'Tudo incluído (AI)',
] as const;

export type MealPlanOption = (typeof MEAL_PLAN_OPTIONS)[number];

export function normalizeMealPlan(value?: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower.includes('apenas') ||
    lower.includes('alojamento') ||
    lower === 'ro' ||
    lower.includes('room only') ||
    lower.includes('só hospedagem') ||
    lower.includes('so hospedagem')
  ) {
    return 'Apenas alojamento (RO)';
  }
  if (
    lower.includes('café') ||
    lower.includes('cafe') ||
    lower === 'bb' ||
    lower.includes('bed & breakfast') ||
    lower.includes('breakfast')
  ) {
    return 'Café da manhã (BB)';
  }
  if (lower.includes('meia') || lower === 'hb' || lower.includes('half board')) {
    return 'Meia-pensão (HB)';
  }
  if (lower.includes('completa') || lower === 'fb' || lower.includes('full board')) {
    return 'Pensão completa (FB)';
  }
  if (lower.includes('tudo') || lower.includes('all inclusive') || lower === 'ai') {
    return 'Tudo incluído (AI)';
  }

  return trimmed;
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
  sourceField?: 'outboundRoute' | 'inboundRoute' | 'hotelName';
  inheritedDescription?: string;
  isCustomized?: boolean;
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
 * Entidade persistida no Supabase (tabela: package_website_contents)
 * Armazena a última versão salva e validada do conteúdo editorial e seu respectivo Markdown determinístico.
 */
export interface PackageWebsiteContent {
  id: string;
  package_id: string;
  content: StructuredPackageContent;
  markdown: string;
  filename: string;
  created_at: string;
  updated_at: string;
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

// ==========================================
// CATÁLOGO DE SERVIÇOS (SERVIÇOS FAVORITOS)
// ==========================================

/**
 * Tipos de serviço suportados pelo catálogo de serviços favoritos.
 * Valores internos estáveis em inglês; apresentação em português na UI.
 */
export type FavoriteServiceType =
  | 'hotel'
  | 'airline'
  | 'transfer'
  | 'tour'
  | 'insurance'
  | 'car_rental'
  | 'additional'
  | 'other';

/** Labels em português para exibição na interface */
export const FAVORITE_SERVICE_TYPE_LABELS: Record<FavoriteServiceType, string> = {
  hotel:       'Hotel',
  airline:     'Companhia aérea',
  transfer:    'Transfer',
  tour:        'Passeio / Excursão',
  insurance:   'Seguro',
  car_rental:  'Aluguer de carro',
  additional:  'Serviço adicional',
  other:       'Outro',
};

/**
 * Entidade do catálogo de serviços reutilizáveis (Tabela: favorite_services)
 * Princípio: o catálogo é fonte de preenchimento. Packages mantêm snapshot próprio.
 */
export interface FavoriteService {
  id: string;
  type: FavoriteServiceType;
  name: string;
  country: string;
  city?: string;
  notes?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateFavoriteServiceInput = {
  type: FavoriteServiceType;
  name: string;
  country: string;
  city?: string;
  notes?: string;
  active?: boolean;
};

export type UpdateFavoriteServiceInput = Partial<CreateFavoriteServiceInput>;

/**
 * Interface para rascunho de criação de pacote salvo em sessionStorage
 * Preserva o estado completo do formulário durante navegações contextuais.
 */
export interface PackageDraft {
  reference: string;
  name: string;
  status: PackageStatus;
  baseCurrency: Currency;
  supplier: string;
  additionalInfo: string;
  startDate: string;
  endDate: string;
  durationDays: number | '';
  durationNights: number | '';
  adults: number | '';
  children: number | '';
  outboundRoute: string;
  outboundCarrier: string;
  inboundRoute: string;
  inboundCarrier: string;
  hotelName: string;
  hotelDestination: string;
  hotelMealPlan: string;
  costComponents: CostComponent[];
  salePrice: number;
  savedAt: number;
}

/**
 * Modelo estruturado de retorno da extração de cotação por imagem via IA multimodal
 */
export interface ImportedPackageData {
  packageName?: string | null;

  dates: {
    start: string | null;
    end: string | null;
  };

  passengers: {
    adults: number | null;
    children: Array<{
      age: number | null;
    }>;
  };

  outbound: {
    route: string | null;
    company: string | null;
    flight: string | null;
    departureTime: string | null;
    arrivalTime: string | null;
  };

  inbound: {
    route: string | null;
    company: string | null;
    flight: string | null;
    departureTime: string | null;
    arrivalTime: string | null;
  };

  lodging: {
    name: string | null;
    city: string | null;
    country: string | null;
    room: string | null;
    mealPlan: string | null;
    checkIn: string | null;
    checkOut: string | null;
  };

  additionalServices: Array<{
    name: string;
    date: string | null;
    description: string | null;
    currency: string | null;
    amount: number | null;
  }>;

  financial: {
    currency: string | null;
    taxesAndFees: number | null;
    total: number | null;
  };
}

export interface ImageImportResponse {
  success: boolean;
  data?: ImportedPackageData;
  error?: string;
  details?: string;
}

