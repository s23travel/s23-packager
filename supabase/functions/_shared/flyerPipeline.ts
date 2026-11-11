import { validImage } from './flyerAiContract.ts';
import { validFlyerItems } from './flyerItemsContract.ts';

const BUCKET = 's23-package-flyers';
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_HTML_BYTES = 10 * 1024 * 1024;
const MAX_PNG_BYTES = 12 * 1024 * 1024;
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

export interface FlyerImage {
  mimeType: 'image/png' | 'image/jpeg';
  data: string;
}

export interface FlyerModelResult<Model> {
  model: Model | null;
  errors: string[];
  warnings: string[];
}

export interface FlyerPipelineDependencies {
  requireUser: (request: Request, corsHeaders: Record<string, string>) => Promise<Response | null>;
  getConfig: () => { url?: string; anonKey?: string; serviceKey?: string; serviceAuthorization?: string; rendererUrl?: string; rendererSecret?: string };
  fetch: typeof fetch;
}

/** Copy que muda entre pacote e cotação; as restantes mensagens são comuns. */
export interface FlyerPipelineMessages {
  /** Ex.: «Informe um pacote válido.» */
  invalidOwner: string;
  /** Ex.: `PACKAGE_UNAVAILABLE`. */
  ownerUnavailableCode: string;
  ownerUnavailable: string;
  unauthorized: string;
  /** Ex.: `PACKAGE_NOT_FOUND`. */
  ownerNotFoundCode: string;
  ownerNotFound: string;
  /** Ex.: «Ainda não há uma lâmina salva neste pacote.» */
  noSavedFlyer: string;
  /** Ex.: «O pacote ou a lâmina mudou. Atualize a tela e gere outra prévia.» */
  revisionConflict: string;
  /** Ex.: «O pacote ou a lâmina mudou. Atualize a tela e tente novamente.» */
  revisionConflictStart: string;
  /** Ex.: `PACKAGE_DATA_INVALID`. */
  modelInvalidCode: string;
  /** Ex.: «Revise os dados comerciais do pacote.» */
  modelInvalidMessage: string;
}

export interface FlyerPipelineConfig<Model> {
  /** Nome da função nos logs: `package-flyer` ou `quotation-flyer`. */
  name: string;
  /** Campo do corpo com o id do dono: `packageId` ou `quotationId`. */
  idField: 'packageId' | 'quotationId';
  /** Tabela e colunas lidas com o JWT do utilizador (RLS). */
  ownerTable: 'packages' | 'quotations';
  ownerSelect: string;
  /** Prefixo das RPCs de persistência: `package` ou `quotation`. */
  rpcPrefix: 'package' | 'quotation';
  attachmentTable: string;
  attachmentKeyColumn: string;
  attachmentSelect: string;
  operationTable: string;
  messages: FlyerPipelineMessages;
  /** Constrói o modelo canônico a partir do registo persistido. */
  buildModel: (record: Record<string, unknown>, subtitle: unknown, items?: unknown) => FlyerModelResult<Model>;
  /** Corpo enviado ao renderer; a cotação acrescenta o discriminador de template. */
  renderPayload: (model: Model, image: FlyerImage) => unknown;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const result = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, ...JSON_HEADERS } });
const failure = (error: string, message: string, status: number) => result({ error, message }, status);
const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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

function decodeBase64(value: string): Uint8Array {
  if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('INVALID_BASE64');
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function dimensions(bytes: Uint8Array, mimeType: string): { width: number; height: number } | null {
  if (mimeType === 'image/png') {
    if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47 ||
        bytes[4] !== 0x0d || bytes[5] !== 0x0a || bytes[6] !== 0x1a || bytes[7] !== 0x0a) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mimeType !== 'image/jpeg' || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: (bytes[offset + 3] << 8) | bytes[offset + 4], width: (bytes[offset + 5] << 8) | bytes[offset + 6] };
    }
    offset += segmentLength;
  }
  return null;
}

const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', copy.buffer)));
}
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  return btoa(binary);
}
const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

function isSafeHtml(html: unknown): html is string {
  if (typeof html !== 'string' || new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) return false;
  return /^<!doctype html>/i.test(html) &&
    /Content-Security-Policy/i.test(html) &&
    !/<\s*script\b|javascript\s*:|https?:\/\/|<\s*iframe\b|<\s*object\b|<\s*embed\b/i.test(html);
}

/**
 * Orquestração comum da lâmina: leitura limitada do corpo, autenticação, CAS por
 * `updated_at` + revisão, renderer confiável, upload dos dois objetos, RPCs de
 * estado e idempotência. Só o modelo canônico e o corpo do renderer variam
 * entre pacote e cotação.
 */
export function createFlyerHandler<Model>(config: FlyerPipelineConfig<Model>, deps: FlyerPipelineDependencies) {
  const { messages } = config;
  const idKey = config.idField;
  const fieldsByAction: Record<string, string[]> = {
    current: ['action', idKey],
    download: ['action', idKey, 'format'],
    preview: ['action', idKey, 'expectedRevision', 'requestId', 'image', 'subtitle', 'items'],
    publish: ['action', idKey, 'expectedRevision', 'requestId'],
  };

  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return failure('METHOD_NOT_ALLOWED', 'Use POST.', 405);

    const authError = await deps.requireUser(request, corsHeaders);
    if (authError) return authError;
    const settings = deps.getConfig();
    const baseUrl = settings.url?.replace(/\/$/, '');
    const authHeader = request.headers.get('Authorization');
    if (!baseUrl || !settings.anonKey || !settings.serviceKey || !authHeader) {
      return failure('SERVICE_UNAVAILABLE', 'A persistência segura da lâmina não está configurada.', 503);
    }

    let input: unknown;
    try { input = JSON.parse(await readLimited(request, MAX_INPUT_BYTES)); }
    catch (error) { return failure(error instanceof Error && error.message === 'too_large' ? 'PAYLOAD_TOO_LARGE' : 'INVALID_INPUT', 'Não foi possível ler os dados da lâmina.', 400); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return failure('INVALID_INPUT', 'Informe uma operação válida.', 400);
    const body = input as Record<string, unknown>;
    const allowedFields = fieldsByAction[String(body.action)];
    if (!allowedFields) return failure('INVALID_INPUT', 'Informe uma operação válida.', 400);
    const ownerId = body[idKey];
    if (Object.keys(body).some(key => !allowedFields.includes(key)) || !isUuid(ownerId)) {
      return failure('INVALID_INPUT', messages.invalidOwner, 400);
    }
    if (((body.action === 'preview' || body.action === 'publish') && (!isUuid(body.requestId) || !Number.isInteger(body.expectedRevision) || Number(body.expectedRevision) < 0)) ||
        (body.action === 'preview' && (
        !validImage(body.image) || typeof body.subtitle !== 'string' ||
        (body.items !== undefined && !validFlyerItems(body.items)))) ||
        (body.action === 'download' && body.format !== 'html' && body.format !== 'png')) {
      return failure('INVALID_INPUT', 'Os dados enviados não são válidos.', 400);
    }

    const ownerQuery = new URL(`${baseUrl}/rest/v1/${config.ownerTable}`);
    ownerQuery.searchParams.set('id', `eq.${ownerId}`);
    ownerQuery.searchParams.set('select', config.ownerSelect);
    let ownerResponse: Response;
    try {
      ownerResponse = await deps.fetch(ownerQuery, { headers: { apikey: settings.anonKey, Authorization: authHeader } });
    } catch { return failure(messages.ownerUnavailableCode, messages.ownerUnavailable, 503); }
    if (ownerResponse.status === 401 || ownerResponse.status === 403) return failure('UNAUTHORIZED', messages.unauthorized, 401);
    if (!ownerResponse.ok) return failure(messages.ownerUnavailableCode, messages.ownerUnavailable, 503);
    const owners = await ownerResponse.json().catch(() => null) as Array<Record<string, unknown>> | null;
    const owner = Array.isArray(owners) ? owners[0] : null;
    if (!owner) return failure(messages.ownerNotFoundCode, messages.ownerNotFound, 404);

    const adminHeaders: Record<string, string> = { apikey: settings.serviceKey };
    if (settings.serviceAuthorization) adminHeaders.Authorization = settings.serviceAuthorization;
    const rpc = async (name: string, args: Record<string, unknown>) => {
      const response = await deps.fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: { ...adminHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(args),
      });
      if (!response.ok) throw new Error(`RPC_${name}_FAILED`);
      return response.json() as Promise<Record<string, unknown>>;
    };
    const attachmentUrl = new URL(`${baseUrl}/rest/v1/${config.attachmentTable}`);
    attachmentUrl.searchParams.set(config.attachmentKeyColumn, `eq.${ownerId}`);
    attachmentUrl.searchParams.set('select', config.attachmentSelect);
    attachmentUrl.searchParams.set('limit', '1');
    const fetchCurrent = async () => {
      const response = await deps.fetch(attachmentUrl, { headers: adminHeaders });
      if (!response.ok) throw new Error('CURRENT_UNAVAILABLE');
      const rows = await response.json() as Array<Record<string, unknown>>;
      return rows[0] || null;
    };
    const getOperation = async (operationId: unknown) => {
      const url = new URL(`${baseUrl}/rest/v1/${config.operationTable}`);
      url.searchParams.set('id', `eq.${String(operationId)}`);
      url.searchParams.set('select', 'id,html_path,png_path,html_sha256,png_sha256');
      url.searchParams.set('limit', '1');
      const response = await deps.fetch(url, { headers: adminHeaders });
      if (!response.ok) throw new Error('OPERATION_UNAVAILABLE');
      const rows = await response.json() as Array<Record<string, unknown>>;
      return rows[0] || null;
    };

    if (body.action === 'current') {
      try {
        const attachment = await fetchCurrent();
        return result({ attachment: attachment ? { revision: attachment.revision, savedAt: attachment.saved_at } : null });
      } catch { return failure('ATTACHMENT_UNAVAILABLE', 'Não foi possível consultar a lâmina salva.', 503); }
    }

    if (body.action === 'download') {
      try {
        const attachment = await fetchCurrent();
        if (!attachment) return failure('ATTACHMENT_NOT_FOUND', messages.noSavedFlyer, 404);
        const operation = await getOperation(attachment.operation_id);
        if (!operation) return failure('ATTACHMENT_UNAVAILABLE', 'O anexo salvo está indisponível.', 503);
        const format = body.format as 'html' | 'png';
        const path = String(format === 'html' ? operation.html_path : operation.png_path);
        if (!path.startsWith(`${ownerId}/`)) return failure('ATTACHMENT_UNAVAILABLE', 'O anexo salvo está indisponível.', 503);
        const response = await deps.fetch(`${baseUrl}/storage/v1/object/authenticated/${BUCKET}/${encodePath(path)}`, { headers: adminHeaders });
        if (!response.ok) return failure('ATTACHMENT_UNAVAILABLE', 'Não foi possível baixar o anexo salvo.', 503);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const expected = String(format === 'html' ? operation.html_sha256 : operation.png_sha256);
        if (await sha256(bytes) !== expected) return failure('ATTACHMENT_INVALID', 'O anexo salvo não passou pela verificação de integridade.', 503);
        return result({ format, revision: attachment.revision, data: toBase64(bytes) });
      } catch { return failure('ATTACHMENT_UNAVAILABLE', 'Não foi possível baixar o anexo salvo.', 503); }
    }

    if (body.action === 'publish') {
      try {
        const published = await rpc(`publish_${config.rpcPrefix}_flyer`, {
          [`p_${config.rpcPrefix}_id`]: ownerId,
          [`p_${config.rpcPrefix}_updated_at`]: owner.updated_at,
          p_expected_revision: body.expectedRevision,
          p_request_id: body.requestId,
        });
        if (published.status === 'conflict') return failure('REVISION_CONFLICT', messages.revisionConflict, 409);
        if (published.status === 'not_found') return failure('PREVIEW_EXPIRED', 'A prévia final expirou. Gere uma nova antes de salvar.', 410);
        if (published.status !== 'published' && published.status !== 'idempotent') return failure('PREVIEW_EXPIRED', 'A prévia final não está mais disponível. Gere uma nova antes de salvar.', 410);
        return result({ saved: true, revision: published.revision, savedAt: new Date().toISOString(), idempotent: published.status === 'idempotent' });
      } catch { return failure('SAVE_FAILED', 'Não foi possível salvar a lâmina. A versão anterior continua disponível.', 502); }
    }

    const image = body.image as FlyerImage;
    let imageBytes: Uint8Array;
    try { imageBytes = decodeBase64(image.data); }
    catch { return failure('INVALID_IMAGE', 'A imagem revisada está inválida.', 400); }
    if (imageBytes.byteLength > 6 * 1024 * 1024) return failure('INVALID_IMAGE', 'A imagem excede o tamanho permitido.', 413);
    const imageDimensions = dimensions(imageBytes, image.mimeType);
    if (!imageDimensions || imageDimensions.width < 360 || imageDimensions.height < 640 ||
        imageDimensions.width > 4096 || imageDimensions.height > 4096 || imageDimensions.width * imageDimensions.height > 12_000_000) {
      return failure('INVALID_IMAGE', 'A imagem revisada não pôde ser validada.', 400);
    }
    const flyer = config.buildModel(owner, body.subtitle, body.items);
    if (!flyer.model) return result({ error: messages.modelInvalidCode, message: messages.modelInvalidMessage, details: flyer.errors, warnings: flyer.warnings }, 422);
    if (!settings.rendererUrl || !settings.rendererSecret) return failure('RENDERER_UNAVAILABLE', 'O renderer seguro não está configurado.', 503);
    let rendererUrl: URL;
    try { rendererUrl = new URL(settings.rendererUrl); }
    catch { return failure('RENDERER_UNAVAILABLE', 'O renderer seguro não está configurado corretamente.', 503); }
    if (rendererUrl.protocol !== 'https:' || rendererUrl.search || rendererUrl.hash) return failure('RENDERER_UNAVAILABLE', 'O renderer seguro não está configurado corretamente.', 503);

    const requestId = body.requestId as string;
    let operationStarted = false;
    let stage = 'begin';
    try {
      const started = await rpc(`begin_${config.rpcPrefix}_flyer_upload`, {
        [`p_${config.rpcPrefix}_id`]: ownerId,
        [`p_${config.rpcPrefix}_updated_at`]: owner.updated_at,
        p_expected_revision: body.expectedRevision,
        p_request_id: requestId,
      });
      if (started.status === 'conflict') return failure('REVISION_CONFLICT', messages.revisionConflictStart, 409);
      if (started.status === 'not_found') return failure(messages.ownerNotFoundCode, messages.ownerNotFound, 404);
      if (started.status === 'published') {
        const attachment = await fetchCurrent();
        const operation = attachment && await getOperation(attachment.operation_id);
        if (!operation) throw new Error('PREVIEW_UNAVAILABLE');
        const existing = await deps.fetch(`${baseUrl}/storage/v1/object/authenticated/${BUCKET}/${encodePath(String(operation.png_path))}`, { headers: adminHeaders });
        if (!existing.ok) throw new Error('PREVIEW_UNAVAILABLE');
        const bytes = new Uint8Array(await existing.arrayBuffer());
        if (await sha256(bytes) !== operation.png_sha256) throw new Error('PREVIEW_INVALID');
        return result({ preview: toBase64(bytes), requestId, expectedRevision: body.expectedRevision, published: true });
      }
      if (started.status === 'uploaded') {
        operationStarted = true;
        const existing = await deps.fetch(`${baseUrl}/storage/v1/object/authenticated/${BUCKET}/${encodePath(String(started.png_path))}`, { headers: adminHeaders });
        if (!existing.ok) throw new Error('PREVIEW_UNAVAILABLE');
        const bytes = new Uint8Array(await existing.arrayBuffer());
        if (await sha256(bytes) !== started.png_sha256) throw new Error('PREVIEW_INVALID');
        return result({ preview: toBase64(bytes), requestId, expectedRevision: body.expectedRevision });
      }
      if (started.status !== 'ready' || typeof started.html_path !== 'string' || typeof started.png_path !== 'string') {
        return failure('SAVE_UNAVAILABLE', 'Não foi possível iniciar o salvamento da lâmina.', 503);
      }
      operationStarted = true;
      stage = 'render';
      const renderResponse = await deps.fetch(rendererUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.rendererSecret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(config.renderPayload(flyer.model, image)),
      });
      if (!renderResponse.ok) throw new Error(`RENDER_HTTP_${renderResponse.status}`);
      const rendered = await renderResponse.json() as { version?: unknown; html?: unknown; png?: unknown };
      stage = 'validate_render';
      if (rendered.version !== 's23-flyer-v1' || !isSafeHtml(rendered.html) || typeof rendered.png !== 'string') throw new Error('INVALID_RENDER_OUTPUT');
      const pngBytes = decodeBase64(rendered.png);
      if (pngBytes.length > MAX_PNG_BYTES || !dimensions(pngBytes, 'image/png') ||
          dimensions(pngBytes, 'image/png')?.width !== 1080 || dimensions(pngBytes, 'image/png')?.height !== 1920) throw new Error('INVALID_RENDER_DIMENSIONS');
      const htmlBytes = new TextEncoder().encode(rendered.html);
      const [htmlSha, pngSha] = await Promise.all([sha256(htmlBytes), sha256(pngBytes)]);

      stage = 'upload';
      const upload = async (path: string, bytes: Uint8Array, mimeType: string, digest: string) => {
        const response = await deps.fetch(`${baseUrl}/storage/v1/object/${BUCKET}/${encodePath(path)}`, {
          method: 'POST', headers: { ...adminHeaders, 'Content-Type': mimeType === 'text/html; charset=utf-8' ? 'text/html' : mimeType, 'x-upsert': 'false' }, body: bytes,
        });
        if (response.ok) return;
        if (response.status === 409 || response.status === 400) {
          const existing = await deps.fetch(`${baseUrl}/storage/v1/object/authenticated/${BUCKET}/${encodePath(path)}`, { headers: adminHeaders });
          if (existing.ok && await sha256(new Uint8Array(await existing.arrayBuffer())) === digest) return;
        }
        throw new Error(`STORAGE_UPLOAD_FAILED_${response.status}`);
      };
      const uploads = await Promise.allSettled([
        upload(started.html_path, htmlBytes, 'text/html; charset=utf-8', htmlSha),
        upload(started.png_path, pngBytes, 'image/png', pngSha),
      ]);
      if (uploads.some(uploadResult => uploadResult.status === 'rejected')) {
        const rejected = uploads.find(uploadResult => uploadResult.status === 'rejected') as PromiseRejectedResult;
        throw rejected.reason;
      }
      stage = 'mark_uploaded';
      const marked = await rpc(`mark_${config.rpcPrefix}_flyer_uploaded`, {
        p_request_id: requestId, p_html_sha256: htmlSha, p_png_sha256: pngSha,
        p_html_bytes: htmlBytes.byteLength, p_png_bytes: pngBytes.byteLength,
      });
      if (marked.status !== 'uploaded' && marked.status !== 'idempotent') throw new Error(`UPLOAD_STATE_${String(marked.status)}`);
      return result({ preview: rendered.png, requestId, expectedRevision: body.expectedRevision, warnings: flyer.warnings });
    } catch (error) {
      console.error(`${config.name} preview failed`, stage, error instanceof Error ? error.message : 'unknown');
      if (operationStarted) {
        try { await rpc(`fail_${config.rpcPrefix}_flyer_upload`, { p_request_id: requestId }); } catch { /* A recolha de tombstones trata uploads expirados. */ }
      }
      return failure('PREVIEW_FAILED', 'Não foi possível gerar a prévia final no servidor. A versão salva anteriormente continua disponível.', 502);
    }
  };
}
