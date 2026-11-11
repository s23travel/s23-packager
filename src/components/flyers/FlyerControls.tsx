import { HINT_MAX_LENGTH, sanitizeHint } from '../../../supabase/functions/_shared/flyerAiContract';

interface FlyerSuggestion {
  imageUrl: string;
}

interface FlyerControlsProps {
  destination: string;
  hint: string;
  onHintChange: (value: string) => void;
  generating: boolean;
  disabled: boolean;
  onGenerate: () => void;
  suggestion: FlyerSuggestion | null;
  subtitleDraft: string;
  onSubtitleChange: (value: string) => void;
  subtitleError: string | null;
  imageFailed: boolean;
  onImageFailed: () => void;
}

/** Bloco de IA e revisão do subtítulo, comum à lâmina de pacote e à de cotação. */
export function FlyerControls({
  destination, hint, onHintChange, generating, disabled, onGenerate, suggestion,
  subtitleDraft, onSubtitleChange, subtitleError, imageFailed, onImageFailed,
}: FlyerControlsProps) {
  return <>
    <label className="form-group">
      <span className="form-label">Indicação para a imagem (opcional)</span>
      <textarea className="form-textarea" aria-label="Indicação para a imagem" value={hint} maxLength={HINT_MAX_LENGTH}
        placeholder="Ex.: Trem Bernina-Express entre paisagens de gelo" disabled={generating}
        onChange={event => onHintChange(sanitizeHint(event.target.value))} />
      <span className="package-flyer-help">Orienta só o assunto da imagem; o subtítulo continua sobre o destino. Até {HINT_MAX_LENGTH} caracteres.</span>
    </label>
    <button type="button" className="btn btn-primary" onClick={onGenerate} disabled={disabled} aria-busy={generating}>
      {generating ? 'Gerando imagem e subtítulo…' : suggestion ? 'Gerar nova sugestão' : 'Gerar imagem e subtítulo'}
    </button>
    <span className="package-flyer-help">Cada geração pode gerar cobrança, inclusive quando falha.</span>
    {suggestion && <>
      <img className="package-flyer-review-image" src={suggestion.imageUrl} alt={`Imagem gerada para ${destination}`} onError={onImageFailed} />
      {imageFailed && <p role="alert">Não foi possível carregar a imagem sugerida. Gere outra imagem antes de baixar.</p>}
      <label className="form-group">
        <span className="form-label">Subtítulo comercial sugerido</span>
        <textarea className="form-textarea" aria-label="Subtítulo comercial sugerido" value={subtitleDraft} maxLength={100}
          onChange={event => onSubtitleChange(event.target.value)} />
      </label>
      {subtitleError && <p role="alert">{subtitleError}</p>}
    </>}
  </>;
}
