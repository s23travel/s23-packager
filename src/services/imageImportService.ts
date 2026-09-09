// Serviço de Importação e Extração de Imagens de Cotação
// Responsável pela pré-validação do arquivo, conversão para Base64,
// chamada à Edge Function 'import-package-image' e sanitização dos dados retornados.

import { supabase } from '../lib/supabase';
import { ImportedPackageData, ImageImportResponse } from '../types';

export const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
export const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida o arquivo no cliente antes de qualquer envio ao backend.
 */
export function validateImageFile(file: File | null | undefined): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'Nenhum arquivo foi selecionado.' };
  }

  // Verifica existência e tamanho não-zero
  if (file.size <= 0) {
    return { valid: false, error: 'O arquivo selecionado está vazio ou corrompido.' };
  }

  // Validação de tamanho máximo
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `O arquivo tem ${sizeInMB}MB, excedendo o limite máximo de 8MB permitido no MVP.`,
    };
  }

  // Validação de extensão
  const fileName = file.name.toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  if (!hasValidExtension) {
    return {
      valid: false,
      error: 'Formato inválido. São aceitas somente imagens nos formatos PNG, JPG ou JPEG.',
    };
  }

  // Validação de MIME Type (se fornecido pelo navegador)
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: `Tipo MIME (${file.type}) não suportado. Por favor, envie uma imagem PNG, JPG ou JPEG.`,
    };
  }

  return { valid: true };
}

/**
 * Converte um objeto File para uma string Base64 limpa.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove o cabeçalho data:image/...;base64, se presente
      const base64Clean = result.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      resolve(base64Clean);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Normaliza e valida a estrutura retornada pela IA para garantir que obedece
 * estritamente à interface ImportedPackageData, sem campos anômalos.
 */
export function normalizeImportedPackageData(raw: any): ImportedPackageData {
  const safeStringOrNull = (val: any): string | null => {
    if (typeof val === 'string' && val.trim() !== '') return val.trim();
    return null;
  };

  const safeNumberOrNull = (val: any): number | null => {
    if (typeof val === 'number' && !isNaN(val)) return val;
    if (typeof val === 'string') {
      let cleaned = val.replace(/[^\d.,-]/g, '').trim();
      if (!cleaned) return null;
      if (cleaned.includes('.') && cleaned.includes(',')) {
        if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
          // Formato brasileiro/europeu: 1.850,50 -> 1850.50
          cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
          // Formato americano: 1,850.50 -> 1850.50
          cleaned = cleaned.replace(/,/g, '');
        }
      } else if (cleaned.includes(',')) {
        cleaned = cleaned.replace(',', '.');
      }
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) return parsed;
    }
    return null;
  };


  const dates = raw?.dates || {};
  const passengers = raw?.passengers || {};
  const outbound = raw?.outbound || {};
  const inbound = raw?.inbound || {};
  const lodging = raw?.lodging || {};
  const financial = raw?.financial || {};

  // Normaliza lista de crianças
  const childrenArray: Array<{ age: number | null }> = [];
  if (Array.isArray(passengers?.children)) {
    for (const ch of passengers.children) {
      if (typeof ch === 'number') {
        childrenArray.push({ age: ch });
      } else if (ch && typeof ch === 'object') {
        childrenArray.push({ age: safeNumberOrNull(ch.age) });
      } else {
        childrenArray.push({ age: null });
      }
    }
  }

  // Normaliza serviços adicionais
  const servicesArray: Array<{
    name: string;
    date: string | null;
    description: string | null;
    currency: string | null;
    amount: number | null;
  }> = [];

  if (Array.isArray(raw?.additionalServices)) {
    for (const s of raw.additionalServices) {
      if (s && typeof s === 'object' && s.name) {
        servicesArray.push({
          name: String(s.name).trim(),
          date: safeStringOrNull(s.date),
          description: safeStringOrNull(s.description),
          currency: safeStringOrNull(s.currency),
          amount: safeNumberOrNull(s.amount),
        });
      }
    }
  }

  return {
    packageName: safeStringOrNull(raw?.packageName),
    dates: {
      start: safeStringOrNull(dates.start),
      end: safeStringOrNull(dates.end),
    },
    passengers: {
      adults: safeNumberOrNull(passengers.adults),
      children: childrenArray,
    },
    outbound: {
      route: safeStringOrNull(outbound.route),
      company: safeStringOrNull(outbound.company),
      flight: safeStringOrNull(outbound.flight),
      departureTime: safeStringOrNull(outbound.departureTime),
      arrivalTime: safeStringOrNull(outbound.arrivalTime),
    },
    inbound: {
      route: safeStringOrNull(inbound.route),
      company: safeStringOrNull(inbound.company),
      flight: safeStringOrNull(inbound.flight),
      departureTime: safeStringOrNull(inbound.departureTime),
      arrivalTime: safeStringOrNull(inbound.arrivalTime),
    },
    lodging: {
      name: safeStringOrNull(lodging.name),
      city: safeStringOrNull(lodging.city),
      country: safeStringOrNull(lodging.country),
      room: safeStringOrNull(lodging.room),
      mealPlan: safeStringOrNull(lodging.mealPlan),
      checkIn: safeStringOrNull(lodging.checkIn),
      checkOut: safeStringOrNull(lodging.checkOut),
    },
    additionalServices: servicesArray,
    financial: {
      currency: safeStringOrNull(financial.currency),
      taxesAndFees: safeNumberOrNull(financial.taxesAndFees),
      total: safeNumberOrNull(financial.total),
    },
  };
}

/**
 * Envia a imagem para a Edge Function 'import-package-image' e retorna
 * os dados devidamente validados e normalizados.
 */
export async function importPackageDataFromImage(file: File): Promise<ImageImportResponse> {
  const val = validateImageFile(file);
  if (!val.valid) {
    return {
      success: false,
      error: val.error,
    };
  }

  try {
    const base64Data = await fileToBase64(file);
    const mimeType = file.type || 'image/jpeg';

    const { data, error } = await supabase.functions.invoke('import-package-image', {
      body: {
        imageBase64: base64Data,
        mimeType,
      },
    });

    if (error) {
      console.error('Erro ao invocar Edge Function import-package-image:', error);

      let errorMsg = error.message || 'Erro ao conectar ao serviço de leitura de imagem.';
      let details = '';

      try {
        if ((error as any).context && typeof (error as any).context.json === 'function') {
          const body = await (error as any).context.json();
          if (body?.message) errorMsg = body.message;
          if (body?.details) {
            details = typeof body.details === 'string' ? body.details : JSON.stringify(body.details);
          }
        }
      } catch {
        // ignora se não houver json no contexto
      }

      if (errorMsg.includes('GEMINI_API_KEY_MISSING') || (data && data.error === 'GEMINI_API_KEY_MISSING')) {
        errorMsg = 'Chave GEMINI_API_KEY não configurada no Supabase Edge Functions.';
        details = 'Configure a secret GEMINI_API_KEY no painel do Supabase para habilitar a extração com IA.';
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
        error: data?.message || data?.error || 'A IA não conseguiu identificar dados na imagem.',
        details: data?.details || '',
      };
    }

    const normalized = normalizeImportedPackageData(data.data);

    return {
      success: true,
      data: normalized,
    };
  } catch (err: any) {
    console.error('Exceção em importPackageDataFromImage:', err);
    return {
      success: false,
      error: err.message || 'Erro inesperado ao processar a imagem.',
      details: 'Verifique sua conexão com o servidor e tente novamente.',
    };
  }
}
