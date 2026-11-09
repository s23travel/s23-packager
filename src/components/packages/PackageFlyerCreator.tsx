import { useEffect, useRef, useState } from 'react';
import type { Package } from '../../types';
import { createPackageFlyer } from '../../services/packageFlyerService';
import { generateFlyerAi } from '../../services/flyerAiService';
import { createPackageFlyerHtml, createPackageFlyerPng } from '../../services/packageFlyerExport';
import { validSubtitle } from '../../../supabase/functions/_shared/flyerAiContract';
import { PackageFlyerTemplate } from './PackageFlyerTemplate';

interface FlyerSuggestionState {
  packageId: string;
  modelKey: string;
  imageUrl: string;
  subtitle: string;
}

type DownloadFormat = 'html' | 'png';

function getDownloadName(destination: string, format: DownloadFormat): string {
  const slug = destination.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'viagem';
  return `lamina-${slug}.${format}`;
}

/** Entrada pública da criação; recebe somente o pacote já carregado. */
export function PackageFlyerCreator({ package: pkg }: { package: Package }) {
  const [open, setOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<FlyerSuggestionState | null>(null);
  const [subtitleDraft, setSubtitleDraft] = useState('');
  const [imageReviewed, setImageReviewed] = useState(false);
  const [subtitleReviewed, setSubtitleReviewed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<DownloadFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subtitleError, setSubtitleError] = useState<string | null>(null);
  const requestId = useRef(0);
  const downloadUrls = useRef(new Set<string>());
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
    setDownloading(null);
    setError(null);
    setSubtitleError(null);
  }, [pkg.id, modelKey]);

  useEffect(() => () => {
    requestId.current += 1;
    downloadUrls.current.forEach(url => URL.revokeObjectURL(url));
    downloadUrls.current.clear();
  }, []);

  const activeSuggestion = suggestion?.packageId === pkg.id && suggestion.modelKey === modelKey ? suggestion : null;
  const previewModel = flyer?.model && activeSuggestion
    ? { ...flyer.model, imageUrl: activeSuggestion.imageUrl, subtitle: subtitleDraft.trim() }
    : flyer?.model;
  const subtitleValid = validSubtitle(subtitleDraft.trim());
  const canDownload = Boolean(previewModel && activeSuggestion && imageReviewed && !imageFailed && subtitleReviewed && subtitleValid && !generating && !downloading);

  const handleToggle = () => {
    if (open) {
      requestId.current += 1;
      setSuggestion(null);
      setSubtitleDraft('');
      setImageReviewed(false);
      setSubtitleReviewed(false);
      setImageFailed(false);
      setGenerating(false);
      setDownloading(null);
      setError(null);
      setSubtitleError(null);
    }
    setOpen(value => !value);
  };

  const handleGenerate = async () => {
    if (!flyer?.model || generating) return;
    const currentRequest = ++requestId.current;
    const currentPackageId = pkg.id;
    const currentModelKey = modelKey;
    setGenerating(true);
    setError(null);
    setSubtitleError(null);
    setSuggestion(null);
    setSubtitleDraft('');
    setImageReviewed(false);
    setSubtitleReviewed(false);
    setImageFailed(false);
    try {
      const result = await generateFlyerAi({ destination: flyer.model.destination });
      if (requestId.current !== currentRequest) return;
      if (!result.success) {
        setError(result.error);
        return;
      }
      const imageUrl = `data:${result.data.image.mimeType};base64,${result.data.image.data}`;
      setSuggestion({ packageId: currentPackageId, modelKey: currentModelKey, imageUrl, subtitle: result.data.subtitle });
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
    setSubtitleDraft(value);
    setSubtitleReviewed(false);
    setSubtitleError(null);
  };

  const handleSubtitleReview = (checked: boolean) => {
    if (checked && !validSubtitle(subtitleDraft.trim())) {
      setSubtitleReviewed(false);
      setSubtitleError('Revise o subtítulo: use de 3 a 100 caracteres, sem afirmações de preço ou serviços.');
      return;
    }
    setSubtitleError(null);
    setSubtitleReviewed(checked);
  };

  const handleDownload = async (format: DownloadFormat) => {
    if (!previewModel || !canDownload) return;
    const currentRequest = ++requestId.current;
    setDownloading(format);
    setError(null);
    try {
      const blob = format === 'html'
        ? await createPackageFlyerHtml(previewModel)
        : await createPackageFlyerPng(previewModel);
      if (requestId.current !== currentRequest) return;
      const url = URL.createObjectURL(blob);
      downloadUrls.current.add(url);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = getDownloadName(previewModel.destination, format);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        downloadUrls.current.delete(url);
      }, 1000);
    } catch (downloadError) {
      if (requestId.current === currentRequest) {
        setError(downloadError instanceof Error ? downloadError.message : 'Não foi possível baixar a lâmina.');
      }
    } finally {
      if (requestId.current === currentRequest) setDownloading(null);
    }
  };

  return <div>
    <button type="button" className="btn btn-secondary" aria-expanded={open} aria-controls="package-flyer-preview" onClick={handleToggle}>
      {open ? 'Fechar prévia da lâmina' : 'Criar lâmina'}
    </button>
    {flyer && <section id="package-flyer-preview" className="card" aria-labelledby="package-flyer-title" style={{ marginTop: '1.25rem' }}>
      <h2 id="package-flyer-title" className="card-title">Prévia da lâmina</h2>
      <p>A imagem e o subtítulo são sugestões da IA. Revise os dados comerciais e confirme a imagem e o texto antes de baixar.</p>
      <p role="status">Nesta versão, os arquivos baixados não ficam anexados ao pacote. Baixe-os agora; para obter outra cópia, gere novamente.</p>
      {flyer.errors.length > 0 && <div role="alert"><p>Não foi possível montar a prévia:</p><ul>{flyer.errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
      {flyer.warnings.length > 0 && <div role="status"><p>Atenção:</p><ul>{Array.from(new Set(flyer.warnings)).map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
      {error && <div role="alert">{error}</div>}
      {flyer.model && <div className="package-flyer-controls">
        <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={generating || downloading !== null} aria-busy={generating}>
          {generating ? 'Gerando imagem e subtítulo…' : activeSuggestion ? 'Gerar outra sugestão de IA' : 'Gerar imagem e subtítulo com IA'}
        </button>
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
        <div className="package-flyer-downloads" aria-label="Downloads da lâmina">
          <button type="button" className="btn btn-secondary" disabled={!canDownload} aria-busy={downloading === 'html'} onClick={() => void handleDownload('html')}>
            {downloading === 'html' ? 'Preparando HTML…' : 'Baixar HTML'}
          </button>
          <button type="button" className="btn btn-secondary" disabled={!canDownload} aria-busy={downloading === 'png'} onClick={() => void handleDownload('png')}>
            {downloading === 'png' ? 'Preparando PNG…' : 'Baixar PNG'}
          </button>
        </div>
        <PackageFlyerTemplate model={previewModel || flyer.model} />
        <div aria-label="Dados da lâmina em texto">
          <p><strong>Rota:</strong> {flyer.model.origin} para {flyer.model.destination}</p>
          <p><strong>Período:</strong> {flyer.model.period}</p>
          <p><strong>Valor total:</strong> {flyer.model.price.formatted} por pessoa em quarto duplo</p>
          {flyer.model.paymentConditions && <p><strong>Pagamento:</strong> {flyer.model.paymentConditions}</p>}
          {flyer.model.items.length > 0 ? <><p><strong>Serviços apresentados:</strong></p><ul>{flyer.model.items.map((item, i) => <li key={i}>{item.label}</li>)}</ul></> : <p>Nenhum serviço apresentado.</p>}
        </div>
      </div>}
    </section>}
  </div>;
}
