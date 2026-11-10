import type { PackageFlyerModel } from '../../services/packageFlyerService';
import { renderPackageFlyerMarkup } from '../../services/packageFlyerMarkup';
import logo from '../../../design-system/s23-travel/assets/Logo Secundário Redondo.png';

export function PackageFlyerTemplate({ model }: { model: PackageFlyerModel }) {
  return <div dangerouslySetInnerHTML={{ __html: renderPackageFlyerMarkup(model, logo) }} />;
}
