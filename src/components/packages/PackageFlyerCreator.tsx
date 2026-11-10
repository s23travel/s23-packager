import { useEffect, useRef, useState } from 'react';
import type { Package } from '../../types';
import { createPackageFlyer } from '../../services/packageFlyerService';
import { generateFlyerAi } from '../../services/flyerAiService';
import { HINT_MAX_LENGTH, sanitizeHint, validSubtitle } from '../../../supabase/functions/_shared/flyerAiContract';
import {
  FLYER_ITEM_KINDS,
  FLYER_ITEM_LABEL_MAX,
  FLYER_ITEMS_MAX,
  itemLabelProblem,
  normalizeItemLabel,
  type FlyerItem,
  type FlyerItemKind,
} from '../../../supabase/functions/_shared/flyerItemsContract';
import { PackageFlyerTemplate } from './PackageFlyerTemplate';
import {
  createPackageFlyerServerPreview,
  downloadSavedPackageFlyer,
  getCurrentPackageFlyer,
  publishPackageFlyer,
  type FlyerAttachmentFormat,
  type PackageFlyerAttachmentMetadata,
  type ReviewedFlyerImage,
} from '../../services/packageFlyerAttachmentService';

interface FlyerSuggestionState {
  packageId: string;
  modelKey: string;
  imageUrl: string;
  image: ReviewedFlyerImage;
  subtitle: string;
}

const FLYER_ITEM_KIND_LABELS: Record<FlyerItemKind, string> = {
  air: 'Aéreo',
  transport: 'Transporte',
  accommodation: 'Hospedagem',
  transfer: 'Transfer',
  insurance: 'Seguro',
  additional: 'Extra',
};

function getDownloadName(destination: string, format: FlyerAttachmentFormat): string {
  const slug = destination.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'viagem';
  return `lamina-${slug}.${format}`;
}

/** Entrada pública da criação; recebe somente o pacote já carregado. */
export function PackageFlyerCreator({ package: pkg, open: openProp, showToggle = true }: {
  package: Package;
  open?: boolean;
  showToggle?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const [suggestion, setSuggestion] = useState<FlyerSuggestionState | null>(null);
  const [subtitleDraft, setSubtitleDraft] = useState('');
  const [hint, setHint] = useState('');
  const [imageReviewed, setImageReviewed] = useState(false);
  const [subtitleReviewed, setSubtitleReviewed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<FlyerAttachmentFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subtitleError, setSubtitleError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<PackageFlyerAttachmentMetadata | null>(null);
  const [attachmentLoaded, setAttachmentLoaded] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentReload, setAttachmentReload] = useState(0);
  const [serverPreview, setServerPreview] = useState<{ url: string; requestId: string; expectedRevision: number; sourceImage: ReviewedFlyerImage; subtitle: string; itemsKey: string; modelKey: string } | null>(null);
  const [itemsDraft, setItemsDraft] = useState<FlyerItem[]>([]);
  const [serverPreviewReviewed, setServerPreviewReviewed] = useState(false);
  const requestId = useRef(0);
  const downloadUrls = useRef(new Set<string>());
  const serverPreviewUrl = useRef<string | null>(null);
  const flyer = open ? createPackageFlyer(pkg) : null;
  const modelKey = flyer?.model ? JSON.stringify(flyer.model) : '';

  useEffect(() => {
    requestId.current += 1;
    setSuggestion(null);
    setSubtitleDraft('');
    setImageReviewed(false);
    setSubtitleReviewed(false);
    setImageFailed(false);
    setGenerating(false);
    setPreviewing(false);
    setSaving(false);
    setDownloading(null);
    setError(null);
    setSubtitleError(null);
    if (serverPreviewUrl.current) {
      URL.revokeObjectURL(serverPreviewUrl.current);
      downloadUrls.current.delete(serverPreviewUrl.current);
      serverPreviewUrl.current = null;
    }
    setServerPreview(null);
    setServerPreviewReviewed(false);
    setItemsDraft(flyer?.model ? flyer.model.items.map(item => ({ kind: item.kind, label: item.label })) : []);
  }, [pkg.id, modelKey]);

  // A indicação vale para o pacote aberto; trocar de pacote troca o destino.
  useEffect(() => { setHint(''); }, [pkg.id]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setAttachment(null);
    setAttachmentLoaded(false);
    setAttachmentError(null);
    getCurrentPackageFlyer(pkg.id).then(current => {
      if (active) setAttachment(current);
    }).catch(loadError => {
      if (active) setAttachmentError(loadError instanceof Error ? loadError.message : 'Não foi possível consultar a lâmina salva.');
    }).finally(() => { if (active) setAttachmentLoaded(true); });
    return () => { active = false; };
  }, [open, pkg.id, attachmentReload]);

  useEffect(() => () => {
    requestId.current += 1;
    downloadUrls.current.forEach(url => URL.revokeObjectURL(url));
    downloadUrls.current.clear();
  }, []);

  const activeSuggestion = suggestion?.packageId === pkg.id && suggestion.modelKey === modelKey ? suggestion : null;
  const clearServerPreview = () => {
    if (serverPreviewUrl.current) {
      URL.revokeObjectURL(serverPreviewUrl.current);
      downloadUrls.current.delete(serverPreviewUrl.current);
      serverPreviewUrl.current = null;
    }
    setServerPreview(null);
    setServerPreviewReviewed(false);
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
  const canDownload = Boolean(previewModel && activeSuggestion && imageReviewed && !imageFailed && subtitleReviewed && subtitleValid &&
    !itemsError && !generating && !previewing && !downloading && !saving);
  const expectedRevision = attachment?.revision ?? 0;
  const serverPreviewMatches = Boolean(serverPreview && activeSuggestion && serverPreview.modelKey === modelKey &&
    serverPreview.sourceImage === activeSuggestion.image && serverPreview.subtitle === subtitleDraft.trim() &&
    serverPreview.itemsKey === itemsKey && serverPreview.expectedRevision === expectedRevision);
  const canPreviewOnServer = Boolean(canDownload && attachmentLoaded && !previewing && !attachmentError);
  const canSave = Boolean(canDownload && serverPreviewMatches && serverPreviewReviewed && !saving && !previewing);

  const resetFlyer = () => {
    requestId.current += 1;
    setSuggestion(null);
    setSubtitleDraft('');
    setHint('');
    setItemsDraft([]);
    setImageReviewed(false);
    setSubtitleReviewed(false);
    setImageFailed(false);
    setGenerating(false);
    setPreviewing(false);
    setSaving(false);
    setDownloading(null);
    setError(null);
    setSubtitleError(null);
    clearServerPreview();
  };

  const handleToggle = () => {
    if (open) resetFlyer();
    if (openProp === undefined) setInternalOpen(value => !value);
  };

  useEffect(() => {
    if (!open) resetFlyer();
  }, [open]);

  const handleGenerate = async () => {
    if (!flyer?.model || generating || previewing || saving) return;
    const currentRequest = ++requestId.current;
    const currentPackageId = pkg.id;
    const currentModelKey = modelKey;
    setGenerating(true);
    setError(null);
    setSubtitleError(null);
    clearServerPreview();
    setSuggestion(null);
    setSubtitleDraft('');
    setImageReviewed(false);
    setSubtitleReviewed(false);
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
      setSuggestion({ packageId: currentPackageId, modelKey: currentModelKey, imageUrl, image, subtitle: result.data.subtitle });
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
    setSubtitleReviewed(false);
    setSubtitleError(null);
  };

  const handleSubtitleReview = (checked: boolean) => {
    if (previewing) { requestId.current += 1; setPreviewing(false); }
    clearServerPreview();
    if (checked && !validSubtitle(subtitleDraft.trim())) {
      setSubtitleReviewed(false);
      setSubtitleError('Revise o subtítulo: use de 3 a 100 caracteres, sem afirmações de preço ou serviços.');
      return;
    }
    setSubtitleError(null);
    setSubtitleReviewed(checked);
  };

  // Qualquer edição dos serviços invalida a prévia final aprovada anteriormente.
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
      const response = await createPackageFlyerServerPreview({
        packageId: pkg.id,
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
      const saved = await publishPackageFlyer({ packageId: pkg.id, expectedRevision: serverPreview.expectedRevision, requestId: serverPreview.requestId });
      if (requestId.current !== currentRequest) return;
      setAttachment(saved);
      setAttachmentError(null);
      setError(null);
      clearServerPreview();
    } catch (saveError) {
      if (requestId.current === currentRequest) {
        setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a lâmina. A versão anterior continua disponível.');
        try { setAttachment(await getCurrentPackageFlyer(pkg.id)); } catch { /* Exibe o erro original e mantém o último estado conhecido. */ }
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
      const blob = await downloadSavedPackageFlyer(pkg.id, format);
      const url = URL.createObjectURL(blob);
      downloadUrls.current.add(url);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = getDownloadName(flyer?.model?.destination || 'viagem', format);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.current.delete(url); }, 1000);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Não foi possível baixar a lâmina salva.');
    } finally { setDownloading(null); }
  };

  return <div>
    {showToggle && <button type="button" className="btn btn-secondary" aria-expanded={open} aria-controls="package-flyer-preview" onClick={handleToggle}>
      {open ? 'Fechar prévia da lâmina' : 'Criar lâmina'}
    </button>}
    {flyer && <section id="package-flyer-preview" className="card" aria-labelledby="package-flyer-title" style={{ marginTop: '1.25rem' }}>
      <h2 id="package-flyer-title" className="card-title">Prévia da lâmina</h2>
      <p className={`package-flyer-status${attachment ? ' is-saved' : ''}`} role="status" aria-live="polite">
        {attachmentLoaded
          ? attachment ? `Lâmina salva neste pacote · versão ${attachment.revision}.` : 'Ainda não há uma lâmina salva neste pacote.'
          : 'Consultando a lâmina salva…'}
      </p>
      {attachmentError && <div className="package-flyer-notice package-flyer-notice--error" role="alert">
        <strong>Não foi possível consultar a lâmina salva</strong>
        <p>{attachmentError}</p>
        <button type="button" className="btn btn-secondary" onClick={() => setAttachmentReload(value => value + 1)}>Tentar novamente</button>
      </div>}
      {flyer.errors.length > 0 && <div className="package-flyer-notice package-flyer-notice--error" role="alert">
        <strong>Não foi possível montar a prévia</strong>
        <ul>{flyer.errors.map(item => <li key={item}>{item}</li>)}</ul>
      </div>}
      {flyer.warnings.length > 0 && <div className="package-flyer-notice" role="status">
        <strong>Atenção</strong>
        <ul>{Array.from(new Set(flyer.warnings)).map(warning => <li key={warning}>{warning}</li>)}</ul>
      </div>}
      {error && <div className="package-flyer-notice package-flyer-notice--error" role="alert">
        <p>{error}</p>
      </div>}
      {flyer.model && <div className="package-flyer-controls">
        <label className="form-group">
          <span className="form-label">Indicação para a imagem (opcional)</span>
          <textarea className="form-textarea" aria-label="Indicação para a imagem" value={hint} maxLength={HINT_MAX_LENGTH}
            placeholder="Ex.: Trem Bernina-Express entre paisagens de gelo" disabled={generating}
            onChange={event => setHint(sanitizeHint(event.target.value))} />
          <span className="package-flyer-help">Orienta só o assunto da imagem; o subtítulo continua sobre o destino. Até {HINT_MAX_LENGTH} caracteres.</span>
        </label>
        <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={generating || previewing || saving || downloading !== null} aria-busy={generating}>
          {generating ? 'Gerando imagem e subtítulo…' : activeSuggestion ? 'Gerar outra sugestão de IA' : 'Gerar imagem e subtítulo com IA'}
        </button>
        <span className="package-flyer-help">Cada geração pode gerar cobrança, inclusive quando falha.</span>
        {activeSuggestion && <>
          <img className="package-flyer-review-image" src={activeSuggestion.imageUrl} alt={`Imagem gerada para ${flyer.model.destination}`} onError={() => setImageFailed(true)} />
          {imageFailed && <p role="alert">Não foi possível carregar a imagem sugerida. Gere outra imagem antes de baixar.</p>}
          <label className="package-flyer-review">
            <input type="checkbox" checked={imageReviewed} disabled={imageFailed} onChange={event => setImageReviewed(event.target.checked)} />
            Revisei a imagem gerada
          </label>
          <label className="form-group">
            <span className="form-label">Subtítulo comercial sugerido</span>
            <textarea className="form-textarea" aria-label="Subtítulo comercial sugerido" value={subtitleDraft} maxLength={100}
              onChange={event => handleSubtitleChange(event.target.value)} />
          </label>
          {subtitleError && <p role="alert">{subtitleError}</p>}
          <label className="package-flyer-review">
            <input type="checkbox" checked={subtitleReviewed} onChange={event => handleSubtitleReview(event.target.checked)} />
            Revisei o subtítulo comercial
          </label>
        </>}
        <fieldset className="package-flyer-items-editor">
          <legend>Serviços apresentados</legend>
          <span className="package-flyer-help">Até {FLYER_ITEMS_MAX} itens e {FLYER_ITEM_LABEL_MAX} caracteres cada. É esta a lista que sai na lâmina; sem itens, a caixa é omitida.</span>
          {itemsDraft.map((item, index) => {
            const problem = itemProblems[index];
            const problemId = `flyer-item-problem-${index}`;
            return <div className="package-flyer-item-block" key={index}>
              <div className="package-flyer-item-row">
                <label className="form-group">
                  <span className="form-label">Tipo</span>
                  <select className="form-select" aria-label={`Tipo do serviço ${index + 1}`} value={item.kind}
                    onChange={event => handleItemChange(index, { kind: event.target.value as FlyerItemKind })}>
                    {FLYER_ITEM_KINDS.map(kind => <option key={kind} value={kind}>{FLYER_ITEM_KIND_LABELS[kind]}</option>)}
                  </select>
                </label>
                <label className="form-group">
                  <span className="form-label package-flyer-item-label">
                    <span>Texto</span>
                    <span className="package-flyer-item-count">{normalizeItemLabel(item.label).length}/{FLYER_ITEM_LABEL_MAX}</span>
                  </span>
                  <input className="form-input" type="text" aria-label={`Serviço ${index + 1}`} value={item.label}
                    maxLength={FLYER_ITEM_LABEL_MAX} aria-invalid={problem ? true : undefined}
                    aria-describedby={problem ? problemId : undefined}
                    onChange={event => handleItemChange(index, { label: event.target.value })} />
                </label>
                <button type="button" className="btn btn-secondary" onClick={() => handleItemRemove(index)} aria-label={`Remover serviço ${index + 1}`}>Remover</button>
              </div>
              {problem && <p className="package-flyer-item-problem" id={problemId}>{problem}</p>}
            </div>;
          })}
          {itemsTooMany && <p className="package-flyer-item-problem" role="alert">{itemsError}</p>}
          <button type="button" className="btn btn-secondary" onClick={handleItemAdd} disabled={itemsDraft.length >= FLYER_ITEMS_MAX}>
            + Adicionar serviço
          </button>
        </fieldset>
        {activeSuggestion && <div className="package-flyer-downloads" aria-label="Salvar lâmina no pacote">
          {!serverPreviewMatches && <button type="button" className="btn btn-primary" disabled={!canPreviewOnServer} aria-busy={previewing} onClick={() => void handleServerPreview()}>
            {previewing ? 'Gerando prévia final no servidor…' : 'Gerar prévia final no servidor'}
          </button>}
          {serverPreviewMatches && <div className="package-flyer-preview-review">
            <img className="package-flyer-review-image" src={serverPreview?.url} alt="Prévia final da lâmina gerada no servidor" />
            <div className="package-flyer-review-row">
              <label className="package-flyer-review">
                <input type="checkbox" checked={serverPreviewReviewed} onChange={event => setServerPreviewReviewed(event.target.checked)} />
                Revisei a prévia final gerada no servidor
              </label>
              <button type="button" className="btn btn-secondary" disabled={!canSave} aria-busy={saving} onClick={() => void handleSave()}>
                {saving ? 'Salvando no pacote…' : attachment ? 'Substituir a lâmina salva' : 'Salvar lâmina no pacote'}
              </button>
            </div>
          </div>}
        </div>}
        {attachment && <div className="package-flyer-downloads" aria-label="Baixar a última lâmina salva">
          <button type="button" className="btn btn-secondary" disabled={downloading !== null} onClick={() => void handleDownloadSaved('html')}>Baixar HTML</button>
          <button type="button" className="btn btn-secondary" disabled={downloading !== null} onClick={() => void handleDownloadSaved('png')}>Baixar PNG</button>
        </div>}
        <PackageFlyerTemplate model={previewModel || flyer.model} />
        <div aria-label="Dados da lâmina em texto">
          <p><strong>Rota:</strong> {flyer.model.origin} para {flyer.model.destination}</p>
          <p><strong>Período:</strong> {flyer.model.period}</p>
          <p><strong>Valor por pessoa:</strong> {flyer.model.price.formatted} por pessoa em quarto duplo</p>
          {flyer.model.paymentConditions && <p><strong>Pagamento:</strong> {flyer.model.paymentConditions}</p>}
          {previewModel && (previewModel.items.length > 0 ? <><p><strong>Serviços apresentados:</strong></p><ul>{previewModel.items.map((item, i) => <li key={i}>{item.label}</li>)}</ul></> : <p>Nenhum serviço apresentado.</p>)}
        </div>
      </div>}
    </section>}
  </div>;
}
