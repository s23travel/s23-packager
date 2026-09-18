// Supabase Edge Function: generate-content
// Responsável por orquestrar a geração de conteúdo comercial para o website S23
// utilizando a API do Google Gemini com Google Search Grounding de forma segura no backend.
// NUNCA expõe a chave de API para o frontend.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OBRIGATORIO_PAGAMENTO_OBSERVACAO =
  'Valor por pessoa em quarto duplo. Consulte-nos sobre personalizações.';

const S23_DESTINATION_DISCLAIMER =
  'Anúncio gerado por rotina informática. Confirme informações e condições junto à S23 antes da contratação.';

const OBRIGATORIO_ITEM_INCLUSO_S23 = {
  icon: 'gift',
  title: 'Guia exclusivo S23',
  desc: 'Nossas dicas práticas.',
};

serve(async (req) => {
  // Trata requisição pre-flight do CORS
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

    const input = await req.json();

    if (!input || !input.destination) {
      return new Response(
        JSON.stringify({
          error: 'Input inválido. Destino e dados comerciais são obrigatórios.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Verificação segura da API Key no ambiente do backend
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey || !apiKey.trim()) {
      return new Response(
        JSON.stringify({
          error: 'GEMINI_API_KEY_MISSING',
          message:
            'A variável GEMINI_API_KEY não está configurada nos secrets do Supabase Edge Functions. Configure a secret GEMINI_API_KEY nas configurações de Edge Functions do projeto Supabase.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Montagem do prompt comercial S23 com Google Search Grounding (Fase 6A)
    const salePrice = input.publicSalePrice !== undefined ? input.publicSalePrice : input.salePrice;
    const servicesList = Array.isArray(input.services) && input.services.length > 0
      ? input.services.map((s: any) => `- [${s.type}] ${s.description}${s.mealPlan ? ` (Regime: ${s.mealPlan})` : ''}`).join('\n')
      : (input.includedServices || []).map((s: string) => `- ${s}`).join('\n');

    const systemPrompt = `
Você é o assistente de criação de conteúdo comercial da S23 Agência de Viagens (www.s23.travel/pacotes).
Seu papel é criar o conteúdo editorial estruturado para publicação de pacotes de viagem.
Idioma: Português do Brasil (PT-BR).

REGRAS DE OURO — DADOS COMERCIAIS SOBERANOS (NÍVEL 1):
1. Preço de Venda ao Público: O valor comercial deve ser exatamente ${salePrice}. NUNCA altere ou deduza custos/margens.
2. Moeda: ${input.currency}.
3. Destino Comercial: ${input.destination}.
4. Hotel: Use sempre descrição genérica (ex: "Hospedagem selecionada" ou "Hospedagem em hotel"). NUNCA invente nem mencione nome específico de hotel.
5. Serviços Contratados (Fonte Autoritativa):
${servicesList}
6. Itens Inclusos: Baseie-se estritamente nos serviços contratados acima e nos itens fornecidos: ${JSON.stringify(input.includedServices || [])}.
   PROIBIÇÃO DE INVENÇÃO: Se não houver seguro ou transfer listado nos serviços, NÃO afirme que estão incluídos.
7. Você DEVE incluir obrigatoriamente no array 'incluso' o seguinte item fixo da S23:
   { "icon": "gift", "title": "Guia exclusivo S23", "desc": "Nossas dicas práticas." }
8. No bloco 'pagamento', a observação DEVE SER EXATAMENTE:
   "${OBRIGATORIO_PAGAMENTO_OBSERVACAO}"

REGRAS DE GENERALIZAÇÃO PARA O WEBSITE PÚBLICO:
- PROIBIÇÃO DE COMPANHIAS AÉREAS: NUNCA mencione nomes explícitos de companhias aéreas (ex: Ryanair, TAP, Latam). Escreva de forma genérica: "voo de ida", "voo de volta", "transporte aéreo".
- PROIBIÇÃO DE HORÁRIOS DE VOOS: NUNCA mencione horários específicos de partida ou chegada (ex: 15:05 → 19:20). Descreva genericamente o transporte aéreo.
- PROIBIÇÃO DE NOME EXPLÍCITO DE HOTEL: NUNCA cite o nome do hotel no texto ou itens inclusos. Use termos genéricos como "hospedagem selecionada", "hospedagem em hotel" ou "acomodação em hotel".

PESQUISA WEB (GOOGLE SEARCH GROUNDING - NÍVEL 2):
Pesquise informações reais e públicas sobre o destino (${input.destination}) para enriquecer o bloco 'sobre' e 'infoDestino' (clima, cultura, documentação para brasileiros, atrativos principais).
ATENÇÃO: A pesquisa web NUNCA deve alterar preços, datas, serviços contratados ou inventar inclusões do pacote.

FORMATO DE RESPOSTA:
Retorne EXCLUSIVAMENTE um objeto JSON estruturado válido (sem marcação markdown em volta, sem crases \`\`\`json).

Estrutura JSON obrigatória:
{
  "title": "Título comercial chamativo (ex: Maiorca Paradisíaca: Sol e Charme Mediterrâneo)",
  "category": "Categoria adequada (ex: Europa, Américas, Brasil, Exóticos)",
  "excerpt": "Resumo de 1 ou 2 frases curtas e persuasivas para o card da listagem",
  "slug": "slug-em-minusculas-sem-acentos-e-com-hifens",
  "price": ${salePrice},
  "published": false,
  "featured": false,
  "subtitle": "Frase convidativa no topo da página",
  "duracao": "${input.durationDays ? `${input.durationDays} dias` : ''}",
  "origem": "${input.origin || ''}",
  "ctaLabel": "Quero garantir minha vaga",
  "incluso": [
    { "icon": "gift", "title": "Guia exclusivo S23", "desc": "Nossas dicas práticas." }
  ],
  "naoIncluso": ${JSON.stringify(input.notIncludedServices || [])},
  "sobre": {
    "title": "Sobre ${input.destination}",
    "text": "Texto descritivo de 1 ou 2 parágrafos com tom comercial sobre o destino."
  },
  "infoDestino": {
    "localizacao": "Localização geográfica factual",
    "clima": "Clima típico",
    "idiomaCultura": "Idioma oficial e curiosidades",
    "documentacao": "Requisitos de passaporte/visto para brasileiros"
  },
  "pagamento": {
    "valor": "${input.paymentConditions || ''}",
    "formas": [],
    "observacao": "${OBRIGATORIO_PAGAMENTO_OBSERVACAO}"
  },
  "seoTitle": "Título SEO de até 60 caracteres",
  "seoDescription": "Descrição SEO de até 160 caracteres"
}
`;

    // 3. Chamada à API do Gemini com Google Search Grounding
    const modelName = input.model || 'gemini-3.6-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }],
          },
        ],
        tools: [
          {
            googleSearch: {},
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Erro na API do Gemini:', geminiResponse.status, errText);

      // Tratamento amigável e seguro de erros da API
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
    // Prioritize non-thought text parts (Gemini thinking models can emit thought parts)
    const nonThoughtParts = parts
      .filter((p: any) => typeof p?.text === 'string' && !p?.thought)
      .map((p: any) => p.text);
    let candidateText = nonThoughtParts.join('').trim();

    if (!candidateText) {
      // Fallback: use all text parts
      candidateText = parts
        .filter((p: any) => typeof p?.text === 'string')
        .map((p: any) => p.text)
        .join('')
        .trim();
    }

    if (!candidateText) {
      console.error('Resposta do Gemini sem texto:', JSON.stringify(geminiData));
      return new Response(
        JSON.stringify({
          error: 'EMPTY_AI_RESPONSE',
          message: 'O modelo Gemini não retornou conteúdo estruturado válido.',
          details: JSON.stringify(candidate || geminiData),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Limpeza e Parse do JSON gerado
    let parsed: any;
    try {
      const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      console.error('Falha ao parsear JSON retornado pelo Gemini:', candidateText);
      return new Response(
        JSON.stringify({
          error: 'INVALID_JSON_RESPONSE',
          message: 'A resposta do modelo de IA não pôde ser interpretada como JSON.',
        }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 5. Validação Determinística dos Campos e Regras S23
    const errors: string[] = [];

    if (!parsed.title) errors.push('title ausente');
    if (!parsed.category) errors.push('category ausente');
    if (!parsed.excerpt) errors.push('excerpt ausente');
    if (!parsed.slug) errors.push('slug ausente');
    if (!parsed.sobre || !parsed.sobre.text) errors.push('bloco sobre ausente ou incompleto');

    // Assegura preservação do item fixo S23
    if (!Array.isArray(parsed.incluso)) {
      parsed.incluso = [];
    }
    const hasFixedItem = parsed.incluso.some(
      (item: any) => item && item.title === OBRIGATORIO_ITEM_INCLUSO_S23.title
    );
    if (!hasFixedItem) {
      parsed.incluso.unshift(OBRIGATORIO_ITEM_INCLUSO_S23);
    }

    // Assegura preservação do aviso padrão na descrição do destino (sem duplicar)
    if (parsed.sobre && typeof parsed.sobre.text === 'string') {
      const trimmedText = parsed.sobre.text.trim();
      if (!trimmedText.includes(S23_DESTINATION_DISCLAIMER)) {
        parsed.sobre.text = `${trimmedText}\n\n${S23_DESTINATION_DISCLAIMER}`;
      }
    }

    // Assegura observação de pagamento obrigatória (padrão se não vier preenchida)
    if (!parsed.pagamento) {
      parsed.pagamento = { observacao: OBRIGATORIO_PAGAMENTO_OBSERVACAO };
    } else if (!parsed.pagamento.observacao || !parsed.pagamento.observacao.trim()) {
      parsed.pagamento.observacao = OBRIGATORIO_PAGAMENTO_OBSERVACAO;
    }

    // Garante coerência do preço com dados comerciais
    if (salePrice > 0) {
      parsed.price = salePrice;
    }

    // Retorna dados estruturados validados
    return new Response(
      JSON.stringify({
        success: true,
        data: parsed,
        groundingMetadata: geminiData.candidates?.[0]?.groundingMetadata || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('Erro na Edge Function generate-content:', err);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_FUNCTION_ERROR',
        message: err.message || 'Erro interno na execução da Edge Function.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
