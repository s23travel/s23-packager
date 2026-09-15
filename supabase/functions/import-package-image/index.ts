// Supabase Edge Function: import-package-image
// Responsável por receber uma imagem de cotação/orçamento de viagem (PNG, JPG, JPEG),
// analisar com a IA multimodal do Gemini e extrair dados estruturados deterministicamente.
// A API key nunca é exposta para o cliente. Não utiliza Google Search Grounding.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_BASE64_LENGTH = 12 * 1024 * 1024; // ~8MB binário em base64

serve(async (req) => {
  // 1. Trata preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método não permitido. Use POST.' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    let rawImages: Array<{ imageBase64?: string; mimeType?: string; name?: string }> = [];

    if (Array.isArray(body?.images) && body.images.length > 0) {
      rawImages = body.images;
    } else if (body?.imageBase64) {
      rawImages = [{ imageBase64: body.imageBase64, mimeType: body.mimeType, name: 'Imagem' }];
    }

    if (rawImages.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_INPUT',
          message: 'Nenhuma imagem foi informada. Envie um array de imagens.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (rawImages.length > 10) {
      return new Response(
        JSON.stringify({
          error: 'MAX_IMAGES_EXCEEDED',
          message: 'Você pode analisar até 10 imagens por vez.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Valida cada imagem individualmente
    const validatedImages: Array<{ cleanBase64: string; mimeType: string; name: string }> = [];
    for (let i = 0; i < rawImages.length; i++) {
      const img = rawImages[i];
      const fileName = img.name || `Imagem ${i + 1}`;

      if (!img.imageBase64 || typeof img.imageBase64 !== 'string') {
        return new Response(
          JSON.stringify({
            error: 'INVALID_INPUT',
            message: `${fileName}: Imagem ausente ou inválida.`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normalizedMime = (img.mimeType || '').toLowerCase();
      if (!ALLOWED_MIME_TYPES.includes(normalizedMime)) {
        return new Response(
          JSON.stringify({
            error: 'INVALID_MIME_TYPE',
            message: `${fileName}: Formato não suportado. Aceito somente PNG, JPG ou JPEG.`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const cleanBase64 = img.imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').trim();
      if (cleanBase64.length > MAX_BASE64_LENGTH) {
        return new Response(
          JSON.stringify({
            error: 'FILE_TOO_LARGE',
            message: `${fileName}: Arquivo excede o limite máximo permitido de 8MB.`,
          }),
          { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      validatedImages.push({
        cleanBase64,
        mimeType: normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime,
        name: fileName,
      });
    }

    // 2. Verificação segura da API Key no ambiente do backend
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey || !apiKey.trim()) {
      return new Response(
        JSON.stringify({
          error: 'GEMINI_API_KEY_MISSING',
          message:
            'A variável GEMINI_API_KEY não está configurada nos secrets do Supabase Edge Functions.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Montagem do prompt multimodal rigoroso de análise conjunta
    const systemPrompt = `
Você é um especialista em interpretação, extração estruturada e consolidação de dados de orçamentos e cotações de viagens da S23 Agência de Viagens.
Você está recebendo ${validatedImages.length} imagem(ns) da mesma cotação/pacote de viagem.

DIRETRIZ PRINCIPAL DE ANÁLISE CONJUNTA:
Estas imagens pertencem à mesma cotação. Analise todas conjuntamente e consolide as informações encontradas em uma única estrutura de dados.

REGRAS INEGOCIÁVEIS DE CONSOLIDAÇÃO:
1. ANÁLISE CONJUNTA E COMPLEMENTAR:
   - Se informações complementares aparecerem em imagens diferentes (ex: Imagem 1 tem voos, Imagem 2 tem hotel, Imagem 3 tem transfer), CONSOLIDE tudo no mesmo objeto final.
   - Se o mesmo campo aparecer em várias imagens com o mesmo valor, mantenha uma única informação limpa.
2. TRATAMENTO ESTRITO DE CONFLITOS:
   - Se houver informações conflitantes entre imagens (ex: valores totais diferentes, datas divergentes, nomes de hotéis distintos):
     NÃO escolha arbitrariamente. NUNCA invente ou adivinhe um valor para resolver o conflito.
     Registre o conflito detalhado no array "conflicts" (ex: "Valor encontrado em mais de uma imagem: €450 / €480. Revise antes de salvar." ou "Datas divergentes encontradas: 10/11 a 17/11 vs 12/11 a 19/11.").
     Preencha o campo com a opção principal identificada, mas OBRIGATORIAMENTE registre o aviso em "conflicts".
3. EXTRAÇÃO ESTRITA E PROIBIÇÃO DE INVENÇÃO:
   - Extraia APENAS o que estiver visível e legível nas imagens. NUNCA invente preços, taxas, passageiros, companhias, voos ou datas.
   - CAMPOS AUSENTES: Se um dado não estiver presente em nenhuma imagem, retorne OBRIGATORIAMENTE 'null' (ou array vazio [] para listas). NUNCA faça inferências.
4. NATUREZA DOS VALORES FINANCEIROS:
   - Todos os valores identificados em orçamentos de fornecedores devem ser tratados como CUSTOS de referência.
   - NUNCA interprete automaticamente um valor de fornecedor como preço de venda, lucro ou margem.
   - Preserve a moeda original identificada (EUR, BRL, USD). NUNCA converta moedas e NUNCA aplique taxas de câmbio arbitrariamente.
   - 'taxesAndFees': valor de taxas/impostos somente se discriminado explicitamente.
   - Se houver valor total geral consolidado, informe em 'total'.
5. FORMATOS:
   - Datas no formato ISO YYYY-MM-DD quando identificadas.
   - Adultos: número inteiro. Crianças: array de { "age": number | null }.
   - Horários de voo no formato HH:MM quando visíveis.

FORMATO OBRIGATÓRIO DE RETORNO (JSON estrito):
Retorne EXCLUSIVAMENTE um objeto JSON válido, sem texto conversacional antes ou depois:
{
  "packageName": string | null,
  "dates": {
    "start": string | null,
    "end": string | null
  },
  "passengers": {
    "adults": number | null,
    "children": []
  },
  "outbound": {
    "route": string | null,
    "company": string | null,
    "flight": string | null,
    "departureTime": string | null,
    "arrivalTime": string | null
  },
  "inbound": {
    "route": string | null,
    "company": string | null,
    "flight": string | null,
    "departureTime": string | null,
    "arrivalTime": string | null
  },
  "lodging": {
    "name": string | null,
    "city": string | null,
    "country": string | null,
    "room": string | null,
    "mealPlan": string | null,
    "checkIn": string | null,
    "checkOut": string | null
  },
  "additionalServices": [
    {
      "name": string,
      "date": string | null,
      "description": string | null,
      "currency": string | null,
      "amount": number | null
    }
  ],
  "financial": {
    "currency": string | null,
    "taxesAndFees": number | null,
    "total": number | null
  },
  "conflicts": [
    "Descrição de conflito entre imagens, se houver"
  ]
}
`;

    // 4. Chamada à API do Gemini com payload multimodal consolidado
    const modelName = 'gemini-3.6-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const imageParts = validatedImages.map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.cleanBase64,
      },
    }));

    const geminiPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            ...imageParts,
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Erro retornado pela API do Gemini:', geminiResponse.status, errText);

      return new Response(
        JSON.stringify({
          error: 'GEMINI_API_ERROR',
          message: `O serviço Gemini retornou erro (${geminiResponse.status}).`,
          details: errText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const geminiData = await geminiResponse.json();
    const candidate = geminiData.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // Prioriza texto que não seja pensamento (Gemini thinking models)
    const nonThoughtParts = parts
      .filter((p: any) => typeof p?.text === 'string' && !p?.thought)
      .map((p: any) => p.text);
    let candidateText = nonThoughtParts.join('').trim();

    if (!candidateText) {
      candidateText = parts
        .filter((p: any) => typeof p?.text === 'string')
        .map((p: any) => p.text)
        .join('')
        .trim();
    }

    if (!candidateText) {
      return new Response(
        JSON.stringify({
          error: 'EMPTY_AI_RESPONSE',
          message: 'O modelo Gemini não retornou texto ao analisar a imagem.',
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Remove eventuais blocos de código markdown se o modelo incluir
    candidateText = candidateText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsedData: any;
    try {
      parsedData = JSON.parse(candidateText);
    } catch (parseErr) {
      console.error('Falha ao parsear JSON retornado pelo Gemini:', candidateText);
      return new Response(
        JSON.stringify({
          error: 'JSON_PARSE_ERROR',
          message: 'A resposta da IA não pôde ser interpretada como JSON estruturado.',
          raw: candidateText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: parsedData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('Exceção interna na Edge Function import-package-image:', err);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: err.message || 'Erro inesperado no servidor ao processar imagem.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
