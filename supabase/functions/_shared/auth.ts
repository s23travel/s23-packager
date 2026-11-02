// Valida o token com o Auth, não apenas com o gateway (que aceita a chave anon).
export async function authorizeUser(
  request: Request,
  options: { url: string | undefined; key: string | undefined; fetch: typeof fetch },
): Promise<'ok' | 'unauthorized' | 'unavailable'> {
  const header = request.headers.get('Authorization');
  if (!header || !/^Bearer\s+\S+$/i.test(header)) return 'unauthorized';
  if (!options.url || !options.key) return 'unavailable';

  try {
    const response = await options.fetch(`${options.url.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: options.key, Authorization: header },
    });
    if (response.status === 401 || response.status === 403) return 'unauthorized';
    if (!response.ok) return 'unavailable';
    const user = await response.json();
    return typeof user.id === 'string' && user.id.length > 0 &&
      user.role === 'authenticated' && user.is_anonymous === false
      ? 'ok' : 'unauthorized';
  } catch {
    return 'unavailable';
  }
}

export async function requireUser(request: Request, corsHeaders: Record<string, string>): Promise<Response | null> {
  let key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!key) {
    try {
      key = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default;
    } catch {
      return new Response(JSON.stringify({ error: 'AUTH_UNAVAILABLE' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
  const result = await authorizeUser(request, { url: Deno.env.get('SUPABASE_URL'), key, fetch });
  if (result === 'ok') return null;
  return new Response(JSON.stringify({ error: result === 'unauthorized' ? 'UNAUTHORIZED' : 'AUTH_UNAVAILABLE' }), {
    status: result === 'unauthorized' ? 401 : 503,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
