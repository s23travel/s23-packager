import type { Package } from '../../../src/types/index.ts';
import { createPackageFlyer } from '../../../src/services/packageFlyerService.ts';
import { validSubtitle } from './flyerAiContract.ts';

export type FlyerItemKind = 'air' | 'transport' | 'accommodation' | 'transfer' | 'insurance' | 'additional';
export interface PackageFlyerServerModel {
  version: 1;
  origin: string;
  destination: string;
  period: string;
  price: { amount: number; currency: 'BRL' | 'EUR'; formatted: string };
  items: Array<{ kind: FlyerItemKind; label: string }>;
  paymentConditions?: string;
  subtitle: string;
}

export interface PackageFlyerServerResult {
  model: PackageFlyerServerModel | null;
  errors: string[];
  warnings: string[];
}

/** Usa o mesmo cálculo comercial da prévia local; só agrega o subtítulo revisado. */
export function createPackageFlyerServerModel(
  packageRecord: { base_currency: unknown; data: unknown },
  subtitle: unknown,
): PackageFlyerServerResult {
  const flyer = createPackageFlyer(packageRecord as Package);
  const errors = [...flyer.errors];
  if (!validSubtitle(subtitle)) errors.push('Revise o subtítulo antes de salvar a lâmina.');
  if (!flyer.model || errors.length > 0 || typeof subtitle !== 'string') {
    return { model: null, errors, warnings: flyer.warnings };
  }
  return { model: { ...flyer.model, subtitle }, errors, warnings: flyer.warnings };
}
