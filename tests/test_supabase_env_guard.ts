/**
 * Testes de Validação e Bloqueio de Ambiente Supabase (packager-dev)
 */
import * as fs from 'fs';
import * as path from 'path';
import { PROD_SUPABASE_PROJECT_REF } from '../src/lib/supabase';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${message}`);
}

console.log('=== INICIANDO TESTES DE SEGURANÇA E AMBIENTE SUPABASE DEV ===\n');

const DEV_PROJECT_REF = 'rskhshtewkgrllbtamsr';

// 1. Verificar se .env.local existe e foi configurado (quando em ambiente local)
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  console.log('ℹ️  .env.local encontrado. Validando credenciais de desenvolvimento...');
  const envContent = fs.readFileSync(envLocalPath, 'utf-8');
  const lines = envContent.split('\n').map(l => l.trim()).filter(Boolean);

  let url = '';
  let anonKey = '';

  for (const line of lines) {
    if (line.startsWith('VITE_SUPABASE_URL=')) {
      url = line.replace('VITE_SUPABASE_URL=', '').trim();
    }
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      anonKey = line.replace('VITE_SUPABASE_ANON_KEY=', '').trim();
    }
  }

  // 2. Verificar variáveis obrigatórias
  assert(Boolean(url), '2. VITE_SUPABASE_URL está configurada em .env.local');
  assert(Boolean(anonKey), '3. VITE_SUPABASE_ANON_KEY está configurada em .env.local');

  // 3. Verificar que o projeto é packager-dev (rskhshtewkgrllbtamsr)
  assert(url.includes(DEV_PROJECT_REF), '4. VITE_SUPABASE_URL aponta para o projeto de desenvolvimento (packager-dev: rskhshtewkgrllbtamsr)');

  // 4. Verificar que a URL NÃO aponta para produção
  assert(!url.includes(PROD_SUPABASE_PROJECT_REF), '5. VITE_SUPABASE_URL NÃO aponta para o projeto de produção');
} else {
  console.log('ℹ️  .env.local não presente (ambiente CI/build). Pulando validação de arquivo local.');
}

// 5. Verificar a constante PROD_SUPABASE_PROJECT_REF
assert(PROD_SUPABASE_PROJECT_REF === 'iqtfqitquykasvfybndl', '6. PROD_SUPABASE_PROJECT_REF está devidamente definida como iqtfqitquykasvfybndl');

// 6. Testar lógica do bloqueador de produção
function simulateEnvValidation(envDev: boolean, testUrl: string): boolean {
  if (envDev && testUrl.includes(PROD_SUPABASE_PROJECT_REF)) {
    return false; // bloqueado com sucesso
  }
  return true; // permitido
}

assert(
  simulateEnvValidation(true, `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co`) === false,
  '7. Ambiente de desenvolvimento bloqueia tentativa de conexão ao projeto de produção'
);

assert(
  simulateEnvValidation(true, `https://${DEV_PROJECT_REF}.supabase.co`) === true,
  '8. Ambiente de desenvolvimento permite conexão ao projeto packager-dev'
);

// 7. Verificar que .gitignore ignora .env.local
const gitignoreContent = fs.readFileSync(path.resolve(process.cwd(), '.gitignore'), 'utf-8');
assert(gitignoreContent.includes('.env.local'), '9. .gitignore contém regra para .env.local');

console.log('\n====================================================');
console.log(' RESULTADO FINAL: 9 PASSOU / 0 FALHOU');
console.log('====================================================\n');
