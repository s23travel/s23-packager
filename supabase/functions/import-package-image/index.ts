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
    const { imageBase64, mimeType } = body || {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(
        JSON.stringify({
          error: 'INVALID_INPUT',
          message: 'Imagem ausente ou inválida. Envie imageBase64 como string.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Normaliza e valida MIME Type
    const normalizedMime = (mimeType || '').toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(normalizedMime)) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_MIME_TYPE',
          message: 'Formato não suportado. Aceito somente PNG, JPG ou JPEG.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Limpa prefixo Data URI se fornecido (ex: "data:image/png;base64,")
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').trim();

    if (cleanBase64.length > MAX_BASE64_LENGTH) {
      return new Response(
        JSON.stringify({
          error: 'FILE_TOO_LARGE',
          message: 'Arquivo excede o limite máximo permitido de 8MB.',
        }),
        {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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

    // 3. Montagem do prompt multimodal rigoroso
    const systemPrompt = `
Você é um especialista em interpretação e extração estruturada de dados de orçamentos e cotações de viagens da S23 Agência de Viagens.
Seu objetivo é analisar minuciosamente os pixels da imagem da cotação fornecida e extrair os dados estruturados de viagem.

REGRAS INEGOCIÁVEIS:
1. EXTRAÇÃO ESTRITA: Extraia APENAS o que estiver efetivamente visível e legível na imagem.
2. PROIBIDO INVENTAR: NUNCA invente preço, data, companhia, aeroporto, hotel, quantidade de passageiros ou taxas.
3. CAMPOS AUSENTES: Se um dado não estiver na imagem ou você tiver dúvida, retorne OBRIGATORIAMENTE 'null'. NUNCA faça suposições ou inferências.
4. FINANCEIRO:
   - Se houver apenas um valor total, coloque em 'total' e NÃO tente deduzir valores individuais dos itens.
   - Moeda deve ser identificada explicitamente (EUR, BRL, USD, etc). Se não tiver certeza, retorne null.
   - 'taxesAndFees': valor de taxas/impostos somente se discriminado explicitamente.
5. FORMATO DE DATAS: Datas no formato ISO YYYY-MM-DD quando identificadas. Se houver apenas dia/mês, interprete com base no ano da cotação caso visível, senão ano corrente.
6. PASSAGEIROS:
   - 'adults': número inteiro de adultos identificados (ou null).
   - 'children': array com objetos { "age": number | null } para cada criança identificada. Se não houver crianças na imagem, retorne array vazio [].
7. TRANSPORTES:
   - 'outbound' (Ida) e 'inbound' (Volta): 'route' (ex: "LIS → GIG" ou "Lisboa - Rio de Janeiro"), 'company' (nome da companhia aérea/transporte), 'flight' (código do voo ex: "TP123"), horários 'departureTime' e 'arrivalTime' (HH:MM).
8. HOSPEDAGEM:
   - 'name': nome do hotel ou acomodação.
   - 'city': cidade.
   - 'country': país.
   - 'room': tipo de quarto/acomodação.
   - 'mealPlan': regime (ex: "Café da Manhã", "Meia Pensão", "All Inclusive", "Só Hospedagem").
   - 'checkIn' / 'checkOut': datas YYYY-MM-DD.
9. SERVIÇOS ADICIONAIS:
   - 'additionalServices': array de serviços extras (transfers, passeios, seguros) com { "name", "date", "description", "currency", "amount" }. Se não houver, retorne [].
10. NOME GERAL:
   - 'packageName': título ou destino principal em destaque no orçamento (ex: "Santiago & Deserto do Atacama"), ou null.

FORMATO OBRIGATÓRIO DE RETORNO:
Retorne EXCLUSIVAMENTE um objeto JSON válido, sem texto explicativo e sem formatação markdown em volta:
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
  "additionalServices": [],
  "financial": {
    "currency": string | null,
    "taxesAndFees": number | null,
    "total": number | null
  }
}
`;

    // 4. Chamada à API do Gemini com payload multimodal
    const modelName = 'gemini-3.6-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const geminiPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            {
              inlineData: {
                mimeType: normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime,
                data: cleanBase64,
              },
            },
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
