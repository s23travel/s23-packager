import { CostComponent, Currency, CostCategory } from '../types';

export interface OperationalData {
  outboundRoute: string;
  inboundRoute: string;
  hotelName: string;
  baseCurrency: Currency;
}

interface OperationalFieldConfig {
  sourceField: 'outboundRoute' | 'inboundRoute' | 'hotelName';
  category: CostCategory;
  getValue: (op: OperationalData) => string;
}

const OPERATIONAL_FIELDS: OperationalFieldConfig[] = [
  {
    sourceField: 'outboundRoute',
    category: 'outbound_transport',
    getValue: (op) => op.outboundRoute.trim(),
  },
  {
    sourceField: 'inboundRoute',
    category: 'inbound_transport',
    getValue: (op) => op.inboundRoute.trim(),
  },
  {
    sourceField: 'hotelName',
    category: 'lodging',
    getValue: (op) => op.hotelName.trim(),
  },
];

/**
 * Sincroniza deterministicamente os dados operacionais da Seção 3 com os componentes financeiros da Seção 4.
 *
 * Regras estritas:
 * 1. Seção 3 preenchida cria/atualiza os custos correspondentes na Seção 4.
 * 2. Se o utilizador editou manualmente a descrição na Seção 4 (`isCustomized === true` ou descrição divergente do herdado),
 *    a edição manual JAMAIS é sobrescrita por alterações posteriores na Seção 3.
 * 3. Componentes manuais adicionados via "+ Adicionar Custo" (sem `sourceField`) permanecem completamente independentes e intocados.
 */
export function syncOperationalWithFinancials(
  prevComponents: CostComponent[],
  operational: OperationalData
): CostComponent[] {
  let result = [...prevComponents];

  for (const config of OPERATIONAL_FIELDS) {
    const currentValue = config.getValue(operational);
    const existingIndex = result.findIndex((c) => c.sourceField === config.sourceField);

    if (currentValue) {
      if (existingIndex >= 0) {
        const existing = result[existingIndex];
        // Se foi editado manualmente, preserva a descrição customizada
        const isManuallyEdited =
          existing.isCustomized === true ||
          (existing.inheritedDescription !== undefined &&
            existing.description !== existing.inheritedDescription);

        result[existingIndex] = {
          ...existing,
          description: isManuallyEdited ? existing.description : currentValue,
          inheritedDescription: currentValue,
          isCustomized: isManuallyEdited,
        };
      } else {
        // Cria novo componente herdado
        const newComponent: CostComponent = {
          id: `cost_${config.sourceField}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          category: config.category,
          description: currentValue,
          amount: 0,
          currency: operational.baseCurrency,
          quantity: 1,
          sourceField: config.sourceField,
          inheritedDescription: currentValue,
          isCustomized: false,
        };
        result.push(newComponent);
      }
    } else {
      // Valor da Seção 3 foi limpo
      if (existingIndex >= 0) {
        const existing = result[existingIndex];
        const hasFinancialValue = (existing.amount || 0) > 0 || Boolean(existing.notes?.trim());
        const isManuallyEdited = existing.isCustomized === true;

        // Se ainda for um rascunho sem valor financeiro ou edição manual, remove
        if (!hasFinancialValue && !isManuallyEdited) {
          result = result.filter((_, idx) => idx !== existingIndex);
        }
      }
    }
  }

  // Evita re-render desnecessário se não houve alterações
  if (result.length === prevComponents.length) {
    const isUnchanged = result.every((item, i) => {
      const prev = prevComponents[i];
      return (
        item.id === prev.id &&
        item.description === prev.description &&
        item.amount === prev.amount &&
        item.currency === prev.currency &&
        item.quantity === prev.quantity &&
        item.isCustomized === prev.isCustomized &&
        item.inheritedDescription === prev.inheritedDescription
      );
    });
    if (isUnchanged) {
      return prevComponents;
    }
  }

  return result;
}
