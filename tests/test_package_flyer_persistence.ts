import assert from 'node:assert/strict';
import { createPackageFlyerServerModel } from '../supabase/functions/_shared/packageFlyerModel.ts';
import { createPackageFlyerHandler } from '../supabase/functions/package-flyer/handler.ts';
import { renderPackageFlyerMarkup } from '../src/services/packageFlyerMarkup.ts';
import { createPackageFlyer } from '../src/services/packageFlyerService.ts';
import type { Package } from '../src/types/index.ts';

const packageId = '73d2084a-c853-40d5-9c76-ade4d0a8ca5f';
const requestId = '4116a000-a3a6-4883-b59a-62e393204deb';
const requestId2 = '5116a000-a3a6-4883-b59a-62e393204deb';
const updatedAt = '2026-11-09T12:00:00.000Z';
const packageRecord = {
  id: packageId,
  updated_at: updatedAt,
  base_currency: 'BRL',
  data: {
    origin: 'São Paulo', destination: 'Açores',
    dates: { startDate: '2027-04-12', endDate: '2027-04-19' },
    passengers: { adults: 2, children: 0 },
    financials: { currency: 'BRL', salePrice: 1500, pricePerPerson: 750, priceTotal: { amount: 1500, currency: 'BRL' } },
    paymentConditions: '10x no cartão',
    services: [
      { type: 'outbound_transport', description: 'Voo internacional' },
      { type: 'accommodation', description: 'Hospedagem', mealPlan: 'BB' },
    ],
  },
};

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const image = { mimeType: 'image/png', data: toBase64(png(1080, 1920)) } as const;
const renderPng = toBase64(png(1080, 1920));
const renderHtml = '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head><body>Fixture</body></html>';

function createHarness(options: {
  authorized?: boolean;
  beginStatus?: string;
  beginSequence?: string[];
  publishStatus?: string;
  renderHtml?: string;
  storageStatus?: number;
  existingStorage?: Uint8Array;
} = {}) {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const stored = new Map<string, Uint8Array>();
  let beginCount = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method || 'GET';
    let body: unknown;
    if (typeof init?.body === 'string') { try { body = JSON.parse(init.body); } catch { body = init.body; } }
    calls.push({ url, method, body });
    if (url.includes('/rest/v1/packages?')) return Response.json([packageRecord]);
    if (url.includes('/rpc/begin_package_flyer_upload')) {
      const status = options.beginSequence?.[beginCount++] || options.beginStatus || 'ready';
      return Response.json(status === 'conflict'
      ? { status: 'conflict' }
      : { status, html_path: `${packageId}/${requestId}.html`, png_path: `${packageId}/${requestId}.png`, png_sha256: '0'.repeat(64) });
    }
    if (url.includes('/rpc/mark_package_flyer_uploaded')) return Response.json({ status: 'uploaded' });
    if (url.includes('/rpc/fail_package_flyer_upload')) return Response.json({ status: 'failed' });
    if (url.includes('/rpc/publish_package_flyer')) return Response.json({ status: options.publishStatus || 'published', revision: 2 });
    if (url.includes('/rest/v1/package_flyer_attachments')) return Response.json([]);
    if (url.includes('/rest/v1/package_flyer_operations')) return Response.json([]);
    if (url.endsWith('/render')) return Response.json({ version: 's23-flyer-v1', html: options.renderHtml || renderHtml, png: renderPng });
    if (url.includes('/storage/v1/object/authenticated/')) {
      const path = url.split('/').slice(-2).join('/');
      const bytes = stored.get(path) || options.existingStorage;
      return bytes ? new Response(bytes) : new Response('missing', { status: 404 });
    }
    if (url.includes('/storage/v1/object/s23-package-flyers/')) {
      if (options.storageStatus) return new Response('failed', { status: options.storageStatus });
      const path = url.split('/').slice(-2).join('/');
      stored.set(path, new Uint8Array(init?.body as Uint8Array));
      return Response.json({ Key: path });
    }
    throw new Error(`Unexpected mock request: ${method} ${url}`);
  };
  const handler = createPackageFlyerHandler({
    requireUser: async () => options.authorized === false ? new Response('unauthorized', { status: 401 }) : null,
    getConfig: () => ({ url: 'https://supabase.example', anonKey: 'public-key', serviceKey: 'server-key', rendererUrl: 'https://renderer.example/render', rendererSecret: 'renderer-secret' }),
    fetch: fetcher,
  });
  return { handler, calls };
}

async function post(handler: (request: Request) => Promise<Response>, body: Record<string, unknown>) {
  return handler(new Request('https://edge.example/package-flyer', {
    method: 'POST', headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
}

const basePreview = { action: 'preview', packageId, expectedRevision: 0, requestId, image, subtitle: 'Uma viagem entre mar e montanha' };

async function run() {
  const modelResult = createPackageFlyerServerModel(packageRecord, 'Uma viagem entre mar e montanha');
  assert.equal(modelResult.errors.length, 0);
  assert.deepEqual(modelResult.model, { ...createPackageFlyer(packageRecord as Package).model!, subtitle: 'Uma viagem entre mar e montanha' });
  assert.equal(modelResult.model?.period, '12 a 19 de abril de 2027');
  assert.equal(modelResult.model?.price.formatted, 'R$ 750,00');
  assert.equal(modelResult.model?.items[0].label, 'Aéreo');
  assert.equal(modelResult.model?.subtitle, 'Uma viagem entre mar e montanha');
  assert.equal(createPackageFlyerServerModel({ ...packageRecord, data: { ...packageRecord.data, financials: { ...packageRecord.data.financials, pricePerPerson: 999 } } }, 'Uma viagem entre mar e montanha').model, null);

  const html = renderPackageFlyerMarkup({ ...modelResult.model!, origin: '<img src=x onerror=alert(1)>', imageUrl: 'javascript:alert(1)' }, 'data:image/png;base64,AA==');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('javascript:alert(1)'));
  assert.ok(!html.includes('package-flyer__photo'), 'URL inválida não deve virar foto de fundo');

  const bigImage = `data:image/png;base64,${'A'.repeat(3 * 1024 * 1024)}`;
  const withPhoto = renderPackageFlyerMarkup({ ...modelResult.model!, imageUrl: bigImage }, 'data:image/png;base64,AA==');
  assert.ok(withPhoto.includes('<img class="package-flyer__photo"'), 'foto deve entrar como elemento img');
  assert.ok(!withPhoto.includes('package-flyer__scrim'), 'foto não deve receber véu por cima');
  assert.ok(!withPhoto.includes('background-image'), 'foto não deve depender de CSS url()');

  const { handler: unauthorized, calls: unauthorizedCalls } = createHarness({ authorized: false });
  assert.equal((await post(unauthorized, basePreview)).status, 401);
  assert.equal(unauthorizedCalls.length, 0);

  const { handler: tooSmall } = createHarness();
  assert.equal((await post(tooSmall, { ...basePreview, image: { mimeType: 'image/png', data: toBase64(png(10, 10)) } })).status, 400);

  const { handler: forged } = createHarness();
  assert.equal((await post(forged, { ...basePreview, price: 0 })).status, 400);

  const previewHarness = createHarness();
  const previewResponse = await post(previewHarness.handler, basePreview);
  assert.equal(previewResponse.status, 200);
  const previewData = await previewResponse.json() as { preview: string; requestId: string };
  assert.equal(previewData.requestId, requestId);
  assert.equal(previewData.preview, renderPng);
  assert.equal(previewHarness.calls.filter(call => call.url.includes('/render')).length, 1);
  assert.equal(previewHarness.calls.some(call => call.url.includes('/rpc/publish_package_flyer')), false);
  const rendererCall = previewHarness.calls.find(call => call.url.includes('/render'))!;
  assert.deepEqual((rendererCall.body as { model: unknown }).model, modelResult.model);
  assert.equal(previewHarness.calls.filter(call => call.url.includes('/storage/v1/object/s23-package-flyers/')).length, 2);

  const { handler: injection, calls: injectionCalls } = createHarness({ renderHtml: '<!doctype html><script>alert(1)</script>' });
  assert.equal((await post(injection, basePreview)).status, 502);
  assert.equal(injectionCalls.some(call => call.url.includes('/rpc/fail_package_flyer_upload')), true);
  assert.equal(injectionCalls.some(call => call.url.includes('/rpc/publish_package_flyer')), false);

  const { handler: conflict, calls: conflictCalls } = createHarness({ beginStatus: 'conflict' });
  assert.equal((await post(conflict, basePreview)).status, 409);
  assert.equal(conflictCalls.some(call => call.url.includes('/render')), false);

  const concurrent = createHarness({ beginSequence: ['ready', 'conflict'] });
  const [firstAttempt, secondAttempt] = await Promise.all([
    post(concurrent.handler, basePreview),
    post(concurrent.handler, { ...basePreview, requestId: requestId2 }),
  ]);
  assert.deepEqual([firstAttempt.status, secondAttempt.status].sort(), [200, 409]);
  assert.equal(concurrent.calls.filter(call => call.url.includes('/render')).length, 1);

  const publishHarness = createHarness({ publishStatus: 'idempotent' });
  const publish = await post(publishHarness.handler, { action: 'publish', packageId, expectedRevision: 0, requestId });
  assert.equal(publish.status, 200);
  assert.equal((await publish.json() as { saved: boolean }).saved, true);
  assert.equal(publishHarness.calls.some(call => call.url.includes('/render')), false);
  assert.equal(publishHarness.calls.some(call => call.url.includes('/storage/v1/object/s23-package-flyers/')), false);

  const publishConflict = createHarness({ publishStatus: 'conflict' });
  assert.equal((await post(publishConflict.handler, { action: 'publish', packageId, expectedRevision: 0, requestId })).status, 409);

  const { handler: storageFailure, calls: storageFailureCalls } = createHarness({ storageStatus: 500 });
  assert.equal((await post(storageFailure, basePreview)).status, 502);
  assert.equal(storageFailureCalls.some(call => call.url.includes('/rpc/fail_package_flyer_upload')), true);
  assert.equal(storageFailureCalls.some(call => call.url.includes('/rpc/publish_package_flyer')), false);

  console.log('package flyer persistence tests passed');
}

run();
