import { validFlyerItems } from '../../../supabase/functions/_shared/flyerItemsContract';
import type { QuotationFlyerModel } from '../../../src/services/quotationFlyerService';
import { renderPackageFlyerMarkup } from '../../../src/services/packageFlyerMarkup';
import { renderQuotationFlyerMarkup } from '../../../src/services/quotationFlyerMarkup';

/**
 * Documento do renderer: validação dos modelos e composição do HTML dos dois
 * templates. Fica separado do entrypoint do worker para ser testável em Node,
 * sem imports de CSS, fontes ou imagens.
 */

export type FlyerTemplate = 'package' | 'quotation';

export type FlyerImage = { mimeType: 'image/png' | 'image/jpeg'; data: string };

/** O modelo de pacote não traz `template`: o discriminador é do envelope. */
export type ItemKind = 'air' | 'transport' | 'accommodation' | 'transfer' | 'insurance' | 'additional';
export interface PackageRenderModel {
  version: 1;
  origin: string;
  destination: string;
  period: string;
  price: { amount: number; currency: 'BRL' | 'EUR'; formatted: string };
  items: Array<{ kind: ItemKind; label: string }>;
  paymentConditions?: string;
  subtitle: string;
}

/** A imagem entra pelo envelope; não é aceite dentro do modelo. */
export type QuotationRenderModel = Omit<QuotationFlyerModel, 'imageUrl'>;

export interface RenderRequest {
  template: FlyerTemplate;
  model: PackageRenderModel | QuotationRenderModel;
  image: FlyerImage;
}

export interface FlyerAssets {
  tokens: string;
  packageStyles: string;
  quotationStyles: string;
  logo: ArrayBuffer;
  fonts: { regular: ArrayBuffer; semibold: ArrayBuffer; bold: ArrayBuffer };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean =>
  Object.keys(value).every(key => allowed.includes(key));

const text = (value: unknown, min: number, max: number): value is string =>
  typeof value === 'string' && value.length >= min && value.length <= max;

const optionalText = (value: unknown, max: number): boolean =>
  value === undefined || text(value, 1, max);

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const MONEY_KEYS = ['amount', 'currency', 'formatted'] as const;
const ITEM_KINDS = new Set<ItemKind>(['air', 'transport', 'accommodation', 'transfer', 'insurance', 'additional']);
const LEG_KEYS = ['carrier', 'date', 'route', 'departureTime', 'arrivalTime', 'fareLabel', 'baggage'] as const;
const LODGING_KEYS = ['name', 'dateRange', 'nights', 'mealPlan'] as const;

function validMoney(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, MONEY_KEYS)) return false;
  return typeof value.amount === 'number' && Number.isFinite(value.amount) && value.amount > 0 &&
    (value.currency === 'BRL' || value.currency === 'EUR') &&
    typeof value.formatted === 'string' && value.formatted.length <= 20;
}

function validTransportLeg(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, LEG_KEYS)) return false;
  return text(value.carrier, 1, 40) && text(value.date, 1, 10) && text(value.route, 1, 30) &&
    optionalText(value.departureTime, 5) && optionalText(value.arrivalTime, 5) &&
    optionalText(value.fareLabel, 60) && optionalText(value.baggage, 60);
}

function validTransport(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['outbound', 'inbound'])) return false;
  return validTransportLeg(value.outbound) && validTransportLeg(value.inbound);
}

function validLodging(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, LODGING_KEYS)) return false;
  return text(value.name, 1, 60) && text(value.dateRange, 1, 30) && text(value.nights, 1, 20) &&
    optionalText(value.mealPlan, 40);
}

/** Mesma rigidez do modelo de pacote: chaves permitidas, limites e tipos. */
export function validPackageModel(value: unknown): value is PackageRenderModel {
  if (!isRecord(value)) return false;
  const price = value.price;
  const items = value.items;
  const allowed = ['version', 'origin', 'destination', 'period', 'price', 'items', 'paymentConditions', 'subtitle'];
  if (!hasOnlyKeys(value, allowed) || value.version !== 1) return false;
  if (!text(value.origin, 2, 45) || !text(value.destination, 2, 45) || !text(value.period, 0, 70) ||
      !text(value.subtitle, 3, 100)) return false;
  if (!isRecord(price) || !hasOnlyKeys(price, MONEY_KEYS) ||
      typeof price.amount !== 'number' || !Number.isFinite(price.amount) || price.amount <= 0 ||
      (price.currency !== 'BRL' && price.currency !== 'EUR') ||
      typeof price.formatted !== 'string' || price.formatted.length > 20) return false;
  if (!Array.isArray(items) || items.length > 6) return false;
  if (!items.every(item => isRecord(item) && hasOnlyKeys(item, ['kind', 'label']) &&
      ITEM_KINDS.has(item.kind as ItemKind) && text(item.label, 1, 40))) return false;
  return optionalText(value.paymentConditions, 100);
}

/** Modelo da cotação: mesmas chaves do contrato, sem discriminador nem imagem. */
export function validQuotationModel(value: unknown): value is QuotationRenderModel {
  if (!isRecord(value)) return false;
  const allowed = [
    'version', 'template', 'clientName', 'proposalDate', 'subtitle', 'origin', 'destination', 'dates',
    'passengers', 'transport', 'lodging', 'included', 'notIncluded', 'price', 'deposit', 'balanceDueDate',
  ];
  if (!hasOnlyKeys(value, allowed) || value.version !== 1 || value.template !== 'quotation') return false;
  if (typeof value.clientName !== 'string' || value.clientName.length < 1 || value.clientName.length > 60 ||
      CONTROL_CHARS.test(value.clientName)) return false;
  if (!text(value.proposalDate, 1, 10) || !text(value.origin, 2, 45) || !text(value.destination, 2, 45) ||
      value.origin.length + value.destination.length > 55) return false;
  if (value.subtitle !== undefined && !text(value.subtitle, 3, 100)) return false;

  const dates = value.dates;
  if (!isRecord(dates) || !hasOnlyKeys(dates, ['period', 'start', 'end']) ||
      !text(dates.period, 0, 40) || !text(dates.start, 1, 10) || !text(dates.end, 1, 10)) return false;

  const passengers = value.passengers;
  if (!isRecord(passengers) || !hasOnlyKeys(passengers, ['adults', 'children', 'infants', 'label']) ||
      !text(passengers.label, 1, 40)) return false;
  if (![passengers.adults, passengers.children, passengers.infants]
    .every(count => Number.isInteger(count) && (count as number) >= 0)) return false;

  if (value.transport !== null && !validTransport(value.transport)) return false;
  if (value.lodging !== null && !validLodging(value.lodging)) return false;
  if (!validFlyerItems(value.included)) return false;
  if (!Array.isArray(value.notIncluded) || value.notIncluded.length > 3 ||
      !value.notIncluded.every(line => text(line, 1, 100))) return false;

  const price = value.price;
  if (!isRecord(price) || !hasOnlyKeys(price, ['total', 'perPerson']) || !validMoney(price.total)) return false;
  if (price.perPerson !== undefined && !validMoney(price.perPerson)) return false;
  if (value.deposit !== undefined && !validMoney(value.deposit)) return false;
  return optionalText(value.balanceDueDate, 10);
}

export function validImage(value: unknown): value is FlyerImage {
  if (!isRecord(value)) return false;
  if ((value.mimeType !== 'image/png' && value.mimeType !== 'image/jpeg') ||
      typeof value.data !== 'string' || value.data.length > 8_000_000) return false;
  if (value.data.length < 16 || value.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.data)) return false;
  try {
    const bytes = Uint8Array.from(atob(value.data.slice(0, 32)), char => char.charCodeAt(0));
    return value.mimeType === 'image/png'
      ? bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      : bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  } catch { return false; }
}

/**
 * Valida o envelope `/render`. Sem `template`, assume `package` para manter o
 * contrato atual; chaves desconhecidas em qualquer nível são rejeitadas.
 */
export function parseRenderRequest(body: unknown): RenderRequest | null {
  if (!isRecord(body) || !hasOnlyKeys(body, ['template', 'model', 'image'])) return null;
  const template = body.template === undefined ? 'package' : body.template;
  if (template !== 'package' && template !== 'quotation') return null;
  if (!validImage(body.image)) return null;
  if (template === 'package') {
    return validPackageModel(body.model) ? { template, model: body.model, image: body.image } : null;
  }
  return validQuotationModel(body.model) ? { template, model: body.model, image: body.image } : null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

const dataUrl = (mime: string, bytes: ArrayBuffer) => `data:${mime};base64,${toBase64(new Uint8Array(bytes))}`;

/** Documento autónomo: fontes, tokens, CSS do template e imagem embutidos. */
export function createHtml(
  template: FlyerTemplate,
  model: PackageRenderModel | QuotationRenderModel,
  image: FlyerImage,
  assets: FlyerAssets,
): string {
  const imageUrl = `data:${image.mimeType};base64,${image.data}`;
  const logo = dataUrl('image/png', assets.logo);
  const regular = dataUrl('font/ttf', assets.fonts.regular);
  const semibold = dataUrl('font/ttf', assets.fonts.semibold);
  const bold = dataUrl('font/ttf', assets.fonts.bold);
  const tokens = assets.tokens.replace(/@font-face\s*\{[^}]*\}/g, '');
  const fonts = [[400, regular], [600, semibold], [700, bold]]
    .map(([weight, source]) => `@font-face{font-family:Poppins;src:url("${source}") format("truetype");font-weight:${weight};font-style:normal;font-display:block;}`).join('\n');
  // O mesmo documento serve para o PNG 1080x1920 e para o HTML descarregado.
  // Em 1080x1920 a peça mede exatamente a viewport; em ecrãs menores encolhe
  // proporcionalmente (9:16), em vez de transbordar sem barra de scroll.
  const styles = template === 'quotation' ? assets.quotationStyles : assets.packageStyles;
  const layout = template === 'quotation'
    ? '.quotation-flyer{width:min(100vw,calc(100vh * 9 / 16));width:min(100vw,calc(100dvh * 9 / 16));height:auto;max-width:none}'
    : '.package-flyer{width:min(100vw,calc(100vh * 9 / 16));width:min(100vw,calc(100dvh * 9 / 16));height:auto;max-width:none}';
  const style = `${fonts}\n${tokens}\n${styles}\nhtml,body{margin:0;background:var(--color-inverse-bg)}body{display:flex;align-items:center;justify-content:center;min-height:100vh}${layout}`;
  const markup = template === 'quotation'
    ? renderQuotationFlyerMarkup({ ...(model as QuotationRenderModel), imageUrl }, logo)
    : renderPackageFlyerMarkup({ ...(model as PackageRenderModel), imageUrl }, logo);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'"><title>Lâmina S23 Travel</title><style>${style}</style></head><body>${markup}</body></html>`;
}
