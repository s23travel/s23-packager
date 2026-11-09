// Teste offline da interface pública de criação. APIs de IA e exportação simuladas.
// Não carrega .env nem acessa serviços externos.
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const browser = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(existsSync);
if (!browser) throw new Error('Defina CHROME_PATH para um executável Chrome/Chromium.');

const bundle = await build({
  entryPoints: ['tests/package_flyer_flow.browser.tsx'],
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  loader: { '.png': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{
    name: 'offline-flyer-apis',
    setup(builder) {
      builder.onResolve({ filter: /(?:flyerAiService|packageFlyerExport)$/ }, args => ({
        path: args.path.split('/').pop(), namespace: 'offline-flyer',
      }));
      builder.onLoad({ filter: /.*/, namespace: 'offline-flyer' }, args => ({
        loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'flyerAiService'
          ? `export async function generateFlyerAi(input) {
               const test = window.flyerFlowTest;
               test.generations.push(input);
               const suggestion = {success:true,data:{image:{mimeType:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aR8AAAAASUVORK5CYII='},subtitle:'Explore lagoas e paisagens'}};
               if (test.deferGeneration) return await new Promise(resolve => { test.resolveGeneration = resolve; });
               return suggestion;
             }`
          : `export async function createPackageFlyerHtml(model) {
               window.flyerFlowTest.htmlModels.push(structuredClone(model));
               return new Blob(['<!doctype html><title>fixture</title>'], {type:'text/html;charset=utf-8'});
             }
             export async function createPackageFlyerPng(model) {
               window.flyerFlowTest.pngModels.push(structuredClone(model));
               return new Blob(['png fixture'], {type:'image/png'});
             }`,
      }));
    },
  }],
});

let complete;
const result = new Promise(resolve => { complete = resolve; });
const server = createServer((req, res) => {
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'self' data: blob:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:" });
    res.end('<!doctype html><html lang="pt-BR"><body><main id="root"></main><script src="/test.js"></script></body></html>');
  } else if (req.url === '/test.js' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(bundle.outputFiles[0].contents);
  } else if (req.url === '/result' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => { res.end('ok'); complete(JSON.parse(body)); });
  } else { res.writeHead(404).end(); }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profile = mkdtempSync(join(tmpdir(), 'packager-flyer-flow-'));
const child = spawn(browser, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
  `--user-data-dir=${profile}`, `http://127.0.0.1:${server.address().port}/`,
], { stdio: 'ignore' });

try {
  const outcome = await Promise.race([
    result,
    new Promise(resolve => setTimeout(() => resolve({ ok: false, message: 'Chromium não retornou resultado em 20 segundos.' }), 20000).unref()),
    new Promise(resolve => child.once('exit', code => resolve({ ok: false, message: `Chromium encerrou antes do resultado: ${code}` }))),
  ]);
  console.log(outcome.message);
  if (!outcome.ok) process.exitCode = 1;
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill();
    await exited;
  }
  await new Promise(resolve => server.close(resolve));
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  catch { console.error(`Não foi possível remover o perfil temporário criado em ${profile}`); process.exitCode = 1; }
}
