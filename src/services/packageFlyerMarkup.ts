import type { PackageFlyerModel } from './packageFlyerService';

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!));

function icon(kind: PackageFlyerModel['items'][number]['kind']): string {
  const paths: Record<PackageFlyerModel['items'][number]['kind'], string> = {
    air: '<path d="M22 2 9 15M22 2l-7 20-4-9-9-4Z"/>',
    accommodation: '<path d="M3 19V7m0 8h18v4M3 11h16a2 2 0 0 1 2 2v2M7 11V8h4a2 2 0 0 1 2 2v1"/>',
    insurance: '<path d="M12 2 4 5v6c0 5 3 8 8 11 5-3 8-6 8-11V5Z"/><path d="M12 7v8M8 11h8"/>',
    transfer: '<path d="M5 16 6 9h12l1 7M4 16h16v3H4zM7 9l2-4h6l2 4"/><path d="M7 19v2m10-2v2"/>',
    transport: '<path d="M5 16 6 9h12l1 7M4 16h16v3H4zM7 9l2-4h6l2 4"/><path d="M7 19v2m10-2v2"/>',
    additional: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg>`;
}

/** Markup compartilhado entre a prévia React e o renderer confiável. */
export function renderPackageFlyerMarkup(model: PackageFlyerModel, logoUrl: string): string {
  const imageUrl = model.imageUrl && /^(?:data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}|blob:https?:\/\/[A-Za-z0-9./:_-]+)$/.test(model.imageUrl)
    ? model.imageUrl : undefined;
  // A foto entra como <img>: o Chrome recusa data URLs grandes em CSS url(),
  // o que apagava a imagem de fundo mesmo com a sugestão revisada.
  const photo = imageUrl
    ? `<img class="package-flyer__photo" src="${escapeHtml(imageUrl)}" alt="" />`
    : '';
  const payment = model.paymentConditions ? `<span>${escapeHtml(model.paymentConditions)}</span>` : '';
  const subtitle = model.subtitle ? `<p>${escapeHtml(model.subtitle)}</p>` : '';
  const items = model.items.map(item => `<li>${icon(item.kind)}${escapeHtml(item.label)}</li>`).join('');
  const list = items ? `<ul>${items}</ul>` : '';
  const panel = items || subtitle
    ? `<section class="package-flyer__items" aria-label="Serviços apresentados">${list}${subtitle}</section>`
    : '';
  // Estimativa de ~32 caracteres por linha na fonte normal. Acima de 6 linhas,
  // a caixa passa ao modo compacto para o rodapé não sair da área segura.
  const estimatedLines = model.items.reduce((total, item) => total + Math.max(1, Math.ceil(item.label.length / 32)), 0);
  const classes = `package-flyer${estimatedLines > 6 ? ' package-flyer--compact' : ''}`;
  return `<article class="${classes}" aria-label="Prévia da lâmina de viagem">${photo}<div class="package-flyer__safe"><header class="package-flyer__header"><img src="${escapeHtml(logoUrl)}" alt="S23 Travel"/><span>Sua viagem, nossa missão</span><span>www.s23.travel</span></header><div class="package-flyer__route">${escapeHtml(model.origin)} ${icon('air')} ${escapeHtml(model.destination)}</div><div class="package-flyer__price"><span>Valor</span><strong>${escapeHtml(model.price.formatted)}</strong><span>por pessoa em quarto duplo</span>${payment}</div><div class="package-flyer__period">${escapeHtml(model.period)}</div>${panel}<footer class="package-flyer__footer"><span>Valores sujeitos a alteração sem aviso. Consulte-nos sobre personalizações.</span><span><strong>Fale com um especialista</strong><br/>zap: +351 960 153 290</span></footer></div></article>`;
}
