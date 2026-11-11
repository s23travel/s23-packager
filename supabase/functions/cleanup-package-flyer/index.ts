import { createFlyerCleanupHandler } from '../_shared/flyerCleanup.ts';

function getServiceKey(): string | undefined {
  const direct = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (direct) return direct;
  try {
    const parsed = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    return typeof parsed.default === 'string' ? parsed.default : undefined;
  } catch { return undefined; }
}

Deno.serve(createFlyerCleanupHandler({
  fetch,
  getConfig: () => ({
    url: Deno.env.get('SUPABASE_URL'),
    key: getServiceKey(),
    secret: Deno.env.get('FLYER_CLEANUP_SHARED_SECRET'),
  }),
}));
