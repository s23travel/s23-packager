import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

export const supabaseConfig = {
  url: (env.VITE_SUPABASE_URL || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 'https://iqtfqitquykasvfybndl.supabase.co'),
  anonKey: (env.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || ''),
};

export const isSupabaseConfigured = Boolean(
  supabaseConfig.url && 
  supabaseConfig.anonKey && 
  !supabaseConfig.url.includes('your-project')
);

/**
 * Instância oficial do cliente Supabase para o Packager
 */
export const supabase: SupabaseClient = createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey || 'dummy-anon-key'
);
