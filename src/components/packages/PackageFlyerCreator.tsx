import { useState } from 'react';
import type { Package } from '../../types';
import { createPackageFlyer } from '../../services/packageFlyerService';
import { flyerDownloadName } from '../../services/flyerDownload';
import { PackageFlyerTemplate } from './PackageFlyerTemplate';
import {
  createPackageFlyerServerPreview,
  downloadSavedPackageFlyer,
  getCurrentPackageFlyer,
  publishPackageFlyer,
} from '../../services/packageFlyerAttachmentService';
import { FlyerControls } from '../flyers/FlyerControls';
import { FlyerItemsEditor } from '../flyers/FlyerItemsEditor';
import { FlyerServerPreview } from '../flyers/FlyerServerPreview';
import { FlyerSavedDownloads } from '../flyers/FlyerSavedDownloads';
import { useFlyerCreator } from '../flyers/useFlyerCreator';

/** Entrada pública da criação; recebe somente o pacote já carregado. */
export function PackageFlyerCreator({ package: pkg, open: openProp, showToggle = true }: {
  package: Package;
  open?: boolean;
  showToggle?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const creator = useFlyerCreator({
    ownerId: pkg.id,
    open,
    createLocalModel: () => createPackageFlyer(pkg),
    getCurrentFlyer: getCurrentPackageFlyer,
    createServerPreview: request => createPackageFlyerServerPreview({
      packageId: request.ownerId,
      expectedRevision: request.expectedRevision,
      requestId: request.requestId,
      image: request.image,
      subtitle: request.subtitle,
      items: request.items,
    }),
    publishFlyer: request => publishPackageFlyer({
      packageId: request.ownerId,
      expectedRevision: request.expectedRevision,
      requestId: request.requestId,
    }),
    downloadSavedFlyer: downloadSavedPackageFlyer,
    savedFileName: (format, subject) => flyerDownloadName('lamina', [subject || 'viagem'], format),
  });
  const { flyer } = creator;

  const handleToggle = () => {
    if (open) creator.resetFlyer();
    if (openProp === undefined) setInternalOpen(value => !value);
  };

  return <div>
    {showToggle && <button type="button" className="btn btn-secondary" aria-expanded={open} aria-controls="package-flyer-preview" onClick={handleToggle}>
      {open ? 'Fechar prévia da lâmina' : 'Criar lâmina'}
    </button>}
    {flyer && <section id="package-flyer-preview" className="card" aria-labelledby="package-flyer-title" style={{ marginTop: '1.25rem' }}>
      <h2 id="package-flyer-title" className="card-title">Prévia da lâmina</h2>
      <p className={`package-flyer-status${creator.attachment ? ' is-saved' : ''}`} role="status" aria-live="polite">
        {creator.attachmentLoaded
          ? creator.attachment ? 'Lâmina salva neste pacote.' : 'Ainda não há uma lâmina salva neste pacote.'
          : 'Consultando a lâmina salva…'}
      </p>
      {creator.attachmentError && <div className="package-flyer-notice package-flyer-notice--error" role="alert">
        <strong>Não foi possível consultar a lâmina salva</strong>
        <p>{creator.attachmentError}</p>
        <button type="button" className="btn btn-secondary" onClick={creator.retryAttachment}>Tentar novamente</button>
      </div>}
      {flyer.errors.length > 0 && <div className="package-flyer-notice package-flyer-notice--error" role="alert">
        <strong>Não foi possível montar a prévia</strong>
        <ul>{flyer.errors.map(item => <li key={item}>{item}</li>)}</ul>
      </div>}
      {flyer.warnings.length > 0 && <div className="package-flyer-notice" role="status">
        <strong>Atenção</strong>
        <ul>{Array.from(new Set(flyer.warnings)).map(warning => <li key={warning}>{warning}</li>)}</ul>
      </div>}
      {creator.error && <div className="package-flyer-notice package-flyer-notice--error" role="alert">
        <p>{creator.error}</p>
      </div>}
      {flyer.model && <div className="package-flyer-controls">
        <FlyerControls
          destination={flyer.model.destination}
          hint={creator.hint}
          onHintChange={creator.setHint}
          generating={creator.generating}
          disabled={creator.generating || creator.previewing || creator.saving || creator.downloading !== null}
          onGenerate={() => void creator.handleGenerate()}
          suggestion={creator.activeSuggestion}
          subtitleDraft={creator.subtitleDraft}
          onSubtitleChange={creator.handleSubtitleChange}
          subtitleError={creator.subtitleError}
          imageFailed={creator.imageFailed}
          onImageFailed={() => creator.setImageFailed(true)}
        />
        <FlyerItemsEditor
          items={creator.itemsDraft}
          problems={creator.itemProblems}
          itemsTooMany={creator.itemsTooMany}
          itemsError={creator.itemsError}
          onChange={creator.handleItemChange}
          onRemove={creator.handleItemRemove}
          onAdd={creator.handleItemAdd}
        />
        {creator.activeSuggestion && <FlyerServerPreview
          matches={creator.serverPreviewMatches}
          previewUrl={creator.serverPreview?.url}
          previewing={creator.previewing}
          canPreview={creator.canPreviewOnServer}
          onPreview={() => void creator.handleServerPreview()}
          canSave={creator.canSave}
          saving={creator.saving}
          saved={Boolean(creator.attachment)}
          onSave={() => void creator.handleSave()}
        />}
        {creator.attachment && <FlyerSavedDownloads
          downloading={creator.downloading}
          onDownload={format => void creator.handleDownloadSaved(format)}
        />}
        <PackageFlyerTemplate model={creator.previewModel || flyer.model} />
        <div aria-label="Dados da lâmina em texto">
          <p><strong>Rota:</strong> {flyer.model.origin} para {flyer.model.destination}</p>
          <p><strong>Período:</strong> {flyer.model.period}</p>
          <p><strong>Valor por pessoa:</strong> {flyer.model.price.formatted} por pessoa em quarto duplo</p>
          {flyer.model.paymentConditions && <p><strong>Pagamento:</strong> {flyer.model.paymentConditions}</p>}
          {creator.previewModel && (creator.previewModel.items.length > 0 ? <><p><strong>Serviços apresentados:</strong></p><ul>{creator.previewModel.items.map((item, i) => <li key={i}>{item.label}</li>)}</ul></> : <p>Nenhum serviço apresentado.</p>)}
        </div>
      </div>}
    </section>}
  </div>;
}
