import { createPackageFlyerHtml, createPackageFlyerPng } from '../src/services/packageFlyerExport';
import type { PackageFlyerModel } from '../src/services/packageFlyerService';

const model: PackageFlyerModel = {
  version: 1, origin: 'Porto', destination: 'Açores', period: '12 a 19 de abril de 2027',
  price: { amount: 748, currency: 'BRL', formatted: 'R$ 748,00' },
  items: [{ kind: 'air', label: 'Aéreo' }], subtitle: 'Destino fictício',
  imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aR8AAAAASUVORK5CYII=',
};

async function run() {
  const backdrop = document.createElement('canvas');
  backdrop.width = 9; backdrop.height = 16;
  const context = backdrop.getContext('2d')!;
  context.fillStyle = '#ee9955'; context.fillRect(0, 0, 9, 8);
  context.fillStyle = '#88ccee'; context.fillRect(0, 8, 9, 8);
  model.imageUrl = backdrop.toDataURL('image/png');
  const original = JSON.stringify(model);
  const html = await (await createPackageFlyerHtml(model)).text();
  if (!html.includes('R$ 748,00') || !html.includes('Açores')) throw new Error('Dados revisados não preservados');
  if (!html.includes('data:image/png;base64,') || !html.includes('data:font/')) throw new Error('Recursos não incorporados');
  if (JSON.stringify(model) !== original) throw new Error('O modelo revisado foi alterado');
  for (const invalid of [
    { ...model, imageUrl: undefined },
    { ...model, imageUrl: 'data:image/png;base64,YmFk' },
    { ...model, subtitle: 'Texto excessivo '.repeat(1000) },
  ]) {
    let failed = false;
    try { await createPackageFlyerHtml(invalid); } catch { failed = true; }
    if (!failed) throw new Error('Recurso indisponível ou conteúdo excessivo deve bloquear exportação');
  }
  let pngFailed = false;
  try { await createPackageFlyerPng({ ...model, imageUrl: undefined }); } catch { pngFailed = true; }
  if (!pngFailed) throw new Error('PNG sem imagem deve ser bloqueado');
  const escaped = await (await createPackageFlyerHtml({ ...model, subtitle: '<script>erro</script>' })).text();
  if (escaped.includes('<script>')) throw new Error('Texto não escapado');
  const originalFetch = window.fetch;
  try {
    const imageBlob = await (await originalFetch(model.imageUrl!)).blob();
    window.fetch = (input, init) => String(input).startsWith('https://example.invalid/')
      ? Promise.resolve(new Response(imageBlob)) : originalFetch(input, init);
    const signed = await (await createPackageFlyerHtml({ ...model, imageUrl: 'https://example.invalid/destino?token=segredo' })).text();
    if (signed.includes('example.invalid') || signed.includes('token=segredo')) throw new Error('URL temporária vazou no HTML');
  } finally {
    window.fetch = originalFetch;
  }
  try {
    window.fetch = (input, init) => String(input).startsWith('data:font/')
      ? Promise.reject(new Error('fonte indisponível')) : originalFetch(input, init);
    let fontFailed = false;
    try { await createPackageFlyerHtml(model); } catch (error) {
      fontFailed = error instanceof Error && error.message.includes('fonte Poppins');
    }
    if (!fontFailed) throw new Error('Fonte indisponível deve bloquear exportação com erro claro');
  } finally {
    window.fetch = originalFetch;
  }
  const png = await createPackageFlyerPng(model);
  if (png.type !== 'image/png') throw new Error('PNG inválido');
  const image = new Image();
  image.src = URL.createObjectURL(png);
  await image.decode();
  if (image.naturalWidth !== 1080 || image.naturalHeight !== 1920) throw new Error('Dimensões inválidas');
  const pngCanvas = document.createElement('canvas');
  pngCanvas.width = 1080; pngCanvas.height = 1920;
  const pngContext = pngCanvas.getContext('2d')!;
  pngContext.drawImage(image, 0, 0);
  const top = pngContext.getImageData(500, 50, 1, 1).data;
  const bottom = pngContext.getImageData(500, 1870, 1, 1).data;
  if (top[3] !== 255 || bottom[3] !== 255 || top[0] === bottom[0]) throw new Error('Imagem não incorporada no PNG');
  image.style.width = '540px';
  image.id = 'exported-png';
  document.body.appendChild(image);
  const frame = document.createElement('iframe');
  frame.srcdoc = html;
  frame.id = 'exported-html';
  frame.style.cssText = 'width:1080px;height:1920px;border:0';
  document.body.appendChild(frame);
  document.body.dataset.result = 'ok';
}
run().catch(error => { document.body.dataset.result = `erro: ${error.message}`; });
