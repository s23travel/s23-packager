import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  createHtml,
  parseRenderRequest,
  validPackageModel,
  validQuotationModel,
  type FlyerAssets,
} from '../workers/flyer-renderer/src/flyerDocument';
import { renderPackageFlyerMarkup } from '../src/services/packageFlyerMarkup';
import { createQuotationFlyer } from '../src/services/quotationFlyerService';
import type { Quotation } from '../src/types';

// Teste offline do contrato do renderer: validação dos dois templates e
// composição do documento, sem rede, browser ou credenciais.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

/** ArrayBuffer sintético: basta para os data URLs, o conteúdo não é interpretado. */
const bytes = (length: number) => Uint8Array.from({ length }, (_, index) => index % 256).buffer as ArrayBuffer;
const base64 = (value: ArrayBuffer) => Buffer.from(new Uint8Array(value)).toString('base64');
const dataUrl = (mime: string, value: ArrayBuffer) => `data:${mime};base64,${base64(value)}`;

const assets: FlyerAssets = {
  tokens: read('design-system/s23-travel/colors_and_type.css'),
  packageStyles: read('src/components/packages/packageFlyer.css'),
  quotationStyles: read('src/components/quotes/quotationFlyer.css'),
  logo: bytes(24),
  fonts: { regular: bytes(12), semibold: bytes(12), bold: bytes(12) },
};

const image = {
  mimeType: 'image/png' as const,
  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
};

const packageModel = {
  version: 1 as const,
  origin: 'Porto',
  destination: 'Paris',
  period: '12 — 19 abril 2027',
  price: { amount: 1496, currency: 'BRL' as const, formatted: 'R$ 1.496,00' },
  items: [
    { kind: 'air' as const, label: 'Aéreo' },
    { kind: 'accommodation' as const, label: 'Hotel com café da manhã' },
  ],
  paymentConditions: 'Entrada de 30% e saldo antes da viagem',
  subtitle: 'Uma viagem inesquecível',
};

const quotationModel = {
  version: 1 as const,
  template: 'quotation' as const,
  clientName: 'Sandra Colognesi',
  proposalDate: '11/11/2026',
  subtitle: 'Paris à medida para dois',
  origin: 'Porto',
  destination: 'Paris',
  dates: { period: '02 ABR — 05 ABR 2027', start: '02/04/2027', end: '05/04/2027' },
  passengers: { adults: 2, children: 0, infants: 0, label: '2 adultos' },
  transport: {
    outbound: {
      carrier: 'easyJet',
      date: '02/04/2027',
      route: 'OPO — ORY',
      departureTime: '08:10',
      arrivalTime: '11:05',
      fareLabel: 'Tarifa para 2 adultos',
      baggage: 'Bagagem de mão incluída',
    },
    inbound: {
      carrier: 'easyJet',
      date: '05/04/2027',
      route: 'ORY — OPO',
      departureTime: '18:40',
      arrivalTime: '19:45',
    },
  },
  lodging: {
    name: 'Ibis Paris Alésia Montparnasse',
    dateRange: '02 ABR — 05 ABR 2027',
    nights: '3 noites',
    mealPlan: 'Café da manhã',
  },
  included: [
    { kind: 'air' as const, label: 'Voo de ida e volta' },
    { kind: 'accommodation' as const, label: '3 noites de hospedagem' },
  ],
  notIncluded: ['Taxa local de 34€ paga no hotel'],
  price: {
    total: { amount: 700, currency: 'EUR' as const, formatted: '€ 700,00' },
    perPerson: { amount: 350, currency: 'EUR' as const, formatted: '€ 350,00' },
  },
  deposit: { amount: 250, currency: 'EUR' as const, formatted: '€ 250,00' },
  balanceDueDate: '20/03',
};

// --- Contrato de envelope ---------------------------------------------------

const legacyRequest = parseRenderRequest({ model: packageModel, image });
assert.ok(legacyRequest, 'pedido sem template tem de continuar válido');
assert.equal(legacyRequest.template, 'package', 'sem template assume package');

const explicitPackage = parseRenderRequest({ template: 'package', model: packageModel, image });
assert.ok(explicitPackage);
assert.deepEqual(explicitPackage, legacyRequest, 'template package explícito é igual ao pedido legado');

const quotationRequest = parseRenderRequest({ template: 'quotation', model: quotationModel, image });
assert.ok(quotationRequest, 'modelo de cotação válido tem de passar');
assert.equal(quotationRequest.template, 'quotation');

assert.equal(parseRenderRequest({ template: 'poster', model: quotationModel, image }), null, 'template desconhecido é rejeitado');
assert.equal(parseRenderRequest({ template: null, model: quotationModel, image }), null, 'template nulo é rejeitado');
assert.equal(parseRenderRequest({ template: 'quotation', model: packageModel, image }), null, 'modelo de pacote não passa como cotação');
assert.equal(parseRenderRequest({ model: quotationModel, image }), null, 'modelo de cotação sem discriminador não passa como pacote');
assert.equal(parseRenderRequest({ template: 'package', model: packageModel, image, extra: true }), null, 'chave desconhecida no envelope é rejeitada');
assert.equal(parseRenderRequest({ template: 'package', model: packageModel }), null, 'imagem é obrigatória');
assert.equal(parseRenderRequest([]), null);
console.log('Envelope e discriminador de template: OK');

// --- Validação do modelo de pacote -----------------------------------------

assert.ok(validPackageModel(packageModel));
assert.ok(!validPackageModel({ ...packageModel, template: 'quotation' }), 'discriminador não pertence ao modelo');
assert.ok(!validPackageModel({ ...packageModel, extra: 'x' }), 'chaves desconhecidas são rejeitadas');
assert.ok(!validPackageModel({ ...packageModel, origin: 'P' }), 'origem curta é rejeitada');
assert.ok(!validPackageModel({ ...packageModel, origin: 'Porto'.repeat(10) }), 'origem longa é rejeitada');
assert.ok(!validPackageModel({ ...packageModel, subtitle: 'oi' }), 'subtítulo curto é rejeitado');
assert.ok(!validPackageModel({ ...packageModel, items: Array.from({ length: 7 }, () => ({ kind: 'air', label: 'Aéreo' })) }), 'mais de 6 itens é rejeitado');
assert.ok(!validPackageModel({ ...packageModel, items: [{ kind: 'air', label: 'Aéreo', extra: 1 }] }), 'item com chave desconhecida é rejeitado');
assert.ok(!validPackageModel({ ...packageModel, items: [{ kind: 'ticket', label: 'Aéreo' }] }), 'tipo de item desconhecido é rejeitado');
assert.ok(!validPackageModel({ ...packageModel, price: { ...packageModel.price, amount: 0 } }), 'preço não positivo é rejeitado');
assert.ok(!validPackageModel({ ...packageModel, price: { ...packageModel.price, currency: 'USD' } }), 'moeda desconhecida é rejeitada');
assert.ok(!validPackageModel({ ...packageModel, paymentConditions: 'x'.repeat(101) }), 'condições longas são rejeitadas');
console.log('Validação do modelo de pacote: OK');

// --- Validação do modelo de cotação ----------------------------------------

assert.ok(validQuotationModel(quotationModel));
assert.ok(!validQuotationModel({ ...quotationModel, template: undefined }), 'modelo de cotação exige o discriminador');
assert.ok(!validQuotationModel({ ...quotationModel, template: 'package' }), 'discriminador divergente é rejeitado');
assert.ok(!validQuotationModel({ ...quotationModel, imageUrl: 'data:image/png;base64,AAAA' }), 'imagem chega pelo envelope, não pelo modelo');
assert.ok(!validQuotationModel({ ...quotationModel, clientName: 'x'.repeat(61) }), 'cliente longo é rejeitado');
assert.ok(!validQuotationModel({ ...quotationModel, clientName: 'Sandra\nColognesi' }), 'caracteres de controlo são rejeitados');
assert.ok(!validQuotationModel({ ...quotationModel, origin: 'O'.repeat(11), destination: 'D'.repeat(45) }), 'soma de origem e destino acima de 55 é rejeitada');
assert.ok(!validQuotationModel({ ...quotationModel, proposalDate: '11/11/2026 ' }), 'data da proposta acima de 10 caracteres é rejeitada');
assert.ok(!validQuotationModel({ ...quotationModel, dates: { ...quotationModel.dates, period: 'x'.repeat(41) } }), 'período longo é rejeitado');
assert.ok(!validQuotationModel({ ...quotationModel, dates: { ...quotationModel.dates, start: 'x'.repeat(11) } }), 'data inicial longa é rejeitada');
assert.ok(!validQuotationModel({ ...quotationModel, passengers: { ...quotationModel.passengers, adults: -1 } }), 'passageiros negativos são rejeitados');
assert.ok(!validQuotationModel({ ...quotationModel, passengers: { ...quotationModel.passengers, label: 'x'.repeat(41) } }), 'rótulo de passageiros longo é rejeitado');
assert.ok(!validQuotationModel({ ...quotationModel, transport: { ...quotationModel.transport!, outbound: { ...quotationModel.transport!.outbound, route: 'R'.repeat(31) } } }), 'rota longa é rejeitada');
assert.ok(!validQuotationModel({ ...quotationModel, transport: { ...quotationModel.transport!, outbound: { ...quotationModel.transport!.outbound, departureTime: '08:100' } } }), 'horário longo é rejeitado');
assert.ok(!validQuotationModel({ ...quotationModel, transport: { ...quotationModel.transport!, outbound: { ...quotationModel.transport!.outbound, extra: 'x' } } }), 'perna com chave desconhecida é rejeitada');
assert.ok(!validQuotationModel({ ...quotationModel, lodging: { ...quotationModel.lodging!, name: 'H'.repeat(61) } }), 'hospedagem longa é rejeitada');
assert.ok(!validQuotationModel({ ...quotationModel, included: Array.from({ length: 7 }, () => ({ kind: 'air', label: 'Voo' })) }), 'mais de 6 incluídos é rejeitado');
assert.ok(!validQuotationModel({ ...quotationModel, notIncluded: ['a', 'b', 'c', 'd'] }), 'mais de 3 não incluídos é rejeitado');
assert.ok(!validQuotationModel({ ...quotationModel, notIncluded: ['x'.repeat(101)] }), 'linha não incluída longa é rejeitada');
assert.ok(!validQuotationModel({ ...quotationModel, price: { total: { ...quotationModel.price.total, formatted: 'x'.repeat(21) } } }), 'preço formatado longo é rejeitado');
assert.ok(!validQuotationModel({ ...quotationModel, price: { total: { ...quotationModel.price.total, amount: 0 } } }), 'total não positivo é rejeitado');
assert.ok(!validQuotationModel({ ...quotationModel, deposit: { ...quotationModel.deposit!, formatted: 'x'.repeat(21) } }), 'sinal formatado longo é rejeitado');
assert.ok(!validQuotationModel({ ...quotationModel, balanceDueDate: 'x'.repeat(11) }), 'data-limite longa é rejeitada');
assert.ok(!validQuotationModel({ ...quotationModel, subtitle: 'oi' }), 'subtítulo curto é rejeitado');
assert.ok(validQuotationModel({ ...quotationModel, transport: null, lodging: null, deposit: undefined, balanceDueDate: undefined }), 'cartões opcionais vazios são aceitos');
console.log('Validação do modelo de cotação: OK');

// --- Paridade real: o modelo produzido pela app passa no renderer ------------

const parityQuote = {
  id: 'parity', package_id: null, reference: 'COT-TESTE', client_name: 'Cliente Teste', status: 'draft',
  currency: 'EUR', exchange_rate: null, exchange_rate_date: null,
  created_at: '2026-11-11T10:00:00Z', updated_at: '2026-11-11T10:00:00Z', archived_at: null,
  data: {
    origin: 'Porto', destination: 'Paris', proposalDate: '2026-11-11',
    dates: { startDate: '2027-04-02', endDate: '2027-04-05', durationNights: 3 },
    passengers: { adults: 2, children: 0, infants: 0 },
    depositAmount: 250, balanceDueDate: '2027-03-20', notIncluded: ['Taxa local de 34€ paga no hotel'],
    financials: { currency: 'EUR', components: [], totalCost: 400, salePrice: 700, pricePerPerson: 350,
      profit: 300, profitPercent: 42.86, taxesAndFeesTotal: 0 },
    services: [
      { id: 'out', type: 'outbound_transport', description: 'Voo de ida Porto (OPO) para Paris (ORY)',
        carrier: 'easyJet', currency: 'EUR', amount: 0, quantity: 1, departureTime: '12:15',
        arrivalTime: '15:25', notes: 'Bagagem de mão incluída' },
      { id: 'in', type: 'inbound_transport', description: 'Voo de volta Paris (ORY) para Porto (OPO)',
        carrier: 'easyJet', currency: 'EUR', amount: 0, quantity: 1, departureTime: '21:40', arrivalTime: '23:05' },
      { id: 'hotel', type: 'accommodation', description: 'Ibis Paris Alésia Montparnasse',
        currency: 'EUR', amount: 0, quantity: 1, mealPlan: 'Café da manhã (BB)' },
    ],
  },
} as Quotation;
const parityResult = createQuotationFlyer(parityQuote);
assert.ok(parityResult.model, 'modelo real da cotação tem de ser gerado');
assert.ok(
  parseRenderRequest({ template: 'quotation', model: parityResult.model, image }),
  'modelo real da cotação tem de passar na validação do renderer',
);
console.log('Paridade modelo real → renderer: OK');

// --- HTML do pacote: exatamente a composição atual -------------------------

const logoUrl = dataUrl('image/png', assets.logo);
const fontFaces = `@font-face{font-family:Poppins;src:url("${dataUrl('font/ttf', assets.fonts.regular)}") format("truetype");font-weight:400;font-style:normal;font-display:block;}
@font-face{font-family:Poppins;src:url("${dataUrl('font/ttf', assets.fonts.semibold)}") format("truetype");font-weight:600;font-style:normal;font-display:block;}
@font-face{font-family:Poppins;src:url("${dataUrl('font/ttf', assets.fonts.bold)}") format("truetype");font-weight:700;font-style:normal;font-display:block;}`;
const tokensWithoutFontFaces = assets.tokens.replace(/@font-face\s*\{[^}]*\}/g, '');
const baseLayout = 'html,body{margin:0;background:var(--color-inverse-bg)}body{display:flex;align-items:center;justify-content:center;min-height:100vh}';
const packageLayout = '.package-flyer{width:min(100vw,calc(100vh * 9 / 16));width:min(100vw,calc(100dvh * 9 / 16));height:auto;max-width:none}';
const expectedPackageHtml = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'"><title>Lâmina S23 Travel</title><style>${fontFaces}\n${tokensWithoutFontFaces}\n${assets.packageStyles}\n${baseLayout}${packageLayout}</style></head><body>${renderPackageFlyerMarkup({ ...packageModel, imageUrl: `data:image/png;base64,${image.data}` }, logoUrl)}</body></html>`;

const packageHtml = createHtml('package', packageModel, image, assets);
assert.equal(packageHtml, expectedPackageHtml, 'HTML do pacote tem de ser idêntico ao contrato atual');
assert.match(packageHtml, /package-flyer/);
assert.doesNotMatch(packageHtml, /quotation-flyer/);
assert.match(packageHtml, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'">/);
console.log('HTML do pacote inalterado: OK');

// --- HTML da cotação --------------------------------------------------------

const quotationHtml = createHtml('quotation', quotationModel, image, assets);
assert.match(quotationHtml, /<article class="quotation-flyer/, 'markup da cotação entra na página');
assert.match(quotationHtml, /Sandra Colognesi/);
assert.match(quotationHtml, /Paris/);
assert.match(quotationHtml, /€ 700,00/);
assert.match(quotationHtml, new RegExp(`data:image/png;base64,${image.data}`));
assert.match(quotationHtml, new RegExp(`data:image/png;base64,${base64(assets.logo)}`));
assert.ok(quotationHtml.includes(assets.quotationStyles), 'CSS da cotação é embutido');
assert.ok(!quotationHtml.includes(assets.packageStyles), 'CSS do pacote não entra na cotação');
assert.match(quotationHtml, /\.quotation-flyer\{width:min\(100vw,calc\(100vh \* 9 \/ 16\)\)/, 'peça ocupa a viewport 9:16');
assert.match(quotationHtml, /Proposta de viagem/);
assert.match(quotationHtml, /Incluído/);
assert.match(quotationHtml, /Não incluído/);
assert.match(quotationHtml, /Fale com a S23 para reservar/);
assert.doesNotMatch(quotationHtml, /package-flyer/);
console.log('HTML da cotação com fontes, logo e imagem embutidos: OK');

console.log('Renderer: dois templates no mesmo contrato — OK');
