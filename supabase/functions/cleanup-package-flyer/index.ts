const BUCKET = 's23-package-flyers';
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const result = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

function equalSecret(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index++) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

function getServiceKey(): string | undefined {
  const direct = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (direct) return direct;
  try {
    const parsed = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    return typeof parsed.default === 'string' ? parsed.default : undefined;
  } catch { return undefined; }
}

Deno.serve(async request => {
  if (request.method !== 'POST') return result({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (!equalSecret(request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null, Deno.env.get('FLYER_CLEANUP_SHARED_SECRET'))) {
    return result({ error: 'UNAUTHORIZED' }, 401);
  }
  const url = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '');
  const key = getServiceKey();
  if (!url || !key) return result({ error: 'SERVICE_UNAVAILABLE' }, 503);

  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}`;
  try {
    const claim = await fetch(`${url}/rest/v1/rpc/claim_package_flyer_cleanup`, {
      method: 'POST', headers, body: JSON.stringify({ p_limit: 50 }),
    });
    if (!claim.ok) return result({ error: 'CLEANUP_UNAVAILABLE' }, 503);
    const rows = await claim.json() as Array<{ object_path?: unknown; operation_id?: unknown }>;
    let removed = 0;
    let failed = 0;
    for (const row of rows) {
      const path = row.object_path;
      if (typeof path !== 'string' || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:html|png)$/i.test(path)) {
        failed++;
        await fetch(`${url}/rest/v1/rpc/finish_package_flyer_cleanup`, {
          method: 'POST', headers, body: JSON.stringify({ p_object_path: String(path || ''), p_success: false, p_error_code: 'invalid_path' }),
        });
        continue;
      }
      let ok = false;
      try {
        const response = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
          method: 'DELETE', headers, body: JSON.stringify({ prefixes: [path] }),
        });
        ok = response.ok || response.status === 404;
      } catch { ok = false; }
      const finished = await fetch(`${url}/rest/v1/rpc/finish_package_flyer_cleanup`, {
        method: 'POST', headers,
        body: JSON.stringify({ p_object_path: path, p_success: ok, p_error_code: ok ? null : 'storage_remove_failed' }),
      });
      if (ok && finished.ok) removed++;
      else failed++;
    }
    return result({ processed: rows.length, removed, failed });
  } catch { return result({ error: 'CLEANUP_UNAVAILABLE' }, 503); }
});
