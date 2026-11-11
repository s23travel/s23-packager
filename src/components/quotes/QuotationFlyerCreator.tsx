import { useState } from 'react';
import type { Quotation } from '../../types';
import type { FlyerItem } from '../../../supabase/functions/_shared/flyerItemsContract';
import { createQuotationFlyer, type QuotationFlyerModel } from '../../services/quotationFlyerService';
import { flyerDownloadName } from '../../services/flyerDownload';
import { normalizeLegacyToNewStructure } from '../../services/legacyAdapterService';
import { QuotationFlyerTemplate } from './QuotationFlyerTemplate';
import {
  createQuotationFlyerServerPreview,
  downloadSavedQuotationFlyer,
  getCurrentQuotationFlyer,
  publishQuotationFlyer,
} from '../../services/quotationFlyerAttachmentService';
import { FlyerControls } from '../flyers/FlyerControls';
import { FlyerItemsEditor } from '../flyers/FlyerItemsEditor';
import { FlyerServerPreview } from '../flyers/FlyerServerPreview';
import { FlyerSavedDownloads } from '../flyers/FlyerSavedDownloads';
import { useFlyerCreator } from '../flyers/useFlyerCreator';

/** O modelo da proposta usa `included`; a casca partilhada edita `items`. */
type QuotationCreatorModel = QuotationFlyerModel & { items: FlyerItem[] };

/** Destino para o nome do ficheiro; funciona mesmo quando o modelo local é inválido. */
function fileDestination(quotation: Quotation): string {
  const direct = typeof quotation.data?.destination === 'string' ? quotation.data.destination.trim() : '';
  if (direct) return direct;
  return normalizeLegacyToNewStructure(quotation.data || {}).destination || '';
}

/** Entrada pública da lâmina de cotação; recebe somente a cotação já carregada. */
export function QuotationFlyerCreator({ quotation, open: openProp, showToggle = true }: {
  quotation: Quotation;
  open?: boolean;
  showToggle?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const creator = useFlyerCreator<QuotationCreatorModel>({
    ownerId: quotation.id,
    open,
    // A cotação deriva `included`; a casca edita a lista como `items`.
    createLocalModel: () => {
      const result = createQuotationFlyer(quotation);
      return {
        ...result,
        model: result.model ? { ...result.model, items: result.model.included } : null,
      };
    },
    getCurrentFlyer: getCurrentQuotationFlyer,
    createServerPreview: request => createQuotationFlyerServerPreview({
      quotationId: request.ownerId,
      expectedRevision: request.expectedRevision,
      requestId: request.requestId,
      image: request.image,
      subtitle: request.subtitle,
      items: request.items,
    }),
    publishFlyer: request => publishQuotationFlyer({
      quotationId: request.ownerId,
      expectedRevision: request.expectedRevision,
      requestId: request.requestId,
    }),
    downloadSavedFlyer: downloadSavedQuotationFlyer,
    // Referência e destino vêm da cotação: a versão salva baixa mesmo sem modelo local.
    savedFileName: (format) => flyerDownloadName('lamina-cotacao', [quotation.reference, fileDestination(quotation)], format),
  });
  const { flyer } = creator;

  const handleToggle = () => {
    if (open) creator.resetFlyer();
    if (openProp === undefined) setInternalOpen(value => !value);
  };

  // O template consome `included`; a revisão local edita `items`.
  const templateModel: QuotationFlyerModel | null = creator.previewModel
    ? { ...creator.previewModel, included: creator.previewModel.items }
    : flyer?.model ? { ...flyer.model, included: flyer.model.items } : null;

  return <div>
    {showToggle && <button type="button" className="btn btn-secondary" aria-expanded={open} aria-controls="quotation-flyer-preview" onClick={handleToggle}>
      {open ? 'Fechar prévia da lâmina' : 'Criar lâmina'}
    </button>}
    {open && <section id="quotation-flyer-preview" className="card" aria-labelledby="quotation-flyer-title" style={{ marginTop: '1.25rem' }}>
      <h2 id="quotation-flyer-title" className="card-title">Prévia da lâmina</h2>
      <p className={`package-flyer-status${creator.attachment ? ' is-saved' : ''}`} role="status" aria-live="polite">
        {creator.attachmentLoaded
          ? creator.attachment ? 'Lâmina salva nesta cotação.' : 'Ainda não há uma lâmina salva nesta cotação.'
          : 'Consultando a lâmina salva…'}
      </p>
      {creator.attachmentError && <div className="package-flyer-notice package-flyer-notice--error" role="alert">
        <strong>Não foi possível consultar a lâmina salva</strong>
        <p>{creator.attachmentError}</p>
        <button type="button" className="btn btn-secondary" onClick={creator.retryAttachment}>Tentar novamente</button>
      </div>}
      {flyer && flyer.errors.length > 0 && <div className="package-flyer-notice package-flyer-notice--error" role="alert">
        <strong>Não foi possível montar a prévia</strong>
        <ul>{flyer.errors.map(item => <li key={item}>{item}</li>)}</ul>
      </div>}
      {flyer && flyer.warnings.length > 0 && <div className="package-flyer-notice" role="status">
        <strong>Atenção</strong>
        <ul>{Array.from(new Set(flyer.warnings)).map(warning => <li key={warning}>{warning}</li>)}</ul>
      </div>}
      {creator.error && <div className="package-flyer-notice package-flyer-notice--error" role="alert">
        <p>{creator.error}</p>
      </div>}
      {flyer?.model && <div className="package-flyer-controls">
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
          sectionLabel="Salvar lâmina na cotação"
          generateLabel="Gerar lâmina"
          generateBusyLabel="Gerando a lâmina…"
          saveLabel="Salvar lâmina na cotação"
          replaceLabel="Substituir a lâmina salva"
          saveBusyLabel="Salvando na cotação…"
          previewAlt="Prévia final da lâmina gerada no servidor"
        />}
      </div>}
      {/* Fora do bloco do modelo local: a versão salva continua acessível com dados em falta. */}
      {creator.attachment && <FlyerSavedDownloads
        downloading={creator.downloading}
        onDownload={format => void creator.handleDownloadSaved(format)}
        label="Baixar a última lâmina salva desta cotação"
      />}
      {templateModel && <div className="package-flyer-controls">
        <QuotationFlyerTemplate model={templateModel} />
        <div aria-label="Dados da lâmina em texto">
          <p><strong>Cliente:</strong> {templateModel.clientName}</p>
          <p><strong>Data da cotação:</strong> {templateModel.proposalDate}</p>
          <p><strong>Rota:</strong> {templateModel.origin} para {templateModel.destination}</p>
          <p><strong>Período:</strong> {templateModel.dates.period}</p>
          <p><strong>Viajantes:</strong> {templateModel.passengers.label}</p>
          {templateModel.transport && <p><strong>Transporte:</strong> {
            [templateModel.transport.outbound, templateModel.transport.inbound]
              .map(leg => `${leg.carrier} · ${leg.route} · ${leg.date}`)
              .join(' / ')
          }</p>}
          {templateModel.lodging && <p><strong>Hospedagem:</strong> {
            [templateModel.lodging.name, templateModel.lodging.dateRange, templateModel.lodging.nights, templateModel.lodging.mealPlan]
              .filter(Boolean).join(' · ')
          }</p>}
          <p><strong>Total:</strong> {templateModel.price.total.formatted}</p>
          {templateModel.deposit && <p><strong>Pagamento:</strong> {templateModel.deposit.formatted} de sinal
            {templateModel.balanceDueDate ? ` · restante do valor até ${templateModel.balanceDueDate}` : ''}
          </p>}
          <p><strong>Serviços apresentados:</strong></p>
          {templateModel.included.length > 0
            ? <ul>{templateModel.included.map((item, index) => <li key={index}>{item.label}</li>)}</ul>
            : <p>Nenhum serviço apresentado.</p>}
          {templateModel.notIncluded.length > 0 && <>
            <p><strong>Não incluído:</strong></p>
            <ul>{templateModel.notIncluded.map((line, index) => <li key={index}>{line}</li>)}</ul>
          </>}
        </div>
      </div>}
    </section>}
  </div>;
}
