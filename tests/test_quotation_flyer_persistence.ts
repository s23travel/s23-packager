import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createFlyerCleanupHandler } from '../supabase/functions/_shared/flyerCleanup.ts';
import { createQuotationFlyerHandler } from '../supabase/functions/quotation-flyer/handler.ts';
import { createQuotationFlyerServerModel } from '../supabase/functions/_shared/quotationFlyerModel.ts';
import { createQuotationFlyer } from '../src/services/quotationFlyerService.ts';
import type { Quotation, ServiceItem } from '../src/types/index.ts';

const quotationId = 'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f601';
const requestId = 'b4116a00-a3a6-4883-b59a-62e393204deb';
const requestId2 = 'c5116a00-a3a6-4883-b59a-62e393204deb';
const updatedAt = '2026-11-11T09:30:00.000Z';

function transport(
  type: 'outbound_transport' | 'inbound_transport',
  description: string,
  times: { departureTime: string; arrivalTime: string },
): ServiceItem {
  return {
    id: type,
    type,
    description,
    currency: 'EUR',
    amount: 0,
    quantity: 1,
    carrier: 'easyJet',
    notes: 'Bagagem de mão incluída',
    ...times,
  };
}

/** Fixture inspirada na COT-2026-059, como no teste do modelo. */
const quotationRecord = {
  id: quotationId,
  package_id: null,
  reference: 'COT-2026-059',
  client_name: 'Sandra Colognesi',
  status: 'draft' as const,
  currency: 'EUR' as const,
  exchange_rate: null,
  exchange_rate_date: null,
  created_at: '2026-11-11T09:30:00Z',
  updated_at: updatedAt,
  archived_at: null,
  data: {
    origin: 'Porto',
    destination: 'Paris',
    proposalDate: '2026-11-11',
    dates: { startDate: '2027-04-02', endDate: '2027-04-05', durationDays: 4, durationNights: 3 },
    passengers: { adults: 2, children: 0, infants: 0 },
    depositAmount: 250,
    balanceDueDate: '2027-03-20',
    notIncluded: ['Taxa local de 34€ paga no hotel', 'Bagagem despachada'],
    paymentConditions: 'fornecedor secreto cobra 10x',
    localTaxNotes: 'Taxa local interna 34€',
    customNotes: 'Observação interna do consultor',
    financials: {
      currency: 'EUR' as const,
      components: [],
      totalCost: 400,
      salePrice: 700,
      pricePerPerson: 350,
      profit: 300,
      profitPercent: 42.86,
      taxesAndFeesTotal: 0,
    },
    services: [
      transport('outbound_transport', 'Voo de ida Porto (OPO) para Paris (ORY)', {
        departureTime: '08:10',
        arrivalTime: '11:05',
      }),
      transport('inbound_transport', 'Voo de volta Paris (ORY) para Porto (OPO)', {
        departureTime: '18:40',
        arrivalTime: '19:45',
      }),
      {
        id: 'hotel',
        type: 'accommodation' as const,
        description: 'Ibis Paris Alésia Montparnasse 14ème',
        currency: 'EUR' as const,
        amount: 0,
        quantity: 1,
        mealPlan: 'Café da manhã (BB)',
      },
    ],
  },
};

const subtitle = 'Paris na primavera entre cafés e avenidas';

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const image = { mimeType: 'image/png', data: toBase64(png(1080, 1920)) } as const;
const renderPng = toBase64(png(1080, 1920));
const renderHtml = '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head><body>Fixture</body></html>';
const basePreview = {
  action: 'preview',
  quotationId,
  expectedRevision: 0,
  requestId,
  image,
  subtitle,
};

function createHarness(options: {
  authorized?: boolean;
  beginStatus?: string;
  beginSequence?: string[];
  publishStatus?: string;
  renderHtml?: string;
  renderStatus?: number;
  storageStatus?: number;
  attachment?: Record<string, unknown> | null;
  operation?: Record<string, unknown> | null;
  stored?: Record<string, Uint8Array>;
  quotation?: Record<string, unknown>;
} = {}) {
  const calls: Array<{ url: string; method: string; body?: unknown; authorization?: string }> = [];
  const stored = new Map<string, Uint8Array>(Object.entries(options.stored || {}));
  let beginCount = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method || 'GET';
    let body: unknown;
    if (typeof init?.body === 'string') { try { body = JSON.parse(init.body); } catch { body = init.body; } }
    calls.push({ url, method, body, authorization: (init?.headers as Record<string, string> | undefined)?.Authorization });
    if (url.includes('/rest/v1/quotations?')) return Response.json([options.quotation || quotationRecord]);
    if (url.includes('/rpc/begin_quotation_flyer_upload')) {
      const status = options.beginSequence?.[beginCount++] || options.beginStatus || 'ready';
      return Response.json(status === 'conflict'
      ? { status: 'conflict' }
      : { status, html_path: `${quotationId}/${requestId}.html`, png_path: `${quotationId}/${requestId}.png`, png_sha256: sha256(png(1080, 1920)) });
    }
    if (url.includes('/rpc/mark_quotation_flyer_uploaded')) return Response.json({ status: 'uploaded' });
    if (url.includes('/rpc/fail_quotation_flyer_upload')) return Response.json({ status: 'failed' });
    if (url.includes('/rpc/publish_quotation_flyer')) return Response.json({ status: options.publishStatus || 'published', revision: 2 });
    if (url.includes('/rest/v1/quotation_flyer_attachments')) return Response.json(options.attachment ? [options.attachment] : []);
    if (url.includes('/rest/v1/quotation_flyer_operations')) return Response.json(options.operation ? [options.operation] : []);
    if (url.endsWith('/render')) {
      if (options.renderStatus) return new Response('failed', { status: options.renderStatus });
      return Response.json({ version: 's23-flyer-v1', html: options.renderHtml || renderHtml, png: renderPng });
    }
    if (url.includes('/storage/v1/object/authenticated/')) {
      const path = url.split('/').slice(-2).join('/');
      const bytes = stored.get(path);
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
  const handler = createQuotationFlyerHandler({
    requireUser: async () => options.authorized === false ? new Response('unauthorized', { status: 401 }) : null,
    getConfig: () => ({ url: 'https://supabase.example', anonKey: 'public-key', serviceKey: 'server-key', rendererUrl: 'https://renderer.example/render', rendererSecret: 'renderer-secret' }),
    fetch: fetcher,
  });
  return { handler, calls };
}

async function post(handler: (request: Request) => Promise<Response>, body: Record<string, unknown>) {
  return handler(new Request('https://edge.example/quotation-flyer', {
    method: 'POST', headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
}

async function run() {
  // 1. Modelo canônico do servidor a partir da linha persistida da cotação.
  const modelResult = createQuotationFlyerServerModel(quotationRecord as unknown as Quotation, subtitle);
  assert.equal(modelResult.errors.length, 0, `sem erros: ${modelResult.errors.join(' | ')}`);
  assert.ok(modelResult.model);
  assert.equal(modelResult.model?.template, 'quotation');
  assert.equal(modelResult.model?.clientName, 'Sandra Colognesi');
  assert.equal(modelResult.model?.proposalDate, '11/11/2026');
  assert.equal(modelResult.model?.destination, 'Paris');
  assert.equal(modelResult.model?.subtitle, subtitle);
  assert.equal(modelResult.model?.price.total.formatted, '€ 700,00');
  assert.equal(modelResult.model?.deposit?.formatted, '€ 250,00');
  assert.equal(modelResult.model?.balanceDueDate, '20/03');
  assert.deepEqual(modelResult.model?.included, [
    { kind: 'air', label: 'Aéreo' },
    { kind: 'accommodation', label: 'Hospedagem com café da manhã' },
  ]);
  assert.equal(JSON.stringify(modelResult.model).includes('fornecedor secreto'), false, 'sem copy interno');

  // 2. Serviços revistos pela operadora substituem a lista derivada.
  const reviewed = [
    { kind: 'air' as const, label: 'Aéreo' },
    { kind: 'additional' as const, label: 'Passeio de barco' },
  ];
  const reviewedModel = createQuotationFlyerServerModel(quotationRecord as unknown as Quotation, subtitle, reviewed);
  assert.equal(reviewedModel.errors.length, 0);
  assert.deepEqual(reviewedModel.model?.included, reviewed);

  // 3. Subtítulo e itens inválidos bloqueiam o modelo.
  assert.equal(createQuotationFlyerServerModel(quotationRecord as unknown as Quotation, 'promoção imperdível').model, null);
  assert.equal(
    createQuotationFlyerServerModel(quotationRecord as unknown as Quotation, subtitle, [{ kind: 'additional', label: 'Tour com fornecedor' }]).model,
    null,
  );
  assert.equal(
    createQuotationFlyerServerModel(quotationRecord as unknown as Quotation, subtitle, [{ kind: 'air', label: 'Aéreo', price: 10 }]).model,
    null,
  );
  // Dados obrigatórios em falta na cotação bloqueiam a prévia.
  assert.equal(
    createQuotationFlyerServerModel({ ...quotationRecord, client_name: null } as unknown as Quotation, subtitle).model,
    null,
  );

  const expectedModel = createQuotationFlyer(quotationRecord as unknown as Quotation).model!;

  // 4. `current`: lê o anexo pelo RPC/Data API com o JWT do utilizador.
  const currentHarness = createHarness();
  const currentResponse = await post(currentHarness.handler, { action: 'current', quotationId });
  assert.equal(currentResponse.status, 200);
  assert.deepEqual(await currentResponse.json(), { attachment: null });
  const ownerCall = currentHarness.calls.find(call => call.url.includes('/rest/v1/quotations?'));
  assert.equal(ownerCall?.authorization, 'Bearer user-token', 'a cotação é lida com o JWT do utilizador');
  assert.ok(ownerCall?.url.includes(`id=eq.${quotationId}`));

  const savedAt = '2026-11-11T10:00:00Z';
  const attachmentRow = { quotation_id: quotationId, operation_id: 'op-1', revision: 3, saved_at: savedAt };
  const currentSaved = createHarness({ attachment: attachmentRow });
  const currentSavedResponse = await post(currentSaved.handler, { action: 'current', quotationId });
  assert.deepEqual(await currentSavedResponse.json(), { attachment: { revision: 3, savedAt } });

  // 5. `download` HTML e PNG com verificação de hash e caminho do dono.
  const htmlBytes = new TextEncoder().encode(renderHtml);
  const pngBytes = png(1080, 1920);
  const operationRow = {
    id: 'op-1',
    html_path: `${quotationId}/${requestId}.html`,
    png_path: `${quotationId}/${requestId}.png`,
    html_sha256: sha256(htmlBytes),
    png_sha256: sha256(pngBytes),
  };
  const storedObjects = {
    [`${quotationId}/${requestId}.html`]: htmlBytes,
    [`${quotationId}/${requestId}.png`]: pngBytes,
  };
  const downloadHarness = createHarness({ attachment: attachmentRow, operation: operationRow, stored: storedObjects });
  const htmlDownload = await post(downloadHarness.handler, { action: 'download', quotationId, format: 'html' });
  assert.equal(htmlDownload.status, 200);
  const htmlData = await htmlDownload.json() as { format: string; revision: number; data: string };
  assert.equal(htmlData.format, 'html');
  assert.equal(htmlData.revision, 3);
  assert.equal(htmlData.data, toBase64(htmlBytes));

  const pngDownload = await post(downloadHarness.handler, { action: 'download', quotationId, format: 'png' });
  assert.equal(pngDownload.status, 200);
  const pngData = await pngDownload.json() as { format: string; data: string };
  assert.equal(pngData.format, 'png');
  assert.equal(pngData.data, toBase64(pngBytes));

  const noAttachment = createHarness();
  const noAttachmentResponse = await post(noAttachment.handler, { action: 'download', quotationId, format: 'html' });
  assert.equal(noAttachmentResponse.status, 404);
  assert.equal((await noAttachmentResponse.json() as { error: string }).error, 'ATTACHMENT_NOT_FOUND');

  const otherOwner = createHarness({
    attachment: attachmentRow,
    operation: { ...operationRow, html_path: `00000000-0000-4000-8000-000000000000/${requestId}.html` },
    stored: storedObjects,
  });
  assert.equal((await post(otherOwner.handler, { action: 'download', quotationId, format: 'html' })).status, 503);

  const tampered = createHarness({
    attachment: attachmentRow,
    operation: { ...operationRow, html_sha256: '0'.repeat(64) },
    stored: storedObjects,
  });
  const tamperedResponse = await post(tampered.handler, { action: 'download', quotationId, format: 'html' });
  assert.equal(tamperedResponse.status, 503);
  assert.equal((await tamperedResponse.json() as { error: string }).error, 'ATTACHMENT_INVALID');

  assert.equal((await post(downloadHarness.handler, { action: 'download', quotationId, format: 'pdf' })).status, 400);

  // 6. `preview` feliz: modelo canônico do servidor e discriminador de template.
  const previewHarness = createHarness();
  const previewResponse = await post(previewHarness.handler, basePreview);
  assert.equal(previewResponse.status, 200);
  const previewData = await previewResponse.json() as { preview: string; requestId: string; warnings: string[] };
  assert.equal(previewData.preview, renderPng);
  assert.equal(previewData.requestId, requestId);
  assert.ok(Array.isArray(previewData.warnings));
  const rendererCall = previewHarness.calls.find(call => call.url.includes('/render'))!;
  assert.deepEqual(rendererCall.body, { template: 'quotation', model: { ...expectedModel, subtitle }, image });
  assert.equal(previewHarness.calls.filter(call => call.url.includes('/storage/v1/object/s23-package-flyers/')).length, 2);
  assert.equal(previewHarness.calls.some(call => call.url.includes('/rpc/publish_quotation_flyer')), false);
  const beginCall = previewHarness.calls.find(call => call.url.includes('/rpc/begin_quotation_flyer_upload'))!;
  assert.deepEqual(beginCall.body, {
    p_quotation_id: quotationId,
    p_quotation_updated_at: updatedAt,
    p_expected_revision: 0,
    p_request_id: requestId,
  });
  const markCall = previewHarness.calls.find(call => call.url.includes('/rpc/mark_quotation_flyer_uploaded'))!;
  assert.equal((markCall.body as { p_html_sha256: string }).p_html_sha256, sha256(htmlBytes));
  assert.equal((markCall.body as { p_png_sha256: string }).p_png_sha256, sha256(pngBytes));

  // 7. Serviços revistos pela operadora chegam ao renderer como `included`.
  const handlerItems = [
    { kind: 'air' as const, label: 'Aéreo' },
    { kind: 'additional' as const, label: 'Passeio de barco' },
  ];
  const itemsHarness = createHarness();
  assert.equal((await post(itemsHarness.handler, { ...basePreview, requestId: requestId2, items: handlerItems })).status, 200);
  const itemsRender = itemsHarness.calls.find(call => call.url.includes('/render'))!;
  assert.deepEqual((itemsRender.body as { model: { included: unknown } }).model.included, handlerItems);

  // 8. `publish` feliz, idempotente, conflito e prévia expirada.
  const publishHarness = createHarness();
  const publishResponse = await post(publishHarness.handler, { action: 'publish', quotationId, expectedRevision: 0, requestId });
  assert.equal(publishResponse.status, 200);
  const publishData = await publishResponse.json() as { saved: boolean; revision: number; idempotent: boolean };
  assert.equal(publishData.saved, true);
  assert.equal(publishData.revision, 2);
  assert.equal(publishData.idempotent, false);
  assert.deepEqual(
    publishHarness.calls.find(call => call.url.includes('/rpc/publish_quotation_flyer'))!.body,
    { p_quotation_id: quotationId, p_quotation_updated_at: updatedAt, p_expected_revision: 0, p_request_id: requestId },
  );
  assert.equal(publishHarness.calls.some(call => call.url.includes('/render')), false);

  const idempotentPublish = createHarness({ publishStatus: 'idempotent' });
  const idempotentData = await (await post(idempotentPublish.handler, { action: 'publish', quotationId, expectedRevision: 0, requestId })).json() as { idempotent: boolean };
  assert.equal(idempotentData.idempotent, true);

  const conflictPublish = createHarness({ publishStatus: 'conflict' });
  const conflictResponse = await post(conflictPublish.handler, { action: 'publish', quotationId, expectedRevision: 0, requestId });
  assert.equal(conflictResponse.status, 409);
  assert.equal((await conflictResponse.json() as { error: string }).error, 'REVISION_CONFLICT');

  const expiredPublish = createHarness({ publishStatus: 'not_found' });
  const expiredResponse = await post(expiredPublish.handler, { action: 'publish', quotationId, expectedRevision: 0, requestId });
  assert.equal(expiredResponse.status, 410);
  assert.equal((await expiredResponse.json() as { error: string }).error, 'PREVIEW_EXPIRED');

  // 9. Idempotência da prévia: estados `published` e `uploaded` não voltam a renderizar.
  const idempotentPreview = createHarness({
    beginStatus: 'published',
    attachment: attachmentRow,
    operation: operationRow,
    stored: storedObjects,
  });
  const idempotentPreviewResponse = await post(idempotentPreview.handler, basePreview);
  assert.equal(idempotentPreviewResponse.status, 200);
  assert.equal((await idempotentPreviewResponse.json() as { published: boolean }).published, true);
  assert.equal(idempotentPreview.calls.some(call => call.url.includes('/render')), false);

  const uploadedPreview = createHarness({ beginStatus: 'uploaded', stored: storedObjects });
  assert.equal((await post(uploadedPreview.handler, basePreview)).status, 200);
  assert.equal(uploadedPreview.calls.some(call => call.url.includes('/render')), false);

  // 10. Concorrência: o segundo pedido não chega ao renderer.
  const concurrent = createHarness({ beginSequence: ['ready', 'conflict'] });
  const [firstAttempt, secondAttempt] = await Promise.all([
    post(concurrent.handler, basePreview),
    post(concurrent.handler, { ...basePreview, requestId: requestId2 }),
  ]);
  assert.deepEqual([firstAttempt.status, secondAttempt.status].sort(), [200, 409]);
  assert.equal(concurrent.calls.filter(call => call.url.includes('/render')).length, 1);

  // 11. Entradas inválidas: sem confiar em dados comerciais do browser.
  const unauthorized = createHarness({ authorized: false });
  assert.equal((await post(unauthorized.handler, basePreview)).status, 401);
  assert.equal(unauthorized.calls.length, 0);

  const forged = createHarness();
  for (const forgedField of ['price', 'clientName', 'depositAmount', 'notIncluded', 'proposalDate', 'currency']) {
    assert.equal((await post(forged.handler, { ...basePreview, [forgedField]: 'valor forjado' })).status, 400, `${forgedField} não é aceite`);
  }
  assert.equal((await post(forged.handler, { ...basePreview, quotationId: 'não-é-uuid' })).status, 400);
  assert.equal(forged.calls.some(call => call.url.includes('/render')), false);

  const tooSmall = createHarness();
  assert.equal((await post(tooSmall.handler, { ...basePreview, image: { mimeType: 'image/png', data: toBase64(png(10, 10)) } })).status, 400);

  const tooLarge = createHarness();
  const tooLargeResponse = await tooLarge.handler(new Request('https://edge.example/quotation-flyer', {
    method: 'POST',
    headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json', 'Content-Length': String(11 * 1024 * 1024) },
    body: JSON.stringify(basePreview),
  }));
  assert.equal(tooLargeResponse.status, 400);
  assert.equal((await tooLargeResponse.json() as { error: string }).error, 'PAYLOAD_TOO_LARGE');
  assert.equal(tooLarge.calls.length, 0);

  const invalidImage = createHarness();
  assert.equal((await post(invalidImage.handler, { ...basePreview, image: { mimeType: 'image/png', data: 'AAAA' } })).status, 400);

  const invalidModel = createHarness({ quotation: { ...quotationRecord, client_name: null } });
  const invalidModelResponse = await post(invalidModel.handler, basePreview);
  assert.equal(invalidModelResponse.status, 422);
  assert.equal((await invalidModelResponse.json() as { error: string }).error, 'QUOTATION_DATA_INVALID');
  assert.equal(invalidModel.calls.some(call => call.url.includes('/render')), false);

  // 12. Falhas do renderer e do Storage passam pelo fail RPC.
  const injection = createHarness({ renderHtml: '<!doctype html><script>alert(1)</script>' });
  assert.equal((await post(injection.handler, basePreview)).status, 502);
  assert.equal(injection.calls.some(call => call.url.includes('/rpc/fail_quotation_flyer_upload')), true);
  assert.equal(injection.calls.some(call => call.url.includes('/rpc/publish_quotation_flyer')), false);

  const rendererFailure = createHarness({ renderStatus: 500 });
  assert.equal((await post(rendererFailure.handler, basePreview)).status, 502);
  assert.equal(rendererFailure.calls.some(call => call.url.includes('/rpc/fail_quotation_flyer_upload')), true);

  const storageFailure = createHarness({ storageStatus: 500 });
  assert.equal((await post(storageFailure.handler, basePreview)).status, 502);
  assert.equal(storageFailure.calls.some(call => call.url.includes('/rpc/fail_quotation_flyer_upload')), true);
  assert.equal(storageFailure.calls.some(call => call.url.includes('/rpc/publish_quotation_flyer')), false);

  // 13. Limpeza das duas filas: claim do pacote e da cotação, finish correspondente.
  const quotedPath = `${quotationId}/${requestId}.png`;
  const packagePath = `73d2084a-c853-40d5-9c76-ade4d0a8ca5f/${requestId2}.html`;
  const cleanupCalls: Array<{ url: string; method: string; body?: unknown }> = [];
  let cleanupStorageStatus = 200;
  const cleanupFetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method || 'GET';
    let body: unknown;
    if (typeof init?.body === 'string') { try { body = JSON.parse(init.body); } catch { body = init.body; } }
    cleanupCalls.push({ url, method, body });
    if (url.includes('/rpc/claim_package_flyer_cleanup')) return Response.json([{ object_path: packagePath, operation_id: 'op-pkg' }]);
    if (url.includes('/rpc/claim_quotation_flyer_cleanup')) return Response.json([{ object_path: quotedPath, operation_id: 'op-quote' }]);
    if (url.includes('/rpc/finish_package_flyer_cleanup') || url.includes('/rpc/finish_quotation_flyer_cleanup')) return Response.json({ status: 'deleted' });
    if (url.includes('/storage/v1/object/s23-package-flyers')) return new Response('{}', { status: cleanupStorageStatus });
    throw new Error(`Unexpected mock request: ${method} ${url}`);
  };
  const cleanup = createFlyerCleanupHandler({
    fetch: cleanupFetcher,
    getConfig: () => ({ url: 'https://supabase.example', key: 'service-key', secret: 'cleanup-secret' }),
  });
  const cleanupRequest = () => new Request('https://edge.example/cleanup-package-flyer', {
    method: 'POST', headers: { Authorization: 'Bearer cleanup-secret' },
  });

  const cleanupResponse = await cleanup(cleanupRequest());
  assert.equal(cleanupResponse.status, 200);
  assert.deepEqual(await cleanupResponse.json(), { processed: 2, removed: 2, failed: 0 });
  const finishPackage = cleanupCalls.find(call => call.url.includes('/rpc/finish_package_flyer_cleanup'))!;
  assert.deepEqual(finishPackage.body, { p_object_path: packagePath, p_success: true, p_error_code: null });
  const finishQuotation = cleanupCalls.find(call => call.url.includes('/rpc/finish_quotation_flyer_cleanup'))!;
  assert.deepEqual(finishQuotation.body, { p_object_path: quotedPath, p_success: true, p_error: null });
  assert.equal(cleanupCalls.filter(call => call.method === 'DELETE').length, 2);

  // Caminho inválido e Storage em baixo mantêm o retry com erro registado.
  cleanupCalls.length = 0;
  const brokenFetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    let body: unknown;
    if (typeof init?.body === 'string') { try { body = JSON.parse(init.body); } catch { body = init.body; } }
    cleanupCalls.push({ url, method: init?.method || 'GET', body });
    if (url.includes('/rpc/claim_package_flyer_cleanup')) return Response.json([]);
    if (url.includes('/rpc/claim_quotation_flyer_cleanup')) return Response.json([{ object_path: '../../etc/passwd', operation_id: 'op-bad' }]);
    if (url.includes('/rpc/finish_quotation_flyer_cleanup')) return Response.json({ status: 'retry' });
    throw new Error(`Unexpected mock request: ${url}`);
  };
  const brokenCleanup = createFlyerCleanupHandler({
    fetch: brokenFetcher,
    getConfig: () => ({ url: 'https://supabase.example', key: 'service-key', secret: 'cleanup-secret' }),
  });
  const brokenResponse = await brokenCleanup(cleanupRequest());
  assert.equal(brokenResponse.status, 200);
  assert.deepEqual(await brokenResponse.json(), { processed: 1, removed: 0, failed: 1 });
  assert.deepEqual(cleanupCalls.find(call => call.url.includes('/rpc/finish_quotation_flyer_cleanup'))!.body, {
    p_object_path: '../../etc/passwd', p_success: false, p_error: 'invalid_path',
  });

  cleanupStorageStatus = 500;
  const storageDown = await cleanup(cleanupRequest());
  assert.deepEqual(await storageDown.json(), { processed: 2, removed: 0, failed: 2 });
  assert.deepEqual(cleanupCalls.filter(call => call.url.includes('/rpc/finish_quotation_flyer_cleanup')).at(-1)!.body, {
    p_object_path: quotedPath, p_success: false, p_error: 'storage_remove_failed',
  });

  const unauthorizedCleanup = createFlyerCleanupHandler({
    fetch: cleanupFetcher,
    getConfig: () => ({ url: 'https://supabase.example', key: 'service-key', secret: 'cleanup-secret' }),
  });
  const unauthorizedCleanupResponse = await unauthorizedCleanup(new Request('https://edge.example/cleanup-package-flyer', {
    method: 'POST', headers: { Authorization: 'Bearer wrong' },
  }));
  assert.equal(unauthorizedCleanupResponse.status, 401);

  console.log('quotation flyer persistence tests passed');
}

run();
