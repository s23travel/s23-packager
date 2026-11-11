import type { FlyerItemKind } from '../../supabase/functions/_shared/flyerItemsContract.ts';

/**
 * Helpers de markup partilhados pela lâmina de pacote e pela proposta de
 * viagem. O markup produzido aqui é o mesmo que a lâmina de pacote já publica,
 * para a extração não alterar a peça existente.
 */

/** Escapa texto público antes de entrar no HTML da peça. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]!));
}

const ICON_PATHS: Record<FlyerItemKind, string> = {
  air: '<path d="M22 2 9 15M22 2l-7 20-4-9-9-4Z"/>',
  accommodation: '<path d="M3 19V7m0 8h18v4M3 11h16a2 2 0 0 1 2 2v2M7 11V8h4a2 2 0 0 1 2 2v1"/>',
  insurance: '<path d="M12 2 4 5v6c0 5 3 8 8 11 5-3 8-6 8-11V5Z"/><path d="M12 7v8M8 11h8"/>',
  transfer: '<path d="M5 16 6 9h12l1 7M4 16h16v3H4zM7 9l2-4h6l2 4"/><path d="M7 19v2m10-2v2"/>',
  transport: '<path d="M5 16 6 9h12l1 7M4 16h16v3H4zM7 9l2-4h6l2 4"/><path d="M7 19v2m10-2v2"/>',
  additional: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
};

/** Ícone linear de traço 1.75 dos serviços apresentados. */
export function flyerIcon(kind: FlyerItemKind): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[kind]}</svg>`;
}

/**
 * Só aceita recursos de imagem embutidos ou blob local. O Chrome recusa data
 * URLs grandes em CSS `url()`, por isso a foto entra sempre como `<img>`.
 */
export function safeFlyerImageUrl(value: string | undefined): string | undefined {
  return value && /^(?:data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}|blob:https?:\/\/[A-Za-z0-9./:_-]+)$/.test(value)
    ? value
    : undefined;
}

/** Foto de fundo da peça; sem imagem segura devolve string vazia. */
export function flyerPhoto(imageUrl: string | undefined, className: string): string {
  const safe = safeFlyerImageUrl(imageUrl);
  return safe ? `<img class="${className}" src="${escapeHtml(safe)}" alt="" />` : '';
}

/** Logo circular S23 (borda opcional via classe). */
export function flyerLogo(logoUrl: string, className?: string): string {
  const attribute = className ? ` class="${className}"` : '';
  return `<img${attribute} src="${escapeHtml(logoUrl)}" alt="S23 Travel"/>`;
}
