import type { QuotationFlyerModel } from '../../services/quotationFlyerService';
import { renderQuotationFlyerMarkup } from '../../services/quotationFlyerMarkup';
import logo from '../../../design-system/s23-travel/assets/Logo Secundário Redondo.png';

/** Prévia React da proposta: a mesma composição do renderer confiável. */
export function QuotationFlyerTemplate({ model }: { model: QuotationFlyerModel }) {
  return <div dangerouslySetInnerHTML={{ __html: renderQuotationFlyerMarkup(model, logo) }} />;
}
