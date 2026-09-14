// Gerador Determinístico de Mensagens Comerciais para WhatsApp (Packager - Fase 5)
// REGRA FUNDAMENTAL: Sem IA, sem APIs externas, puramente determinístico em TypeScript.
// Utiliza estritamente os dados congelados no snapshot da Quotation.
// Nunca expõe dados internos (custo, lucro, margem, fornecedor, markup, IDs).

import { Currency, Quotation, QuotationData } from '../types';

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
    return `💶 Total do pacote: *€ ${formatted}*`;
  }
  return `💰 Total do pacote: *R$ ${formatted}*`;
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
  const fromLodging = d.lodging?.map((l) => l?.destination?.trim()).find(Boolean);
  if (fromLodging) return fromLodging;
  if (typeof (d as any)?.destination === 'string' && (d as any).destination.trim()) {
    return (d as any).destination.trim();
  }
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

/**
 * Gera a mensagem comercial completa para envio no WhatsApp
 * baseando-se única e exclusivamente nos dados da cotação.
 */
export function generateWhatsAppMessage(quotation: Quotation): string {
  if (!quotation) return '';

  const d: QuotationData = quotation.data || {};
  const currency: Currency = quotation.currency || 'EUR';

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

  // Transporte de Ida
  const outbound = d.outboundTransport;
  if (outbound && (outbound.route?.trim() || outbound.carrier?.trim())) {
    const obDate = outbound.departureDate
      ? formatDateCommercial(outbound.departureDate)
      : startDate;
    const obDesc = [
      outbound.carrier?.trim(),
      outbound.route?.trim(),
    ]
      .filter(Boolean)
      .join(' ');

    if (obDate) {
      inclusions.push(`🛫 ${obDate} – ${obDesc}`);
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

  // Transporte de Volta
  const inbound = d.inboundTransport;
  if (inbound && (inbound.route?.trim() || inbound.carrier?.trim())) {
    const ibDate = inbound.departureDate
      ? formatDateCommercial(inbound.departureDate)
      : endDate;
    const ibDesc = [
      inbound.carrier?.trim(),
      inbound.route?.trim(),
    ]
      .filter(Boolean)
      .join(' ');

    if (ibDate) {
      inclusions.push(`🛬 ${ibDate} – ${ibDesc}`);
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

  // Hospedagem
  if (d.lodging && d.lodging.length > 0) {
    const h = d.lodging[0];
    if (h.name?.trim()) {
      const nights =
        h.nights ||
        d.dates?.durationNights ||
        (d.dates?.durationDays && d.dates.durationDays > 1 ? d.dates.durationDays - 1 : d.dates?.durationDays);
      const hDate = h.checkIn ? formatDateCommercial(h.checkIn) : startDate;
      const mealPlan = h.mealPlan?.trim();

      let hotelLine = '🏨 ';
      if (hDate && nights && mealPlan) {
        hotelLine += `${hDate} – ${nights} noites em ${h.name.trim()}, com ${mealPlan}.`;
      } else if (nights && mealPlan) {
        hotelLine += `${nights} noites em ${h.name.trim()}, com ${mealPlan}.`;
      } else if (nights) {
        hotelLine += `${nights} noites em ${h.name.trim()}.`;
      } else if (mealPlan) {
        hotelLine += `Hospedagem em ${h.name.trim()}, com ${mealPlan}.`;
      } else {
        hotelLine += `Hospedagem em ${h.name.trim()}.`;
      }
      inclusions.push(hotelLine);
    }
  }

  // Transfer (se configurado)
  if (d.transferService?.trim()) {
    inclusions.push(`🚗 ${d.transferService.trim()}`);
  } else {
    // Procura em additionalServices se há algum transfer incluído
    const includedTransfer = d.additionalServices?.find(
      (s) => s.included && (s.type?.toLowerCase().includes('transfer') || s.name?.toLowerCase().includes('transfer'))
    );
    if (includedTransfer) {
      inclusions.push(`🚗 ${includedTransfer.name.trim()}`);
    }
  }

  sections.push(inclusions.join('\n'));

  // 4. Preço de Venda do Pacote
  const salePrice =
    typeof d.financials?.salePrice === 'number'
      ? d.financials.salePrice
      : typeof d.financials?.priceTotal?.amount === 'number'
      ? d.financials.priceTotal.amount
      : 0;

  if (salePrice > 0) {
    sections.push(formatPriceText(salePrice, currency));
  }

  // 5. Condição de Pagamento (Entrada / Parcelamento)
  if (d.paymentConditions?.trim()) {
    sections.push(`💳 Entrada: ${d.paymentConditions.trim()}`);
  }

  // 6. Observações ou Opções Comerciais
  if (d.customNotes?.trim()) {
    sections.push(d.customNotes.trim());
  }

  // 7. Taxa Local (se aplicável)
  if (d.localTaxNotes?.trim()) {
    sections.push(`Taxa local a pagar diretamente na hospedagem: ${d.localTaxNotes.trim()}`);
  }

  // 8. Serviços Extras / Opcionais (se aplicável)
  if (d.extraServicesNotes?.trim()) {
    sections.push(`Consulte-nos sobre serviços extra: ${d.extraServicesNotes.trim()}`);
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
