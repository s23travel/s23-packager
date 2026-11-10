/**
 * Contrato dos itens públicos da lâmina ("Serviços apresentados").
 * Partilhado entre a SPA e a Edge Function: o mesmo limite e as mesmas regras
 * de texto valem na prévia local e no modelo canônico do servidor.
 */

export const FLYER_ITEM_KINDS = [
  'air',
  'transport',
  'accommodation',
  'transfer',
  'insurance',
  'additional',
] as const;

export type FlyerItemKind = typeof FLYER_ITEM_KINDS[number];

export interface FlyerItem {
  kind: FlyerItemKind;
  label: string;
}

export const FLYER_ITEMS_MAX = 6;
export const FLYER_ITEM_LABEL_MAX = 40;

/** Termos operacionais que nunca podem ser divulgados. */
const INTERNAL_TERMS = /\b(?:custos?|lucros?|margem|margens|comiss[aã]o|comiss[oõ]es|fornecedor(?:es)?|supplier|confidencial|sigilos[oa]s?|intern[oa]s?)\b/iu;
/** Valores, moedas e percentagens não cabem numa lista de serviços. */
const PRICE = /(?:R\$|€|\$|£|\b(?:eur|brl|usd|reais|euros)\b|\d\s?%)/iu;
/** Contactos e links também não. */
const CONTACT = /(?:@|https?:\/\/|www\.|\+?\d[\d\s().-]{7,}\d)/iu;

/** Remove espaços a mais e caracteres de controlo, sem alterar o texto comercial. */
export function normalizeItemLabel(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Problemas de conteúdo; o tamanho é avaliado à parte, para não omitir em silêncio. */
export function itemContentProblem(label: string): string | null {
  if (INTERNAL_TERMS.test(label)) return 'Retire termos internos como fornecedor, custo ou margem.';
  if (PRICE.test(label)) return 'Não inclua preços, valores ou percentagens.';
  if (CONTACT.test(label)) return 'Não inclua contactos, links ou e-mails.';
  return null;
}

/** Mensagem do primeiro problema do rótulo, ou null quando está pronto a publicar. */
export function itemLabelProblem(label: string): string | null {
  if (!label) return 'Escreva o serviço ou remova esta linha.';
  if (label.length > FLYER_ITEM_LABEL_MAX) {
    return `Use até ${FLYER_ITEM_LABEL_MAX} caracteres (tem ${label.length}).`;
  }
  return itemContentProblem(label);
}

/** Validação server-side do campo `items` revisto pela operadora. */
export function validFlyerItems(value: unknown): value is FlyerItem[] {
  if (!Array.isArray(value) || value.length > FLYER_ITEMS_MAX) return false;
  return value.every(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const candidate = item as Record<string, unknown>;
    if (Object.keys(candidate).some(key => key !== 'kind' && key !== 'label')) return false;
    if (!FLYER_ITEM_KINDS.includes(candidate.kind as FlyerItemKind)) return false;
    if (typeof candidate.label !== 'string') return false;
    return normalizeItemLabel(candidate.label) === candidate.label && itemLabelProblem(candidate.label) === null;
  });
}
