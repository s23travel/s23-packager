/**
 * Mensagens reais das Edge Functions das lâminas.
 *
 * O `supabase.functions.invoke` devolve um erro genérico
 * («Edge Function returned a non-2xx status code») e guarda a resposta HTTP em
 * `error.context`. Sem ler esse corpo, o utilizador perde a mensagem e os
 * detalhes de validação enviados pelo servidor.
 */

export interface FlyerFunctionError {
  message?: string;
  /** Response original da Edge Function, quando o invoke falha por status HTTP. */
  context?: Response;
}

export interface FlyerFunctionResult<T> {
  data: T | null;
  error: FlyerFunctionError | null;
}

interface FlyerFunctionBody {
  message?: unknown;
  details?: unknown;
}

async function readErrorBody(error: FlyerFunctionError | null): Promise<FlyerFunctionBody | null> {
  const response = error?.context;
  if (!response || typeof response.clone !== 'function') return null;
  try {
    const body = await response.clone().json();
    return body && typeof body === 'object' ? (body as FlyerFunctionBody) : null;
  } catch {
    return null;
  }
}

/** Mensagem pública do servidor, com os detalhes de validação quando existem. */
export async function flyerFunctionMessage(
  data: unknown,
  error: FlyerFunctionError | null,
  fallback: string,
): Promise<string> {
  const payload = (data && typeof data === 'object' ? (data as FlyerFunctionBody) : null) ?? await readErrorBody(error);
  if (payload && typeof payload.message === 'string' && payload.message.trim()) {
    const details = Array.isArray(payload.details)
      ? payload.details.filter((detail): detail is string => typeof detail === 'string' && detail.trim().length > 0)
      : [];
    return details.length ? `${payload.message} ${details.join(' ')}` : payload.message;
  }
  return error?.message || fallback;
}
