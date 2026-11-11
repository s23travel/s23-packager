const BUCKET = 's23-package-flyers';
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const result = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

/** Filas processadas pela limpeza: o finish acompanha o dono do objeto. */
const QUEUES = [
  { claim: 'claim_package_flyer_cleanup', finish: 'finish_package_flyer_cleanup', errorParam: 'p_error_code' },
  { claim: 'claim_quotation_flyer_cleanup', finish: 'finish_quotation_flyer_cleanup', errorParam: 'p_error' },
] as const;

export interface FlyerCleanupDependencies {
  fetch: typeof fetch;
  getConfig: () => { url?: string; key?: string; secret?: string };
}

function equalSecret(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index++) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

/**
 * Remove os objetos das duas filas de lâminas (pacote e cotação). Cada linha é
 * apagada pelo Storage API e fechada pelo `finish_*` da respectiva fila, que
 * mantém o retry exponencial e os contadores no banco.
 */
export function createFlyerCleanupHandler(deps: FlyerCleanupDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return result({ error: 'METHOD_NOT_ALLOWED' }, 405);
    const config = deps.getConfig();
    if (!equalSecret(request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null, config.secret)) {
      return result({ error: 'UNAUTHORIZED' }, 401);
    }
    const url = config.url?.replace(/\/$/, '');
    const key = config.key;
    if (!url || !key) return result({ error: 'SERVICE_UNAVAILABLE' }, 503);

    const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
    if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}`;
    try {
      let processed = 0;
      let removed = 0;
      let failed = 0;
      for (const queue of QUEUES) {
        const claim = await deps.fetch(`${url}/rest/v1/rpc/${queue.claim}`, {
          method: 'POST', headers, body: JSON.stringify({ p_limit: 50 }),
        });
        if (!claim.ok) return result({ error: 'CLEANUP_UNAVAILABLE' }, 503);
        const rows = await claim.json() as Array<{ object_path?: unknown; operation_id?: unknown }>;
        processed += rows.length;
        for (const row of rows) {
          const path = row.object_path;
          if (typeof path !== 'string' || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:html|png)$/i.test(path)) {
            failed++;
            await deps.fetch(`${url}/rest/v1/rpc/${queue.finish}`, {
              method: 'POST', headers, body: JSON.stringify({ p_object_path: String(path || ''), p_success: false, [queue.errorParam]: 'invalid_path' }),
            });
            continue;
          }
          let ok = false;
          try {
            const response = await deps.fetch(`${url}/storage/v1/object/${BUCKET}`, {
              method: 'DELETE', headers, body: JSON.stringify({ prefixes: [path] }),
            });
            ok = response.ok || response.status === 404;
          } catch { ok = false; }
          const finished = await deps.fetch(`${url}/rest/v1/rpc/${queue.finish}`, {
            method: 'POST', headers,
            body: JSON.stringify({ p_object_path: path, p_success: ok, [queue.errorParam]: ok ? null : 'storage_remove_failed' }),
          });
          if (ok && finished.ok) removed++;
          else failed++;
        }
      }
      return result({ processed, removed, failed });
    } catch { return result({ error: 'CLEANUP_UNAVAILABLE' }, 503); }
  };
}
