import type { FlyerAttachmentFormat } from '../../services/packageFlyerAttachmentService';

interface FlyerSavedDownloadsProps {
  downloading: FlyerAttachmentFormat | null;
  onDownload: (format: FlyerAttachmentFormat) => void;
  label?: string;
}

/** Download da última versão salva; o botão "IMAGEM" entrega o PNG do servidor. */
export function FlyerSavedDownloads({ downloading, onDownload, label = 'Baixar a última lâmina salva' }: FlyerSavedDownloadsProps) {
  return <div className="package-flyer-downloads" aria-label={label}>
    <button type="button" className="btn btn-secondary" disabled={downloading !== null} onClick={() => onDownload('html')}>HTML</button>
    <button type="button" className="btn btn-secondary" disabled={downloading !== null} onClick={() => onDownload('png')}>IMAGEM</button>
  </div>;
}
