import { validDestination, validImage, validSubtitle } from '../../supabase/functions/_shared/flyerAiContract';
import type { FlyerAiInput, FlyerAiSuggestion } from '../../supabase/functions/_shared/flyerAiContract';

export type FlyerAiResult =
  | { success: true; data: FlyerAiSuggestion }
  | { success: false; error: string; code: string };

type Invoke = (name: string, options: { body: FlyerAiInput }) => Promise<{ data: unknown; error: unknown }>;

const messages: Record<string, string> = {
  INVALID_INPUT: 'Informe um destino válido.',
  UNAUTHORIZED: 'Entre na sua conta para gerar a lâmina.',
  AUTH_UNAVAILABLE: 'Não foi possível validar sua sessão.',
  AI_NOT_CONFIGURED: 'A geração de IA não está configurada no servidor.',
  AI_RATE_LIMIT: 'Limite da IA atingido. Tente novamente mais tarde.',
  AI_UNAVAILABLE: 'Não foi possível gerar a imagem. Verifique o acesso ao modelo.',
  AI_INVALID_RESPONSE: 'A IA retornou uma resposta inválida.',
  AI_IMAGE_MISSING: 'A IA não retornou uma imagem válida.',
  AI_SUBTITLE_INVALID: 'A IA não retornou um subtítulo adequado para revisão.',
};

function failure(code: string): FlyerAiResult {
  return { success: false, code, error: messages[code] || 'Não foi possível gerar a imagem e o subtítulo.' };
}

/** Aceita somente destino; o resultado é sugestão não aprovada, sem alterar o modelo comercial. */
export function createFlyerAiGenerator(invoke: Invoke) {
  return async (input: FlyerAiInput): Promise<FlyerAiResult> => {
    if (!input || !validDestination(input.destination)) return failure('INVALID_INPUT');
    try {
      const { data, error } = await invoke('generate-flyer-ai', { body: { destination: input.destination.trim() } });
      if (error) {
        const context = (error as { context?: unknown }).context;
        if (context instanceof Response) {
          try {
            const body = await context.clone().json();
            if (typeof body?.error === 'string' && Object.prototype.hasOwnProperty.call(messages, body.error)) return failure(body.error);
          } catch { /* Erros HTTP não confiáveis não são exibidos. */ }
          if (context.status === 401) return failure('UNAUTHORIZED');
          if (context.status === 429) return failure('AI_RATE_LIMIT');
        }
        return failure('AI_UNAVAILABLE');
      }
      const response = data as { success?: unknown; data?: { image?: unknown; subtitle?: unknown } } | null;
      const suggestion = response?.data;
      if (response?.success !== true || !suggestion || !validImage(suggestion.image) || !validSubtitle(suggestion.subtitle)) {
        return failure('AI_INVALID_RESPONSE');
      }
      return { success: true, data: { image: { mimeType: suggestion.image.mimeType, data: suggestion.image.data }, subtitle: suggestion.subtitle } };
    } catch { return failure('AI_UNAVAILABLE'); }
  };
}
