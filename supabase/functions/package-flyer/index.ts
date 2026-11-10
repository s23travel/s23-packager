import { requireUser } from '../_shared/auth.ts';
import { createPackageFlyerHandler } from './handler.ts';

const getSecretKey = (): string | undefined => {
  const direct = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (direct) return direct;
  try {
    const parsed = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    return typeof parsed.default === 'string' ? parsed.default : undefined;
  } catch { return undefined; }
};

const getPublishableKey = (): string | undefined => {
  const direct = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (direct) return direct;
  try {
    const parsed = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    return typeof parsed.default === 'string' ? parsed.default : undefined;
  } catch { return undefined; }
};

const serviceKey = getSecretKey();

const handler = createPackageFlyerHandler({
  requireUser,
  getConfig: () => ({
    url: Deno.env.get('SUPABASE_URL'),
    anonKey: getPublishableKey(),
    serviceKey,
    serviceAuthorization: serviceKey?.split('.').length === 3 ? `Bearer ${serviceKey}` : undefined,
    rendererUrl: Deno.env.get('FLYER_RENDERER_URL'),
    rendererSecret: Deno.env.get('FLYER_RENDERER_SHARED_SECRET'),
  }),
  fetch,
});

Deno.serve(handler);
