// Gerador Determinístico de Mensagens Comerciais para WhatsApp (Packager - Fase 4 / Fase 5)
// REGRA FUNDAMENTAL: Sem IA, sem APIs externas, puramente determinístico em TypeScript.
// Utiliza estritamente os dados congelados no snapshot da Quotation.
// Nunca expõe dados internos (custo, lucro, margem, fornecedor, markup, IDs).

import { Currency, Quotation, QuotationData, ServiceItem } from '../types';
import { isLegacyPackageData, normalizeLegacyToNewStructure } from './legacyAdapterService';

/**
 * Converte data de formato ISO (YYYY-MM-DD) para formato comercial DD/MM/YYYY
 */
export function formatDateCommercial(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  return trimmed;
}

/**
 * Formata descrição legível de passageiros com concordância gramatical precisa
 * Ex.: "2 adultos", "2 adultos e 1 criança", "2 adultos, 2 crianças e 1 bebé"
 */
export function formatPassengersText(d?: QuotationData): string {
  const p = d?.passengers;
  const adults = p?.adults ?? 0;
  const children = p?.children ?? 0;
  const infants = p?.infants ?? 0;

  const parts: string[] = [];

  if (adults > 0) {
    parts.push(adults === 1 ? '1 adulto' : `${adults} adultos`);
  }
  if (children > 0) {
    parts.push(children === 1 ? '1 criança' : `${children} crianças`);
  }
  if (infants > 0) {
    parts.push(infants === 1 ? '1 bebé' : `${infants} bebés`);
  }

  if (parts.length === 0) {
    return 'os passageiros';
  }
  if (parts.length === 1) {
    return parts[0];
  }
  if (parts.length === 2) {
    return `${parts[0]} e ${parts[1]}`;
  }
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

/**
 * Formata o valor monetário respeitando a moeda da cotação
 */
export function formatPriceText(price: number, currency: Currency): string {
  const formatted = price.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (currency === 'EUR') {
    return `💶 Preço por pessoa: *€ ${formatted}*`;
  }
  return `💰 Preço por pessoa: *R$ ${formatted}*`;
}

function getPackageBaseName(quotation: Quotation): string {
  if (quotation.origin_package_name?.trim()) {
    return quotation.origin_package_name.trim();
  }
  const d = quotation.data;
  if (d?.originPackageName?.trim()) {
    return d.originPackageName.trim();
  }
  if (typeof (quotation as any)?.package?.name === 'string' && (quotation as any).package.name.trim()) {
    return (quotation as any).package.name.trim();
  }
  if (typeof (d as any)?.packageName === 'string' && (d as any).packageName.trim()) {
    return (d as any).packageName.trim();
  }
  if (typeof (d as any)?.package_name === 'string' && (d as any).package_name.trim()) {
    return (d as any).package_name.trim();
  }
  return '';
}

function getClientName(quotation: Quotation): string {
  if (quotation.client_name?.trim()) {
    return quotation.client_name.trim();
  }
  const d = quotation.data;
  if (typeof (d as any)?.client_name === 'string' && (d as any).client_name.trim()) {
    return (d as any).client_name.trim();
  }
  if (typeof (d as any)?.clientName === 'string' && (d as any).clientName.trim()) {
    return (d as any).clientName.trim();
  }
  return '';
}

function getDestination(quotation: Quotation): string {
  const d = quotation.data;
  if (!d) return '';

  // 1. Destino comercial explícito no nível da cotação
  if (typeof d.destination === 'string' && d.destination.trim()) {
    return d.destination.trim();
  }

  // 2. Se for formato legado, resolve através do adapter
  if (isLegacyPackageData(d) || !Array.isArray(d.services)) {
    const normalized = normalizeLegacyToNewStructure(d);
    if (normalized.destination?.trim()) {
      return normalized.destination.trim();
    }
  }

  // 3. Destino das hospedagens nos serviços
  if (Array.isArray(d.services)) {
    const hotelWithDest = d.services.find((s) => s.type === 'accommodation' && s.destination?.trim());
    if (hotelWithDest?.destination?.trim()) {
      return hotelWithDest.destination.trim();
    }
  }

  // 4. Fallback para hospedagem legada
  const fromLodging = d.lodging?.map((l) => l?.destination?.trim()).find(Boolean);
  if (fromLodging) return fromLodging;

  if (typeof (d as any)?.city === 'string' && (d as any).city.trim()) {
    return (d as any).city.trim();
  }
  return '';
}

/**
 * Constrói o título comercial da mensagem para WhatsApp.
 *
 * REGRA DEFINITIVA DE PRIORIDADE:
 * 1. Cotação vinculada a Pacote Base:
 *    "✨ Pacote S23 – {Nome Comercial do Pacote Base}"
 * 2. Cotação avulsa com cliente + destino:
 *    "✨ {Nome do Cliente} – {Destino/Cidade}"
 * 3. Sem nome do cliente, mas com destino:
 *    "✨ {Destino/Cidade}"
 * 4. Sem destino, mas com nome do cliente:
 *    "✨ {Nome do Cliente}"
 * 5. Fallback neutro:
 *    "✨ Pacote S23"
 *
 * NUNCA utilizar informações de transporte (ida, volta, rota, cia aérea, aeroporto/IATA)
 * como título ou fallback.
 */
export function getWhatsAppTitle(quotation: Quotation): string {
  if (!quotation) return '✨ Pacote S23';

  // 1. Cotação vinculada a Pacote Base
  const packageBaseName = getPackageBaseName(quotation);
  if (packageBaseName) {
    return `✨ Pacote S23 – ${packageBaseName}`;
  }

  const clientName = getClientName(quotation);
  const destination = getDestination(quotation);

  // 2. Cotação avulsa com cliente + destino
  if (clientName && destination) {
    return `✨ ${clientName} – ${destination}`;
  }

  // 3. Sem nome do cliente, mas com destino
  if (destination) {
    return `✨ ${destination}`;
  }

  // 4. Sem destino, mas com nome do cliente
  if (clientName) {
    return `✨ ${clientName}`;
  }

  // 5. Fallback neutro
  return '✨ Pacote S23';
}

/**
 * Constrói o título comercial (compatibilidade com chamadas baseadas apenas em QuotationData)
 */
export function getPackageCommercialTitle(d?: QuotationData): string {
  if (!d) return '✨ Pacote S23';
  const mockQuotation: Partial<Quotation> = {
    data: d,
    origin_package_name: d.originPackageName,
    client_name: (d as any)?.client_name || (d as any)?.clientName || null,
  };
  return getWhatsAppTitle(mockQuotation as Quotation);
}

function calculateNightsBetweenDates(startDate?: string, endDate?: string): number | undefined {
  if (!startDate || !endDate) return undefined;
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return undefined;
  const diffTime = e.getTime() - s.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : undefined;
}

/**
 * Gera a mensagem comercial completa para envio no WhatsApp
 * baseando-se única e exclusivamente nos dados da cotação.
 * Suporta tanto a nova estrutura unificada `services[]` quanto dados legados via adapter.
 */
export function generateWhatsAppMessage(quotation: Quotation): string {
  if (!quotation) return '';

  const d: QuotationData = quotation.data || {};
  const currency: Currency = quotation.currency || 'EUR';

  const isLegacy = !Array.isArray(d.services);
  const hasLegacyLodging = isLegacy ? Boolean(d.lodging && d.lodging.length > 0) : true;
  const hasLegacyOutbound = isLegacy ? Boolean(d.outboundTransport && (d.outboundTransport.route || d.outboundTransport.carrier)) : true;
  const hasLegacyInbound = isLegacy ? Boolean(d.inboundTransport && (d.inboundTransport.route || d.inboundTransport.carrier)) : true;

  // Unificação de Fonte de Dados: se for legado ou não tiver services[], normaliza via adapter
  let services: ServiceItem[] = [];
  let localTaxNotes = d.localTaxNotes;
  let paymentConditions = d.paymentConditions;
  let extraServicesNotes = d.extraServicesNotes;
  let customNotes = d.customNotes;
  let transferService = d.transferService;

  if (Array.isArray(d.services) && d.services.length > 0) {
    services = d.services;
  } else if (d && (isLegacyPackageData(d) || !Array.isArray(d.services))) {
    const normalized = normalizeLegacyToNewStructure(d);
    services = normalized.services || [];
    if (!localTaxNotes && normalized.localTaxNotes) localTaxNotes = normalized.localTaxNotes;
    if (!paymentConditions && normalized.paymentConditions) paymentConditions = normalized.paymentConditions;
    if (!extraServicesNotes && normalized.extraServicesNotes) extraServicesNotes = normalized.extraServicesNotes;
    if (!customNotes && normalized.customNotes) customNotes = normalized.customNotes;
    if (!transferService && normalized.transferService) transferService = normalized.transferService;
  }

  const sections: string[] = [];

  // 1. Título do Pacote / Cotação
  const title = getWhatsAppTitle(quotation);
  sections.push(title);

  // 2. Datas da viagem (omitido se não houver datas)
  const startDate = d.dates?.startDate ? formatDateCommercial(d.dates.startDate) : '';
  const endDate = d.dates?.endDate ? formatDateCommercial(d.dates.endDate) : '';

  if (startDate && endDate) {
    sections.push(`📅 ${startDate} a ${endDate}`);
  } else if (startDate) {
    sections.push(`📅 A partir de ${startDate}`);
  }

  // 3. Bloco de Inclusões e Passageiros
  const passengersText = formatPassengersText(d);
  const inclusions: string[] = [];

  inclusions.push(`✈️ O que está incluído para ${passengersText}:`);

  // Transporte de Ida (outbound_transport)
  const outbounds = isLegacy && !hasLegacyOutbound
    ? []
    : services.filter((s) => s.type === 'outbound_transport');
  for (const outbound of outbounds) {
    if (outbound.description?.trim()) {
      let obDesc = outbound.description.trim();
      if (outbound.carrier?.trim() && !obDesc.toLowerCase().includes(outbound.carrier.toLowerCase().trim())) {
        obDesc = `${outbound.carrier.trim()} ${obDesc}`;
      }

      if (startDate) {
        inclusions.push(`🛫 ${startDate} – ${obDesc}`);
      } else {
        inclusions.push(`🛫 ${obDesc}`);
      }

      // Horários de ida (omitido se não informado)
      const depTime = outbound.departureTime?.trim();
      const arrTime = outbound.arrivalTime?.trim();
      if (depTime && arrTime) {
        inclusions.push(`⏰ Partida: ${depTime} → ${arrTime}`);
      } else if (depTime) {
        inclusions.push(`⏰ Partida: ${depTime}`);
      } else if (arrTime) {
        inclusions.push(`⏰ Chegada: ${arrTime}`);
      }
    }
  }

  // Transporte de Volta (inbound_transport)
  const inbounds = isLegacy && !hasLegacyInbound
    ? []
    : services.filter((s) => s.type === 'inbound_transport');
  for (const inbound of inbounds) {
    if (inbound.description?.trim()) {
      let ibDesc = inbound.description.trim();
      if (inbound.carrier?.trim() && !ibDesc.toLowerCase().includes(inbound.carrier.toLowerCase().trim())) {
        ibDesc = `${inbound.carrier.trim()} ${ibDesc}`;
      }

      if (endDate) {
        inclusions.push(`🛬 ${endDate} – ${ibDesc}`);
      } else {
        inclusions.push(`🛬 ${ibDesc}`);
      }

      // Horários de volta (omitido se não informado)
      const depTime = inbound.departureTime?.trim();
      const arrTime = inbound.arrivalTime?.trim();
      if (depTime && arrTime) {
        inclusions.push(`⏰ Partida: ${depTime} → ${arrTime}`);
      } else if (depTime) {
        inclusions.push(`⏰ Partida: ${depTime}`);
      } else if (arrTime) {
        inclusions.push(`⏰ Chegada: ${arrTime}`);
      }
    }
  }

  // Hospedagem (accommodation) - Suporta múltiplas hospedagens
  const accommodations = isLegacy && !hasLegacyLodging
    ? []
    : services.filter((s) => s.type === 'accommodation');
  for (const h of accommodations) {
    if (h.description?.trim()) {
      const parsedNotesNights = h.notes?.match(/(\d+)\s*noites?/i);
      const nightsFromNotes = parsedNotesNights ? parseInt(parsedNotesNights[1], 10) : undefined;
      const nights =
        d.dates?.durationNights ||
        (d.dates?.durationDays && d.dates.durationDays > 1 ? d.dates.durationDays - 1 : d.dates?.durationDays) ||
        calculateNightsBetweenDates(d.dates?.startDate, d.dates?.endDate) ||
        nightsFromNotes ||
        (h.quantity && h.quantity > 1 ? h.quantity : undefined);
      const mealPlan = h.mealPlan?.trim();

      let hotelLine = '🏨 ';
      if (startDate && nights && mealPlan) {
        hotelLine += `${startDate} – ${nights} noites em ${h.description.trim()}, com ${mealPlan}.`;
      } else if (nights && mealPlan) {
        hotelLine += `${nights} noites em ${h.description.trim()}, com ${mealPlan}.`;
      } else if (nights) {
        hotelLine += `${nights} noites em ${h.description.trim()}.`;
      } else if (mealPlan) {
        hotelLine += `Hospedagem em ${h.description.trim()}, com ${mealPlan}.`;
      } else {
        hotelLine += `Hospedagem em ${h.description.trim()}.`;
      }
      inclusions.push(hotelLine);
    }
  }

  // Transfers (transfer)
  if (transferService?.trim()) {
    inclusions.push(`🚗 ${transferService.trim()}`);
  }
  const transfers = services.filter((s) => s.type === 'transfer');
  for (const t of transfers) {
    if (t.description?.trim()) {
      if (!transferService || transferService.trim().toLowerCase() !== t.description.trim().toLowerCase()) {
        inclusions.push(`🚗 ${t.description.trim()}`);
      }
    }
  }

  // Seguro-viagem (insurance)
  const insurances = services.filter((s) => s.type === 'insurance');
  for (const ins of insurances) {
    if (ins.description?.trim()) {
      inclusions.push(`🛡️ ${ins.description.trim()}`);
    }
  }

  // Serviços adicionais (additional)
  const additionals = services.filter((s) => s.type === 'additional');
  for (const add of additionals) {
    if (add.description?.trim()) {
      inclusions.push(`🎫 ${add.description.trim()}`);
    }
  }

  // Impostos / Taxas (taxes)
  const taxes = services.filter((s) => s.type === 'taxes');
  for (const tax of taxes) {
    if (tax.description?.trim()) {
      inclusions.push(`🏛️ ${tax.description.trim()}`);
    }
  }

  // Outros custos (other)
  const others = services.filter((s) => s.type === 'other');
  for (const oth of others) {
    if (oth.description?.trim()) {
      inclusions.push(`📦 ${oth.description.trim()}`);
    }
  }

  sections.push(inclusions.join('\n'));

  // 4. Preço por Pessoa do Pacote
  const pricePerPerson =
    typeof d.financials?.pricePerPerson === 'number'
      ? d.financials.pricePerPerson
      : typeof d.financials?.pricePerPersonAmount?.amount === 'number'
      ? d.financials.pricePerPersonAmount.amount
      : 0;

  if (pricePerPerson > 0) {
    sections.push(formatPriceText(pricePerPerson, currency));
  }

  // 5. Condição de Pagamento (Entrada / Parcelamento)
  if (paymentConditions?.trim()) {
    sections.push(`💳 Entrada: ${paymentConditions.trim()}`);
  }

  // 6. Observações ou Opções Comerciais
  if (customNotes?.trim()) {
    sections.push(customNotes.trim());
  }

  // 7. Taxa Local (se aplicável)
  if (localTaxNotes?.trim()) {
    sections.push(`Taxa local a pagar diretamente na hospedagem: ${localTaxNotes.trim()}`);
  }

  // 8. Serviços Extras / Opcionais (se aplicável)
  if (extraServicesNotes?.trim()) {
    sections.push(`Consulte-nos sobre serviços extra: ${extraServicesNotes.trim()}`);
  } else {
    const extraServices = d.additionalServices?.filter((s) => !s.included);
    if (extraServices && extraServices.length > 0) {
      const list = extraServices.map((s) => s.name).join(', ');
      sections.push(`Consulte-nos sobre serviços extra: ${list}`);
    }
  }

  // 9. Aviso Legal Comercial Padrão S23
  sections.push('Até a data da contratação podem ocorrer alterações sem controle da agência.');

  // Junta seções separando por quebra de linha dupla para legibilidade no WhatsApp
  return sections.join('\n\n');
}
