import assert from 'node:assert/strict';
import { flyerDownloadName, sanitizeFlyerFilePart, triggerFlyerDownload } from '../src/services/flyerDownload';

// Nome do ficheiro: mesmo resultado da lâmina de pacote antes da extração.
assert.equal(sanitizeFlyerFilePart('Açores'), 'acores');
assert.equal(sanitizeFlyerFilePart('  COT-2026-059  '), 'cot-2026-059');
assert.equal(sanitizeFlyerFilePart(''), '');
assert.equal(flyerDownloadName('lamina', ['Açores'], 'png'), 'lamina-acores.png');
assert.equal(flyerDownloadName('lamina', ['Açores'], 'html'), 'lamina-acores.html');
assert.equal(flyerDownloadName('lamina', [''], 'png'), 'lamina-viagem.png');
assert.equal(flyerDownloadName('lamina-cotacao', ['COT-2026-059', 'Paris'], 'png'), 'lamina-cotacao-cot-2026-059-paris.png');
console.log('Nome do ficheiro: OK');

// Download: entrega o PNG do servidor sem recompressão e revoga o URL temporário.
const originalDocument = globalThis.document;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalSetTimeout = globalThis.setTimeout;
const clicked: string[] = [];
const revoked: string[] = [];
let appended = 0;
let urlCount = 0;

(globalThis as { document?: unknown }).document = {
  createElement() {
    return {
      href: '', download: '',
      click(this: { download: string }) { clicked.push(this.download); },
      remove() { /* noop */ },
    };
  },
  body: { appendChild() { appended += 1; } },
};
URL.createObjectURL = () => `blob:teste-${++urlCount}`;
URL.revokeObjectURL = (url: string) => { revoked.push(url); };
(globalThis as { setTimeout: unknown }).setTimeout = (callback: () => void) => { callback(); return 0; };

try {
  const tracked = new Set<string>();
  const png = new Blob(['png'], { type: 'image/png' });
  triggerFlyerDownload(png, flyerDownloadName('lamina', ['Açores'], 'png'), tracked);
  assert.deepEqual(clicked, ['lamina-acores.png']);
  assert.equal(appended, 1);
  assert.equal(tracked.size, 0, 'o URL temporário sai do registo após o download');
  assert.deepEqual(revoked, ['blob:teste-1']);
} finally {
  (globalThis as { document?: unknown }).document = originalDocument;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  (globalThis as { setTimeout: unknown }).setTimeout = originalSetTimeout;
}
console.log('Download PNG: OK');
