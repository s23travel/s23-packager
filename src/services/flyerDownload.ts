/** Formatos de download da lâmina salva: o servidor guarda PNG/HTML e a imagem é entregue sem recompressão. */
export type FlyerDownloadFormat = 'html' | 'png';

/** Reduz um trecho a slug seguro para nome de ficheiro (sem acentos nem pontuação). */
export function sanitizeFlyerFilePart(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Nome do ficheiro no padrão `prefixo-destino.ext`; usado pelo pacote
 * (`lamina-…`) e pela cotação (`lamina-cotacao-…`).
 */
export function flyerDownloadName(prefix: string, parts: string[], format: FlyerDownloadFormat): string {
  const subject = parts.map(sanitizeFlyerFilePart).filter(Boolean).join('-') || 'viagem';
  return `${sanitizeFlyerFilePart(prefix) || 'lamina'}-${subject}.${format}`;
}

/** Entrega o Blob ao browser e mantém o registo dos URLs temporários para revogação. */
export function triggerFlyerDownload(blob: Blob, fileName: string, trackedUrls?: Set<string>): void {
  const url = URL.createObjectURL(blob);
  trackedUrls?.add(url);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => { URL.revokeObjectURL(url); trackedUrls?.delete(url); }, 1000);
}
