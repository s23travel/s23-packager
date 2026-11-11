// Teste offline da interface pública da lâmina de cotação. IA e persistência
// simuladas; não carrega .env nem acessa serviços externos.
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

const mocks = {
  flyerAiService: `export async function generateFlyerAi(input) {
    const test = window.flyerFlowTest;
    test.generations.push(input);
    return {success:true,data:{image:{mimeType:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aR8AAAAASUVORK5CYII='},subtitle:'Paris na primavera, entre cafés e boulevards'}};
  }`,
  quotationFlyerAttachmentService: `export async function getCurrentQuotationFlyer(quotationId) {
    window.flyerFlowTest.currentReads.push(quotationId);
    return window.flyerFlowTest.currents[quotationId] ?? null;
  }
  export async function createQuotationFlyerServerPreview(input) {
    window.flyerFlowTest.previews.push(structuredClone(input));
    return {requestId:input.requestId,expectedRevision:input.expectedRevision,preview:new Blob(['png fixture'],{type:'image/png'})};
  }
  export async function publishQuotationFlyer(input) {
    window.flyerFlowTest.publications.push(structuredClone(input));
    return {revision:1,savedAt:'2026-11-11T12:00:00.000Z'};
  }
  export async function downloadSavedQuotationFlyer(quotationId,format) {
    window.flyerFlowTest.savedDownloads.push(quotationId+':'+format);
    return new Blob(['saved fixture'],{type:format==='png'?'image/png':'text/html'});
  }`,
};

const bundle = await build({
  entryPoints: ['tests/quotation_flyer_flow.browser.tsx'],
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', charset: 'utf8',
  loader: { '.png': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{
    name: 'offline-quotation-flyer-apis',
    setup(builder) {
      builder.onResolve({ filter: /(?:flyerAiService|quotationFlyerAttachmentService)$/ }, args => ({
        path: args.path.split('/').pop(), namespace: 'offline-flyer',
      }));
      builder.onLoad({ filter: /.*/, namespace: 'offline-flyer' }, args => ({
        loader: 'tsx', resolveDir: process.cwd(), contents: mocks[args.path] || '',
      }));
    },
  }],
});

let complete;
const result = new Promise(resolve => { complete = resolve; });
const server = createServer((req, res) => {
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'self' data: blob:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:" });
    res.end('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body><main id="root"></main><script src="/test.js"></script></body></html>');
  } else if (req.url === '/test.js' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    res.end(bundle.outputFiles[0].contents);
  } else if (req.url === '/result' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => { res.end('ok'); complete(JSON.parse(body)); });
  } else { res.writeHead(404).end(); }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profile = mkdtempSync(join(tmpdir(), 'packager-quotation-flyer-flow-'));
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
