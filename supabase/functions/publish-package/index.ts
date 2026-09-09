// Supabase Edge Function: publish-package
// Responsável pela publicação segura e idempotente do Markdown de pacotes
// diretamente no repositório do website S23 via GitHub Contents API.
// Isolamento total de credenciais: GITHUB_TOKEN nunca trafega para o frontend.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OBRIGATORIO_ITEM_FIXO = 'Guia exclusivo S23';
const OBRIGATORIO_PAGAMENTO_OBSERVACAO =
  'Valor por pessoa. Consulte-nos sobre personalizações, pagamento parcelado ou em outras moedas.';

// Validação de segurança do Markdown antes da publicação
function validateMarkdownSecurity(markdown: string, slug: string, structuredContent?: any): { valid: boolean; error?: string } {
  if (!markdown || !markdown.trim()) {
    return { valid: false, error: 'Conteúdo Markdown vazio ou ausente.' };
  }

  // 1. Slug válido
  const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  if (!slug || !slugRegex.test(slug)) {
    return { valid: false, error: `Slug inválido: "${slug}". Use apenas letras minúsculas, números e hífens.` };
  }

  // 2. Delimitadores de frontmatter
  if (!markdown.startsWith('---')) {
    return { valid: false, error: 'O arquivo Markdown deve iniciar com o delimitador "---" do frontmatter.' };
  }

  const secondDelimiter = markdown.indexOf('\n---', 3);
  if (secondDelimiter === -1) {
    return { valid: false, error: 'Delimitador de fechamento do frontmatter "---" não encontrado.' };
  }

  // 3. Ausência de placeholders
  const placeholders = ['[hotel]', '[data]', '[horário]', 'undefined', 'NaN', 'null'];
  for (const ph of placeholders) {
    if (markdown.includes(ph)) {
      return { valid: false, error: `Presença indevida de placeholder ou valor nulo: "${ph}".` };
    }
  }

  // 4. Ausência de dados internos confidenciais (custo, lucro, margem, fornecedor, segredos)
  const confidentialTerms = [
    'totalcost', 'profit', 'lucro', 'margem', 'profitpercent', 
    'markup', 'supplier', 'fornecedor', 'gemini_api_key', 'apikey', 'secret'
  ];
  const lowerMd = markdown.toLowerCase();
  for (const term of confidentialTerms) {
    if (lowerMd.includes(`${term}:`) || lowerMd.includes(`"${term}"`)) {
      return { valid: false, error: `Dado confidencial detectado no Markdown: "${term}". A publicação foi bloqueada.` };
    }
  }

  // 5. Item fixo obrigatório S23
  if (!markdown.includes(OBRIGATORIO_ITEM_FIXO)) {
    return { valid: false, error: `Item fixo obrigatório ausente: "${OBRIGATORIO_ITEM_FIXO}".` };
  }

  // 6. Observação oficial de pagamento
  if (!markdown.includes(OBRIGATORIO_PAGAMENTO_OBSERVACAO)) {
    return { valid: false, error: 'Observação oficial de pagamento da S23 ausente no Markdown.' };
  }

  // 7. Validação estrita de preço (se structuredContent fornecido)
  if (structuredContent && structuredContent.price !== undefined) {
    const priceStr = String(structuredContent.price);
    const hasNumericPrice = new RegExp(`price:\\s*${priceStr}(\\s|$)`).test(markdown);
    const hasQuotedPrice = new RegExp(`price:\\s*"${priceStr}[^"]*"`).test(markdown);
    if (!hasNumericPrice && !hasQuotedPrice) {
      return { valid: false, error: `Preço no Markdown diverge do preço validado (${priceStr}).` };
    }
  }

  return { valid: true };
}

serve(async (req) => {
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
    const { markdown, slug, structuredContent, overwrite = true } = body || {};

    if (!slug) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'SLUG_REQUIRED',
          message: 'O campo slug é obrigatório para definir o destino do arquivo.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const filePath = `content/pacotes/${slug}.md`;

    // 1. Executa validações de segurança do Markdown
    const securityCheck = validateMarkdownSecurity(markdown, slug, structuredContent);
    if (!securityCheck.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'SECURITY_VALIDATION_FAILED',
          message: securityCheck.error,
          filePath,
        }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Leitura dos secrets de ambiente do GitHub
    const githubToken = Deno.env.get('GITHUB_TOKEN');
    const githubRepo = Deno.env.get('GITHUB_REPO') || 's23-travel/website';
    const githubBranch = Deno.env.get('GITHUB_BRANCH') || 'main';

    if (!githubToken || !githubToken.trim()) {
      // Retorna informação clara e acionável sem quebrar o cliente
      return new Response(
        JSON.stringify({
          success: false,
          error: 'GITHUB_TOKEN_MISSING',
          message:
            'A publicação automática via GitHub não está configurada no Supabase (secret GITHUB_TOKEN ausente). Configure GITHUB_TOKEN e GITHUB_REPO no Supabase Edge Functions Secrets. O arquivo está pronto para publicação manual no Manager.',
          filePath,
          slug,
        }),
        {
          status: 200, // 200 para entrega amigável ao frontend com status controlado
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Comunicação oficial com a GitHub Contents API
    const githubApiBase = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;
    const headers = {
      'Authorization': `Bearer ${githubToken.trim()}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'S23-Packager-App',
      'Content-Type': 'application/json',
    };

    // 3.1 Verifica se o arquivo já existe (GET)
    const checkResp = await fetch(`${githubApiBase}?ref=${encodeURIComponent(githubBranch)}`, {
      method: 'GET',
      headers,
    });

    let existingSha: string | null = null;
    if (checkResp.status === 200) {
      const fileData = await checkResp.json();
      existingSha = fileData.sha;
    } else if (checkResp.status === 401 || checkResp.status === 403) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'GITHUB_AUTH_FAILED',
          message: 'Falha de autenticação no GitHub. Verifique as permissões do GITHUB_TOKEN configurado.',
          filePath,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (existingSha && !overwrite) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'FILE_ALREADY_EXISTS',
          message: `O pacote ${slug}.md já existe no website e sobrescrita não foi solicitada.`,
          filePath,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3.2 Codificação Base64 segura para UTF-8
    const base64Content = btoa(unescape(encodeURIComponent(markdown)));
    const commitMessage = existingSha
      ? `chore(pacotes): atualizar pacote ${slug} via Packager`
      : `feat(pacotes): adicionar pacote ${slug} via Packager`;

    const putPayload: any = {
      message: commitMessage,
      content: base64Content,
      branch: githubBranch,
    };
    if (existingSha) {
      putPayload.sha = existingSha;
    }

    // 3.3 Gravação (PUT)
    const putResp = await fetch(githubApiBase, {
      method: 'PUT',
      headers,
      body: JSON.stringify(putPayload),
    });

    if (!putResp.ok) {
      const errBody = await putResp.text();
      console.error('Erro na gravação GitHub:', putResp.status, errBody);

      let userMsg = 'Falha ao gravar arquivo no GitHub.';
      if (putResp.status === 409) {
        userMsg = 'Conflito de versão no GitHub. O arquivo foi modificado recentemente.';
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: 'GITHUB_PUT_ERROR',
          message: userMsg,
          filePath,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const putResult = await putResp.json();
    const action = existingSha ? 'updated' : 'created';
    const message = existingSha ? 'Pacote atualizado com sucesso.' : 'Publicado com sucesso.';

    return new Response(
      JSON.stringify({
        success: true,
        action,
        message,
        filePath,
        slug,
        commitUrl: putResult.commit?.html_url || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('Erro interno na Edge Function publish-package:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'INTERNAL_ERROR',
        message: err.message || 'Erro interno no backend de publicação.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
