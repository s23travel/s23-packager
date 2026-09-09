// Serviço de Publicação de Pacotes no Website S23 (Fase 6C)
// Integração segura com o backend (Supabase Edge Function 'publish-package').
// NUNCA expõe tokens do GitHub ou secrets no frontend.

import { supabase } from '../lib/supabase';
import { PublishPackageInput, PublishPackageResult, StructuredPackageContent } from '../types';
import { validatePackageMarkdown } from './markdownValidationService';

/**
 * Validação prévia de integridade antes do envio para publicação.
 */
export function validateBeforePublish(
  markdown: string,
  content?: StructuredPackageContent
): { valid: boolean; errors: string[] } {
  if (!markdown || !markdown.trim()) {
    return { valid: false, errors: ['Conteúdo Markdown vazio ou ausente.'] };
  }

  // Validação estrita do Markdown
  const validation = validatePackageMarkdown(markdown, content);
  if (!validation.valid) {
    return { valid: false, errors: validation.errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Publica ou atualiza o pacote no website através do backend seguro Supabase.
 * O backend utiliza a GitHub Contents API para escrever em content/pacotes/[slug].md
 * com autenticação isolada via segredos do Supabase.
 */
export async function publishPackageToWebsite(
  input: PublishPackageInput
): Promise<PublishPackageResult> {
  try {
    // 1. Validação local antes de realizar o dispatch
    const preValidation = validateBeforePublish(input.markdown, input.structuredContent);
    if (!preValidation.valid) {
      return {
        success: false,
        message: 'O Markdown falhou na validação de segurança antes da publicação.',
        error: 'VALIDATION_FAILED',
        details: preValidation.errors.join('; '),
      };
    }

    // 2. Invocação da Edge Function segura 'publish-package'
    const { data, error } = await supabase.functions.invoke('publish-package', {
      body: {
        markdown: input.markdown,
        slug: input.slug,
        structuredContent: input.structuredContent,
        overwrite: input.overwrite ?? true,
      },
    });

    if (error) {
      console.error('Erro ao invocar Edge Function publish-package:', error);

      // Tratamento amigável de erro sem expor segredos ou tokens
      let errorMsg = error.message || 'Falha ao conectar com o serviço de publicação.';
      let details = '';

      if (errorMsg.includes('GITHUB_TOKEN_MISSING') || (data && data.error === 'GITHUB_TOKEN_MISSING')) {
        errorMsg = 'Publicação automática via GitHub não configurada no Supabase.';
        details =
          'Configure o secret GITHUB_TOKEN e GITHUB_REPO no painel do Supabase Edge Functions. O arquivo .md está pronto para download ou publicação manual no Manager.';
      }

      return {
        success: false,
        message: errorMsg,
        error: data?.error || 'EDGE_FUNCTION_ERROR',
        details: details || data?.message || data?.details,
        filePath: `content/pacotes/${input.slug}.md`,
      };
    }

    if (!data) {
      return {
        success: false,
        message: 'Resposta vazia do backend de publicação.',
        error: 'EMPTY_RESPONSE',
        filePath: `content/pacotes/${input.slug}.md`,
      };
    }

    return data as PublishPackageResult;
  } catch (err: any) {
    console.error('Exceção em publishPackageToWebsite:', err);
    return {
      success: false,
      message: err.message || 'Erro inesperado durante a publicação.',
      error: 'UNEXPECTED_ERROR',
      filePath: `content/pacotes/${input.slug}.md`,
    };
  }
}
