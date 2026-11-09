import { renderToStaticMarkup } from 'react-dom/server';
import { PackageFlyerTemplate } from '../components/packages/PackageFlyerTemplate';
import type { PackageFlyerModel } from './packageFlyerService';
import travelCss from '../../design-system/s23-travel/colors_and_type.css?raw';
import flyerCss from '../components/packages/packageFlyer.css?raw';
import logoUrl from '../../design-system/s23-travel/assets/Logo_Circulo.png';
import regularUrl from '../../design-system/s23-travel/fonts/Poppins/Poppins-Regular.ttf?url';
import semiboldUrl from '../../design-system/s23-travel/fonts/Poppins/Poppins-SemiBold.ttf?url';
import boldUrl from '../../design-system/s23-travel/fonts/Poppins/Poppins-Bold.ttf?url';

const WIDTH = 1080;
const HEIGHT = 1920;

async function resource(url: string, name: string, types: readonly string[]): Promise<string> {
  try {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) throw new Error('HTTP');
    const blob = await response.blob();
    const type = blob.type.toLowerCase().split(';')[0];
    if (!blob.size || !types.includes(type)) throw new Error('tipo');
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject();
      reader.onerror = () => reject();
      reader.readAsDataURL(blob);
    });
  } catch {
    throw new Error(`Não foi possível carregar ${name}. Verifique o recurso e tente novamente.`);
  }
}

async function checkImage(src: string, name: string): Promise<void> {
  try {
    const image = new Image();
    image.src = src;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('imagem vazia');
  } catch {
    throw new Error(`Não foi possível decodificar ${name}.`);
  }
}

async function createDocument(model: PackageFlyerModel): Promise<string> {
  if (!model.imageUrl) throw new Error('A imagem revisada da lâmina está indisponível.');
  const imageTypes = ['image/png', 'image/jpeg', 'image/webp'];
  const fontTypes = ['font/ttf', 'application/x-font-ttf', 'application/x-font-truetype', 'application/font-ttf', 'application/font-sfnt', 'application/octet-stream', 'font/sfnt'];
  const [image, logo, regular, semibold, bold] = await Promise.all([
    resource(model.imageUrl, 'a imagem da lâmina', imageTypes),
    resource(logoUrl, 'o logotipo', imageTypes),
    resource(regularUrl, 'a fonte Poppins', fontTypes),
    resource(semiboldUrl, 'a fonte Poppins', fontTypes),
    resource(boldUrl, 'a fonte Poppins', fontTypes),
  ]);
  await Promise.all([checkImage(image, 'a imagem da lâmina'), checkImage(logo, 'o logotipo')]);

  const markup = renderToStaticMarkup(<PackageFlyerTemplate model={{ ...model, imageUrl: image }} />);
  const parsed = new DOMParser().parseFromString(markup, 'text/html');
  const article = parsed.querySelector('article.package-flyer');
  const logoElement = article?.querySelector('img');
  if (!article || !logoElement) throw new Error('Não foi possível preparar o modelo da lâmina.');
  logoElement.src = logo;

  // As definições originais referem caminhos relativos. Os três pesos usados pelo
  // template são incorporados, preservando o restante dos tokens e estilos reais.
  const tokens = travelCss.replace(/@font-face\s*\{[^}]*\}/g, '');
  const fonts = [[400, regular], [600, semibold], [700, bold]]
    .map(([weight, data]) => `@font-face{font-family:Poppins;src:url("${data}") format("truetype");font-weight:${weight};font-style:normal;}`).join('\n');
  const style = `${fonts}\n${tokens}\n${flyerCss}\n.package-flyer{width:${WIDTH}px;height:${HEIGHT}px;}`;
  const content = new XMLSerializer().serializeToString(article);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'"><title>Lâmina S23 Travel</title><style>${style}</style></head><body>${content}</body></html>`;
}

async function inspect(html: string): Promise<void> {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1080px;height:1920px;border:0;visibility:hidden';
  try {
    const loaded = new Promise<void>((resolve, reject) => {
      frame.onload = () => resolve();
      frame.onerror = () => reject(new Error('Não foi possível preparar a lâmina para exportação.'));
    });
    frame.srcdoc = html;
    document.body.appendChild(frame);
    await loaded;
    const doc = frame.contentDocument;
    if (!doc || !frame.contentWindow) throw new Error('Não foi possível inspecionar a lâmina.');
    try {
      const loadedFonts = await Promise.all([400, 600, 700].map(weight => doc.fonts.load(`${weight} 32px Poppins`)));
      if (loadedFonts.some(fonts => !fonts.length || fonts.some(font => font.status !== 'loaded'))) throw new Error('fonte');
      await doc.fonts.ready;
    } catch {
      throw new Error('Não foi possível carregar a fonte Poppins para exportação.');
    }
    const article = doc.querySelector<HTMLElement>('.package-flyer');
    const safe = doc.querySelector<HTMLElement>('.package-flyer__safe');
    if (!article || !safe) throw new Error('Não foi possível inspecionar o modelo da lâmina.');
    const bounds = article.getBoundingClientRect();
    const area = safe.getBoundingClientRect();
    if (bounds.width !== WIDTH || bounds.height !== HEIGHT || area.top - bounds.top < 249 || bounds.bottom - area.bottom < 249) {
      throw new Error('A lâmina não respeita as dimensões ou margens de segurança.');
    }
    const children = Array.from(safe.children) as HTMLElement[];
    for (let i = 0; i < children.length; i++) {
      const box = children[i].getBoundingClientRect();
      if (box.left < area.left - 1 || box.right > area.right + 1 || box.top < area.top - 1 || box.bottom > area.bottom + 1 ||
          (i && box.top < children[i - 1].getBoundingClientRect().bottom - 1)) {
        throw new Error('O conteúdo não cabe nas margens da lâmina. Reduza o texto e revise a prévia.');
      }
    }
    for (const element of Array.from(safe.querySelectorAll<HTMLElement>('*'))) {
      if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml' || frame.contentWindow.getComputedStyle(element).display === 'inline') continue;
      // A métrica de Poppins pode ultrapassar alguns pixels da linha sem corte.
      if (element.scrollWidth > element.clientWidth + 16 || element.scrollHeight > element.clientHeight + 16) {
        throw new Error('O conteúdo da lâmina está cortado. Reduza o texto e revise a prévia.');
      }
    }
  } finally {
    frame.remove();
  }
}

/** Retorna o HTML autônomo, sem iniciar download ou alterar o modelo revisado. */
export async function createPackageFlyerHtml(model: PackageFlyerModel): Promise<Blob> {
  const html = await createDocument(model);
  await inspect(html);
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

/** Retorna um PNG de 1080 × 1920; falhas nunca produzem um arquivo parcial. */
export async function createPackageFlyerPng(model: PackageFlyerModel): Promise<Blob> {
  const html = await createDocument(model);
  await inspect(html);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const article = doc.querySelector('.package-flyer');
  const style = doc.querySelector('style');
  if (!article || !style) throw new Error('Não foi possível preparar o PNG da lâmina.');
  const content = new XMLSerializer().serializeToString(article);
  const css = (style.textContent || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${content}</div></foreignObject></svg>`;
  try {
    const image = new Image();
    // Chromium considera um SVG foreignObject em blob: como origem contaminada.
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas');
    context.drawImage(image, 0, 0);
    if (context.getImageData(0, 0, 1, 1).data[3] !== 255 ||
        context.getImageData(WIDTH - 1, HEIGHT - 1, 1, 1).data[3] !== 255) throw new Error('imagem incompleta');
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob || blob.type !== 'image/png') throw new Error('PNG');
    return blob;
  } catch {
    throw new Error('Não foi possível gerar o PNG da lâmina neste navegador.');
  }
}
