import type { Currency, Quotation, ServiceItem } from '../types/index.ts';
import { calculatePricePerPerson, formatMoney, roundMoney } from './financeService.ts';
import { normalizeLegacyToNewStructure } from './legacyAdapterService.ts';
import {
  FLYER_ITEM_LABEL_MAX,
  FLYER_ITEMS_MAX,
  itemContentProblem,
  normalizeItemLabel,
  type FlyerItem,
} from '../../supabase/functions/_shared/flyerItemsContract.ts';
import {
  deriveFlyerItems,
  formatMealPlan,
  internalTermProblem,
  resolveFlyerServices,
  validDate,
} from './flyerCommercialModel.ts';
import {
  NOT_INCLUDED_MAX_LENGTH,
  depositOverSalePriceWarning,
  formatBalanceDueDate,
  formatProposalDate,
  normalizeNotIncluded,
  parseDepositAmount,
  resolveProposalDate,
} from './quotationFlyerFields.ts';

/** Contrato público da lâmina de cotação (proposta de viagem 9:16). */
export interface TransportLeg {
  carrier: string;
  date: string;
  route: string;
  departureTime?: string;
  arrivalTime?: string;
  fareLabel?: string;
  baggage?: string;
}

export interface QuotationFlyerModel {
  version: 1;
  template: 'quotation';
  /** Primeira linha do título. */
  clientName: string;
  /** Data da cotação em `DD/MM/AAAA`. */
  proposalDate: string;
  subtitle?: string;
  origin: string;
  /** Segunda linha do título. */
  destination: string;
  dates: { period: string; start: string; end: string };
  passengers: {
    adults: number;
    children: number;
    infants: number;
    label: string;
  };
  transport: {
    outbound: TransportLeg;
    inbound: TransportLeg;
  } | null;
  lodging: {
    name: string;
    dateRange: string;
    nights: string;
    mealPlan?: string;
  } | null;
  included: FlyerItem[];
  notIncluded: string[];
  price: {
    total: { amount: number; currency: Currency; formatted: string };
    perPerson?: { amount: number; currency: Currency; formatted: string };
  };
  deposit?: { amount: number; currency: Currency; formatted: string };
  /** Data-limite do restante em `DD/MM`. */
  balanceDueDate?: string;
  /** URL local ou recurso aprovado; ausente significa moldura editorial provisória. */
  imageUrl?: string;
}

export interface QuotationFlyerResult {
  model: QuotationFlyerModel | null;
  errors: string[];
  warnings: string[];
}

const CLIENT_NAME_MAX = 60;
const PLACE_MAX = 45;
const PLACE_SUM_MAX = 55;
const PERIOD_MAX = 40;
const PASSENGERS_LABEL_MAX = 40;
const CARRIER_MAX = 40;
const ROUTE_MAX = 30;
const FARE_LABEL_MAX = 60;
const BAGGAGE_MAX = 60;
const LODGING_NAME_MAX = 60;
const DATE_RANGE_MAX = 30;
const NIGHTS_MAX = 20;
const MEAL_PLAN_MAX = 40;
const PRICE_MAX = 20;

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'] as const;

/** O editor mostra «Café da manhã (BB)» quando o serviço não traz regime; a peça segue o mesmo default. */
const DEFAULT_MEAL_PLAN = 'Café da manhã (BB)';

interface DateParts {
  day: string;
  month: string;
  monthNumber: string;
  year: string;
}

function dateParts(iso: string): DateParts {
  const [year, monthNumber, day] = iso.split('-');
  return { day, month: MONTHS[Number(monthNumber) - 1], monthNumber, year };
}

/** Data curta do template: `DD/MM/AAAA`. */
function formatIsoDate(iso: string): string {
  const parts = dateParts(iso);
  return `${parts.day}/${parts.monthNumber}/${parts.year}`;
}

/**
 * Período curto do template: dia de 2 dígitos, mês abreviado em maiúsculas e
 * ano no fim; o ano só se repete quando muda.
 */
function formatShortPeriod(start: string, end: string): string {
  const from = dateParts(start);
  const to = dateParts(end);
  if (from.year === to.year) {
    return `${from.day} ${from.month} — ${to.day} ${to.month} ${to.year}`;
  }
  return `${from.day} ${from.month} ${from.year} — ${to.day} ${to.month} ${to.year}`;
}

function isPositiveAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function plural(value: number, singular: string, pluralForm: string): string {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

function passengersLabel(adults: number, children: number, infants: number): string {
  const parts: string[] = [];
  if (adults > 0) parts.push(plural(adults, 'adulto', 'adultos'));
  if (children > 0) parts.push(plural(children, 'criança', 'crianças'));
  if (infants > 0) parts.push(plural(infants, 'bebê', 'bebês'));
  if (!parts.length) return 'Viajantes';
  const label = parts.join(' · ');
  return label.length > PASSENGERS_LABEL_MAX ? `${adults + children} pagantes` : label;
}

function fareLabel(adults: number, children: number): string | undefined {
  const paying = adults + children;
  if (paying <= 0) return undefined;
  const label = children > 0
    ? `Tarifa para ${plural(paying, 'pagante', 'pagantes')}`
    : `Tarifa para ${plural(paying, 'adulto', 'adultos')}`;
  return label.length > FARE_LABEL_MAX ? undefined : label;
}

/** Códigos entre parênteses do `description` do transporte, ex.: `OPO — ORY`. */
function routeFromDescription(description: string): string | undefined {
  const codes = Array.from(description.matchAll(/\(([A-Z]{3})\)/g), match => match[1]);
  return codes.length >= 2 ? `${codes[0]} — ${codes[1]}` : undefined;
}

function safeTime(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const time = value.trim();
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : undefined;
}

/** Nota do transporte (bagagem/tarifa) só entra se for texto público curto. */
function safeBaggage(notes: unknown, warnings: string[]): string | undefined {
  const label = normalizeItemLabel(notes);
  if (!label) return undefined;
  const problem = itemContentProblem(label);
  if (problem || label.length > BAGGAGE_MAX) {
    warnings.push('Bagagem do transporte omitida: revise a nota do serviço antes de divulgar.');
    return undefined;
  }
  return label;
}

function findTransport(services: ServiceItem[], type: 'outbound_transport' | 'inbound_transport'): ServiceItem | undefined {
  return services.find(service =>
    service?.type === type && typeof service.description === 'string' && service.description.trim().length > 0
  );
}

interface TransportContext {
  origin: string;
  destination: string;
  start: string;
  end: string;
  fare: string | undefined;
}

function buildLeg(
  service: ServiceItem | undefined,
  type: 'outbound_transport' | 'inbound_transport',
  context: TransportContext,
  warnings: string[]
): TransportLeg {
  const outbound = type === 'outbound_transport';
  const description = typeof service?.description === 'string' ? service.description : '';
  const fallbackRoute = outbound
    ? `${context.origin} — ${context.destination}`
    : `${context.destination} — ${context.origin}`;
  const route = (routeFromDescription(description) ?? fallbackRoute).slice(0, ROUTE_MAX);
  const carrier = (normalizeItemLabel(service?.carrier) || 'Voo').slice(0, CARRIER_MAX);
  const date = formatIsoDate(outbound ? context.start : context.end);
  const departureTime = safeTime(service?.departureTime);
  const arrivalTime = safeTime(service?.arrivalTime);
  const baggage = safeBaggage(service?.notes, warnings);
  return {
    carrier,
    date,
    route,
    ...(departureTime ? { departureTime } : {}),
    ...(arrivalTime ? { arrivalTime } : {}),
    ...(context.fare ? { fareLabel: context.fare } : {}),
    ...(baggage ? { baggage } : {}),
  };
}

function deriveTransport(
  services: ServiceItem[],
  start: string,
  end: string,
  origin: string,
  destination: string,
  adults: number,
  children: number,
  warnings: string[]
): QuotationFlyerModel['transport'] {
  const outbound = findTransport(services, 'outbound_transport');
  const inbound = findTransport(services, 'inbound_transport');
  if (!outbound && !inbound) {
    warnings.push('Transporte não informado na cotação: o cartão de voos não será exibido.');
    return null;
  }
  if (!outbound) warnings.push('Serviço de ida não informado: confira o transporte da cotação.');
  if (!inbound) warnings.push('Serviço de regresso não informado: confira o transporte da cotação.');
  const context: TransportContext = { origin, destination, start, end, fare: fareLabel(adults, children) };
  return {
    outbound: buildLeg(outbound, 'outbound_transport', context, warnings),
    inbound: buildLeg(inbound, 'inbound_transport', context, warnings),
  };
}

function deriveLodging(
  services: ServiceItem[],
  start: string,
  end: string,
  durationNights: unknown,
  warnings: string[]
): QuotationFlyerModel['lodging'] {
  const service = services.find(item =>
    item?.type === 'accommodation' && typeof item.description === 'string' && item.description.trim().length > 0
  );
  if (!service) {
    warnings.push('Hospedagem não informada na cotação: o cartão de hospedagem não será exibido.');
    return null;
  }

  // O nome do hotel sai sem os códigos entre parênteses do cadastro.
  const rawName = normalizeItemLabel(service.description.replace(/\([^)]*\)/g, ' ')) || 'Hospedagem';
  const name = rawName.slice(0, LODGING_NAME_MAX);
  if (name !== rawName) warnings.push('Nome da hospedagem reduzido para caber na lâmina.');

  const nightsFromHeader = typeof durationNights === 'number' && Number.isInteger(durationNights) && durationNights >= 0
    ? durationNights
    : Math.max(0, Math.round(
      (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000
    ));
  const nights = plural(nightsFromHeader, 'noite', 'noites');

  const meal = formatMealPlan(service.mealPlan);
  const dateRange = formatShortPeriod(start, end);
  return {
    name,
    dateRange: dateRange.slice(0, DATE_RANGE_MAX),
    nights: nights.slice(0, NIGHTS_MAX),
    ...(meal && meal.length <= MEAL_PLAN_MAX ? { mealPlan: meal } : {}),
  };
}

function deriveNotIncluded(value: unknown, warnings: string[]): string[] {
  const lines: string[] = [];
  for (const raw of normalizeNotIncluded(value)) {
    // Texto público: pode citar o preço do item, nunca custos ou fornecedores.
    const line = normalizeItemLabel(raw).slice(0, NOT_INCLUDED_MAX_LENGTH);
    if (!line || lines.includes(line)) continue;
    if (internalTermProblem(line)) {
      warnings.push('Linha do "Não incluído" omitida: retire termos internos como fornecedor ou custo.');
      continue;
    }
    lines.push(line);
  }
  if (!lines.length) warnings.push('Lista de não incluídos vazia: o bloco "Não incluído" não será exibido.');
  return lines;
}

/** Converte a derivação comercial nos itens do contrato: até 6 rótulos de 40 caracteres. */
function deriveIncluded(data: Quotation['data'], services: ServiceItem[], isLegacy: boolean, warnings: string[]): FlyerItem[] {
  const included: FlyerItem[] = [];
  for (const item of deriveFlyerItems(data, services, isLegacy, warnings)) {
    if (included.length >= FLYER_ITEMS_MAX) break;
    if (item.label.length > FLYER_ITEM_LABEL_MAX) {
      warnings.push(`Serviço omitido: o rótulo tem ${item.label.length} caracteres (limite de ${FLYER_ITEM_LABEL_MAX} caracteres).`);
      continue;
    }
    included.push(item);
  }
  return included;
}

/**
 * Modelo comercial da proposta de viagem. Só entram dados públicos: cliente,
 * destino, datas, serviços, total e sinal/restante. Custos, margens, fornecedor,
 * `paymentConditions` e as notas antigas ficam fora da peça.
 */
export function createQuotationFlyer(quote: Quotation): QuotationFlyerResult {
  const data = quote.data || {};
  const normalized = normalizeLegacyToNewStructure(data);
  const errors: string[] = [];
  const warnings: string[] = [];

  const clientName = normalizeItemLabel(quote.client_name);
  if (!clientName) errors.push('Informe o nome do cliente na cotação.');
  else if (clientName.length > CLIENT_NAME_MAX) errors.push(`Nome do cliente muito longo para a lâmina (máximo ${CLIENT_NAME_MAX} caracteres).`);

  const origin = typeof data.origin === 'string' ? data.origin.trim() : '';
  const destination = typeof data.destination === 'string' && data.destination.trim()
    ? data.destination.trim()
    : normalized.destination?.trim() || '';
  if (!origin) errors.push('Informe a origem na cotação.');
  if (!destination || (!data.destination && normalized.destinationConflict)) errors.push('Informe o destino principal na cotação.');
  if (origin.length > PLACE_MAX || destination.length > PLACE_MAX || origin.length + destination.length > PLACE_SUM_MAX) {
    errors.push('Origem ou destino muito longos para a lâmina.');
  }

  const start = data.dates?.startDate;
  const end = data.dates?.endDate;
  if (!validDate(start) || !validDate(end) || end < start) errors.push('Informe datas de ida e retorno válidas na cotação.');

  const currency = quote.currency;
  const financials = data.financials;
  const total = financials?.salePrice ?? financials?.priceTotal?.amount;
  const validTotal = isPositiveAmount(total);
  const currencyMismatch = (currency !== 'BRL' && currency !== 'EUR') ||
    (!!financials?.currency && financials.currency !== currency) ||
    (!!financials?.priceTotal && financials.priceTotal.currency !== currency) ||
    (!!financials?.pricePerPersonAmount && financials.pricePerPersonAmount.currency !== currency);
  if (currencyMismatch) errors.push('A moeda do financeiro diverge da moeda da cotação. Revise e salve a cotação.');
  if (!validTotal) errors.push('Informe um preço total válido na moeda da cotação.');
  if (validTotal && formatMoney(total, currency).length > PRICE_MAX) errors.push('Preço longo demais para a lâmina.');

  const passengers = data.passengers;
  const adults = passengers && Number.isInteger(passengers.adults) && passengers.adults > 0 ? passengers.adults : 0;
  const children = passengers && Number.isInteger(passengers.children) && passengers.children > 0 ? passengers.children : 0;
  const infants = passengers && Number.isInteger(passengers.infants) && passengers.infants > 0 ? passengers.infants : 0;
  const label = passengersLabel(adults, children, infants);
  if (!passengers || adults + children + infants === 0) {
    warnings.push('Passageiros não informados na cotação: a barra de dados mostrará apenas "Viajantes".');
  }

  const { isLegacy, services } = resolveFlyerServices(data, normalized);
  // Serviços antigos podem não ter regime gravado; o editor sempre apresentou
  // café da manhã como default, por isso a peça usa o mesmo valor.
  const flyerServices = services.map(service =>
    service?.type === 'accommodation' && !service.mealPlan
      ? { ...service, mealPlan: DEFAULT_MEAL_PLAN }
      : service
  );

  const depositAmount = parseDepositAmount(data.depositAmount);
  const deposit = typeof depositAmount === 'number' && depositAmount > 0
    ? { amount: depositAmount, currency, formatted: formatMoney(depositAmount, currency) }
    : undefined;
  if (!deposit) warnings.push('Sinal não informado na cotação: o bloco "Pagamento" não será exibido.');
  const balanceDueDate = formatBalanceDueDate(data.balanceDueDate);
  if (deposit && !balanceDueDate) warnings.push('Data-limite do restante não informada: o bloco "Pagamento" mostra apenas o sinal.');
  if (deposit) {
    const overPrice = depositOverSalePriceWarning(deposit.amount, validTotal ? total : undefined);
    if (overPrice) warnings.push(overPrice);
  }

  const period = validDate(start) && validDate(end) ? formatShortPeriod(start, end) : '';
  if (period.length > PERIOD_MAX) warnings.push('Período longo demais para a lâmina.');

  const included = deriveIncluded(data, flyerServices, isLegacy, warnings);
  const notIncluded = deriveNotIncluded(data.notIncluded, warnings);

  if (errors.length || !validDate(start) || !validDate(end) || !validTotal) {
    return { model: null, errors, warnings };
  }

  const payingPassengers = adults + children;
  let perPerson: QuotationFlyerModel['price']['perPerson'];
  if (payingPassengers > 0) {
    const perPersonAmount = calculatePricePerPerson(total, { adults, children, infants });
    const formatted = formatMoney(perPersonAmount, currency);
    if (formatted.length <= PRICE_MAX) perPerson = { amount: perPersonAmount, currency, formatted };
  }

  return {
    model: {
      version: 1,
      template: 'quotation',
      clientName,
      proposalDate: formatProposalDate(resolveProposalDate(data.proposalDate, quote.created_at)),
      origin,
      destination,
      dates: { period, start: formatIsoDate(start), end: formatIsoDate(end) },
      passengers: { adults, children, infants, label },
      transport: deriveTransport(flyerServices, start, end, origin, destination, adults, children, warnings),
      lodging: deriveLodging(flyerServices, start, end, data.dates?.durationNights, warnings),
      included,
      notIncluded,
      price: {
        total: { amount: roundMoney(total), currency, formatted: formatMoney(total, currency) },
        ...(perPerson ? { perPerson } : {}),
      },
      ...(deposit ? { deposit } : {}),
      ...(balanceDueDate ? { balanceDueDate } : {}),
    },
    errors,
    warnings,
  };
}
