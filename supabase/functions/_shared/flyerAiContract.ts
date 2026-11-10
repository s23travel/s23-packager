/** Dados não aprovados: a operadora deve revisar imagem e texto antes de publicar. */
export interface FlyerAiInput {
  destination: string;
  /** Indicação opcional da operadora: orienta apenas o assunto da imagem. */
  hint?: string;
}
export interface FlyerAiSuggestion {
  subtitle: string;
  image: { mimeType: 'image/png' | 'image/jpeg'; data: string };
}

/** Acima deste tamanho a indicação deixa de orientar o assunto e vira instrução. */
export const HINT_MAX_LENGTH = 200;

export function validDestination(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 80 &&
    /^[\p{L}\p{M}][\p{L}\p{M} .,'’()\-]*$/u.test(value.trim());
}

/** Alfabeto da indicação: texto livre de uma linha, sem símbolos que montem prompt. */
export function validHint(value: unknown): value is string {
  return typeof value === 'string' && value === value.trim() && value.length >= 3 &&
    value.length <= HINT_MAX_LENGTH && /^[\p{L}\p{M}\p{N} .,'’()\/&:-]+$/u.test(value);
}

/** Mantém o campo aceito pelo contrato enquanto a operadora digita. */
export function sanitizeHint(value: string): string {
  return value.replace(/[^\p{L}\p{M}\p{N} .,'’()\/&:-]/gu, '').replace(/\s+/gu, ' ').slice(0, HINT_MAX_LENGTH);
}

export function validSubtitle(value: unknown): value is string {
  if (typeof value !== 'string' || value !== value.trim() || value.length < 3 || value.length > 100) return false;
  if (!/^[\p{L}\p{M} ,.!?\-’']+$/u.test(value)) return false;
  // Reduz afirmações comerciais óbvias; não substitui a revisão humana.
  return !/\b(pre[çc]o|valor|parcela|juros|inclus[oa]s?|inclu[ií]d[oa]s?|gr[aá]tis|hospedagem|hotel|voos?|a[eé]reo|transfer|seguro|passagens?|di[aá]rias?|caf[eé] da manh[aã]|all inclusive|sem custo)\b/iu.test(value);
}

export function validImage(value: unknown): value is FlyerAiSuggestion['image'] {
  if (!value || typeof value !== 'object') return false;
  const image = value as Record<string, unknown>;
  if (image.mimeType !== 'image/png' && image.mimeType !== 'image/jpeg') return false;
  const data = image.data;
  if (typeof data !== 'string' || data.length < 16 || data.length > 8 * 1024 * 1024 || data.length % 4 !== 0) return false;
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  if (/[^A-Za-z0-9+/]/.test(data.slice(0, data.length - padding))) return false;
  try {
    const prefix = atob(data.slice(0, 16));
    return image.mimeType === 'image/png'
      ? prefix.startsWith('\x89PNG\r\n\x1a\n')
      : prefix.startsWith('\xff\xd8\xff');
  } catch { return false; }
}
