import { supabase } from '../lib/supabase';
import type { FlyerItem } from '../../supabase/functions/_shared/flyerItemsContract.ts';
import type {
  FlyerAttachmentFormat,
  PackageFlyerAttachmentMetadata,
  ReviewedFlyerImage,
} from './packageFlyerAttachmentService';

/** Metadados da última versão salva da lâmina de uma cotação. */
export type QuotationFlyerAttachmentMetadata = PackageFlyerAttachmentMetadata;

interface FunctionResult<T> { data: T | null; error: { message?: string } | null }

const messageFrom = (data: unknown, fallback: string): string => {
  if (data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string') {
    return (data as { message: string }).message;
  }
  return fallback;
};

/** Consulta a última lâmina salva desta cotação (funciona também arquivada). */
export async function getCurrentQuotationFlyer(quotationId: string): Promise<QuotationFlyerAttachmentMetadata | null> {
  const { data, error } = await supabase.functions.invoke('quotation-flyer', {
    body: { action: 'current', quotationId },
  }) as FunctionResult<{ attachment?: QuotationFlyerAttachmentMetadata | null; message?: string }>;
  if (error || !data) throw new Error(messageFrom(data, error?.message || 'Não foi possível consultar a lâmina salva.'));
  return data.attachment || null;
}

/** Gera a prévia final no servidor com a imagem, o subtítulo e os itens revistos. */
export async function createQuotationFlyerServerPreview(input: {
  quotationId: string;
  expectedRevision: number;
  requestId: string;
  image: ReviewedFlyerImage;
  subtitle: string;
  items: FlyerItem[];
}): Promise<{ requestId: string; expectedRevision: number; preview: Blob }> {
  const { data, error } = await supabase.functions.invoke('quotation-flyer', {
    body: { action: 'preview', ...input },
  }) as FunctionResult<{ preview?: string; requestId?: string; expectedRevision?: number; message?: string }>;
  if (error || !data || typeof data.preview !== 'string' || data.requestId !== input.requestId) {
    throw new Error(messageFrom(data, error?.message || 'Não foi possível gerar a prévia final no servidor.'));
  }
  try {
    const binary = atob(data.preview);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return { requestId: data.requestId, expectedRevision: Number(data.expectedRevision), preview: new Blob([bytes], { type: 'image/png' }) };
  } catch { throw new Error('A prévia final do servidor está inválida.'); }
}

/** Publica a prévia staged; uma nova lâmina substitui a anterior. */
export async function publishQuotationFlyer(input: {
  quotationId: string;
  expectedRevision: number;
  requestId: string;
}): Promise<QuotationFlyerAttachmentMetadata> {
  const { data, error } = await supabase.functions.invoke('quotation-flyer', {
    body: { action: 'publish', ...input },
  }) as FunctionResult<{ saved?: boolean; revision?: number; savedAt?: string; message?: string }>;
  if (error || !data || data.saved !== true || !Number.isInteger(data.revision)) {
    throw new Error(messageFrom(data, error?.message || 'Não foi possível salvar a lâmina. A versão anterior continua disponível.'));
  }
  return { revision: data.revision!, savedAt: data.savedAt || new Date().toISOString() };
}

/** Baixa a última versão salva; o servidor guarda HTML/PNG e o JPG é convertido no cliente. */
export async function downloadSavedQuotationFlyer(quotationId: string, format: FlyerAttachmentFormat): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke('quotation-flyer', {
    body: { action: 'download', quotationId, format },
  }) as FunctionResult<{ data?: string; message?: string }>;
  if (error || !data || typeof data.data !== 'string') {
    throw new Error(messageFrom(data, error?.message || 'Não foi possível baixar a lâmina salva.'));
  }
  try {
    const binary = atob(data.data);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return new Blob([bytes], { type: format === 'html' ? 'text/html;charset=utf-8' : 'image/png' });
  } catch { throw new Error('O arquivo salvo não passou pela verificação de integridade.'); }
}
