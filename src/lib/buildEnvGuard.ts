/**
 * Guarda de Configuração e Validação de Ambiente de Build
 *
 * Garante que builds de produção exijam explicitamente a URL e a chave pública anon de PROD,
 * validem a origem exata da URL, verifiquem a integridade da chave JWT e falhem imediatamente
 * se receberem configurações de DEV, URLs malformadas, JWTs inválidos, valores ausentes
 * ou segredos administrativos (como service_role).
 */

export const PROD_SUPABASE_PROJECT_REF = 'iqtfqitquykasvfybndl';
export const DEV_SUPABASE_PROJECT_REF = 'rskhshtewkgrllbtamsr';

export interface ValidatedProductionEnv {
  url: string;
  anonKey: string;
}

export function parseJwtPayload(token: string): { ref?: string; role?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    if (!base64Url || base64Url.length < 4) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    let jsonStr: string;
    if (typeof Buffer !== 'undefined') {
      jsonStr = Buffer.from(base64, 'base64').toString('utf8');
    } else if (typeof atob !== 'undefined') {
      jsonStr = atob(base64);
    } else {
      return null;
    }
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function validateProductionEnv(
  env: Record<string, string | undefined>
): ValidatedProductionEnv {
  const rawUrl = (env.VITE_SUPABASE_URL || '').trim();
  const anonKey = (env.VITE_SUPABASE_ANON_KEY || '').trim();

  // 1. Validação de presença da URL
  if (!rawUrl) {
    throw new Error(
      `[Build Error] VITE_SUPABASE_URL ausente. Builds de produção exigem explicitamente a URL do projeto Supabase PROD (${PROD_SUPABASE_PROJECT_REF}).`
    );
  }

  // 2. Validação sintática e de protocolo da URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error(
      `[Build Error] URL Malformada: VITE_SUPABASE_URL ('${rawUrl}') não é uma URL válida.`
    );
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error(
      `[Build Error] Protocolo Inválido: VITE_SUPABASE_URL deve utilizar estritamente o protocolo HTTPS. Recebido: '${parsedUrl.protocol}'`
    );
  }

  // 3. Validação estrita do host de PROD (rejeita DEV, subdomínios maliciosos ou projetos desconhecidos)
  const expectedHost = `${PROD_SUPABASE_PROJECT_REF}.supabase.co`;
  if (parsedUrl.hostname !== expectedHost) {
    if (parsedUrl.hostname.includes(DEV_SUPABASE_PROJECT_REF) || rawUrl.includes(DEV_SUPABASE_PROJECT_REF)) {
      throw new Error(
        `[Build Error] Violação de Ambiente: Tentativa de build de produção utilizando o projeto Supabase DEV (${DEV_SUPABASE_PROJECT_REF}). O build foi abortado.`
      );
    }
    throw new Error(
      `[Build Error] Origem Inválida: VITE_SUPABASE_URL deve apontar exclusivamente para a origem oficial de produção ('https://${expectedHost}'). Host recebido: '${parsedUrl.hostname}'.`
    );
  }

  // 4. Validação de presença da chave pública anon
  if (!anonKey) {
    throw new Error(
      `[Build Error] VITE_SUPABASE_ANON_KEY ausente. Builds de produção exigem a chave pública anon de PROD.`
    );
  }

  // 5. Validação estrutural do token JWT (rejeita não-JWTs ou chaves malformadas)
  const payload = parseJwtPayload(anonKey);
  if (!payload) {
    throw new Error(
      `[Build Error] VITE_SUPABASE_ANON_KEY inválida: A chave fornecida não é um token JWT reconhecível. Builds de produção exigem uma chave pública anon válida do Supabase.`
    );
  }

  // 6. Validação contra chaves administrativas (service_role ou roles não-anon)
  if (!payload.role || payload.role !== 'anon') {
    throw new Error(
      `[Build Error] Violação Crítica de Segurança: A chave fornecida possui role='${payload.role || 'desconhecido'}'. Nunca inclua segredos administrativos (como service_role) no bundle do cliente!`
    );
  }

  // 7. Validação do claim de projeto (ref deve corresponder exatamente a PROD)
  if (!payload.ref || payload.ref !== PROD_SUPABASE_PROJECT_REF) {
    throw new Error(
      `[Build Error] Chave Incompatível: A chave anon fornecida pertence ao projeto '${payload.ref || 'desconhecido'}', e não ao projeto PROD (${PROD_SUPABASE_PROJECT_REF}).`
    );
  }

  // Retorna a URL normalizada (sem barras finais ou fragmentos espúrios) e a chave validada
  const normalizedUrl = `https://${expectedHost}`;
  return { url: normalizedUrl, anonKey };
}
