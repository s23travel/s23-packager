import type { Currency, Package } from '../types/index.ts';
import { calculatePricePerPerson, formatMoney } from './financeService.ts';
import { normalizeLegacyToNewStructure } from './legacyAdapterService.ts';
import type { FlyerItemKind } from '../../supabase/functions/_shared/flyerItemsContract.ts';
import {
  deriveFlyerItems,
  displayPeriod,
  resolveFlyerServices,
  safePaymentConditions,
  validDate,
} from './flyerCommercialModel.ts';

/** Contrato público da lâmina v1: somente dados destinados à divulgação. */
export interface PackageFlyerModel {
  version: 1;
  origin: string;
  destination: string;
  period: string;
  price: { amount: number; currency: Currency; formatted: string };
  items: Array<{ kind: FlyerItemKind; label: string }>;
  paymentConditions?: string;
  subtitle?: string;
  /** URL local ou recurso aprovado; ausente significa moldura editorial provisória. */
  imageUrl?: string;
}

export interface PackageFlyerResult {
  model: PackageFlyerModel | null;
  errors: string[];
  warnings: string[];
}

/** Não transforma texto operacional livre em afirmação pública. */
export function createPackageFlyer(pkg: Package): PackageFlyerResult {
  const data = pkg.data || {};
  const normalized = normalizeLegacyToNewStructure(data);
  const errors: string[] = [];
  const warnings: string[] = [];
  const origin = typeof data.origin === 'string' ? data.origin.trim() : '';
  const destination = typeof data.destination === 'string' && data.destination.trim() ? data.destination.trim() : normalized.destination?.trim() || '';
  if (!origin) errors.push('Informe a origem no pacote.');
  if (!destination || (!data.destination && normalized.destinationConflict)) errors.push('Informe o destino principal no pacote.');
  if (origin.length > 45 || destination.length > 45 || origin.length + destination.length > 55) errors.push('Origem ou destino muito longos para a lâmina.');

  const start = data.dates?.startDate;
  const end = data.dates?.endDate;
  if (!validDate(start) || !validDate(end) || end < start) errors.push('Informe datas de ida e retorno válidas no pacote.');

  const currency = pkg.base_currency;
  const financials = data.financials;
  const passengers = data.passengers;
  const total = financials?.salePrice ?? financials?.priceTotal?.amount;
  const hasPassengers = !!passengers && Number.isInteger(passengers.adults) && Number.isInteger(passengers.children) &&
    passengers.adults >= 0 && passengers.children >= 0 && passengers.adults + passengers.children > 0;
  let amount = financials?.pricePerPerson;
  if (!(typeof amount === 'number' && Number.isFinite(amount) && amount > 0)) {
    if (typeof total === 'number' && Number.isFinite(total) && total > 0 && hasPassengers) {
      amount = calculatePricePerPerson(total, passengers);
    }
  }
  if (typeof amount === 'number' && amount > 0 && typeof total === 'number' && total > 0 && hasPassengers &&
    Math.abs(calculatePricePerPerson(total, passengers) - amount) > 0.009) {
    errors.push('O preço por pessoa diverge do total e dos passageiros. Revise o financeiro.');
  }
  if ((currency !== 'BRL' && currency !== 'EUR') || (financials?.currency && financials.currency !== currency) ||
    (financials?.pricePerPersonAmount && financials.pricePerPersonAmount.currency !== currency) ||
    (financials?.priceTotal && financials.priceTotal.currency !== currency) ||
    !(typeof amount === 'number' && Number.isFinite(amount) && amount > 0)) errors.push('Informe um preço comercial por pessoa válido na moeda do pacote.');
  if (typeof amount === 'number' && Number.isFinite(amount) && formatMoney(amount, currency).length > 20) errors.push('Preço longo demais para a lâmina.');

  const { isLegacy, services } = resolveFlyerServices(data, normalized);
  const items: PackageFlyerModel['items'] = deriveFlyerItems(data, services, isLegacy, warnings);

  let paymentConditions: string | undefined;
  if (typeof data.paymentConditions === 'string' && data.paymentConditions.trim()) {
    paymentConditions = safePaymentConditions(data.paymentConditions);
    if (!paymentConditions) warnings.push('Condições de pagamento omitidas: revise o texto comercial antes de divulgar.');
  } else warnings.push('Condições de pagamento não informadas.');

  if (errors.length || !validDate(start) || !validDate(end) || typeof amount !== 'number') return { model: null, errors, warnings };
  return {
    model: { version: 1, origin, destination, period: displayPeriod(start, end),
      price: { amount, currency, formatted: formatMoney(amount, currency) }, items, paymentConditions },
    errors, warnings,
  };
}
