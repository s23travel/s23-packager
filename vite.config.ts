import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { validateProductionEnv } from './src/lib/buildEnvGuard';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isProdBuild = mode === 'production' || command === 'build';

  if (isProdBuild) {
    // 1. Obter variáveis EXCLUSIVAMENTE do ambiente do processo (process.env)
    // Sem fallback para loadEnv(), .env.local, .env.production ou qualquer ficheiro local
    const candidateEnv = {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    };

    // 2. Validação determinística de build: exige explicitamente URL e chave anon de PROD,
    // rejeita DEV, valores ausentes, URLs malformadas, não-JWTs e chaves administrativas (service_role)
    const validated = validateProductionEnv(candidateEnv);

    return {
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        },
      },
      define: {
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(validated.url),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(validated.anonKey),
      },
      build: {
        outDir: 'dist',
        sourcemap: false,
      },
    };
  }

  // Modo de desenvolvimento local (vite dev)
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
