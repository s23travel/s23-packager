import type { QuotationFlyerModel, TransportLeg } from './quotationFlyerService';
import { escapeHtml, flyerLogo, flyerPhoto } from './flyerMarkupShared';

/**
 * Markup da proposta de viagem 9:16. A mesma composição alimenta a prévia React
 * e o renderer confiável; as classes são partilhadas com `quotationFlyer.css`.
 * Todos os dados chegam já formatados no modelo comercial.
 */

const stampIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6 15h4"/></svg>';
const searchIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>';
const arrowIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15"/><path d="m13 6 6 6-6 6"/></svg>';
const infoIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 11v6" fill="none" stroke="var(--color-on-primary)" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1.2" fill="var(--color-on-primary)"/></svg>';
// Círculo preenchido com o visto branco, como no template aprovado.
const checkIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="m7 12.4 3.2 3.2L17 8.6" fill="none" stroke="var(--color-on-primary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function legMarkup(label: string, leg: TransportLeg | undefined): string {
  if (!leg) return '';
  const time = leg.departureTime && leg.arrivalTime
    ? `${leg.departureTime} — ${leg.arrivalTime}`
    : leg.departureTime ?? leg.arrivalTime ?? '';
  return `<div class="quotation-flyer__leg">`
    + `<p class="quotation-flyer__leg-label">${label} · ${escapeHtml(leg.date)}</p>`
    + `<p class="quotation-flyer__leg-route">${escapeHtml(leg.route)}</p>`
    + (time ? `<p class="quotation-flyer__leg-time">${escapeHtml(time)}</p>` : '')
    + `</div>`;
}

function includedMarkup(included: QuotationFlyerModel['included']): string {
  if (!included.length) return '';
  const items = included
    .map(item => `<li class="quotation-flyer__included-item">${checkIcon}${escapeHtml(item.label)}</li>`)
    .join('');
  return `<div class="quotation-flyer__included"><span class="quotation-flyer__label">Incluído</span><ul>${items}</ul></div>`;
}

function notIncludedMarkup(lines: string[]): string {
  if (!lines.length) return '';
  const items = lines
    .map(line => `<li class="quotation-flyer__not-included-item">${escapeHtml(line)}</li>`)
    .join('');
  return `<div class="quotation-flyer__not-included">`
    + `<span class="quotation-flyer__label quotation-flyer__label--navy">Não incluído</span><ul>${items}</ul>`
    + `</div>`;
}

/** Cartão de voos: companhia, ida/regresso, tarifa e bagagem. */
function flightsCard(model: QuotationFlyerModel): string {
  const transport = model.transport;
  if (!transport) return '';
  const carriers = Array.from(new Set([transport.outbound.carrier, transport.inbound.carrier])).join(' · ');
  const fare = transport.outbound.fareLabel ?? transport.inbound.fareLabel;
  const baggage = transport.outbound.baggage ?? transport.inbound.baggage;
  const fareBox = fare || baggage
    ? `<div class="quotation-flyer__fare">${fare ? `<span>${escapeHtml(fare)}</span>` : ''}${baggage ? `<strong>${escapeHtml(baggage)}</strong>` : ''}</div>`
    : '';
  return `<section class="quotation-flyer__card quotation-flyer__card--flights" aria-label="Voos">`
    + `<h2 class="quotation-flyer__card-title"><span>Voos <span class="quotation-flyer__carrier">${escapeHtml(carriers)}</span></span></h2>`
    + legMarkup('Ida', transport.outbound)
    + legMarkup('Regresso', transport.inbound)
    + fareBox
    + `</section>`;
}

/** Cartão de hospedagem e, abaixo dele, os blocos incluído/não incluído. */
function lodgingCard(model: QuotationFlyerModel): string {
  const lodging = model.lodging;
  const included = includedMarkup(model.included);
  const notIncluded = notIncludedMarkup(model.notIncluded);
  if (!lodging && !included && !notIncluded) return '';
  const modifier = lodging ? 'quotation-flyer__card--lodging' : 'quotation-flyer__card--extras';
  const label = lodging ? 'Hospedagem' : 'Serviços da proposta';
  const nights = lodging?.nights
    ? `<span class="quotation-flyer__nights">${escapeHtml(lodging.nights)}</span>`
    : '';
  const meta = lodging
    ? `<div class="quotation-flyer__lodging-meta">`
      + `<p class="quotation-flyer__lodging-name">${escapeHtml(lodging.name)}</p>`
      + `<p class="quotation-flyer__lodging-dates">${escapeHtml(lodging.dateRange)}</p>`
      + (lodging.mealPlan ? `<p class="quotation-flyer__lodging-meal">${escapeHtml(lodging.mealPlan)}</p>` : '')
      + `</div>`
    : '';
  return `<section class="quotation-flyer__card ${modifier}" aria-label="${escapeHtml(label)}">`
    + `<h2 class="quotation-flyer__card-title"><span>${escapeHtml(label)}</span>${nights}</h2>`
    + meta + included + notIncluded
    + `</section>`;
}

/** Proposta de viagem completa, pronta para a prévia e para o renderer. */
export function renderQuotationFlyerMarkup(model: QuotationFlyerModel, logoUrl: string): string {
  const photo = flyerPhoto(model.imageUrl, 'quotation-flyer__photo');
  const subtitle = model.subtitle ? `<p class="quotation-flyer__subtitle">${escapeHtml(model.subtitle)}</p>` : '';
  const flights = flightsCard(model);
  const lodging = lodgingCard(model);
  const cards = flights || lodging
    ? `<div class="quotation-flyer__cards${flights && lodging ? '' : ' quotation-flyer__cards--single'}">${flights}${lodging}</div>`
    : '';
  // O bloco de pagamento existe pelo sinal; sem sinal, a linha de outras saídas
  // continua no mesmo lugar para o rodapé não mudar de altura.
  const payment = model.deposit
    ? `<span class="quotation-flyer__label">Pagamento</span>`
      + `<strong class="quotation-flyer__deposit">${escapeHtml(model.deposit.formatted)} de sinal</strong>`
      + (model.balanceDueDate ? `<span class="quotation-flyer__balance">+ restante do valor até ${escapeHtml(model.balanceDueDate)}</span>` : '')
    : '';
  // Listas longas entram em modo compacto para o grupo inferior não sair da área segura.
  const dense = model.included.length >= 5 || model.notIncluded.length >= 3 ? ' quotation-flyer--dense' : '';
  return `<article class="quotation-flyer${dense}" aria-label="Proposta de viagem S23 Travel">`
    + `<header class="quotation-flyer__hero">${photo}<div class="quotation-flyer__hero-inner">`
    + `<div class="quotation-flyer__top">${flyerLogo(logoUrl, 'quotation-flyer__logo')}`
    + `<span class="quotation-flyer__date">${escapeHtml(model.proposalDate)}</span></div>`
    + `<div class="quotation-flyer__intro">`
    + `<span class="quotation-flyer__tag">Proposta de viagem</span>`
    + `<h1 class="quotation-flyer__title"><span class="quotation-flyer__client">${escapeHtml(model.clientName)}</span>`
    + `<span class="quotation-flyer__destination">${escapeHtml(model.destination)}</span></h1>`
    + subtitle
    + `</div></div></header>`
    + `<section class="quotation-flyer__sheet" aria-label="Dados da viagem">`
    + `<div class="quotation-flyer__facts">`
    + `<div class="quotation-flyer__fact"><span>Datas</span><strong>${escapeHtml(model.dates.period)}</strong></div>`
    + `<div class="quotation-flyer__fact"><span>Viajantes</span><strong>${escapeHtml(model.passengers.label)}</strong></div>`
    + `<div class="quotation-flyer__fact"><span>Rota</span><strong>${escapeHtml(model.origin)} — ${escapeHtml(model.destination)}</strong></div>`
    + `</div>${cards}</section>`
    + `<div class="quotation-flyer__bottom">`
    + `<section class="quotation-flyer__investment" aria-label="Investimento total da proposta">`
    + `<div class="quotation-flyer__price"><span class="quotation-flyer__card-icon">${stampIcon}</span>`
    + `<div class="quotation-flyer__price-copy"><span class="quotation-flyer__label">Investimento total</span>`
    + `<strong class="quotation-flyer__amount">${escapeHtml(model.price.total.formatted)}</strong></div></div>`
    + `<div class="quotation-flyer__payment">${payment}`
    + `<span class="quotation-flyer__note">Consulte-nos sobre outras saídas e datas</span></div>`
    + `</section>`
    + `<div class="quotation-flyer__cta">${searchIcon}<strong>Fale com a S23 para reservar</strong>${arrowIcon}</div>`
    + `<p class="quotation-flyer__legal">${infoIcon}<span>Até à data da contratação podem ocorrer alterações sem controlo da agência.</span></p>`
    + `</div></article>`;
}
