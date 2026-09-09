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

/**
 * Constrói o título comercial do pacote
 */
export function getPackageCommercialTitle(d?: QuotationData): string {
  const outboundRoute = d?.outboundTransport?.route?.trim();
  const destination = d?.lodging?.[0]?.destination?.trim();
  const originPkgName = d?.originPackageName?.trim();

  if (outboundRoute) {
    return `✨ Pacote S23 – ${outboundRoute}`;
  }
  if (destination) {
    return `✨ Pacote S23 – ${destination}`;
  }
  if (originPkgName) {
    return `✨ Pacote S23 – ${originPkgName}`;
  }
  return '✨ Pacote S23';
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

  // 1. Título do Pacote
  const title = getPackageCommercialTitle(d);
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
