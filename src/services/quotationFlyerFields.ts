import { roundMoney } from './financeService';

/**
 * Campos da proposta de viagem usados pela lâmina de cotação.
 * `proposalDate` e `balanceDueDate` são ISO `YYYY-MM-DD`;
 * `depositAmount` está na moeda da cotação.
 */
export interface QuotationFlyerFields {
  proposalDate?: string;
  depositAmount?: number;
  balanceDueDate?: string;
  notIncluded?: string[];
}

export const NOT_INCLUDED_MAX_ITEMS = 3;
export const NOT_INCLUDED_MAX_LENGTH = 100;

const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Normaliza a lista de "Não incluído": remove espaços, descarta linhas vazias,
 * trunca cada linha em 100 caracteres e limita a lista a 3 itens.
 */
export function normalizeNotIncluded(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((line): line is string => typeof line === 'string')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.slice(0, NOT_INCLUDED_MAX_LENGTH))
    .slice(0, NOT_INCLUDED_MAX_ITEMS);
}

/**
 * Converte o valor do formulário em número (aceita vírgula decimal).
 * Negativos, vazios e valores não numéricos são descartados.
 */
export function parseDepositAmount(value: unknown): number | undefined {
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return undefined;
    return parseDepositAmount(Number(normalized));
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return roundMoney(value);
}

/**
 * Aviso não bloqueante quando o sinal ultrapassa o preço de venda.
 * Retorna `null` quando não há conflito ou quando falta um dos valores.
 */
export function depositOverSalePriceWarning(
  depositAmount?: number | null,
  salePrice?: number | null
): string | null {
  if (typeof depositAmount !== 'number' || typeof salePrice !== 'number') return null;
  if (!Number.isFinite(depositAmount) || !Number.isFinite(salePrice)) return null;
  if (depositAmount <= salePrice) return null;
  return 'O sinal é maior que o preço de venda. Revise os valores antes de enviar a proposta.';
}

function extractIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = ISO_DATE_PREFIX.exec(value.trim());
  if (!match) return undefined;

  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return undefined;
  }

  return `${year}-${month}-${day}`;
}

function localTodayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Resolve a data da cotação: o valor editado prevalece; sem ele, usa a data
 * da cotação (`created_at`); sem ambas, usa a data local de hoje.
 */
export function resolveProposalDate(
  proposalDate?: string | null,
  createdAt?: string | null
): string {
  return extractIsoDate(proposalDate) ?? extractIsoDate(createdAt) ?? localTodayIso();
}

/** Formata uma data ISO para o detalhe da cotação (`DD/MM/AAAA`). */
export function formatProposalDate(value?: string | null): string {
  const iso = extractIsoDate(value);
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/** Formata uma data-limite ISO para o detalhe (`DD/MM`). */
export function formatBalanceDueDate(value?: string | null): string {
  const iso = extractIsoDate(value);
  if (!iso) return '';
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}
