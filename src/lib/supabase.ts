/**
 * Módulo de conexão com o Supabase (Fase Futura).
 * 
 * Nesta etapa de fundação técnica, apenas estruturamos a leitura segura
 * das variáveis de ambiente sem realizar chamadas de rede ou autenticação prematura.
 */

export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
};

export const isSupabaseConfigured = Boolean(
  supabaseConfig.url && 
  supabaseConfig.anonKey && 
  !supabaseConfig.url.includes('your-project')
);
