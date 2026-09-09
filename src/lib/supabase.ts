import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || 'https://iqtfqitquykasvfybndl.supabase.co',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
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
