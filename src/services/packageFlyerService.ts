import type { Currency, Package, ServiceItem } from '../types';
import { calculatePricePerPerson, formatMoney } from './financeService';
import { normalizeLegacyToNewStructure } from './legacyAdapterService';

/** Contrato público da lâmina v1: somente dados destinados à divulgação. */
export interface PackageFlyerModel {
  version: 1;
  origin: string;
  destination: string;
  period: string;
  price: { amount: number; currency: Currency; formatted: string };
  items: Array<{ kind: 'air' | 'transport' | 'accommodation' | 'transfer' | 'insurance' | 'additional'; label: string }>;
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

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

const mealPlans: Record<string, string> = {
  'Apenas alojamento (RO)': 'apenas alojamento',
  'Café da manhã (BB)': 'café da manhã',
  'Meia-pensão (HB)': 'meia-pensão',
  'Pensão completa (FB)': 'pensão completa',
  'Tudo incluído (AI)': 'tudo incluído',
  RO: 'apenas alojamento', BB: 'café da manhã', HB: 'meia-pensão', FB: 'pensão completa', AI: 'tudo incluído',
};

function safePaymentConditions(value: string): string | undefined {
  const payment = value.trim().replace(/\s+/g, ' ');
  const hasPaymentTerm = /(?:^|[^\p{L}\p{N}])(?:à vista|a vista|\d{1,2}x|entrada|saldo|restante|parcelas?|vezes|juros|cart[aã]o|pix|boleto|transfer[êe]ncia)(?=$|[^\p{L}\p{N}])/iu.test(payment);
  const containsInternalTerm = /\b(?:custos?|lucros?|margem|comiss[aã]o|fornecedor(?:es)?|supplier|confidencial|sigiloso|intern[oa]s?|n[aã]o divulgar|nao divulgar)\b/iu.test(payment);
  if (payment.length > 100 || !/^[\p{L}\p{M}\d\s.,%€$()+/:;\-]+$/u.test(payment) || !hasPaymentTerm || containsInternalTerm) {
    return undefined;
  }
  return payment;
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

  const isLegacy = !Array.isArray(data.services);
  const services: ServiceItem[] = isLegacy ? normalized.services : data.services!;
  const items: PackageFlyerModel['items'] = [];
  let lodgingIndex = 0;
  const add = (kind: PackageFlyerModel['items'][number]['kind'], label: string) => {
    if (!items.some(item => item.kind === kind && item.label === label)) items.push({ kind, label });
  };
  const addAdditional = (description: string) => {
    const safeNames: Record<string, string> = {
      'passeio de barco': 'Passeio de barco',
      'passeio guiado': 'Passeio guiado',
      'ingresso': 'Ingresso',
    };
    const label = safeNames[description.trim().toLocaleLowerCase('pt-BR')];
    if (label) add('additional', label);
    else warnings.push('Serviço adicional omitido: revise sua descrição comercial antes de divulgar.');
  };
  for (const service of services) {
    if (!service || typeof service.description !== 'string' || !service.description.trim()) continue;
    if (/\b(n[aã]o (?:inclu[ií]d[oa]|inclus[oa])|sem inclus[aã]o)\b/i.test(service.description)) {
      warnings.push('Serviço marcado como não incluído foi omitido.');
      continue;
    }
    if (service.type === 'outbound_transport' || service.type === 'inbound_transport') {
      const legacy = isLegacy ? (service.type === 'outbound_transport' ? data.outboundTransport : data.inboundTransport) : undefined;
      if (isLegacy && !legacy) { warnings.push('Transporte financeiro omitido: confirme o serviço incluído.'); continue; }
      const air = legacy ? legacy.type === 'flight' : /\b(voo|a[eé]reo|aeronave|flight)\b/i.test(service.description);
      add(air ? 'air' : 'transport', air ? 'Aéreo' : 'Transporte');
    } else if (service.type === 'accommodation') {
      if (isLegacy && lodgingIndex++ >= (data.lodging?.length || 0)) { warnings.push('Hospedagem financeira omitida: confirme o serviço incluído.'); continue; }
      const meal = service.mealPlan ? mealPlans[service.mealPlan.trim()] : undefined;
      if (!meal) warnings.push('Confira o regime da hospedagem; não foi exibido por não estar reconhecido.');
      add('accommodation', meal ? `Hospedagem com ${meal}` : 'Hospedagem');
    } else if (isLegacy) {
      warnings.push('Serviço financeiro omitido: confirme o serviço incluído.');
    } else if (service.type === 'taxes') {
      warnings.push('Taxa omitida da lâmina: confirme se está incluída no pacote.');
    } else if (service.type === 'transfer') add('transfer', 'Transfer');
    else if (service.type === 'insurance') add('insurance', 'Seguro-viagem');
    else if (service.type === 'additional' || service.type === 'other') {
      addAdditional(service.description);
    }
  }
  if (isLegacy) {
    for (const service of data.additionalServices || []) {
      if (service.included && typeof service.name === 'string') addAdditional(service.name);
    }
    if (data.transferService?.trim()) add('transfer', 'Transfer');
  }
  if (!items.length) warnings.push('Nenhum serviço confirmado para exibir.');
  if (items.length > 6) errors.push('Há itens demais para exibir com segurança na lâmina.');

  let paymentConditions: string | undefined;
  if (typeof data.paymentConditions === 'string' && data.paymentConditions.trim()) {
    paymentConditions = safePaymentConditions(data.paymentConditions);
    if (!paymentConditions) warnings.push('Condições de pagamento omitidas: revise o texto comercial antes de divulgar.');
  } else warnings.push('Condições de pagamento não informadas.');

  if (errors.length || !validDate(start) || !validDate(end) || typeof amount !== 'number') return { model: null, errors, warnings };
  return {
    model: { version: 1, origin, destination, period: `${displayDate(start)} a ${displayDate(end)}`,
      price: { amount, currency, formatted: formatMoney(amount, currency) }, items, paymentConditions },
    errors, warnings,
  };
}
