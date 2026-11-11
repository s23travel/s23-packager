// Render de conferência 1080 × 1920, offline: esbuild empacota o entry com as
// fontes e o logo embutidos, o Chrome headless tira o screenshot. Sem rede.
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const browser = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(existsSync);
if (!browser) throw new Error('Defina CHROME_PATH para um executável Chrome/Chromium.');

const output = resolve(process.env.PREVIEW_OUT || '.scratch/laminas-cotacoes/preview-ticket04.png');
const work = mkdtempSync(join(tmpdir(), 'packager-quotation-preview-'));
const bundlePath = join(work, 'preview.mjs');
const htmlPath = join(work, 'preview.html');

const bundle = await build({
  entryPoints: ['.scratch/laminas-cotacoes/quotation_flyer_preview.entry.tsx'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.ttf': 'dataurl', '.css': 'text' },
  define: { 'process.env.NODE_ENV': '"production"' },
});
writeFileSync(bundlePath, bundle.outputFiles[0].text);
const module = await import(`file:///${bundlePath.replace(/\\/g, '/')}`);
writeFileSync(htmlPath, module.default, 'utf8');

const profile = join(work, 'chrome-profile');
const child = spawn(browser, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--hide-scrollbars', '--force-device-scale-factor=1',
  `--user-data-dir=${profile}`, '--window-size=1080,1920',
  `--screenshot=${output}`, `file:///${htmlPath.replace(/\\/g, '/')}`,
], { stdio: 'ignore' });

try {
  const code = await new Promise(resolveExit => child.once('exit', resolveExit));
  if (code !== 0) throw new Error(`Chromium encerrou com código ${code}.`);
  const png = readFileSync(output);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== 1080 || height !== 1920) throw new Error(`PNG inesperado: ${width} × ${height}.`);
  console.log(`Prévia gerada: ${output} (${width} × ${height})`);
} finally {
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
