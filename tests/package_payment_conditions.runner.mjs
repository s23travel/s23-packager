// Teste offline do formulário público. Usa esbuild (dependência transitiva do Vite)
// e Chrome/Chromium instalado; não carrega .env nem permite acesso a serviços externos.
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const browser = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(existsSync);
if (!browser) throw new Error('Defina CHROME_PATH para um executável Chrome/Chromium.');

const mocks = {
  packagesService: `export const packagesService = {
    getNextReference: async () => 'PK-2026-999',
    isReferenceAvailable: async () => true,
    getPackageById: async () => window.packageTest.loaded,
    createPackage: async (input) => { window.packageTest.calls.push('create'); window.packageTest.saved.push(input); return { id: 'new' }; },
    updatePackage: async (id, input) => { window.packageTest.calls.push('update:' + id); window.packageTest.saved.push(input); return { id }; },
  };`,
  PackageServicesEditor: `import React from 'react';
    export function PackageServicesEditor({ onAddNewService }) {
      return <button type="button" onClick={() => onAddNewService('hotel', 'Hotel fictício')}>Adicionar serviço fictício</button>;
    }`,
  ImageImportModal: `export function ImageImportModal() { return null; }`,
};

const bundle = await build({
  entryPoints: ['tests/package_payment_conditions.browser.tsx'],
  bundle: true, write: false, platform: 'browser', format: 'iife',
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{
    name: 'offline-mocks',
    setup(builder) {
      builder.onResolve({ filter: /(?:packagesService|PackageServicesEditor|ImageImportModal)$/ }, (args) => ({
        path: args.path.split('/').pop(), namespace: 'mock',
      }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, (args) => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: process.cwd() }));
    },
  }],
});

let complete;
const result = new Promise((resolve) => { complete = resolve; });
const server = createServer((req, res) => {
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'self'; connect-src 'self'" });
    res.end('<!doctype html><html><body><div id="root"></div><script src="/test.js"></script></body></html>');
  } else if (req.url === '/test.js' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(bundle.outputFiles[0].contents);
  } else if (req.url === '/result' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => { res.end('ok'); complete(JSON.parse(body)); });
  } else {
    res.writeHead(404).end();
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const profile = mkdtempSync(join(process.cwd(), '.package-form-browser-'));
const child = spawn(browser, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
  `--user-data-dir=${profile}`, `http://127.0.0.1:${server.address().port}/`,
], { stdio: 'ignore' });

try {
  const outcome = await Promise.race([
    result,
    new Promise((resolve) => setTimeout(() => resolve({ ok: false, message: 'Navegador não retornou resultado em 20 segundos.' }), 20000).unref()),
    new Promise((resolve) => child.once('exit', (code) => resolve({ ok: false, message: `Navegador encerrou antes do resultado: ${code}` }))),
  ]);
  console.log(outcome.message);
  if (!outcome.ok) process.exitCode = 1;
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill();
    await exited;
  }
  await new Promise((resolve) => server.close(resolve));
  // Apenas o perfil temporário criado por este teste é removido.
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    console.error(`Não foi possível remover o perfil temporário criado em ${profile}`);
    process.exitCode = 1;
  }
}
