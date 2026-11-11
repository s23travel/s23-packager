import { useEffect, useRef, useState } from 'react';
import { generateFlyerAi } from '../../services/flyerAiService';
import { validSubtitle } from '../../../supabase/functions/_shared/flyerAiContract';
import {
  FLYER_ITEMS_MAX,
  itemLabelProblem,
  normalizeItemLabel,
  type FlyerItem,
} from '../../../supabase/functions/_shared/flyerItemsContract';
import { triggerFlyerDownload, type FlyerDownloadFormat } from '../../services/flyerDownload';
import type { FlyerAttachmentFormat, ReviewedFlyerImage } from '../../services/packageFlyerAttachmentService';

/** Metadados da última versão salva, comuns ao pacote e à cotação. */
export interface FlyerAttachment {
  revision: number;
  savedAt: string;
}

/** Campos do modelo local usados pela casca; o resto do modelo fica com o consumidor. */
export interface FlyerCreatorModel {
  destination: string;
  items: FlyerItem[];
  imageUrl?: string;
  subtitle?: string;
}

export interface FlyerLocalModel<TModel extends FlyerCreatorModel> {
  model: TModel | null;
  errors: string[];
  warnings: string[];
}

export interface FlyerPreviewRequest {
  ownerId: string;
  expectedRevision: number;
  requestId: string;
  image: ReviewedFlyerImage;
  subtitle: string;
  items: FlyerItem[];
}

export interface FlyerPreviewResult {
  preview: Blob;
  requestId: string;
  expectedRevision: number;
}

export interface FlyerPublishRequest {
  ownerId: string;
  expectedRevision: number;
  requestId: string;
}

/**
 * Adaptadores que isolam a persistência: o pacote usa `packageFlyerService` e
 * a cotação usará `quotationFlyerAttachmentService` sem duplicar a casca.
 */
export interface FlyerCreatorAdapter<TModel extends FlyerCreatorModel> {
  ownerId: string;
  open: boolean;
  createLocalModel: () => FlyerLocalModel<TModel> | null;
  getCurrentFlyer: (ownerId: string) => Promise<FlyerAttachment | null>;
  createServerPreview: (request: FlyerPreviewRequest) => Promise<FlyerPreviewResult>;
  publishFlyer: (request: FlyerPublishRequest) => Promise<FlyerAttachment>;
  downloadSavedFlyer: (ownerId: string, format: FlyerAttachmentFormat) => Promise<Blob>;
  savedFileName: (format: FlyerDownloadFormat, subject?: string) => string;
}

interface FlyerSuggestionState {
  ownerId: string;
  modelKey: string;
  imageUrl: string;
  image: ReviewedFlyerImage;
  subtitle: string;
}

interface FlyerServerPreviewState {
  url: string;
  requestId: string;
  expectedRevision: number;
  sourceImage: ReviewedFlyerImage;
  subtitle: string;
  itemsKey: string;
  modelKey: string;
}

/** Estado e handlers da lâmina: IA, revisão, prévia no servidor, publicação e download. */
export function useFlyerCreator<TModel extends FlyerCreatorModel>(adapter: FlyerCreatorAdapter<TModel>) {
  const { ownerId, open } = adapter;
  const [suggestion, setSuggestion] = useState<FlyerSuggestionState | null>(null);
  const [subtitleDraft, setSubtitleDraft] = useState('');
  const [hint, setHint] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<FlyerAttachmentFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<FlyerAttachment | null>(null);
  const [attachmentLoaded, setAttachmentLoaded] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentReload, setAttachmentReload] = useState(0);
  const [serverPreview, setServerPreview] = useState<FlyerServerPreviewState | null>(null);
  const [itemsDraft, setItemsDraft] = useState<FlyerItem[]>([]);
  const requestId = useRef(0);
  const downloadUrls = useRef(new Set<string>());
  const serverPreviewUrl = useRef<string | null>(null);
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const flyer = open ? adapter.createLocalModel() : null;
  const modelKey = flyer?.model ? JSON.stringify(flyer.model) : '';

  useEffect(() => {
    requestId.current += 1;
    setSuggestion(null);
    setSubtitleDraft('');
    setImageFailed(false);
    setGenerating(false);
    setPreviewing(false);
    setSaving(false);
    setDownloading(null);
    setError(null);
    if (serverPreviewUrl.current) {
      URL.revokeObjectURL(serverPreviewUrl.current);
      downloadUrls.current.delete(serverPreviewUrl.current);
      serverPreviewUrl.current = null;
    }
    setServerPreview(null);
    setItemsDraft(flyer?.model ? flyer.model.items.map(item => ({ kind: item.kind, label: item.label })) : []);
  }, [ownerId, modelKey]);

  // A indicação vale para o registo aberto; trocar de pacote/cotação troca o destino.
  useEffect(() => { setHint(''); }, [ownerId]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setAttachment(null);
    setAttachmentLoaded(false);
    setAttachmentError(null);
    adapterRef.current.getCurrentFlyer(ownerId).then(current => {
      if (active) setAttachment(current);
    }).catch(loadError => {
      if (active) setAttachmentError(loadError instanceof Error ? loadError.message : 'Não foi possível consultar a lâmina salva.');
    }).finally(() => { if (active) setAttachmentLoaded(true); });
    return () => { active = false; };
  }, [open, ownerId, attachmentReload]);

  useEffect(() => () => {
    requestId.current += 1;
    downloadUrls.current.forEach(url => URL.revokeObjectURL(url));
    downloadUrls.current.clear();
  }, []);

  const activeSuggestion = suggestion?.ownerId === ownerId && suggestion.modelKey === modelKey ? suggestion : null;
  const clearServerPreview = () => {
    if (serverPreviewUrl.current) {
      URL.revokeObjectURL(serverPreviewUrl.current);
      downloadUrls.current.delete(serverPreviewUrl.current);
      serverPreviewUrl.current = null;
    }
    setServerPreview(null);
  };
  const displayItems: FlyerItem[] = itemsDraft.map(item => ({
    kind: item.kind,
    label: normalizeItemLabel(item.label),
  }));
  const itemProblems = displayItems.map(item => itemLabelProblem(item.label));
  const itemsTooMany = displayItems.length > FLYER_ITEMS_MAX;
  const itemsError = itemsTooMany
    ? `A lâmina comporta ${FLYER_ITEMS_MAX} serviços; remova ${displayItems.length - FLYER_ITEMS_MAX}.`
    : itemProblems.find(problem => problem) || null;
  const itemsKey = JSON.stringify(displayItems);
  const editedModel = flyer?.model ? { ...flyer.model, items: displayItems } : undefined;
  const previewModel = editedModel && activeSuggestion
    ? { ...editedModel, imageUrl: activeSuggestion.imageUrl, subtitle: subtitleDraft.trim() }
    : editedModel;
  const subtitleValid = validSubtitle(subtitleDraft.trim());
  const subtitleError = subtitleDraft.trim().length > 0 && !subtitleValid
    ? 'Use de 3 a 100 caracteres, sem afirmações de preço ou serviços.'
    : null;
  const canDownload = Boolean(previewModel && activeSuggestion && !imageFailed && subtitleValid &&
    !itemsError && !generating && !previewing && !downloading && !saving);
  const expectedRevision = attachment?.revision ?? 0;
  const serverPreviewMatches = Boolean(serverPreview && activeSuggestion && serverPreview.modelKey === modelKey &&
    serverPreview.sourceImage === activeSuggestion.image && serverPreview.subtitle === subtitleDraft.trim() &&
    serverPreview.itemsKey === itemsKey && serverPreview.expectedRevision === expectedRevision);
  const canPreviewOnServer = Boolean(canDownload && attachmentLoaded && !previewing && !attachmentError);
  const canSave = Boolean(canDownload && serverPreviewMatches && !saving && !previewing);

  const resetFlyer = () => {
    requestId.current += 1;
    setSuggestion(null);
    setSubtitleDraft('');
    setHint('');
    setItemsDraft([]);
    setImageFailed(false);
    setGenerating(false);
    setPreviewing(false);
    setSaving(false);
    setDownloading(null);
    setError(null);
    clearServerPreview();
  };

  useEffect(() => {
    if (!open) resetFlyer();
  }, [open]);

  const handleGenerate = async () => {
    if (!flyer?.model || generating || previewing || saving) return;
    const currentRequest = ++requestId.current;
    const currentOwnerId = ownerId;
    const currentModelKey = modelKey;
    setGenerating(true);
    setError(null);
    clearServerPreview();
    setSuggestion(null);
    setSubtitleDraft('');
    setImageFailed(false);
    try {
      const result = await generateFlyerAi({ destination: flyer.model.destination, hint: hint.trim() || undefined });
      if (requestId.current !== currentRequest) return;
      if (!result.success) {
        setError(result.error);
        return;
      }
      const imageUrl = `data:${result.data.image.mimeType};base64,${result.data.image.data}`;
      const image = { mimeType: result.data.image.mimeType, data: result.data.image.data } as ReviewedFlyerImage;
      setSuggestion({ ownerId: currentOwnerId, modelKey: currentModelKey, imageUrl, image, subtitle: result.data.subtitle });
      setSubtitleDraft(result.data.subtitle);
    } catch (generationError) {
      if (requestId.current === currentRequest) {
        setError(generationError instanceof Error ? generationError.message : 'Não foi possível gerar a sugestão por IA.');
      }
    } finally {
      if (requestId.current === currentRequest) setGenerating(false);
    }
  };

  const handleSubtitleChange = (value: string) => {
    if (previewing) { requestId.current += 1; setPreviewing(false); }
    clearServerPreview();
    setSubtitleDraft(value);
  };

  // Qualquer edição dos serviços invalida a prévia final gerada anteriormente.
  const invalidateServerPreview = () => {
    if (previewing) { requestId.current += 1; setPreviewing(false); }
    clearServerPreview();
  };

  const handleItemChange = (index: number, patch: Partial<FlyerItem>) => {
    invalidateServerPreview();
    setItemsDraft(current => current.map((item, position) => position === index ? { ...item, ...patch } : item));
  };

  const handleItemRemove = (index: number) => {
    invalidateServerPreview();
    setItemsDraft(current => current.filter((_, position) => position !== index));
  };

  const handleItemAdd = () => {
    if (itemsDraft.length >= FLYER_ITEMS_MAX) return;
    invalidateServerPreview();
    setItemsDraft(current => [...current, { kind: 'additional', label: '' }]);
  };

  const handleServerPreview = async () => {
    if (!flyer?.model || !activeSuggestion || !canPreviewOnServer) return;
    const currentRequest = ++requestId.current;
    const currentRequestId = crypto.randomUUID();
    setPreviewing(true);
    setError(null);
    clearServerPreview();
    try {
      const response = await adapterRef.current.createServerPreview({
        ownerId,
        expectedRevision,
        requestId: currentRequestId,
        image: activeSuggestion.image,
        subtitle: subtitleDraft.trim(),
        items: displayItems,
      });
      if (requestId.current !== currentRequest) return;
      const url = URL.createObjectURL(response.preview);
      serverPreviewUrl.current = url;
      downloadUrls.current.add(url);
      setServerPreview({ url, requestId: response.requestId, expectedRevision: response.expectedRevision,
        sourceImage: activeSuggestion.image, subtitle: subtitleDraft.trim(), itemsKey, modelKey });
    } catch (previewError) {
      if (requestId.current === currentRequest) setError(previewError instanceof Error ? previewError.message : 'Não foi possível gerar a prévia final no servidor.');
    } finally {
      if (requestId.current === currentRequest) setPreviewing(false);
    }
  };

  const handleSave = async () => {
    if (!serverPreview || !canSave) return;
    const currentRequest = ++requestId.current;
    setSaving(true);
    setError(null);
    try {
      const saved = await adapterRef.current.publishFlyer({ ownerId, expectedRevision: serverPreview.expectedRevision, requestId: serverPreview.requestId });
      if (requestId.current !== currentRequest) return;
      setAttachment(saved);
      setAttachmentError(null);
      setError(null);
      clearServerPreview();
    } catch (saveError) {
      if (requestId.current === currentRequest) {
        setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a lâmina. A versão anterior continua disponível.');
        try { setAttachment(await adapterRef.current.getCurrentFlyer(ownerId)); } catch { /* Exibe o erro original e mantém o último estado conhecido. */ }
      }
    } finally {
      if (requestId.current === currentRequest) setSaving(false);
    }
  };

  const handleDownloadSaved = async (format: FlyerAttachmentFormat) => {
    if (!attachment || downloading) return;
    setDownloading(format);
    setError(null);
    try {
      const savedBlob = await adapterRef.current.downloadSavedFlyer(ownerId, format);
      triggerFlyerDownload(savedBlob, adapterRef.current.savedFileName(format, flyer?.model?.destination), downloadUrls.current);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Não foi possível baixar a lâmina salva.');
    } finally { setDownloading(null); }
  };

  const retryAttachment = () => setAttachmentReload(value => value + 1);

  return {
    flyer,
    modelKey,
    activeSuggestion,
    subtitleDraft,
    hint,
    setHint,
    imageFailed,
    setImageFailed,
    generating,
    previewing,
    saving,
    downloading,
    error,
    attachment,
    attachmentLoaded,
    attachmentError,
    retryAttachment,
    serverPreview,
    itemsDraft,
    displayItems,
    itemProblems,
    itemsTooMany,
    itemsError,
    subtitleError,
    canDownload,
    serverPreviewMatches,
    canPreviewOnServer,
    canSave,
    previewModel,
    handleGenerate,
    handleSubtitleChange,
    handleItemChange,
    handleItemRemove,
    handleItemAdd,
    handleServerPreview,
    handleSave,
    handleDownloadSaved,
    resetFlyer,
  };
}

export type FlyerCreatorState<TModel extends FlyerCreatorModel> = ReturnType<typeof useFlyerCreator<TModel>>;
