// Serviço de Importação e Extração de Imagens de Cotação
// Responsável pela pré-validação do arquivo, conversão para Base64,
// chamada à Edge Function 'import-package-image' e sanitização dos dados retornados.

import { supabase } from '../lib/supabase';
import {
  ImportedPackageData,
  ImageImportResponse,
  ImportConflict,
  ServiceItem,
  ServiceType,
  VALID_SERVICE_TYPES,
} from '../types';

export const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_IMAGES_PER_ANALYSIS = 10;
export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
export const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface BatchValidationResult {
  valid: boolean;
  validFiles: File[];
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
      error: `O arquivo tem ${sizeInMB}MB, excedendo o limite máximo de 8MB permitido.`,
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
 * Valida um lote de arquivos respeitando o limite máximo de imagens e requisitos individuais.
 */
export function validateImageFilesBatch(
  newFiles: File[],
  currentCount: number = 0
): BatchValidationResult {
  if (!newFiles || newFiles.length === 0) {
    return { valid: false, validFiles: [], error: 'Nenhum arquivo foi selecionado.' };
  }

  if (currentCount + newFiles.length > MAX_IMAGES_PER_ANALYSIS) {
    return {
      valid: false,
      validFiles: [],
      error: 'Você pode analisar até 10 imagens por vez.',
    };
  }

  const validFiles: File[] = [];
  for (const file of newFiles) {
    const res = validateImageFile(file);
    if (!res.valid) {
      return {
        valid: false,
        validFiles: [],
        error: `Arquivo "${file.name}": ${res.error}`,
      };
    }
    validFiles.push(file);
  }

  return { valid: true, validFiles };
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
 * estritamente à interface ImportedPackageData, sem campos anômalos. (Fase 5)
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

  // Normaliza conflitos estruturados
  const conflictsArray: Array<ImportConflict | string> = [];
  if (Array.isArray(raw?.conflicts)) {
    for (const c of raw.conflicts) {
      if (typeof c === 'string' && c.trim()) {
        conflictsArray.push(c.trim());
      } else if (c && typeof c === 'object') {
        const desc = safeStringOrNull(c.description) || 'Conflito detectado entre imagens';
        conflictsArray.push({
          field: safeStringOrNull(c.field) || 'geral',
          values: Array.isArray(c.values) ? c.values.map(String) : [],
          description: desc,
        });
      }
    }
  }

  // Destino Comercial
  const rawDest = safeStringOrNull(raw?.destination);
  const hotelCityCountry = [safeStringOrNull(lodging.city), safeStringOrNull(lodging.country)].filter(Boolean).join(', ');
  const destination = rawDest || (hotelCityCountry || null);

  // 1. Constrói services: ServiceItem[] com UUIDs
  const services: ServiceItem[] = [];

  if (Array.isArray(raw?.services) && raw.services.length > 0) {
    // Nova estrutura direta de services[]
    for (const s of raw.services) {
      if (!s || typeof s !== 'object') continue;

      let type: ServiceType = 'other';
      if (s.type && VALID_SERVICE_TYPES.includes(s.type as ServiceType)) {
        type = s.type as ServiceType;
      }

      const description = safeStringOrNull(s.description) || safeStringOrNull(s.name) || 'Serviço';
      const amount = safeNumberOrNull(s.amount) ?? 0;
      const quantity = typeof s.quantity === 'number' && s.quantity > 0 ? s.quantity : 1;
      const currency = s.currency === 'BRL' || s.currency === 'EUR' ? s.currency : 'EUR';

      const item: ServiceItem = {
        id: generateUuid(),
        type,
        description,
        amount: amount >= 0 ? amount : 0,
        currency,
        quantity,
        carrier: safeStringOrNull(s.carrier) || undefined,
        departureTime: safeStringOrNull(s.departureTime) || undefined,
        arrivalTime: safeStringOrNull(s.arrivalTime) || undefined,
        destination: safeStringOrNull(s.destination) || undefined,
        mealPlan: safeStringOrNull(s.mealPlan) || undefined, // NUNCA inventa
        notes: safeStringOrNull(s.notes) || undefined,
      };

      services.push(item);
    }
  } else {
    // Retrocompatibilidade: Se a IA ou mock retornou formato legado, mapeia para ServiceItem[]
    if (outbound.route || outbound.company || outbound.flight) {
      const parts = [outbound.route, outbound.company, outbound.flight].filter(Boolean);
      services.push({
        id: generateUuid(),
        type: 'outbound_transport',
        description: parts.join(' | ') || 'Transporte de ida',
        carrier: safeStringOrNull(outbound.company) || undefined,
        departureTime: safeStringOrNull(outbound.departureTime) || undefined,
        arrivalTime: safeStringOrNull(outbound.arrivalTime) || undefined,
        amount: 0,
        currency: 'EUR',
        quantity: 1,
      });
    }

    if (inbound.route || inbound.company || inbound.flight) {
      const parts = [inbound.route, inbound.company, inbound.flight].filter(Boolean);
      services.push({
        id: generateUuid(),
        type: 'inbound_transport',
        description: parts.join(' | ') || 'Transporte de volta',
        carrier: safeStringOrNull(inbound.company) || undefined,
        departureTime: safeStringOrNull(inbound.departureTime) || undefined,
        arrivalTime: safeStringOrNull(inbound.arrivalTime) || undefined,
        amount: 0,
        currency: 'EUR',
        quantity: 1,
      });
    }

    if (lodging.name) {
      services.push({
        id: generateUuid(),
        type: 'accommodation',
        description: lodging.name,
        destination: hotelCityCountry || undefined,
        mealPlan: safeStringOrNull(lodging.mealPlan) || undefined,
        notes: safeStringOrNull(lodging.room) || undefined,
        amount: 0,
        currency: 'EUR',
        quantity: 1,
      });
    }

    if (Array.isArray(raw?.additionalServices)) {
      for (const s of raw.additionalServices) {
        if (s && typeof s === 'object' && s.name) {
          const sName = String(s.name).trim();
          const sDesc = safeStringOrNull(s.description);
          services.push({
            id: generateUuid(),
            type: 'additional',
            description: sDesc ? `${sName} (${sDesc})` : sName,
            amount: safeNumberOrNull(s.amount) ?? 0,
            currency: s.currency === 'BRL' || s.currency === 'EUR' ? s.currency : 'EUR',
            quantity: 1,
            notes: safeStringOrNull(s.date) ? `Data: ${s.date}` : undefined,
          });
        }
      }
    }
  }

  // Preço de venda comercial (se identificado)
  const identifiedSalePrice = safeNumberOrNull(
    financial.identifiedSalePrice ?? financial.total ?? raw?.salePrice
  );
  const finCurrency = financial.currency === 'BRL' || financial.currency === 'EUR' ? financial.currency : null;

  // Preserva lista de serviços adicionais em formato legado para compatibilidade com testes antigos
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
  } else {
    // Converte additional services do novo formato para legado se necessário
    for (const s of services) {
      if (s.type === 'additional' || s.type === 'transfer' || s.type === 'insurance') {
        servicesArray.push({
          name: s.description,
          date: null,
          description: s.notes || null,
          currency: s.currency || null,
          amount: s.amount || null,
        });
      }
    }
  }

  return {
    packageName: safeStringOrNull(raw?.packageName),
    destination,
    dates: {
      start: safeStringOrNull(dates.start),
      end: safeStringOrNull(dates.end),
    },
    passengers: {
      adults: safeNumberOrNull(passengers.adults),
      children: childrenArray,
    },
    services,
    salePrice: identifiedSalePrice,
    currency: finCurrency,
    conflicts: conflictsArray.length > 0 ? conflictsArray : undefined,

    // Campos legados para retrocompatibilidade
    outbound: {
      route: safeStringOrNull(outbound.route) || services.find((s) => s.type === 'outbound_transport')?.description || null,
      company: safeStringOrNull(outbound.company) || services.find((s) => s.type === 'outbound_transport')?.carrier || null,
      flight: safeStringOrNull(outbound.flight),
      departureTime: safeStringOrNull(outbound.departureTime) || services.find((s) => s.type === 'outbound_transport')?.departureTime || null,
      arrivalTime: safeStringOrNull(outbound.arrivalTime) || services.find((s) => s.type === 'outbound_transport')?.arrivalTime || null,
    },
    inbound: {
      route: safeStringOrNull(inbound.route) || services.find((s) => s.type === 'inbound_transport')?.description || null,
      company: safeStringOrNull(inbound.company) || services.find((s) => s.type === 'inbound_transport')?.carrier || null,
      flight: safeStringOrNull(inbound.flight),
      departureTime: safeStringOrNull(inbound.departureTime) || services.find((s) => s.type === 'inbound_transport')?.departureTime || null,
      arrivalTime: safeStringOrNull(inbound.arrivalTime) || services.find((s) => s.type === 'inbound_transport')?.arrivalTime || null,
    },
    lodging: {
      name: safeStringOrNull(lodging.name) || services.find((s) => s.type === 'accommodation')?.description || null,
      city: safeStringOrNull(lodging.city) || services.find((s) => s.type === 'accommodation')?.destination || null,
      country: safeStringOrNull(lodging.country),
      room: safeStringOrNull(lodging.room),
      mealPlan: safeStringOrNull(lodging.mealPlan) || services.find((s) => s.type === 'accommodation')?.mealPlan || null,
      checkIn: safeStringOrNull(lodging.checkIn),
      checkOut: safeStringOrNull(lodging.checkOut),
    },
    additionalServices: servicesArray,
    financial: {
      currency: safeStringOrNull(financial.currency),
      taxesAndFees: safeNumberOrNull(financial.taxesAndFees),
      total: identifiedSalePrice,
    },
  };
}

/**
 * Envia múltiplas imagens para a Edge Function 'import-package-image' em uma
 * única análise contextual de IA e retorna os dados consolidados.
 */
export async function importPackageDataFromImages(files: File[]): Promise<ImageImportResponse> {
  if (!files || files.length === 0) {
    return {
      success: false,
      error: 'Nenhuma imagem foi informada para análise.',
    };
  }

  if (files.length > MAX_IMAGES_PER_ANALYSIS) {
    return {
      success: false,
      error: 'Você pode analisar até 10 imagens por vez.',
    };
  }

  // Validação prévia de cada arquivo
  for (const file of files) {
    const val = validateImageFile(file);
    if (!val.valid) {
      return {
        success: false,
        error: `Arquivo "${file.name}": ${val.error}`,
      };
    }
  }

  try {
    // Conversão das imagens para Base64 em paralelo
    const imagePayloads = await Promise.all(
      files.map(async (file) => ({
        imageBase64: await fileToBase64(file),
        mimeType: file.type || 'image/jpeg',
        name: file.name,
      }))
    );

    const { data, error } = await supabase.functions.invoke('import-package-image', {
      body: {
        images: imagePayloads,
        // Mantém campos legados para máxima retrocompatibilidade
        imageBase64: imagePayloads[0]?.imageBase64,
        mimeType: imagePayloads[0]?.mimeType,
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
        error: data?.message || data?.error || 'A IA não conseguiu identificar dados nas imagens.',
        details: data?.details || '',
      };
    }

    const normalized = normalizeImportedPackageData(data.data);

    return {
      success: true,
      data: normalized,
    };
  } catch (err: any) {
    console.error('Exceção em importPackageDataFromImages:', err);
    return {
      success: false,
      error: err.message || 'Não foi possível analisar uma ou mais imagens. Verifique os arquivos e tente novamente.',
      details: 'Verifique sua conexão com o servidor e tente novamente.',
    };
  }
}

/**
 * Envia uma imagem para a Edge Function 'import-package-image' (retrocompatibilidade).
 */
export async function importPackageDataFromImage(file: File): Promise<ImageImportResponse> {
  return importPackageDataFromImages([file]);
}
