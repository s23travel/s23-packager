import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

export const PROD_SUPABASE_PROJECT_REF = 'iqtfqitquykasvfybndl';

const isDev = Boolean(
  env.DEV ||
  env.MODE === 'development' ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')
);

const rawUrl = (env.VITE_SUPABASE_URL || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || '');
const rawAnonKey = (env.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || '');

// Validação de segurança: impede o ambiente de desenvolvimento de usar o projeto de produção
if (isDev && rawUrl.includes(PROD_SUPABASE_PROJECT_REF)) {
  const errorMsg = `[Segurança] Bloqueio de Ambiente: O ambiente de desenvolvimento não tem permissão para conectar ao projeto Supabase de produção (${PROD_SUPABASE_PROJECT_REF}). Configure o projeto de desenvolvimento (packager-dev) no arquivo .env.local.`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

export const supabaseConfig = {
  url: rawUrl,
  anonKey: rawAnonKey,
};

export const isSupabaseConfigured = Boolean(
  supabaseConfig.url && 
  supabaseConfig.anonKey && 
  !supabaseConfig.url.includes('your-project') &&
  !supabaseConfig.url.includes('dummy')
);

/**
 * Instância oficial do cliente Supabase para o Packager
 */
export const supabase: SupabaseClient = createClient(
  supabaseConfig.url || 'https://dummy-project.supabase.co',
  supabaseConfig.anonKey || 'dummy-anon-key'
);

