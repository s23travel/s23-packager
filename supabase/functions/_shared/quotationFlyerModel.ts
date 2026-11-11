import type { Quotation } from '../../../src/types/index.ts';
import { createQuotationFlyer, type QuotationFlyerModel } from '../../../src/services/quotationFlyerService.ts';
import { validSubtitle } from './flyerAiContract.ts';
import { validFlyerItems } from './flyerItemsContract.ts';

export interface QuotationFlyerServerResult {
  model: QuotationFlyerModel | null;
  errors: string[];
  warnings: string[];
}

/**
 * Modelo canônico da proposta lida da tabela `quotations` com o JWT do
 * utilizador. Só o subtítulo e a lista revista de serviços vêm do browser;
 * cliente, data, valores, sinal e não incluídos saem sempre do registo salvo.
 */
export function createQuotationFlyerServerModel(
  quotationRecord: { client_name?: unknown; currency?: unknown; data?: unknown; created_at?: unknown },
  subtitle: unknown,
  items?: unknown,
): QuotationFlyerServerResult {
  const flyer = createQuotationFlyer(quotationRecord as unknown as Quotation);
  const errors = [...flyer.errors];
  if (!validSubtitle(subtitle)) errors.push('Revise o subtítulo antes de salvar a lâmina.');
  const reviewedItems = items === undefined ? undefined : (validFlyerItems(items) ? items : null);
  if (reviewedItems === null) errors.push('Revise os serviços apresentados antes de gerar a lâmina.');
  if (!flyer.model || errors.length > 0 || typeof subtitle !== 'string') {
    return { model: null, errors, warnings: flyer.warnings };
  }
  return {
    model: { ...flyer.model, ...(reviewedItems ? { included: reviewedItems } : {}), subtitle },
    errors,
    warnings: flyer.warnings,
  };
}
