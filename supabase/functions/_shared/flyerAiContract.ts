/** Dados não aprovados: a operadora deve revisar imagem e texto antes de publicar. */
export interface FlyerAiInput { destination: string }
export interface FlyerAiSuggestion {
  subtitle: string;
  image: { mimeType: 'image/png' | 'image/jpeg'; data: string };
}

export function validDestination(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 80 &&
    /^[\p{L}\p{M}][\p{L}\p{M} .,'’()\-]*$/u.test(value.trim());
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
