// Motor Financeiro Determinístico e Multi-Moeda (Packager - Fase 4)
// Regra Fundamental: Todos os cálculos são puramente determinísticos em TypeScript,
// sem nenhuma dependência de IA, APIs externas ou bibliotecas financeiras pesadas.

import { CostCategory, CostComponent, Currency, FinancialSummary, PassengerConfig } from '../types';

/**
 * Convenção Unificada de Câmbio do Packager:
 * Base: 1 EUR = X BRL (ex: 1 EUR = 6.20 BRL)
 * - Para converter EUR para BRL: valor * taxa
 * - Para converter BRL para EUR: valor / taxa
 */
export const EXCHANGE_RATE_CONVENTION_NOTE = 'Convenção oficial: 1 EUR = X BRL';

/**
 * Arredonda um valor monetário para 2 casas decimais de forma consistente,
 * mitigando imprecisões de ponto flutuante em JavaScript.
 */
export function roundMoney(amount: number): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return 0;
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Arredonda uma taxa percentual para 2 casas decimais.
 */
export function roundPercent(percent: number): number {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) {
    return 0;
  }
  return Math.round((percent + Number.EPSILON) * 100) / 100;
}

export interface ConversionResult {
  converted: number;
  error?: string;
}

/**
 * Converte um valor monetário entre EUR e BRL usando a taxa manual informada.
 * Se a taxa não for válida ou for <= 0 quando necessária, bloqueia o cálculo retornando erro descritivo.
 */
export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency,
  exchangeRate?: number | null
): ConversionResult {
  const safeAmount = roundMoney(amount);

  // Sem necessidade de conversão se as moedas forem idênticas
  if (from === to) {
    return { converted: safeAmount };
  }

  // Validação estrita da taxa de câmbio informada
  if (!exchangeRate || exchangeRate <= 0 || !Number.isFinite(exchangeRate)) {
    return {
      converted: 0,
      error: `Câmbio manual obrigatório não informado ou inválido para converter de ${from} para ${to}. Convenção: 1 EUR = X BRL.`,
    };
  }

  if (from === 'EUR' && to === 'BRL') {
    // 1 EUR = X BRL => EUR * rate
    return { converted: roundMoney(safeAmount * exchangeRate) };
  }

  if (from === 'BRL' && to === 'EUR') {
    // X BRL = 1 EUR => BRL / rate
    return { converted: roundMoney(safeAmount / exchangeRate) };
  }

  return {
    converted: 0,
    error: `Conversão de ${from} para ${to} não suportada.`,
  };
}

/**
 * Calcula o custo total e o total de impostos/taxas a partir dos componentes de custo.
 * Se houver componentes em moedas distintas sem taxa de câmbio válida,
 * o cálculo é bloqueado e uma mensagem de erro é retornada.
 */
export function calculateCosts(
  components: CostComponent[],
  targetCurrency: Currency,
  exchangeRate?: number | null
): {
  totalCost: number;
  taxesAndFeesTotal: number;
  conversionError?: string;
  hasDifferentCurrencies: boolean;
} {
  let totalCost = 0;
  let taxesAndFeesTotal = 0;
  let hasDifferentCurrencies = false;

  for (const comp of components) {
    const qty = comp.quantity && comp.quantity > 0 ? comp.quantity : 1;
    const baseItemAmount = (comp.amount || 0) * qty;

    if (comp.currency !== targetCurrency) {
      hasDifferentCurrencies = true;
    }

    const conv = convertCurrency(baseItemAmount, comp.currency, targetCurrency, exchangeRate);
    if (conv.error) {
      return {
        totalCost: 0,
        taxesAndFeesTotal: 0,
        conversionError: conv.error,
        hasDifferentCurrencies: true,
      };
    }

    totalCost += conv.converted;
    if (comp.category === 'taxes') {
      taxesAndFeesTotal += conv.converted;
    }
  }

  return {
    totalCost: roundMoney(totalCost),
    taxesAndFeesTotal: roundMoney(taxesAndFeesTotal),
    hasDifferentCurrencies,
  };
}

/**
 * Calcula o preço por pessoa com base nos passageiros pagantes.
 * Regra documentada para o divisor:
 * - payingPassengers = adultos + crianças
 * - Bebês (infants) não dividem o preço base do pacote (viajam de colo/berço)
 * - Se payingPassengers <= 0, o divisor padrão é 1
 * - Protegido contra NaN e Infinity
 */
export function calculatePricePerPerson(
  salePrice: number,
  passengers?: PassengerConfig | null
): number {
  const safeSalePrice = Math.max(0, roundMoney(salePrice));
  const adults = Math.max(0, passengers?.adults ?? 0);
  const children = Math.max(0, passengers?.children ?? 0);

  const payingPassengers = adults + children;
  const divisor = payingPassengers > 0 ? payingPassengers : 1;

  return roundMoney(safeSalePrice / divisor);
}

/**
 * Calcula o lucro bruto determinístico:
 * profit = salePrice - totalCost
 */
export function calculateProfit(salePrice: number, totalCost: number): number {
  const safeSalePrice = roundMoney(salePrice);
  const safeTotalCost = roundMoney(totalCost);
  return roundMoney(safeSalePrice - safeTotalCost);
}

/**
 * Calcula a margem de lucro percentual:
 * profitPercent = (profit / salePrice) * 100
 * Se salePrice <= 0, retorna 0 (nunca NaN nem Infinity).
 */
export function calculateProfitPercent(salePrice: number, totalCost: number): number {
  const safeSalePrice = roundMoney(salePrice);
  const safeTotalCost = roundMoney(totalCost);

  if (safeSalePrice <= 0) {
    return 0;
  }

  const profit = safeSalePrice - safeTotalCost;
  return roundPercent((profit / safeSalePrice) * 100);
}

export interface FinancialCalculationInput {
  components: CostComponent[];
  salePrice: number;
  targetCurrency: Currency;
  exchangeRate?: number | null;
  passengers?: PassengerConfig | null;
}

/**
 * Executa a consolidação financeira completa determinística.
 */
export function calculateFinancialSummary(input: FinancialCalculationInput): FinancialSummary {
  const { components = [], salePrice = 0, targetCurrency, exchangeRate, passengers } = input;

  const costResult = calculateCosts(components, targetCurrency, exchangeRate);

  if (costResult.conversionError) {
    return {
      currency: targetCurrency,
      components,
      totalCost: 0,
      salePrice: roundMoney(salePrice),
      pricePerPerson: calculatePricePerPerson(salePrice, passengers),
      profit: 0,
      profitPercent: 0,
      taxesAndFeesTotal: 0,
      exchangeRateUsed: exchangeRate || null,
      conversionError: costResult.conversionError,
      priceTotal: {
        amount: roundMoney(salePrice),
        currency: targetCurrency,
      },
    };
  }

  const totalCost = costResult.totalCost;
  const safeSalePrice = roundMoney(salePrice);
  const pricePerPerson = calculatePricePerPerson(safeSalePrice, passengers);
  const profit = calculateProfit(safeSalePrice, totalCost);
  const profitPercent = calculateProfitPercent(safeSalePrice, totalCost);

  return {
    currency: targetCurrency,
    components,
    totalCost,
    salePrice: safeSalePrice,
    pricePerPerson,
    profit,
    profitPercent,
    taxesAndFeesTotal: costResult.taxesAndFeesTotal,
    exchangeRateUsed: costResult.hasDifferentCurrencies ? (exchangeRate || null) : null,
    conversionError: null,
    priceTotal: {
      amount: safeSalePrice,
      currency: targetCurrency,
    },
    pricePerPersonAmount: {
      amount: pricePerPerson,
      currency: targetCurrency,
    },
  };
}

/**
 * Rótulos descritivos para as categorias de custo
 */
export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  outbound_transport: 'Transporte de ida',
  inbound_transport: 'Transporte de volta',
  lodging: 'Hospedagem',
  services: 'Serviços adicionais',
  taxes: 'Impostos/taxas',
  other: 'Outros custos',
};

/**
 * Formata um valor numérico para a moeda correspondente com duas casas decimais
 */
export function formatMoney(amount: number, currency: Currency): string {
  const safe = roundMoney(amount);
  const formatted = safe.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === 'EUR' ? `€ ${formatted}` : `R$ ${formatted}`;
}

/**
 * Formata uma margem percentual com sinal visual
 */
export function formatPercent(percent: number): string {
  const safe = roundPercent(percent);
  return `${safe >= 0 ? '+' : ''}${safe.toFixed(2)}%`;
}
