import assert from 'node:assert/strict';
import { createFlyerAiHandler } from '../supabase/functions/generate-flyer-ai/handler.ts';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aR8AAAAASUVORK5CYII=';
const JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==';
const cors = { 'Access-Control-Allow-Origin': '*' };

type Reply = { status?: number; body: unknown };
const modelReply = (parts: unknown[]): Reply => ({ body: { candidates: [{ finishReason: 'STOP', content: { parts } }] } });

function createHarness(replies: Reply[]) {
  const calls: Array<{ endpoint: string; modalities: unknown; imageConfig: unknown; promptLength: number; prompt: string }> = [];
  const fetchMock: typeof fetch = async (input, init) => {
    const body = JSON.parse(String(init?.body || '{}'));
    const prompt = String(body?.contents?.[0]?.parts?.[0]?.text || '');
    calls.push({ endpoint: String(input), modalities: body?.generationConfig?.responseModalities,
      imageConfig: body?.generationConfig?.imageConfig, promptLength: prompt.length, prompt });
    const reply = replies.shift() || { status: 500, body: {} };
    return new Response(JSON.stringify(reply.body), { status: reply.status || 200, headers: { 'Content-Type': 'application/json' } });
  };
  const handler = createFlyerAiHandler({
    requireUser: async () => null,
    getApiKey: () => 'test-key',
    fetch: fetchMock,
  });
  return { handler, calls };
}

const request = () => new Request('https://edge.example/generate-flyer-ai', {
  method: 'POST', headers: { Authorization: 'Bearer user', 'Content-Type': 'application/json' },
  body: JSON.stringify({ destination: 'Maiorca', hint: 'Trem Bernina entre paisagens de gelo' }),
});

async function run() {
  const retry = createHarness([
    modelReply([{ text: 'Descubra a ilha de encantos.' }]),
    modelReply([{ inlineData: { mimeType: 'image/png', data: PNG } }]),
  ]);
  const ok = await retry.handler(request());
  const okBody = await ok.json() as { success: boolean; data: { image: { mimeType: string }; subtitle: string } };
  assert.equal(ok.status, 200);
  assert.equal(okBody.success, true);
  assert.equal(okBody.data.subtitle, 'Descubra a ilha de encantos.');
  assert.equal(okBody.data.image.mimeType, 'image/png');
  assert.equal(retry.calls.length, 2);
  assert.equal(retry.calls[0].endpoint, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-nano-banana-2.1:generateContent');
  assert.deepEqual(retry.calls[0].imageConfig, { aspectRatio: '9:16', imageSize: '1K' });
  assert.deepEqual(retry.calls[0].modalities, ['TEXT', 'IMAGE']);
  assert.deepEqual(retry.calls[1].modalities, ['IMAGE']);
  assert.match(retry.calls[0].prompt, /Maiorca.*Trem Bernina entre paisagens de gelo/s);
  assert.match(retry.calls[1].prompt, /Maiorca.*Trem Bernina entre paisagens de gelo/s);

  const firstTry = createHarness([modelReply([{ text: 'Uma frase qualquer.' }, { inlineData: { mimeType: 'image/png', data: PNG } }])]);
  const firstResponse = await firstTry.handler(request());
  assert.equal(firstResponse.status, 200);
  assert.equal(firstTry.calls.length, 1);

  const jpegResponse = createHarness([modelReply([{ text: 'Conheça um destino de beleza natural.' }, { inlineData: { mimeType: 'image/jpeg', data: JPEG } }])]);
  const jpeg = await jpegResponse.handler(request());
  assert.equal(jpeg.status, 200);
  assert.equal((await jpeg.json() as { data: { image: { mimeType: string } } }).data.image.mimeType, 'image/jpeg');

  const noImage = createHarness([modelReply([{ text: 'Texto sem imagem.' }]), modelReply([{ text: 'Continua sem imagem.' }])]);
  assert.equal((await noImage.handler(request())).status, 502);
  assert.equal(noImage.calls.length, 2);

  const rateLimited = createHarness([{ status: 429, body: { error: 'quota' } }]);
  const limited = await rateLimited.handler(request());
  assert.equal(limited.status, 429);
  assert.equal((await limited.json() as { error: string }).error, 'AI_RATE_LIMIT');
  assert.equal(rateLimited.calls.length, 1);

  const invalidSubtitle = createHarness([
    modelReply([{ text: 'Texto com preço e hospedagem inclusa.' }, { inlineData: { mimeType: 'image/png', data: PNG } }]),
  ]);
  const invalid = await invalidSubtitle.handler(request());
  assert.equal(invalid.status, 502);
  assert.equal((await invalid.json() as { error: string }).error, 'AI_SUBTITLE_INVALID');

  console.log('generate-flyer-ai retry tests passed');
}

run();
