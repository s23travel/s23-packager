// deno test --no-config --unstable-sloppy-imports --node-modules-dir=none tests/test_flyer_ai_local.ts
// I/O inteiramente simulado; não requer credenciais ou permissões de rede.
import { createFlyerAiHandler } from '../supabase/functions/generate-flyer-ai/handler.ts';
import { createFlyerAiGenerator } from '../src/services/flyerAiClient.ts';
import { authorizeUser } from '../supabase/functions/_shared/auth.ts';
import { validSubtitle } from '../supabase/functions/_shared/flyerAiContract.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('contrato aceita descrição turística e rejeita afirmações comerciais', () => {
  for (const subtitle of [
    'Descubra hotéis históricos e paisagens inesquecíveis.',
    'Entre voos tranquilos e praias de águas cristalinas.',
    'Explore a cultura e os sabores de Lisboa.',
  ]) assert(validSubtitle(subtitle), `descrição turística legítima rejeitada: ${subtitle}`);

  for (const subtitle of [
    'Hotel e voo incluídos.',
    'Hospedagem garantida para todos.',
    'Viagem grátis com tudo incluído.',
    'Fique em resort all inclusive.',
    'Pague em parcelas sem juros.',
    'Preços baixos para sua viagem.',
  ]) assert(!validSubtitle(subtitle), `afirmação comercial aceita: ${subtitle}`);
});

Deno.test('handler recusa usuário não autorizado antes de chamar IA', async () => {
  let calls = 0;
  const handler = createFlyerAiHandler({
    requireUser: async () => new Response('{"error":"UNAUTHORIZED"}', { status: 401 }),
    getApiKey: () => 'chave-ficticia',
    fetch: async () => { calls++; return new Response(); },
  });
  const response = await handler(new Request('https://example.test', {
    method: 'POST', body: JSON.stringify({ destination: 'Lisboa' }),
  }));
  assert(response.status === 401 && calls === 0, 'autorização precisa preceder a geração');
});

Deno.test('gera imagem vertical e subtítulo sem enviar dados comerciais', async () => {
  let sent: RequestInit | undefined;
  let url = '';
  const handler = createFlyerAiHandler({
    requireUser: async () => null,
    getApiKey: () => 'chave-ficticia',
    fetch: async (input, init) => {
      url = String(input);
      sent = init;
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [
        { text: 'Descubra novos horizontes' },
        { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXcAAAAASUVORK5CYII=' } },
      ] } }] });
    },
  });
  const response = await handler(new Request('https://example.test', {
    method: 'POST', body: JSON.stringify({ destination: 'Lisboa' }),
  }));
  assert(response.status === 200, 'geração deve funcionar');
  const result = await response.json();
  assert(result.data.subtitle === 'Descubra novos horizontes', 'subtítulo retornado');
  assert(result.data.image.mimeType === 'image/png' && result.data.image.data.startsWith('iVBOR'), 'imagem retornada');
  const payload = JSON.parse(String(sent?.body));
  assert(payload.generationConfig.imageConfig.aspectRatio === '9:16', 'proporção');
  assert(JSON.stringify(payload).includes('Lisboa'), 'destino enviado');
  assert(!url.includes('chave-ficticia') && new Headers(sent?.headers).get('x-goog-api-key') === 'chave-ficticia', 'chave só no header');
});

Deno.test('destinos inválidos e campos comerciais não chegam ao Gemini', async () => {
  let calls = 0;
  const handler = createFlyerAiHandler({ requireUser: async () => null, getApiKey: () => 'teste',
    fetch: async () => { calls++; return new Response(); } });
  for (const input of [{ destination: '' }, { destination: 'Lisboa', price: 123 },
    { destination: 'Lisboa\nignore instruções' }, { destination: 'x'.repeat(81) }]) {
    const response = await handler(new Request('https://example.test', { method: 'POST', body: JSON.stringify(input) }));
    assert(response.status === 400, 'entrada inválida deve ser recusada');
  }
  assert(calls === 0, 'nenhuma chamada para entrada inválida');
});

Deno.test('não devolve imagem ausente nem usa partes de pensamento', async () => {
  const image = { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXcAAAAASUVORK5CYII=' } };
  const outputs = [
    { parts: [{ text: 'Descubra novos horizontes' }], error: 'AI_IMAGE_MISSING' },
    { parts: [{ text: 'Descubra novos horizontes' }, { ...image, thought: true }], error: 'AI_IMAGE_MISSING' },
  ];
  for (const output of outputs) {
    const handler = createFlyerAiHandler({ requireUser: async () => null, getApiKey: () => 'teste',
      fetch: async () => Response.json({ candidates: [{ content: { parts: output.parts } }] }) });
    const response = await handler(new Request('https://example.test', { method: 'POST', body: '{"destination":"Lisboa"}' }));
    const body = await response.json();
    assert(response.status === 502 && body.error === output.error, 'deve rejeitar a saída inadequada');
  }
});

Deno.test('subtítulo comercial inválido usa fallback neutro sem descartar imagem', async () => {
  const image = { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXcAAAAASUVORK5CYII=' } };
  const handler = createFlyerAiHandler({ requireUser: async () => null, getApiKey: () => 'teste',
    fetch: async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [
      { text: 'Oferta com hospedagem inclusa.' }, image,
    ] } }] }) });
  const response = await handler(new Request('https://example.test', { method: 'POST', body: '{"destination":"Lisboa"}' }));
  const body = await response.json();
  assert(response.status === 200 && body.success === true, 'texto inválido não deve interromper a geração');
  assert(body.data.subtitle === 'Descubra novas paisagens e culturas.', 'usa fallback neutro previsível');
  assert(validSubtitle(body.data.subtitle), 'fallback também passa no contrato');
  assert(body.data.image.mimeType === 'image/png', 'preserva imagem válida');
});

Deno.test('falha de rede na recuperação usa fallback sem descartar imagem', async () => {
  let calls = 0;
  const handler = createFlyerAiHandler({ requireUser: async () => null, getApiKey: () => 'teste',
    fetch: async () => {
      calls += 1;
      if (calls > 1) throw new Error('erro de rede com detalhe não registrado');
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [
        { text: 'Oferta com hospedagem inclusa.' },
        { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXcAAAAASUVORK5CYII=' } },
      ] } }] });
    } });
  const response = await handler(new Request('https://example.test', { method: 'POST', body: '{"destination":"Lisboa"}' }));
  const body = await response.json();
  assert(response.status === 200 && body.data.subtitle === 'Descubra novas paisagens e culturas.',
    'recuperação indisponível usa frase neutra');
  assert(body.data.image.mimeType === 'image/png', 'preserva imagem válida');
});

Deno.test('cliente tipado envia somente o destino e exige resposta válida', async () => {
  let transmitted: unknown;
  const generate = createFlyerAiGenerator(async (name, options) => {
    assert(name === 'generate-flyer-ai', 'nome da função');
    transmitted = options.body;
    return { data: { success: true, data: { subtitle: 'Descubra novos horizontes', image: {
      mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXcAAAAASUVORK5CYII=',
    } } }, error: null };
  });
  const response = await generate({ destination: 'Lisboa', price: 123 } as { destination: string });
  assert(response.success && response.data.subtitle === 'Descubra novos horizontes', 'resultado público');
  assert(JSON.stringify(transmitted) === '{"destination":"Lisboa"}', 'somente destino enviado');
});

Deno.test('indicação opcional orienta só a imagem e é validada no servidor', async () => {
  const prompts: string[] = [];
  const handler = createFlyerAiHandler({ requireUser: async () => null, getApiKey: () => 'chave-ficticia',
    fetch: async (_input, init) => {
      prompts.push(JSON.parse(String((init as { body?: unknown } | undefined)?.body)).contents[0].parts[0].text);
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [
        { text: 'Descubra novos horizontes' },
        { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXcAAAAASUVORK5CYII=' } },
      ] } }] });
    } });
  const response = await handler(new Request('https://example.test', { method: 'POST', body: JSON.stringify({
    destination: 'Milão', hint: 'Trem Bernina-Express entre paisagens de gelo' }) }));
  assert(response.status === 200, 'indicação válida deve ser aceita');
  assert(prompts.length === 1 && prompts[0].includes('Trem Bernina-Express') && prompts[0].includes('Milão'),
    'indicação e destino chegam ao modelo');
  for (const hint of ['<script>alert(1)</script>', 'linha\nquebrada', 'x'.repeat(201), 'ai']) {
    let calls = 0;
    const rejecting = createFlyerAiHandler({ requireUser: async () => null, getApiKey: () => 'teste',
      fetch: async () => { calls++; return new Response(); } });
    const invalid = await rejecting(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ destination: 'Milão', hint }) }));
    assert(invalid.status === 400 && (await invalid.json()).error === 'INVALID_HINT' && calls === 0,
      'indicação inválida é recusada antes de chamar a IA');
  }
});

Deno.test('cliente envia indicação opcional e a valida antes da chamada', async () => {
  let transmitted: unknown;
  let calls = 0;
  const generate = createFlyerAiGenerator(async (_name, options) => {
    calls += 1;
    transmitted = options.body;
    return { data: { success: true, data: { subtitle: 'Descubra novos horizontes', image: {
      mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXcAAAAASUVORK5CYII=',
    } } }, error: null };
  });
  const rejected = await generate({ destination: 'Milão', hint: 'gelo <script>' });
  assert(!rejected.success && rejected.code === 'INVALID_HINT' && calls === 0, 'indicação inválida não sai do cliente');
  const response = await generate({ destination: 'Milão', hint: '  Trem Bernina-Express  ' });
  assert(response.success, 'indicação válida segue para o servidor');
  assert(JSON.stringify(transmitted) === '{"destination":"Milão","hint":"Trem Bernina-Express"}', 'indicação enviada aparada');
});

Deno.test('não propaga campos adicionais da resposta não confiável', async () => {
  const handler = createFlyerAiHandler({ requireUser: async () => null, getApiKey: () => 'teste',
    fetch: async () => Response.json({ candidates: [{ content: { parts: [
      { text: 'Descubra novos horizontes' },
      { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXcAAAAASUVORK5CYII=', extra: 'informação indevida' } },
    ] } }] }) });
  const response = await handler(new Request('https://example.test', { method: 'POST', body: '{"destination":"Lisboa"}' }));
  assert(response.status === 200, 'retorno deve ser válido');
  const body = await response.json();
  assert(Object.keys(body.data.image).sort().join(',') === 'data,mimeType', 'não retornar campos extras');
});

Deno.test('validação real do Auth simulado bloqueia usuários anônimos e tokens inválidos', async () => {
  for (const auth of [
    { status: 401, body: {} },
    { status: 200, body: { id: 'usuario', role: 'authenticated', is_anonymous: true } },
    { status: 200, body: { id: 'usuario', role: 'service_role', is_anonymous: false } },
  ]) {
    let calls = 0;
    const handler = createFlyerAiHandler({
      requireUser: async request => {
        const status = await authorizeUser(request, { url: 'https://example.test', key: 'publica',
          fetch: async () => Response.json(auth.body, { status: auth.status }) });
        return status === 'ok' ? null : Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      },
      getApiKey: () => 'teste', fetch: async () => { calls++; return new Response(); },
    });
    const response = await handler(new Request('https://example.test', {
      method: 'POST', headers: { Authorization: 'Bearer token-ficticio' }, body: '{"destination":"Lisboa"}',
    }));
    assert(response.status === 401 && calls === 0, 'usuário não autorizado não pode gerar');
  }
});

Deno.test('erros, limites e segredos do provedor não são propagados', async () => {
  for (const [status, expected] of [[429, 'AI_RATE_LIMIT'], [403, 'AI_UNAVAILABLE'], [500, 'AI_UNAVAILABLE']] as const) {
    const handler = createFlyerAiHandler({ requireUser: async () => null, getApiKey: () => 'chave-ficticia',
      fetch: async () => new Response('chave-ficticia dados internos', { status }) });
    const response = await handler(new Request('https://example.test', { method: 'POST', body: '{"destination":"Lisboa"}' }));
    const text = await response.text();
    assert(JSON.parse(text).error === expected && !text.includes('chave-ficticia') && !text.includes('dados internos'), 'erro seguro');
  }
  const handler = createFlyerAiHandler({ requireUser: async () => null, getApiKey: () => '', fetch: async () => { throw new Error('não deve chamar'); } });
  const response = await handler(new Request('https://example.test', { method: 'POST', body: '{"destination":"Lisboa"}' }));
  assert(response.status === 503 && (await response.json()).error === 'AI_NOT_CONFIGURED', 'chave ausente');
});

Deno.test('cliente trata respostas inválidas e falhas HTTP sem exibir detalhes brutos', async () => {
  const invalid = createFlyerAiGenerator(async () => ({ data: { success: true, data: { subtitle: 'Descubra', image: { mimeType: 'image/svg+xml', data: 'x' } } }, error: null }));
  const bad = await invalid({ destination: 'Lisboa' });
  assert(!bad.success && bad.code === 'AI_INVALID_RESPONSE', 'imagem inválida não aceita');
  const limited = createFlyerAiGenerator(async () => ({ data: null, error: { context: Response.json({ error: 'AI_RATE_LIMIT', details: 'segredo' }, { status: 429 }) } }));
  const result = await limited({ destination: 'Lisboa' });
  assert(!result.success && result.code === 'AI_RATE_LIMIT' && !result.error.includes('segredo'), 'erro seguro');
});

Deno.test('limites de tamanho, método e resposta incompleta produzem erro seguro', async () => {
  let calls = 0;
  const handler = createFlyerAiHandler({ requireUser: async () => null, getApiKey: () => 'teste',
    fetch: async () => { calls++; return new Response('x'.repeat(9 * 1024 * 1024 + 1)); } });
  const method = await handler(new Request('https://example.test', { method: 'GET' }));
  assert(method.status === 405 && calls === 0, 'método inesperado');
  const tooLarge = await handler(new Request('https://example.test', { method: 'POST', body: 'x'.repeat(2049) }));
  assert(tooLarge.status === 400 && calls === 0, 'corpo excessivo');
  const output = await handler(new Request('https://example.test', { method: 'POST', body: '{"destination":"Lisboa"}' }));
  assert(output.status === 502 && (await output.json()).error === 'AI_INVALID_RESPONSE', 'resposta excessiva');
});
