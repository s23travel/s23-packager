import assert from 'node:assert/strict';
import { convertPngToJpg, flyerDownloadName, sanitizeFlyerFilePart, triggerFlyerDownload } from '../src/services/flyerDownload';

// Nome do ficheiro: mesmo resultado da lâmina de pacote antes da extração.
assert.equal(sanitizeFlyerFilePart('Açores'), 'acores');
assert.equal(sanitizeFlyerFilePart('  COT-2026-059  '), 'cot-2026-059');
assert.equal(sanitizeFlyerFilePart(''), '');
assert.equal(flyerDownloadName('lamina', ['Açores'], 'jpg'), 'lamina-acores.jpg');
assert.equal(flyerDownloadName('lamina', ['Açores'], 'html'), 'lamina-acores.html');
assert.equal(flyerDownloadName('lamina', [''], 'png'), 'lamina-viagem.png');
assert.equal(flyerDownloadName('lamina-cotacao', ['COT-2026-059', 'Paris'], 'jpg'), 'lamina-cotacao-cot-2026-059-paris.jpg');
console.log('Nome do ficheiro: OK');

interface FakeCanvas { toBlob: (callback: (blob: Blob | null) => void, type?: string) => void }
const bitmap = { width: 1080, height: 1920, closed: false, close() { this.closed = true; } };

async function withDom(options: { context?: object | null; jpeg?: boolean; nullBlob?: boolean }, run: (state: {
  canvas: FakeCanvas; clicked: string[]; revoked: string[]; appended: number;
}) => Promise<void>) {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalSetTimeout = globalThis.setTimeout;
  const state = { canvas: null as unknown as FakeCanvas, clicked: [] as string[], revoked: [] as string[], appended: 0 };
  let urlCount = 0;
  globalThis.createImageBitmap = async () => bitmap as unknown as ImageBitmap;
  state.canvas = {
    toBlob(callback, type) {
      if (options.nullBlob) { callback(null); return; }
      callback(new Blob(['imagem'], { type: options.jpeg === false ? 'image/png' : type }));
    },
  };
  (globalThis as { document?: unknown }).document = {
    createElement(tag: string) {
      if (tag === 'canvas') {
        return { width: 0, height: 0, getContext: () => options.context === undefined ? { drawImage: () => undefined } : options.context, toBlob: state.canvas.toBlob };
      }
      return {
        href: '', download: '',
        click(this: { download: string }) { state.clicked.push(this.download); },
        remove() { /* noop */ },
      };
    },
    body: { appendChild() { state.appended += 1; } },
  };
  URL.createObjectURL = () => `blob:teste-${++urlCount}`;
  URL.revokeObjectURL = (url: string) => { state.revoked.push(url); };
  (globalThis as { setTimeout: unknown }).setTimeout = (callback: () => void) => { callback(); return 0; };
  try {
    await run(state);
  } finally {
    globalThis.createImageBitmap = originalCreateImageBitmap;
    (globalThis as { document?: unknown }).document = originalDocument;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    (globalThis as { setTimeout: unknown }).setTimeout = originalSetTimeout;
  }
}

await withDom({}, async state => {
  const jpg = await convertPngToJpg(new Blob(['png'], { type: 'image/png' }));
  assert.equal(jpg.type, 'image/jpeg');
  assert.equal(bitmap.closed, true, 'o bitmap precisa ser libertado');

  const tracked = new Set<string>();
  triggerFlyerDownload(jpg, flyerDownloadName('lamina', ['Açores'], 'jpg'), tracked);
  assert.deepEqual(state.clicked, ['lamina-acores.jpg']);
  assert.equal(state.appended, 1);
  assert.equal(tracked.size, 0, 'o URL temporário sai do registo após o download');
  assert.deepEqual(state.revoked, ['blob:teste-1']);
});
console.log('Conversão PNG→JPG e download: OK');

await withDom({ context: null }, async () => {
  bitmap.closed = false;
  await assert.rejects(() => convertPngToJpg(new Blob(['png'], { type: 'image/png' })), /preparar a conversão/);
  assert.equal(bitmap.closed, true, 'o bitmap é libertado quando falta o contexto');
});
await withDom({ jpeg: false }, async () => {
  bitmap.closed = false;
  await assert.rejects(() => convertPngToJpg(new Blob(['png'], { type: 'image/png' })), /não foi convertida/);
  assert.equal(bitmap.closed, true, 'o bitmap é libertado quando o canvas devolve outro formato');
});
await withDom({ nullBlob: true }, async () => {
  bitmap.closed = false;
  await assert.rejects(() => convertPngToJpg(new Blob(['png'], { type: 'image/png' })), /converter a lâmina/);
  assert.equal(bitmap.closed, true, 'o bitmap é libertado quando o canvas falha');
});
console.log('Falhas da conversão: OK');
