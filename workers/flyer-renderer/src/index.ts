import travelTokens from '../../../design-system/s23-travel/colors_and_type.css';
import packageStyles from '../../../src/components/packages/packageFlyer.css';
import quotationStyles from '../../../src/components/quotes/quotationFlyer.css';
import logoBytes from '../../../design-system/s23-travel/assets/Logo Secundário Redondo.png';
import regularFont from '../../../design-system/s23-travel/fonts/Poppins/Poppins-Regular.ttf';
import semiboldFont from '../../../design-system/s23-travel/fonts/Poppins/Poppins-SemiBold.ttf';
import boldFont from '../../../design-system/s23-travel/fonts/Poppins/Poppins-Bold.ttf';
import { createHtml, parseRenderRequest, type FlyerAssets } from './flyerDocument';

interface BrowserRun {
  quickAction(action: 'screenshot', options: Record<string, unknown>): Promise<Response>;
}

interface Env {
  BROWSER: BrowserRun;
  RENDERER_SHARED_SECRET?: string;
  CLEANUP_FUNCTION_URL?: string;
  CLEANUP_SHARED_SECRET?: string;
}

// Assets embutidos uma vez por isolate; os dois templates partilham tokens e fontes.
const assets: FlyerAssets = {
  tokens: travelTokens,
  packageStyles,
  quotationStyles,
  logo: logoBytes,
  fonts: { regular: regularFont, semibold: semiboldFont, bold: boldFont },
};

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

async function render(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST' || new URL(request.url).pathname !== '/render') return json({ error: 'NOT_FOUND' }, 404);
  if (!equalSecret(request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null, env.RENDERER_SHARED_SECRET)) {
    return json({ error: 'UNAUTHORIZED' }, 401);
  }
  let body: unknown;
  try { body = JSON.parse(await readLimited(request, MAX_REQUEST_BYTES)); }
  catch (error) { return json({ error: error instanceof Error && error.message === 'too_large' ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON' }, 400); }
  const input = parseRenderRequest(body);
  if (!input) return json({ error: 'INVALID_INPUT' }, 400);

  try {
    const html = createHtml(input.template, input.model, input.image, assets);
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
