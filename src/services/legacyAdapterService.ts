// Serviço de Adaptação e Normalização de Dados Legados para Nova Estrutura de Serviços (Fase 1)
// REGRA FUNDAMENTAL: 100% Determinístico, sem IA, em memória, não altera dados originais,
// não executa queries de banco ou migrations, e preserva rigorosamente todos os campos.

import {
  CostCategory,
  CostComponent,
  Currency,
  FinancialSummary,
  LodgingDetails,
  NormalizedPackageData,
  PackageData,
  PassengerConfig,
  QuotationData,
  ServiceItem,
  ServiceType,
} from '../types';
import { calculateFinancialSummary } from './financeService';

/**
 * Gera UUID seguro via crypto.randomUUID() com fallback para compatibilidade.
 */
export function generateServiceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Normaliza e classifica determinísticamente componentes da categoria 'services'.
 * Regras:
 * - Menção a "seguro" -> 'insurance'
 * - Menção a "transfer" / "traslado" -> 'transfer'
 * - Demais -> 'additional'
 */
export function classifyServiceComponent(description: string, notes?: string): ServiceType {
  const text = `${description || ''} ${notes || ''}`.toLowerCase();

  // Seguro-viagem
  if (text.includes('seguro')) {
    return 'insurance';
  }

  // Transfer / Traslado / Transfere
  if (text.includes('transfer') || text.includes('traslado') || text.includes('transfere')) {
    return 'transfer';
  }

  return 'additional';
}

/**
 * Mapeia uma categoria de custo do modelo antigo para o novo ServiceType
 */
export function mapCostCategoryToServiceType(
  category: string,
  description: string = '',
  notes?: string
): ServiceType {
  switch (category) {
    case 'outbound_transport':
      return 'outbound_transport';
    case 'inbound_transport':
      return 'inbound_transport';
    case 'lodging':
      return 'accommodation';
    case 'services':
      return classifyServiceComponent(description, notes);
    case 'taxes':
      return 'taxes';
    case 'other':
      return 'other';
    default:
      return 'other';
  }
}

/**
 * Extrai horários de voo (departureTime e arrivalTime) de strings de texto/notas caso não estejam estruturados.
 * Ex.: "15:15-18:40", "15:05 - 19:20", "07:00 - 10:30", "07:43\t18:02"
 */
export function extractTimesFromText(text?: string | null): {
  departureTime?: string;
  arrivalTime?: string;
  remainingNotes?: string;
} {
  if (!text || typeof text !== 'string') return {};

  const trimmed = text.trim();
  // Regex para capturar padrões HH:MM [h/H]? [- / a \t] HH:MM [h/H]?
  const timeRangeRegex = /(\d{1,2}:\d{2})\s*(?:h|H)?\s*(?:-|–|—|a|\t|\s)\s*(\d{1,2}:\d{2})\s*(?:h|H)?/;
  const match = trimmed.match(timeRangeRegex);

  if (match) {
    const dep = match[1].padStart(5, '0');
    const arr = match[2].padStart(5, '0');
    const cleanRemainder = trimmed.replace(match[0], '').trim();

    return {
      departureTime: dep,
      arrivalTime: arr,
      remainingNotes: cleanRemainder.length > 0 ? cleanRemainder : undefined,
    };
  }

  return { remainingNotes: trimmed };
}

/**
 * Determina o destino em nível superior a partir das hospedagens.
 * Se houver múltiplos hotéis com destinos diferentes, preserva a informação
 * e sinaliza conflito determinístico sem escolher arbitrariamente.
 */
export function resolveDestination(lodgings?: LodgingDetails[]): {
  destination?: string;
  destinationConflict?: boolean;
  destinationConflictDetails?: string[];
} {
  if (!lodgings || lodgings.length === 0) {
    return {};
  }

  const destinations = lodgings
    .map((l) => (l.destination ? l.destination.trim() : ''))
    .filter((d) => d.length > 0);

  if (destinations.length === 0) {
    return {};
  }

  const uniqueDestinations = Array.from(new Set(destinations));

  if (uniqueDestinations.length === 1) {
    return {
      destination: uniqueDestinations[0],
      destinationConflict: false,
    };
  }

  // Múltiplos destinos diferentes detectados
  return {
    destination: uniqueDestinations.join(' / '),
    destinationConflict: true,
    destinationConflictDetails: uniqueDestinations,
  };
}

/**
 * Normaliza um registro de PackageData ou QuotationData para a nova estrutura unificada de Serviços.
 * Não altera o objeto original (opera sobre cópia imutável).
 */
export function normalizeLegacyToNewStructure(
  legacyData: PackageData | QuotationData
): NormalizedPackageData {
  if (!legacyData || typeof legacyData !== 'object') {
    return { services: [] };
  }

  // Clone raso das propriedades de alto nível para não mutar o objeto recebido
  const copy: Record<string, unknown> = { ...legacyData };

  const components: CostComponent[] = Array.isArray(legacyData.financials?.components)
    ? [...legacyData.financials.components]
    : [];

  const services: ServiceItem[] = [];
  const processedComponentIds = new Set<string>();

  // 1. Resolver Destino de nível superior
  const destResolution = resolveDestination(legacyData.lodging);

  // 2. Transporte de Ida (outboundTransport + component category = 'outbound_transport')
  const outboundCompIndex = components.findIndex((c) => c.category === 'outbound_transport');
  const outboundComp = outboundCompIndex >= 0 ? components[outboundCompIndex] : undefined;
  const outboundTransport = legacyData.outboundTransport;

  if (outboundTransport || outboundComp) {
    let departureTime = outboundTransport?.departureTime;
    let arrivalTime = outboundTransport?.arrivalTime;
    const notesParts: string[] = [];

    if (outboundTransport?.notes) {
      notesParts.push(outboundTransport.notes);
    }

    if (outboundComp?.notes) {
      // Se não temos horários estruturados no outboundTransport, tentar extrair de notes
      if (!departureTime && !arrivalTime) {
        const extracted = extractTimesFromText(outboundComp.notes);
        if (extracted.departureTime && extracted.arrivalTime) {
          departureTime = extracted.departureTime;
          arrivalTime = extracted.arrivalTime;
          if (extracted.remainingNotes) {
            notesParts.push(extracted.remainingNotes);
          }
        } else {
          notesParts.push(outboundComp.notes);
        }
      } else {
        // Horários já existem estruturados. Verificar se notes do comp contém algo adicional
        const extracted = extractTimesFromText(outboundComp.notes);
        if (extracted.remainingNotes) {
          notesParts.push(extracted.remainingNotes);
        } else if (!extracted.departureTime) {
          notesParts.push(outboundComp.notes);
        }
      }
    }

    const description =
      outboundTransport?.route ||
      outboundComp?.description ||
      (outboundTransport?.carrier ? `Voo ${outboundTransport.carrier}` : 'Transporte de ida');

    const item: ServiceItem = {
      id: generateServiceId(),
      type: 'outbound_transport',
      description,
      currency: outboundComp?.currency || legacyData.financials?.currency || 'EUR',
      amount: outboundComp?.amount ?? 0,
      quantity: outboundComp?.quantity ?? 1,
      carrier: outboundTransport?.carrier,
      departureTime: departureTime || undefined,
      arrivalTime: arrivalTime || undefined,
      notes: notesParts.filter(Boolean).join(' | ') || undefined,
      sourceField: outboundComp?.sourceField || 'outboundRoute',
      legacyComponentId: outboundComp?.id,
      legacyCategory: 'outbound_transport',
      isCustomized: outboundComp?.isCustomized,
    };

    services.push(item);
    if (outboundComp?.id) {
      processedComponentIds.add(outboundComp.id);
    }
  }

  // 3. Transporte de Volta (inboundTransport + component category = 'inbound_transport')
  const inboundCompIndex = components.findIndex((c) => c.category === 'inbound_transport');
  const inboundComp = inboundCompIndex >= 0 ? components[inboundCompIndex] : undefined;
  const inboundTransport = legacyData.inboundTransport;

  if (inboundTransport || inboundComp) {
    let departureTime = inboundTransport?.departureTime;
    let arrivalTime = inboundTransport?.arrivalTime;
    const notesParts: string[] = [];

    if (inboundTransport?.notes) {
      notesParts.push(inboundTransport.notes);
    }

    if (inboundComp?.notes) {
      if (!departureTime && !arrivalTime) {
        const extracted = extractTimesFromText(inboundComp.notes);
        if (extracted.departureTime && extracted.arrivalTime) {
          departureTime = extracted.departureTime;
          arrivalTime = extracted.arrivalTime;
          if (extracted.remainingNotes) {
            notesParts.push(extracted.remainingNotes);
          }
        } else {
          notesParts.push(inboundComp.notes);
        }
      } else {
        const extracted = extractTimesFromText(inboundComp.notes);
        if (extracted.remainingNotes) {
          notesParts.push(extracted.remainingNotes);
        } else if (!extracted.departureTime) {
          notesParts.push(inboundComp.notes);
        }
      }
    }

    const description =
      inboundTransport?.route ||
      inboundComp?.description ||
      (inboundTransport?.carrier ? `Voo ${inboundTransport.carrier}` : 'Transporte de volta');

    const item: ServiceItem = {
      id: generateServiceId(),
      type: 'inbound_transport',
      description,
      currency: inboundComp?.currency || legacyData.financials?.currency || 'EUR',
      amount: inboundComp?.amount ?? 0,
      quantity: inboundComp?.quantity ?? 1,
      carrier: inboundTransport?.carrier,
      departureTime: departureTime || undefined,
      arrivalTime: arrivalTime || undefined,
      notes: notesParts.filter(Boolean).join(' | ') || undefined,
      sourceField: inboundComp?.sourceField || 'inboundRoute',
      legacyComponentId: inboundComp?.id,
      legacyCategory: 'inbound_transport',
      isCustomized: inboundComp?.isCustomized,
    };

    services.push(item);
    if (inboundComp?.id) {
      processedComponentIds.add(inboundComp.id);
    }
  }

  // 4. Hospedagem (CADA item em lodging[] vira um ServiceItem do tipo 'accommodation')
  const lodgingComps = components.filter((c) => c.category === 'lodging');
  const usedLodgingCompIds = new Set<string>();

  if (Array.isArray(legacyData.lodging) && legacyData.lodging.length > 0) {
    legacyData.lodging.forEach((hotel, idx) => {
      // Tenta associar o componente financeiro de lodging:
      // 1. Por descrição exata do hotel
      // 2. Ou por ordem se houver a mesma quantidade de componentes que hotéis
      let matchedComp = lodgingComps.find(
        (c) =>
          !usedLodgingCompIds.has(c.id) &&
          c.description &&
          hotel.name &&
          c.description.toLowerCase().trim() === hotel.name.toLowerCase().trim()
      );

      if (!matchedComp && lodgingComps.length === legacyData.lodging!.length) {
        matchedComp = lodgingComps[idx];
      } else if (!matchedComp) {
        // Fallback: primeiro componente de lodging não usado
        matchedComp = lodgingComps.find((c) => !usedLodgingCompIds.has(c.id));
      }

      if (matchedComp) {
        usedLodgingCompIds.add(matchedComp.id);
        processedComponentIds.add(matchedComp.id);
      }

      const notesParts: string[] = [];
      if (hotel.roomType) notesParts.push(`Quarto: ${hotel.roomType}`);
      if (hotel.nights) notesParts.push(`${hotel.nights} noites`);
      if (matchedComp?.notes) notesParts.push(matchedComp.notes);

      const item: ServiceItem = {
        id: generateServiceId(),
        type: 'accommodation',
        description: hotel.name || matchedComp?.description || 'Hospedagem',
        currency: matchedComp?.currency || legacyData.financials?.currency || 'EUR',
        amount: matchedComp?.amount ?? 0,
        quantity: matchedComp?.quantity ?? 1,
        destination: hotel.destination || undefined,
        mealPlan: hotel.mealPlan || undefined,
        notes: notesParts.length > 0 ? notesParts.join(' | ') : undefined,
        sourceField: matchedComp?.sourceField || 'hotelName',
        legacyComponentId: matchedComp?.id,
        legacyCategory: 'lodging',
        isCustomized: matchedComp?.isCustomized,
      };

      services.push(item);
    });
  }

  // 5. Componentes de Custo restantes em financials.components
  for (const comp of components) {
    if (processedComponentIds.has(comp.id)) {
      continue;
    }

    const serviceType = mapCostCategoryToServiceType(comp.category, comp.description, comp.notes);

    const item: ServiceItem = {
      id: generateServiceId(),
      type: serviceType,
      description: comp.description || 'Serviço',
      currency: comp.currency || legacyData.financials?.currency || 'EUR',
      amount: comp.amount ?? 0,
      quantity: comp.quantity ?? 1,
      notes: comp.notes || undefined,
      sourceField: comp.sourceField,
      legacyComponentId: comp.id,
      legacyCategory: comp.category,
      isCustomized: comp.isCustomized,
    };

    services.push(item);
    processedComponentIds.add(comp.id);
  }

  // 6. Montar o NormalizedPackageData preservando todos os campos
  const normalized: NormalizedPackageData = {
    ...copy,
    destination: destResolution.destination,
    destinationConflict: destResolution.destinationConflict,
    destinationConflictDetails: destResolution.destinationConflictDetails,
    dates: legacyData.dates ? { ...legacyData.dates } : undefined,
    passengers: legacyData.passengers ? { ...legacyData.passengers } : undefined,
    services,
    financials: legacyData.financials ? { ...legacyData.financials } : undefined,
    additionalInfo: legacyData.additionalInfo,
    localTaxNotes: legacyData.localTaxNotes,
    paymentConditions: legacyData.paymentConditions,
    supplier: legacyData.supplier,
    transferService: legacyData.transferService,
    extraServicesNotes: legacyData.extraServicesNotes,
    customNotes: legacyData.customNotes,
  };

  return normalized;
}

/**
 * Converte um ServiceItem unificado em um CostComponent para compatibilidade
 * com o motor financeiro determinístico e relatórios.
 */
export function serviceItemToCostComponent(item: ServiceItem): CostComponent {
  let category: CostCategory = 'other';
  if (item.type === 'outbound_transport') category = 'outbound_transport';
  else if (item.type === 'inbound_transport') category = 'inbound_transport';
  else if (item.type === 'accommodation') category = 'lodging';
  else if (item.type === 'transfer' || item.type === 'insurance' || item.type === 'additional') category = 'services';
  else if (item.type === 'taxes') category = 'taxes';
  else if (item.type === 'other') category = 'other';

  return {
    id: item.id,
    category,
    description: item.description,
    amount: item.amount || 0,
    currency: item.currency || 'EUR',
    quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
    notes: item.notes,
    sourceField: item.sourceField as any,
    inheritedDescription: item.description,
    isCustomized: item.isCustomized,
  };
}

/**
 * Cria uma nova instância de ServiceItem com UUID v4 e valores padrão para um dado ServiceType.
 */
export function createDefaultServiceItem(
  type: ServiceType,
  defaultCurrency: Currency = 'EUR',
  defaultDestination?: string
): ServiceItem {
  return {
    id: generateServiceId(),
    type,
    description: '',
    currency: defaultCurrency,
    amount: 0,
    quantity: 1,
    destination: type === 'accommodation' ? defaultDestination || '' : undefined,
    mealPlan: type === 'accommodation' ? 'Café da manhã (BB)' : undefined,
    departureTime: type === 'outbound_transport' || type === 'inbound_transport' ? '' : undefined,
    arrivalTime: type === 'outbound_transport' || type === 'inbound_transport' ? '' : undefined,
  };
}

/**
 * Calcula o FinancialSummary determinístico diretamente a partir de uma lista de ServiceItem[].
 */
export function calculateFinancialSummaryFromServices(input: {
  services: ServiceItem[];
  salePrice: number;
  targetCurrency: Currency;
  exchangeRate?: number | null;
  passengers?: PassengerConfig | null;
}): FinancialSummary {
  const components = (input.services || []).map(serviceItemToCostComponent);
  return calculateFinancialSummary({
    components,
    salePrice: input.salePrice,
    targetCurrency: input.targetCurrency,
    exchangeRate: input.exchangeRate,
    passengers: input.passengers,
  });
}

/**
 * Detecta se os dados de um pacote estão no formato legado (sem services[]).
 */
export function isLegacyPackageData(data?: PackageData | null): boolean {
  if (!data || typeof data !== 'object') return false;
  if (Array.isArray(data.services)) return false;
  return Boolean(
    data.outboundTransport ||
    data.inboundTransport ||
    (data.lodging && data.lodging.length > 0) ||
    (data.financials?.components && data.financials.components.length > 0)
  );
}

