// Serviço de Integração com o Backend de IA (Supabase Edge Function) (Fase 6A)
// NUNCA chama o Gemini diretamente do frontend.
// Toda comunicação passa pela Edge Function segura 'generate-content'.

import { supabase } from '../lib/supabase';
import { ContentGenerationInput, StructuredPackageContent } from '../types';
import {
  validateStructuredContent,
  OBRIGATORIO_PAGAMENTO_OBSERVACAO,
} from './contentValidationService';

export interface AIContentResponse {
  success: boolean;
  data?: StructuredPackageContent;
  error?: string;
  details?: string;
}

/**
 * Invoca o backend seguro da Supabase Edge Function para gerar o conteúdo estruturado
 * via Gemini com Google Search Grounding.
 */
export async function generateContentForWebsite(
  input: ContentGenerationInput
): Promise<AIContentResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: input,
    });

    if (error) {
      // Supabase Edge Function invoke error
      console.error('Erro ao invocar Edge Function generate-content:', error);

      // Tratamento específico de chave ausente ou erro HTTP
      let errorMsg = error.message || 'Erro ao conectar com o backend de IA.';
      let details = '';

      if (errorMsg.includes('GEMINI_API_KEY_MISSING') || (data && data.error === 'GEMINI_API_KEY_MISSING')) {
        errorMsg = 'Chave GEMINI_API_KEY não configurada no backend Supabase.';
        details =
          'Para habilitar a geração por IA, adicione o secret GEMINI_API_KEY no painel do Supabase (Edge Functions > Secrets).';
      }

      return {
        success: false,
        error: errorMsg,
        details,
      };
    }

    if (!data || !data.success || !data.data) {
      return {
        success: false,
        error: data?.message || data?.error || 'A IA não retornou dados estruturados válidos.',
        details: data?.details || '',
      };
    }

    // Aplica camada determinística de soberania: se a IA tiver gerado preço divergente
    // ou frase de pagamento diferente, o frontend impõe os valores oficiais soberanos da S23
    const rawContent = data.data;
    const expectedPrice =
      typeof input.publicSalePrice === 'number' && input.publicSalePrice > 0
        ? input.publicSalePrice
        : input.salePrice;

    if (rawContent && typeof rawContent === 'object') {
      if (expectedPrice > 0) {
        rawContent.price = expectedPrice;
      }
      if (!rawContent.pagamento || typeof rawContent.pagamento !== 'object') {
        rawContent.pagamento = { observacao: OBRIGATORIO_PAGAMENTO_OBSERVACAO };
      } else if (!rawContent.pagamento.observacao || typeof rawContent.pagamento.observacao !== 'string') {
        rawContent.pagamento.observacao = OBRIGATORIO_PAGAMENTO_OBSERVACAO;
      } else if (rawContent.pagamento.observacao.trim() !== OBRIGATORIO_PAGAMENTO_OBSERVACAO) {
        rawContent.pagamento.observacao = OBRIGATORIO_PAGAMENTO_OBSERVACAO;
      }
    }

    // Validação determinística client-side adicional antes de aceitar o conteúdo
    const validation = validateStructuredContent(rawContent, input);
    if (!validation.valid) {
      return {
        success: false,
        error: 'A resposta da IA falhou nas regras de validação editorial/comercial.',
        details: validation.errors.join('; '),
      };
    }

    return {
      success: true,
      data: validation.data,
    };
  } catch (err: any) {
    console.error('Exceção ao chamar aiContentService:', err);
    return {
      success: false,
      error: err.message || 'Erro inesperado ao gerar conteúdo com IA.',
      details: 'Verifique sua conexão e a configuração do Supabase Edge Functions.',
    };
  }
}
