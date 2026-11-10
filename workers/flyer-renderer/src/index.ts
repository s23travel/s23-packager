import travelTokens from '../../../design-system/s23-travel/colors_and_type.css';
import flyerStyles from '../../../src/components/packages/packageFlyer.css';
import logoBytes from '../../../design-system/s23-travel/assets/Logo Secundário Redondo.png';
import regularFont from '../../../design-system/s23-travel/fonts/Poppins/Poppins-Regular.ttf';
import semiboldFont from '../../../design-system/s23-travel/fonts/Poppins/Poppins-SemiBold.ttf';
import boldFont from '../../../design-system/s23-travel/fonts/Poppins/Poppins-Bold.ttf';
import { renderPackageFlyerMarkup } from '../../../src/services/packageFlyerMarkup';

interface BrowserRun {
  quickAction(action: 'screenshot', options: Record<string, unknown>): Promise<Response>;
}

interface Env {
  BROWSER: BrowserRun;
  RENDERER_SHARED_SECRET?: string;
  CLEANUP_FUNCTION_URL?: string;
  CLEANUP_SHARED_SECRET?: string;
}

type ItemKind = 'air' | 'transport' | 'accommodation' | 'transfer' | 'insurance' | 'additional';
interface RenderModel {
  version: 1;
  origin: string;
  destination: string;
  period: string;
  price: { amount: number; currency: 'BRL' | 'EUR'; formatted: string };
  items: Array<{ kind: ItemKind; label: string }>;
  paymentConditions?: string;
  subtitle: string;
}

const MAX_REQUEST_BYTES = 9 * 1024 * 1024;
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: JSON_HEADERS });

function equalSecret(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index++) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

async function readLimited(request: Request, limit: number): Promise<string> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) throw new Error('too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('empty');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('too_large');
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

const dataUrl = (mime: string, bytes: ArrayBuffer) => `data:${mime};base64,${toBase64(new Uint8Array(bytes))}`;

function validModel(value: unknown): value is RenderModel {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const model = value as Record<string, unknown>;
  const price = model.price as Record<string, unknown> | null;
  const items = model.items;
  const allowed = new Set(['version', 'origin', 'destination', 'period', 'price', 'items', 'paymentConditions', 'subtitle']);
  if (Object.keys(model).some(key => !allowed.has(key)) || model.version !== 1) return false;
  if (typeof model.origin !== 'string' || model.origin.length < 2 || model.origin.length > 45 ||
      typeof model.destination !== 'string' || model.destination.length < 2 || model.destination.length > 45 ||
      typeof model.period !== 'string' || model.period.length > 70 || typeof model.subtitle !== 'string' ||
      model.subtitle.length < 3 || model.subtitle.length > 100) return false;
  if (!price || typeof price !== 'object' || Object.keys(price).some(key => !['amount', 'currency', 'formatted'].includes(key)) ||
      typeof price.amount !== 'number' || !Number.isFinite(price.amount) || price.amount <= 0 ||
      (price.currency !== 'BRL' && price.currency !== 'EUR') || typeof price.formatted !== 'string' || price.formatted.length > 20) return false;
  if (!Array.isArray(items) || items.length > 6) return false;
  const kinds = new Set<ItemKind>(['air', 'transport', 'accommodation', 'transfer', 'insurance', 'additional']);
  if (!items.every(item => item && typeof item === 'object' && Object.keys(item).every(key => key === 'kind' || key === 'label') &&
      kinds.has(item.kind) && typeof item.label === 'string' && item.label.length > 0 && item.label.length <= 40)) return false;
  return model.paymentConditions === undefined || (typeof model.paymentConditions === 'string' && model.paymentConditions.length <= 100);
}

function validImage(value: unknown): value is { mimeType: 'image/png' | 'image/jpeg'; data: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const image = value as Record<string, unknown>;
  if ((image.mimeType !== 'image/png' && image.mimeType !== 'image/jpeg') || typeof image.data !== 'string' || image.data.length > 8_000_000) return false;
  if (image.data.length < 16 || image.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)) return false;
  try {
    const bytes = Uint8Array.from(atob(image.data.slice(0, 32)), char => char.charCodeAt(0));
    return image.mimeType === 'image/png'
      ? bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      : bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  } catch { return false; }
}

export function createHtml(model: RenderModel, image: { mimeType: 'image/png' | 'image/jpeg'; data: string }): string {
  const flyerModel = { ...model, imageUrl: `data:${image.mimeType};base64,${image.data}` };
  const logo = dataUrl('image/png', logoBytes);
  const regular = dataUrl('font/ttf', regularFont);
  const semibold = dataUrl('font/ttf', semiboldFont);
  const bold = dataUrl('font/ttf', boldFont);
  const tokens = travelTokens.replace(/@font-face\s*\{[^}]*\}/g, '');
  const fonts = [[400, regular], [600, semibold], [700, bold]]
    .map(([weight, source]) => `@font-face{font-family:Poppins;src:url("${source}") format("truetype");font-weight:${weight};font-style:normal;font-display:block;}`).join('\n');
  // O mesmo documento serve para o PNG 1080x1920 e para o HTML descarregado.
  // Em 1080x1920 a peça mede exatamente a viewport; em ecrãs menores encolhe
  // proporcionalmente (9:16), em vez de transbordar sem barra de scroll.
  const style = `${fonts}\n${tokens}\n${flyerStyles}\nhtml,body{margin:0;background:var(--color-inverse-bg)}body{display:flex;align-items:center;justify-content:center;min-height:100vh}.package-flyer{width:min(100vw,calc(100vh * 9 / 16));width:min(100vw,calc(100dvh * 9 / 16));height:auto;max-width:none}`;
  const markup = renderPackageFlyerMarkup(flyerModel, logo);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'"><title>Lâmina S23 Travel</title><style>${style}</style></head><body>${markup}</body></html>`;
}

async function render(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST' || new URL(request.url).pathname !== '/render') return json({ error: 'NOT_FOUND' }, 404);
  if (!equalSecret(request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null, env.RENDERER_SHARED_SECRET)) {
    return json({ error: 'UNAUTHORIZED' }, 401);
  }
  let body: unknown;
  try { body = JSON.parse(await readLimited(request, MAX_REQUEST_BYTES)); }
  catch (error) { return json({ error: error instanceof Error && error.message === 'too_large' ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'model' && key !== 'image')) {
    return json({ error: 'INVALID_INPUT' }, 400);
  }
  const input = body as { model?: unknown; image?: unknown };
  if (!validModel(input.model) || !validImage(input.image)) return json({ error: 'INVALID_INPUT' }, 400);

  try {
    const html = createHtml(input.model, input.image);
    const screenshot = await env.BROWSER.quickAction('screenshot', {
      html,
      setJavaScriptEnabled: false,
      viewport: { width: 1080, height: 1920, deviceScaleFactor: 1 },
      screenshotOptions: { type: 'png', fullPage: false },
      gotoOptions: { waitUntil: 'domcontentloaded', timeout: 30000 },
    });
    if (!screenshot.ok) return json({ error: 'RENDER_FAILED' }, 502);
    const png = new Uint8Array(await screenshot.arrayBuffer());
    if (png.length < 24 || png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47 ||
        new DataView(png.buffer, png.byteOffset, png.byteLength).getUint32(16) !== 1080 ||
        new DataView(png.buffer, png.byteOffset, png.byteLength).getUint32(20) !== 1920) {
      return json({ error: 'INVALID_RENDER_OUTPUT' }, 502);
    }
    return json({ version: 's23-flyer-v1', html, png: toBase64(png) });
  } catch {
    return json({ error: 'RENDER_FAILED' }, 502);
  }
}

async function scheduledCleanup(env: Env): Promise<void> {
  if (!env.CLEANUP_FUNCTION_URL || !env.CLEANUP_SHARED_SECRET) return;
  await fetch(env.CLEANUP_FUNCTION_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CLEANUP_SHARED_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'run' }),
  });
}

export default {
  fetch(request: Request, env: Env) { return render(request, env); },
  scheduled(_controller: ScheduledController, env: Env, context: ExecutionContext) {
    context.waitUntil(scheduledCleanup(env));
  },
};
