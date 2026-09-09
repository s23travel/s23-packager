import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env: Record<string, any> =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : typeof process !== 'undefined' && process.env
    ? process.env
    : {};

export const supabaseConfig = {
  url: (env.VITE_SUPABASE_URL as string) || 'https://iqtfqitquykasvfybndl.supabase.co',
  anonKey: (env.VITE_SUPABASE_ANON_KEY as string) || '',
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
