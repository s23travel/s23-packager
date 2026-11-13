import { normalizeMealPlan, ROOM_ONLY_MEAL_PLAN } from '../types/index.ts';
import type { NormalizedPackageData, PackageData, QuotationData, ServiceItem } from '../types/index.ts';
import {
  FLYER_ITEM_LABEL_MAX,
  FLYER_ITEMS_MAX,
  itemContentProblem,
  normalizeItemLabel,
  type FlyerItem,
} from '../../supabase/functions/_shared/flyerItemsContract.ts';

/**
 * Derivação comercial partilhada entre a lâmina de pacote e a lâmina de cotação.
 * Só entram helpers puros: a saída de `createPackageFlyer` não muda com esta extração.
 */

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function displayDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

/** Encurta o período sem repetir mês/ano quando não é necessário. */
export function displayPeriod(start: string, end: string): string {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const day = (date: Date) => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', timeZone: 'UTC' }).format(date);
  const month = (date: Date) => new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(date);
  const startYear = startDate.getUTCFullYear();
  const endYear = endDate.getUTCFullYear();
  if (startYear === endYear && startDate.getUTCMonth() === endDate.getUTCMonth()) {
    return `${day(startDate)} a ${day(endDate)} de ${month(endDate)} de ${endYear}`;
  }
  if (startYear === endYear) {
    return `${day(startDate)} de ${month(startDate)} a ${day(endDate)} de ${month(endDate)} de ${endYear}`;
  }
  return `${displayDate(start)} a ${displayDate(end)}`;
}

/** Regimes de acomodação no texto público da peça, sem o código entre parênteses. */
export const MEAL_PLANS: Record<string, string> = {
  'Apenas alojamento (RO)': 'apenas alojamento',
  'Café da manhã (BB)': 'café da manhã',
  'Meia-pensão (HB)': 'meia-pensão',
  'Pensão completa (FB)': 'pensão completa',
  'Tudo incluído (AI)': 'tudo incluído',
  RO: 'apenas alojamento', BB: 'café da manhã', HB: 'meia-pensão', FB: 'pensão completa', AI: 'tudo incluído',
};

/** Regime reconhecido, ou `undefined` quando o valor não está no mapa. */
export function formatMealPlan(value?: string | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  return MEAL_PLANS[value.trim()];
}

/** Prefixo público da hospedagem com refeições. */
const MEAL_PREFIX = 'Hospedagem com ';
/** Espaço do regime dentro do limite de 40 caracteres do item. */
const MEAL_PLAN_TEXT_MAX = FLYER_ITEM_LABEL_MAX - MEAL_PREFIX.length;
/** Um regime que começa por "sem"/"não" não vira afirmação de "Hospedagem com". */
const NEGATIVE_MEAL = /^(?:sem|n[aã]o)\b/i;
/** O prefixo "Hospedagem com" já diz alojamento; um regime composto não repete essa menção. */
const LODGING_MENTION = /^(?:apenas|somente|só|so)?[\s,;:.-]*(?:alojamento|hospedagem)\b(?:[\s,;:.-]+(?:com|e)\b)?[\s,;:.-]*/i;

/** Regime sem refeições: não há nada de diferente de "Hospedagem" a anunciar. */
function isRoomOnly(mealPlan: string): boolean {
  return normalizeMealPlan(mealPlan) === ROOM_ONLY_MEAL_PLAN;
}

/** Texto comercial do regime como foi registado: sem o código, sem repetir alojamento e em minúscula inicial. */
function publicMealText(mealPlan: string): string {
  const registered = normalizeItemLabel(mealPlan.replace(/\([^)]*\)/g, ' '));
  const withoutLodging = normalizeItemLabel(registered.replace(LODGING_MENTION, '')) || registered;
  if (!withoutLodging) return '';
  // Um regime registado todo em maiúsculas desce por inteiro, para não sair "pEQUENO-ALMOÇO".
  if (/\p{L}/u.test(withoutLodging) && withoutLodging === withoutLodging.toUpperCase()) {
    return withoutLodging.toLowerCase();
  }
  return withoutLodging.charAt(0).toLowerCase() + withoutLodging.slice(1);
}

interface AccommodationItemText {
  label: string;
  /** Aviso quando o regime registado existe mas não pode ir para a peça. */
  problem?: string;
}

/** Texto do item de hospedagem a partir do regime registado, sem truncar o texto comercial. */
function accommodationItemText(mealPlan?: string | null): AccommodationItemText {
  const unrecognized = {
    label: 'Hospedagem',
    problem: 'Confira o regime da hospedagem; não foi exibido por não estar reconhecido.',
  };
  if (typeof mealPlan !== 'string' || !mealPlan.trim()) return unrecognized;
  // O conteúdo é verificado no valor registado, antes de retirar os parênteses: o que está lá dentro também não vai para a peça.
  const registeredProblem = itemContentProblem(mealPlan);
  if (registeredProblem) return { label: 'Hospedagem', problem: `Regime da hospedagem omitido: ${registeredProblem}` };
  if (NEGATIVE_MEAL.test(normalizeItemLabel(mealPlan))) {
    return { label: 'Hospedagem', problem: 'Confira o regime da hospedagem; descreva o que está incluído.' };
  }
  if (isRoomOnly(mealPlan)) return { label: 'Hospedagem' };
  const mealText = formatMealPlan(mealPlan) ?? publicMealText(mealPlan);
  if (!mealText) return unrecognized;
  const label = `${MEAL_PREFIX}${mealText}`;
  const publishedProblem = itemContentProblem(label);
  if (publishedProblem) return { label: 'Hospedagem', problem: `Regime da hospedagem omitido: ${publishedProblem}` };
  if (mealText.length > MEAL_PLAN_TEXT_MAX) {
    return { label: 'Hospedagem', problem: 'Regime da hospedagem omitido: encurte o regime para caber na lâmina.' };
  }
  return { label };
}

/** Termos operacionais que nunca podem virar texto público. */
const INTERNAL_TERMS = /\b(?:custos?|lucros?|margem|comiss[aã]o|fornecedor(?:es)?|supplier|confidencial|sigilos[oa]s?|intern[oa]s?|n[aã]o divulgar|nao divulgar)\b/iu;

/** Problema de conteúdo interno, ou `null` quando o texto pode ser publicado. */
export function internalTermProblem(value: string): string | null {
  return INTERNAL_TERMS.test(value)
    ? 'Retire termos internos como fornecedor, custo ou margem.'
    : null;
}

export function safePaymentConditions(value: string): string | undefined {
  const payment = value.trim().replace(/\s+/g, ' ');
  const hasPaymentTerm = /(?:^|[^\p{L}\p{N}])(?:à vista|a vista|\d{1,2}x|entrada|saldo|restante|parcelas?|vezes|juros|cart[aã]o|pix|boleto|transfer[êe]ncia)(?=$|[^\p{L}\p{N}])/iu.test(payment);
  if (payment.length > 100 || !/^[\p{L}\p{M}\d\s.,%€$()+/:;\-]+$/u.test(payment) || !hasPaymentTerm || internalTermProblem(payment)) {
    return undefined;
  }
  return payment;
}

export interface FlyerServiceSource {
  isLegacy: boolean;
  services: ServiceItem[];
}

/** Usa os serviços atuais; sem array, cai na estrutura antiga já normalizada. */
export function resolveFlyerServices(
  data: PackageData | QuotationData,
  normalized: NormalizedPackageData
): FlyerServiceSource {
  const isLegacy = !Array.isArray(data.services);
  return { isLegacy, services: isLegacy ? normalized.services : data.services! };
}

/**
 * Derivação serviço→item da lista "Serviços apresentados".
 * `warnings` recebe os serviços omitidos; o chamador decide os limites do contrato.
 */
export function deriveFlyerItems(
  data: PackageData | QuotationData,
  services: ServiceItem[],
  isLegacy: boolean,
  warnings: string[]
): FlyerItem[] {
  const items: FlyerItem[] = [];
  let lodgingIndex = 0;
  const add = (kind: FlyerItem['kind'], label: string) => {
    if (!items.some(item => item.kind === kind && item.label === label)) items.push({ kind, label });
  };
  const addAdditional = (description: string) => {
    // O texto vem da descrição comercial do serviço: não há lista branca de nomes.
    // Descrições com termos internos, valores ou contactos continuam fora da peça.
    const label = normalizeItemLabel(description);
    if (!label) return;
    const problem = itemContentProblem(label);
    if (problem) {
      warnings.push(`Serviço adicional omitido: ${problem}`);
      return;
    }
    add('additional', label);
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
      const accommodation = accommodationItemText(service.mealPlan);
      if (accommodation.problem) warnings.push(accommodation.problem);
      add('accommodation', accommodation.label);
    } else if (isLegacy) {
      warnings.push('Serviço financeiro omitido: confirme o serviço incluído.');
    } else if (service.type === 'taxes') {
      warnings.push('Taxa omitida da lâmina: confirme se está incluída no pacote.');
    } else if (service.type === 'transfer') add('transfer', 'Transfer');
    else if (service.type === 'insurance') add('insurance', 'Seguro-viagem');
    else if (service.type === 'additional') {
      addAdditional(service.description);
    } else if (service.type === 'other') {
      warnings.push('Serviço de "outros custos" omitido; adicione-o em "Serviços apresentados" se estiver incluído.');
    }
  }
  if (isLegacy) {
    for (const service of data.additionalServices || []) {
      if (service.included && typeof service.name === 'string') addAdditional(service.name);
    }
    if (data.transferService?.trim()) add('transfer', 'Transfer');
  }
  if (!items.length) warnings.push('Nenhum serviço confirmado para exibir.');
  if (items.length > FLYER_ITEMS_MAX) {
    warnings.push(`A lâmina comporta ${FLYER_ITEMS_MAX} serviços; remova ${items.length - FLYER_ITEMS_MAX} em "Serviços apresentados".`);
  }
  return items;
}
