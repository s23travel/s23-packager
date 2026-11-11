import type { PackageFlyerModel } from './packageFlyerService';
import { escapeHtml, flyerIcon, flyerLogo, flyerPhoto } from './flyerMarkupShared';

/** Markup compartilhado entre a prévia React e o renderer confiável. */
export function renderPackageFlyerMarkup(model: PackageFlyerModel, logoUrl: string): string {
  const photo = flyerPhoto(model.imageUrl, 'package-flyer__photo');
  const payment = model.paymentConditions ? `<span>${escapeHtml(model.paymentConditions)}</span>` : '';
  const subtitle = model.subtitle ? `<p>${escapeHtml(model.subtitle)}</p>` : '';
  const items = model.items.map(item => `<li>${flyerIcon(item.kind)}${escapeHtml(item.label)}</li>`).join('');
  const list = items ? `<ul>${items}</ul>` : '';
  // Valor e período entram na mesma caixa dos serviços: a peça lê como um bloco só,
  // como no modelo aprovado, e a foto fica livre em volta.
  const panel = `<section class="package-flyer__items" aria-label="Valor, serviços apresentados e subtítulo">`
    + `<div class="package-flyer__price"><span>Valor</span><strong>${escapeHtml(model.price.formatted)}</strong>`
    + `<span>por pessoa em quarto duplo</span>${payment}</div>`
    + `<div class="package-flyer__period">${escapeHtml(model.period)}</div>${list}${subtitle}</section>`;
  // Estimativa de ~32 caracteres por linha na fonte normal. Acima de 6 linhas,
  // a caixa passa ao modo compacto para o rodapé não sair da área segura.
  const estimatedLines = model.items.reduce((total, item) => total + Math.max(1, Math.ceil(item.label.length / 32)), 0);
  const classes = `package-flyer${estimatedLines > 6 ? ' package-flyer--compact' : ''}`;
  return `<article class="${classes}" aria-label="Prévia da lâmina de viagem">${photo}<div class="package-flyer__safe"><header class="package-flyer__header">${flyerLogo(logoUrl)}<span>Sua viagem, nossa missão</span><span>www.s23.travel</span></header><div class="package-flyer__route">${escapeHtml(model.origin)} ${flyerIcon('air')} ${escapeHtml(model.destination)}</div>${panel}<footer class="package-flyer__footer"><span>Valores sujeitos a alteração sem aviso. Consulte-nos sobre personalizações.</span><span><strong>Fale com um especialista</strong><br/>zap: +351 960 153 290</span></footer></div></article>`;
}
