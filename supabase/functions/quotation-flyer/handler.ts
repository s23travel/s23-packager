import { createQuotationFlyerServerModel } from '../_shared/quotationFlyerModel.ts';
import {
  createFlyerHandler,
  type FlyerPipelineDependencies,
} from '../_shared/flyerPipeline.ts';

export type QuotationFlyerDependencies = FlyerPipelineDependencies;

/** Configuração da proposta de viagem sobre a pipeline comum da lâmina. */
export function createQuotationFlyerHandler(deps: QuotationFlyerDependencies) {
  return createFlyerHandler(
    {
      name: 'quotation-flyer',
      idField: 'quotationId',
      ownerTable: 'quotations',
      ownerSelect: 'id,client_name,currency,data,created_at,updated_at',
      rpcPrefix: 'quotation',
      attachmentTable: 'quotation_flyer_attachments',
      attachmentKeyColumn: 'quotation_id',
      attachmentSelect: 'quotation_id,operation_id,revision,saved_at',
      operationTable: 'quotation_flyer_operations',
      messages: {
        invalidOwner: 'Informe uma cotação válida.',
        ownerUnavailableCode: 'QUOTATION_UNAVAILABLE',
        ownerUnavailable: 'Não foi possível validar a cotação.',
        unauthorized: 'A sessão não está autorizada para esta cotação.',
        ownerNotFoundCode: 'QUOTATION_NOT_FOUND',
        ownerNotFound: 'A cotação não foi encontrada.',
        noSavedFlyer: 'Ainda não há uma lâmina salva nesta cotação.',
        revisionConflict: 'A cotação ou a lâmina mudou. Atualize a tela e gere outra prévia.',
        revisionConflictStart: 'A cotação ou a lâmina mudou. Atualize a tela e tente novamente.',
        modelInvalidCode: 'QUOTATION_DATA_INVALID',
        modelInvalidMessage: 'Revise os dados comerciais da cotação.',
      },
      buildModel: (record, subtitle, items) => createQuotationFlyerServerModel(record, subtitle, items),
      // O worker só ganha o template da cotação no ticket seguinte; o contrato já vai assim.
      renderPayload: (model, image) => ({ template: 'quotation', model, image }),
    },
    deps,
  );
}
