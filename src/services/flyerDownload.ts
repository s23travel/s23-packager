/** Formatos de download da lâmina salva: o servidor guarda PNG/HTML; o JPG é convertido no cliente. */
export type FlyerDownloadFormat = 'html' | 'png' | 'jpg';

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

/** Converte o PNG devolvido pelo servidor em JPG; falha em vez de rotular mal o ficheiro. */
export async function convertPngToJpg(png: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(png);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a conversão para JPG.');
    context.drawImage(bitmap, 0, 0);
    const jpg = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(image => image ? resolve(image) : reject(new Error('Não foi possível converter a lâmina para JPG.')), 'image/jpeg', 0.92);
    });
    if (jpg.type !== 'image/jpeg') throw new Error('A lâmina não foi convertida para JPG.');
    return jpg;
  } finally {
    bitmap.close();
  }
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
