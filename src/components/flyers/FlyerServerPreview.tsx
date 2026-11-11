interface FlyerServerPreviewProps {
  matches: boolean;
  previewUrl?: string;
  previewing: boolean;
  canPreview: boolean;
  onPreview: () => void;
  canSave: boolean;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
  sectionLabel?: string;
  generateLabel?: string;
  generateBusyLabel?: string;
  saveLabel?: string;
  replaceLabel?: string;
  saveBusyLabel?: string;
  previewAlt?: string;
}

/** Prévia final vinda do servidor e ação de salvar; copy do pacote por omissão. */
export function FlyerServerPreview({
  matches, previewUrl, previewing, canPreview, onPreview, canSave, saving, saved, onSave,
  sectionLabel = 'Salvar lâmina no pacote',
  generateLabel = 'Gerar lâmina',
  generateBusyLabel = 'Gerando a lâmina…',
  saveLabel = 'Salvar lâmina no pacote',
  replaceLabel = 'Substituir a lâmina salva',
  saveBusyLabel = 'Salvando no pacote…',
  previewAlt = 'Prévia final da lâmina gerada no servidor',
}: FlyerServerPreviewProps) {
  return <div className="package-flyer-downloads" aria-label={sectionLabel}>
    {!matches && <button type="button" className="btn btn-primary" disabled={!canPreview} aria-busy={previewing} onClick={onPreview}>
      {previewing ? generateBusyLabel : generateLabel}
    </button>}
    {matches && <div className="package-flyer-preview-review">
      <img className="package-flyer-review-image" src={previewUrl} alt={previewAlt} />
      <div className="package-flyer-review-row">
        <button type="button" className="btn btn-secondary" disabled={!canSave} aria-busy={saving} onClick={onSave}>
          {saving ? saveBusyLabel : saved ? replaceLabel : saveLabel}
        </button>
      </div>
    </div>}
  </div>;
}
