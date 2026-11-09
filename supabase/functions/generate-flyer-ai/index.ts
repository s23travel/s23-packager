import { requireUser } from '../_shared/auth.ts';
import { createFlyerAiHandler } from './handler.ts';

// Mesmo com verify_jwt desligado no gateway, a validação de usuário ocorre no handler.
Deno.serve(createFlyerAiHandler({
  requireUser,
  getApiKey: () => Deno.env.get('GEMINI_API_KEY'),
  fetch,
}));
