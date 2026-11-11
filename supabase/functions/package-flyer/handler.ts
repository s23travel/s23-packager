import { createPackageFlyerServerModel } from '../_shared/packageFlyerModel.ts';
import {
  corsHeaders,
  createFlyerHandler,
  type FlyerImage,
  type FlyerPipelineDependencies,
} from '../_shared/flyerPipeline.ts';

export { corsHeaders };

export type PackageFlyerDependencies = FlyerPipelineDependencies;

/** Configuração da lâmina de pacote sobre a pipeline comum. */
export function createPackageFlyerHandler(deps: PackageFlyerDependencies) {
  return createFlyerHandler(
    {
      name: 'package-flyer',
      idField: 'packageId',
      ownerTable: 'packages',
      ownerSelect: 'id,data,base_currency,updated_at',
      rpcPrefix: 'package',
      attachmentTable: 'package_flyer_attachments',
      attachmentKeyColumn: 'package_id',
      attachmentSelect: 'package_id,operation_id,revision,saved_at',
      operationTable: 'package_flyer_operations',
      messages: {
        invalidOwner: 'Informe um pacote válido.',
        ownerUnavailableCode: 'PACKAGE_UNAVAILABLE',
        ownerUnavailable: 'Não foi possível validar o pacote.',
        unauthorized: 'A sessão não está autorizada para este pacote.',
        ownerNotFoundCode: 'PACKAGE_NOT_FOUND',
        ownerNotFound: 'O pacote não foi encontrado.',
        noSavedFlyer: 'Ainda não há uma lâmina salva neste pacote.',
        revisionConflict: 'O pacote ou a lâmina mudou. Atualize a tela e gere outra prévia.',
        revisionConflictStart: 'O pacote ou a lâmina mudou. Atualize a tela e tente novamente.',
        modelInvalidCode: 'PACKAGE_DATA_INVALID',
        modelInvalidMessage: 'Revise os dados comerciais do pacote.',
      },
      buildModel: (record, subtitle, items) =>
        createPackageFlyerServerModel(record as { base_currency: unknown; data: unknown }, subtitle, items),
      // O contrato atual do worker de pacotes não conhece discriminador de template.
      renderPayload: (model, image: FlyerImage) => ({ model, image }),
    },
    deps,
  );
}
