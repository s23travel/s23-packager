import { supabase } from '../lib/supabase';

export type FlyerAttachmentFormat = 'html' | 'png';
export interface PackageFlyerAttachmentMetadata { revision: number; savedAt: string }
export interface ReviewedFlyerImage { mimeType: 'image/png' | 'image/jpeg'; data: string }

interface FunctionResult<T> { data: T | null; error: { message?: string } | null }
const messageFrom = (data: unknown, fallback: string): string => {
  if (data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string') return (data as { message: string }).message;
  return fallback;
};

export async function getCurrentPackageFlyer(packageId: string): Promise<PackageFlyerAttachmentMetadata | null> {
  const { data, error } = await supabase.functions.invoke('package-flyer', { body: { action: 'current', packageId } }) as FunctionResult<{ attachment?: PackageFlyerAttachmentMetadata | null; message?: string }>;
  if (error || !data) throw new Error(messageFrom(data, error?.message || 'Não foi possível consultar a lâmina salva.'));
  return data.attachment || null;
}

export async function createPackageFlyerServerPreview(input: {
  packageId: string;
  expectedRevision: number;
  requestId: string;
  image: ReviewedFlyerImage;
  subtitle: string;
}): Promise<{ requestId: string; expectedRevision: number; preview: Blob }> {
  const { data, error } = await supabase.functions.invoke('package-flyer', {
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

export async function publishPackageFlyer(input: {
  packageId: string;
  expectedRevision: number;
  requestId: string;
}): Promise<PackageFlyerAttachmentMetadata> {
  const { data, error } = await supabase.functions.invoke('package-flyer', {
    body: { action: 'publish', ...input },
  }) as FunctionResult<{ saved?: boolean; revision?: number; savedAt?: string; message?: string }>;
  if (error || !data || data.saved !== true || !Number.isInteger(data.revision)) {
    throw new Error(messageFrom(data, error?.message || 'Não foi possível salvar a lâmina. A versão anterior continua disponível.'));
  }
  return { revision: data.revision!, savedAt: data.savedAt || new Date().toISOString() };
}

export async function downloadSavedPackageFlyer(packageId: string, format: FlyerAttachmentFormat): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke('package-flyer', { body: { action: 'download', packageId, format } }) as FunctionResult<{ data?: string; message?: string }>;
  if (error || !data || typeof data.data !== 'string') {
    throw new Error(messageFrom(data, error?.message || 'Não foi possível baixar a lâmina salva.'));
  }
  try {
    const binary = atob(data.data);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return new Blob([bytes], { type: format === 'html' ? 'text/html;charset=utf-8' : 'image/png' });
  } catch { throw new Error('O arquivo salvo não passou pela verificação de integridade.'); }
}
