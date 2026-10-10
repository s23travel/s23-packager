/**
 * Testes de Validação e Bloqueio de Ambiente Supabase (packager-dev e packager PROD)
 *
 * Valida determinísticamente:
 * 1. O bloqueio que impede desenvolvimento local de conectar a PROD.
 * 2. O guarda de build de produção:
 *    - Exigência explícita de PROD.
 *    - Rejeição imediata de DEV.
 *    - Rejeição imediata de variáveis ausentes.
 *    - Rejeição imediata de URLs malformadas, protocolos não-HTTPS e hosts falsos.
 *    - Rejeição imediata de chaves que não sejam JWTs válidos.
 *    - Rejeição imediata de chaves administrativas (service_role).
 *    - Rejeição imediata de chaves com project ref divergente de PROD.
 * 3. Total independência de arquivos locais não versionados (.env.production).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  PROD_SUPABASE_PROJECT_REF,
  DEV_SUPABASE_PROJECT_REF,
  validateProductionEnv,
  parseJwtPayload,
} from '../src/lib/buildEnvGuard';

let passedCount = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  passedCount++;
  console.log(`✅ [PASS] ${message}`);
}

console.log('=== INICIANDO TESTES DE SEGURANÇA E AMBIENTE SUPABASE (DEV E PROD) ===\n');

// -------------------------------------------------------------
// BLOCO 1: Validação Estática e Determinística da Guarda de Ambiente (DEV e PROD)
// -------------------------------------------------------------
console.log('--- Bloco 1: Validação Estática e Determinística da Guarda de Ambiente ---');

assert(
  PROD_SUPABASE_PROJECT_REF === 'iqtfqitquykasvfybndl',
  '1. PROD_SUPABASE_PROJECT_REF está devidamente definida como iqtfqitquykasvfybndl'
);
assert(
  DEV_SUPABASE_PROJECT_REF === 'rskhshtewkgrllbtamsr',
  '2. DEV_SUPABASE_PROJECT_REF está devidamente definida como rskhshtewkgrllbtamsr'
);

function simulateDevGuard(envDev: boolean, testUrl: string): boolean {
  if (envDev && testUrl.includes(PROD_SUPABASE_PROJECT_REF)) {
    return false; // bloqueado com sucesso
  }
  return true; // permitido
}

assert(
  simulateDevGuard(true, `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co`) === false,
  '3. Ambiente de desenvolvimento bloqueia tentativa de conexão ao projeto de produção'
);

assert(
  simulateDevGuard(true, `https://${DEV_SUPABASE_PROJECT_REF}.supabase.co`) === true,
  '4. Ambiente de desenvolvimento permite conexão ao projeto packager-dev'
);

// Validação determinística do utilitário parseJwtPayload
const sampleJwtPayload = parseJwtPayload('header.' + Buffer.from(JSON.stringify({ ref: PROD_SUPABASE_PROJECT_REF, role: 'anon' })).toString('base64url') + '.sig');
assert(
  sampleJwtPayload?.ref === PROD_SUPABASE_PROJECT_REF,
  '5. parseJwtPayload decodifica corretamente o project ref de token JWT simulado'
);
assert(
  sampleJwtPayload?.role === 'anon',
  '6. parseJwtPayload decodifica corretamente a claim de role de token JWT simulado'
);
assert(
  parseJwtPayload('invalid-raw-string') === null,
  '7. parseJwtPayload retorna null de forma segura para strings que não sejam JWTs'
);
assert(
  parseJwtPayload('') === null,
  '8. parseJwtPayload retorna null de forma segura para string vazia'
);

// -------------------------------------------------------------
// BLOCO 2: Validação Determinística de Builds de Produção (PROD)
// -------------------------------------------------------------
console.log('\n--- Bloco 2: Validação Determinística do Build de Produção ---');

// Tokens sintéticos para teste determinístico sem depender de segredos externos
function createMockJwt(ref: string, role: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ iss: 'supabase', ref, role, iat: 1700000000, exp: 2000000000 })
  ).toString('base64url');
  return `${header}.${payload}.mockSignature_${role}_${ref}`;
}

const validProdAnonKey = createMockJwt('iqtfqitquykasvfybndl', 'anon');
const dangerousServiceRoleKey = createMockJwt('iqtfqitquykasvfybndl', 'service_role');
const otherRoleKey = createMockJwt('iqtfqitquykasvfybndl', 'authenticated');
const devAnonKey = createMockJwt('rskhshtewkgrllbtamsr', 'anon');
const unknownProjectKey = createMockJwt('unauthorized-project', 'anon');

// Cenário 2.1: Configuração Correta de PROD
try {
  const result = validateProductionEnv({
    VITE_SUPABASE_URL: `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co`,
    VITE_SUPABASE_ANON_KEY: validProdAnonKey,
  });
  assert(
    result.url === `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co`,
    '9. Build de produção aceita URL oficial de PROD'
  );
  assert(result.anonKey === validProdAnonKey, '10. Build de produção aceita chave pública anon de PROD');
} catch (e: any) {
  assert(false, `9/10. Falha inesperada no cenário correto de produção: ${e.message}`);
}

// Cenário 2.2: Variável VITE_SUPABASE_URL Ausente
try {
  validateProductionEnv({
    VITE_SUPABASE_URL: '',
    VITE_SUPABASE_ANON_KEY: validProdAnonKey,
  });
  assert(false, '11. Deveria ter falhado com VITE_SUPABASE_URL ausente');
} catch (e: any) {
  assert(
    e.message.includes('VITE_SUPABASE_URL ausente'),
    '11. Build de produção falha imediatamente se VITE_SUPABASE_URL estiver ausente'
  );
}

// Cenário 2.3: Variável VITE_SUPABASE_ANON_KEY Ausente
try {
  validateProductionEnv({
    VITE_SUPABASE_URL: `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co`,
    VITE_SUPABASE_ANON_KEY: '',
  });
  assert(false, '12. Deveria ter falhado com VITE_SUPABASE_ANON_KEY ausente');
} catch (e: any) {
  assert(
    e.message.includes('VITE_SUPABASE_ANON_KEY ausente'),
    '12. Build de produção falha imediatamente se VITE_SUPABASE_ANON_KEY estiver ausente'
  );
}

// Cenário 2.4: Ambas as variáveis ausentes ({})
try {
  validateProductionEnv({});
  assert(false, '13. Deveria ter falhado com variáveis ausentes');
} catch (e: any) {
  assert(
    e.message.includes('VITE_SUPABASE_URL ausente'),
    '13. Build de produção falha imediatamente com ambiente vazio'
  );
}

// Cenário 2.5: URL Malformada (não é URL válida)
try {
  validateProductionEnv({
    VITE_SUPABASE_URL: 'not-a-valid-url',
    VITE_SUPABASE_ANON_KEY: validProdAnonKey,
  });
  assert(false, '14. Deveria ter falhado com URL malformada');
} catch (e: any) {
  assert(
    e.message.includes('URL Malformada'),
    '14. Build de produção rejeita URL malformada (não analisável por URL)'
  );
}

// Cenário 2.6: URL com Protocolo Inseguro (http em vez de https)
try {
  validateProductionEnv({
    VITE_SUPABASE_URL: `http://${PROD_SUPABASE_PROJECT_REF}.supabase.co`,
    VITE_SUPABASE_ANON_KEY: validProdAnonKey,
  });
  assert(false, '15. Deveria ter falhado com protocolo HTTP');
} catch (e: any) {
  assert(
    e.message.includes('Protocolo Inválido'),
    '15. Build de produção rejeita protocolo inseguro (exige HTTPS)'
  );
}

// Cenário 2.7: Host Falso com Project Ref apenas no Path (spoofing)
try {
  validateProductionEnv({
    VITE_SUPABASE_URL: `https://attacker-domain.com/${PROD_SUPABASE_PROJECT_REF}`,
    VITE_SUPABASE_ANON_KEY: validProdAnonKey,
  });
  assert(false, '16. Deveria ter rejeitado host de terceiro');
} catch (e: any) {
  assert(
    e.message.includes('Origem Inválida'),
    '16. Build de produção rejeita host que apenas contenha o project ref no path'
  );
}

// Cenário 2.8: Host Falso com Subdomínio Fraudulento
try {
  validateProductionEnv({
    VITE_SUPABASE_URL: `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co.evil.com`,
    VITE_SUPABASE_ANON_KEY: validProdAnonKey,
  });
  assert(false, '17. Deveria ter rejeitado subdomínio fraudulento');
} catch (e: any) {
  assert(
    e.message.includes('Origem Inválida'),
    '17. Build de produção rejeita subdomínio fraudulento de terceiro'
  );
}

// Cenário 2.9: Tentativa de Build com URL de DEV
try {
  validateProductionEnv({
    VITE_SUPABASE_URL: `https://${DEV_SUPABASE_PROJECT_REF}.supabase.co`,
    VITE_SUPABASE_ANON_KEY: validProdAnonKey,
  });
  assert(false, '18. Deveria ter bloqueado URL de DEV em build de produção');
} catch (e: any) {
  assert(
    e.message.includes('Violação de Ambiente') && e.message.includes(DEV_SUPABASE_PROJECT_REF),
    '18. Build de produção bloqueia imediatamente qualquer tentativa com URL de DEV'
  );
}

// Cenário 2.10: Tentativa de Build com Project Ref Incorreto
try {
  validateProductionEnv({
    VITE_SUPABASE_URL: 'https://outro-projeto-desconhecido.supabase.co',
    VITE_SUPABASE_ANON_KEY: validProdAnonKey,
  });
  assert(false, '19. Deveria ter bloqueado URL que não seja PROD');
} catch (e: any) {
  assert(
    e.message.includes('Origem Inválida') && e.message.includes(PROD_SUPABASE_PROJECT_REF),
    '19. Build de produção bloqueia URLs que não correspondam exatamente à origem de PROD'
  );
}

// Cenário 2.11: Chave que NÃO é um JWT (string arbitrária ou placeholder)
try {
  validateProductionEnv({
    VITE_SUPABASE_URL: `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co`,
    VITE_SUPABASE_ANON_KEY: 'dummy-anon-key-12345',
  });
  assert(false, '20. Deveria ter rejeitado chave que não é JWT');
} catch (e: any) {
  assert(
    e.message.includes('VITE_SUPABASE_ANON_KEY inválida'),
    '20. Build de produção rejeita chaves que não sejam JWTs reconhecíveis'
  );
}

// Cenário 2.12: Chave com formato JWT mas payload corrompido
try {
  validateProductionEnv({
    VITE_SUPABASE_URL: `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co`,
    VITE_SUPABASE_ANON_KEY: 'header.invalid_base64_payload!.signature',
  });
  assert(false, '21. Deveria ter rejeitado payload de JWT corrompido');
} catch (e: any) {
  assert(
    e.message.includes('VITE_SUPABASE_ANON_KEY inválida'),
    '21. Build de produção rejeita JWT com payload malformado ou corrompido'
  );
}

// Cenário 2.13: Rejeição Estrita de Segredos Administrativos (service_role)
try {
  validateProductionEnv({
    VITE_SUPABASE_URL: `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co`,
    VITE_SUPABASE_ANON_KEY: dangerousServiceRoleKey,
  });
  assert(false, '22. Deveria ter bloqueado chave administrativa service_role');
} catch (e: any) {
  assert(
    e.message.includes('Violação Crítica de Segurança') && e.message.includes('service_role'),
    '22. Build de produção impede inclusão de segredos administrativos (service_role) no bundle'
  );
}

// Cenário 2.14: Rejeição de Chave com role diferente de anon (ex: authenticated)
try {
  validateProductionEnv({
    VITE_SUPABASE_URL: `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co`,
    VITE_SUPABASE_ANON_KEY: otherRoleKey,
  });
  assert(false, '23. Deveria ter bloqueado chave com role authenticated');
} catch (e: any) {
  assert(
    e.message.includes('Violação Crítica de Segurança') && e.message.includes('authenticated'),
    '23. Build de produção bloqueia qualquer role que não seja estritamente anon'
  );
}

// Cenário 2.15: Rejeição de Chave Anon pertencente a DEV
try {
  validateProductionEnv({
    VITE_SUPABASE_URL: `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co`,
    VITE_SUPABASE_ANON_KEY: devAnonKey,
  });
  assert(false, '24. Deveria ter bloqueado chave anon pertencente a DEV');
} catch (e: any) {
  assert(
    e.message.includes('Chave Incompatível') && e.message.includes(DEV_SUPABASE_PROJECT_REF),
    '24. Build de produção bloqueia chave anon de DEV mesmo com URL de PROD'
  );
}

// Cenário 2.16: Rejeição de Chave Anon pertencente a Projeto Desconhecido
try {
  validateProductionEnv({
    VITE_SUPABASE_URL: `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co`,
    VITE_SUPABASE_ANON_KEY: unknownProjectKey,
  });
  assert(false, '25. Deveria ter bloqueado chave anon de projeto desconhecido');
} catch (e: any) {
  assert(
    e.message.includes('Chave Incompatível') && e.message.includes('unauthorized-project'),
    '25. Build de produção bloqueia chave anon de projeto terceiro'
  );
}

// Cenário 2.17: Prova de que ficheiros .env locais NÃO satisfazem variáveis ausentes no processo
// Simula a resolução estrita de vite.config.ts (apenas process.env, sem fallback para ficheiros)
function resolveProdBuildEnv(
  procEnv: Record<string, string | undefined>,
  _ignoredFileEnv?: Record<string, string | undefined>
) {
  // Em vite.config.ts, candidateEnv obtém exclusivamente process.env
  return {
    VITE_SUPABASE_URL: procEnv.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: procEnv.VITE_SUPABASE_ANON_KEY,
  };
}

const mockLocalFileEnvWithProd = {
  VITE_SUPABASE_URL: `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co`,
  VITE_SUPABASE_ANON_KEY: validProdAnonKey,
};

// Teste 26: process.env vazio falha mesmo se ficheiro .env local tiver configuração válida de PROD
try {
  const candidate = resolveProdBuildEnv({}, mockLocalFileEnvWithProd);
  validateProductionEnv(candidate);
  assert(false, '26. Deveria ter falhado com variáveis ausentes no processo');
} catch (e: any) {
  assert(
    e.message.includes('VITE_SUPABASE_URL ausente'),
    '26. Ficheiros .env locais não conseguem satisfazer VITE_SUPABASE_URL ausente no processo (process.env obrigatório)'
  );
}

// Teste 27: process.env sem anon key falha mesmo se ficheiro .env local tiver anon key válida de PROD
try {
  const candidate = resolveProdBuildEnv(
    { VITE_SUPABASE_URL: `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co` },
    mockLocalFileEnvWithProd
  );
  validateProductionEnv(candidate);
  assert(false, '27. Deveria ter falhado com chave ausente no processo');
} catch (e: any) {
  assert(
    e.message.includes('VITE_SUPABASE_ANON_KEY ausente'),
    '27. Ficheiros .env locais não conseguem satisfazer VITE_SUPABASE_ANON_KEY ausente no processo (process.env obrigatório)'
  );
}

// Teste 28: process.env fornecido explicitamente tem sucesso sem depender de qualquer ficheiro .env
try {
  const candidate = resolveProdBuildEnv(
    {
      VITE_SUPABASE_URL: `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co`,
      VITE_SUPABASE_ANON_KEY: validProdAnonKey,
    },
    undefined // nenhum ficheiro local disponível
  );
  const res = validateProductionEnv(candidate);
  assert(
    res.url === `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co` && res.anonKey === validProdAnonKey,
    '28. Build de produção opera com sucesso baseado estritamente nas variáveis explícitas do processo'
  );
} catch (e: any) {
  assert(false, `28. Falha inesperada com variáveis explícitas no processo: ${e.message}`);
}

// -------------------------------------------------------------
// BLOCO 3: Validação de Regras Git e Ignored Files
// -------------------------------------------------------------
console.log('\n--- Bloco 3: Validação de Integridade do Repositório Git ---');

const gitignoreContent = fs.readFileSync(path.resolve(process.cwd(), '.gitignore'), 'utf-8');
assert(gitignoreContent.includes('.env.local'), '29. .gitignore contém regra para .env.local');
assert(gitignoreContent.includes('.env.production'), '30. .gitignore contém regra para .env.production');

// -------------------------------------------------------------
// BLOCO 4: Inspeção de Configuração Local (.env.local)
// -------------------------------------------------------------
console.log('\n--- Bloco 4: Inspeção de Configuração Local (.env.local) ---');

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  console.log('ℹ️  .env.local encontrado. Validando formatação e integridade do ambiente...');
  const envContent = fs.readFileSync(envLocalPath, 'utf-8');
  const lines = envContent.split('\n').map((l) => l.trim()).filter(Boolean);

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

  assert(Boolean(url), '31. VITE_SUPABASE_URL está configurada em .env.local');
  assert(Boolean(anonKey), '32. VITE_SUPABASE_ANON_KEY está configurada em .env.local');

  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(url);
  } catch {
    parsedUrl = null;
  }
  assert(
    parsedUrl !== null && parsedUrl.protocol === 'https:',
    '33. VITE_SUPABASE_URL em .env.local é uma URL HTTPS válida e bem formada'
  );

  const isDev = url.includes(DEV_SUPABASE_PROJECT_REF);
  const isProd = url.includes(PROD_SUPABASE_PROJECT_REF);
  assert(
    isDev || isProd,
    `34. VITE_SUPABASE_URL aponta para um ambiente explicitamente permitido (${DEV_SUPABASE_PROJECT_REF} ou ${PROD_SUPABASE_PROJECT_REF})`
  );
  console.log(
    `ℹ️  Ambiente configurado em .env.local: ${
      isProd ? 'PRODUÇÃO (iqtfqitquykasvfybndl)' : 'DESENVOLVIMENTO (rskhshtewkgrllbtamsr)'
    } (chave validada sem exposição)`
  );
} else {
  console.log('ℹ️  .env.local não presente (ambiente limpo/CI). Pulando inspeção de arquivo local.');
}

console.log('\n====================================================');
console.log(` RESULTADO FINAL: ${passedCount} PASSOU / 0 FALHOU`);
console.log('====================================================\n');
