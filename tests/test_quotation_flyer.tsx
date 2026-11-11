import assert from 'node:assert/strict';
import { register } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createQuotationFlyer, type QuotationFlyerModel } from '../src/services/quotationFlyerService';
import type { Quotation, ServiceItem } from '../src/types';

// O template importa o logo .png (o Vite resolve como URL); em Node é preciso o loader.
register('./pngAssetLoader.mjs', import.meta.url);
const { QuotationFlyerTemplate } = await import('../src/components/quotes/QuotationFlyerTemplate');
const { renderQuotationFlyerMarkup } = await import('../src/services/quotationFlyerMarkup');

function transport(
  id: string,
  type: 'outbound_transport' | 'inbound_transport',
  description: string,
  times: { departureTime: string; arrivalTime: string }
): ServiceItem {
  return {
    id,
    type,
    description,
    currency: 'EUR',
    amount: 0,
    quantity: 1,
    carrier: 'easyJet',
    notes: 'Bagagem de mão incluída',
    ...times,
  };
}

// Fixture inspirada na COT-2026-059, a mesma da prévia aprovada.
const quote: Quotation = {
  id: 'cot-fixture',
  package_id: null,
  reference: 'COT-2026-059',
  client_name: 'Sandra Colognesi',
  status: 'draft',
  currency: 'EUR',
  exchange_rate: null,
  exchange_rate_date: null,
  created_at: '2026-11-11T09:30:00Z',
  updated_at: '2026-11-11T09:30:00Z',
  archived_at: null,
  data: {
    origin: 'Porto',
    destination: 'Paris',
    proposalDate: '2026-11-11',
    dates: { startDate: '2027-04-02', endDate: '2027-04-05', durationDays: 4, durationNights: 3 },
    passengers: { adults: 2, children: 0, infants: 0 },
    depositAmount: 250,
    balanceDueDate: '2027-03-20',
    notIncluded: ['Taxa local de 34€ paga no hotel', 'Bagagem despachada'],
    paymentConditions: 'fornecedor secreto cobra 10x',
    localTaxNotes: 'Taxa local interna 34€',
    extraServicesNotes: 'Nota interna de extras',
    customNotes: 'Observação interna do consultor',
    financials: {
      currency: 'EUR',
      components: [],
      totalCost: 400,
      salePrice: 700,
      pricePerPerson: 350,
      profit: 300,
      profitPercent: 42.86,
      taxesAndFeesTotal: 0,
    },
    services: [
      transport('out', 'outbound_transport', 'Voo de ida Porto (OPO) para Paris (ORY)', {
        departureTime: '08:10',
        arrivalTime: '11:05',
      }),
      transport('in', 'inbound_transport', 'Voo de volta Paris (ORY) para Porto (OPO)', {
        departureTime: '18:40',
        arrivalTime: '19:45',
      }),
      {
        id: 'hotel',
        type: 'accommodation',
        description: 'Ibis Paris Alésia Montparnasse 14ème',
        currency: 'EUR',
        amount: 0,
        quantity: 1,
        mealPlan: 'Café da manhã (BB)',
      },
    ],
  },
};

const result = createQuotationFlyer(quote);
assert.equal(result.errors.length, 0, `fixture sem erros: ${result.errors.join(' | ')}`);
assert.ok(result.model, 'modelo deve existir');
// O subtítulo chega da sugestão de IA editada na lâmina, não do formulário.
const model: QuotationFlyerModel = {
  ...result.model,
  subtitle: 'Paris na primavera, entre cafés e boulevards',
};
const html = renderQuotationFlyerMarkup(model, 'logo.png');

// 1. Casca e hero
assert.match(html, /^<article class="quotation-flyer/, 'a peça é um article com a classe base');
assert.match(html, /Proposta de viagem/, 'etiqueta da peça');
assert.match(html, /class="quotation-flyer__logo"[^>]*src="logo.png"/, 'logo no hero');
assert.match(html, /class="quotation-flyer__date"[^>]*>11\/11\/2026</, 'badge apenas com a data DD/MM/AAAA');
assert.doesNotMatch(html, /COT-2026-059|Referência|Validade/i, 'sem referência nem validade');

// 2. Título em duas linhas distintas + subtítulo
assert.match(html, /class="quotation-flyer__client"[^>]*>Sandra Colognesi</, 'cliente na primeira linha');
assert.match(html, /class="quotation-flyer__destination"[^>]*>Paris</, 'destino na segunda linha');
assert.ok(
  html.indexOf('quotation-flyer__client') < html.indexOf('quotation-flyer__destination'),
  'cliente vem antes do destino'
);
assert.match(html, /quotation-flyer__subtitle/, 'subtítulo presente');
console.log('✅ Hero, etiqueta, data e título em duas linhas');

// 3. Barra de dados
assert.match(html, /Datas<\/span><strong>02 ABR — 05 ABR 2027</, 'período na barra');
assert.match(html, /Viajantes<\/span><strong>2 adultos</, 'viajantes na barra');
assert.match(html, /Rota<\/span><strong>Porto — Paris</, 'rota origem/destino na barra');
console.log('✅ Barra DATAS | VIAJANTES | ROTA');

// 4. Cartão de voos
assert.match(html, /quotation-flyer__card--flights/, 'cartão de voos');
assert.match(html, /Voos/, 'título do cartão de voos');
assert.match(html, /easyJet/, 'companhia aérea');
assert.match(html, /Ida · 02\/04\/2027/, 'ida com data');
assert.match(html, /OPO — ORY/, 'rota de ida');
assert.match(html, /08:10 — 11:05/, 'horários de ida');
assert.match(html, /Regresso · 05\/04\/2027/, 'regresso com data');
assert.match(html, /ORY — OPO/, 'rota de regresso');
assert.match(html, /18:40 — 19:45/, 'horários de regresso');
assert.match(html, /Tarifa para 2 adultos/, 'tarifa');
assert.match(html, /Bagagem de mão incluída/, 'bagagem');
console.log('✅ Cartão VOOS (ida/regresso, datas, rotas, horários, tarifa e bagagem)');

// 5. Cartão de hospedagem + incluídos/não incluídos
assert.match(html, /quotation-flyer__card--lodging/, 'cartão de hospedagem');
assert.match(html, /Hospedagem/, 'título do cartão de hospedagem');
assert.match(html, /Ibis Paris Alésia Montparnasse 14ème/, 'nome do hotel');
assert.match(html, /3 noites/, 'noites');
assert.match(html, /café da manhã/, 'regime');
assert.match(html, /Incluído/, 'bloco incluído');
assert.match(html, /Aéreo/, 'item incluído aéreo');
assert.match(html, /Hospedagem com café da manhã/, 'item incluído hospedagem');
assert.match(html, /Não incluído/, 'bloco não incluído');
assert.match(html, /Taxa local de 34€ paga no hotel/, 'primeira linha do não incluído');
assert.equal((html.match(/quotation-flyer__included-item/g) || []).length, 2, 'uma linha por incluído');
console.log('✅ Cartão HOSPEDAGEM e blocos incluído/não incluído');

// 6. Investimento, pagamento, CTA e rodapé
assert.match(html, /Investimento total/i, 'rótulo do investimento');
assert.match(html, /quotation-flyer__card-icon/, 'ícone de cartão de crédito');
assert.match(html, /€ 700,00/, 'total formatado pela app');
assert.match(html, /Pagamento/i, 'bloco de pagamento');
assert.match(html, /€ 250,00 de sinal/, 'sinal formatado');
assert.match(html, /restante do valor até 20\/03/, 'restante até DD/MM');
assert.match(html, /Fale com a S23 para reservar/, 'CTA');
assert.match(html, /Consulte-nos sobre outras saídas e datas/, 'linha de outras saídas');
assert.match(html, /Até à data da contratação/, 'rodapé legal');
assert.doesNotMatch(html, /fornecedor secreto|Taxa local interna|Nota interna|Observação interna/, 'sem dados internos');
console.log('✅ Investimento, pagamento, CTA e rodapé');

// 7. Escape de HTML em texto vindo do modelo
const risky = {
  ...model,
  clientName: 'Ana <b>&</b>',
  subtitle: '"<script>alert(1)</script>"',
  notIncluded: ['<i>taxa</i>'],
};
const riskyHtml = renderQuotationFlyerMarkup(risky, 'logo.png');
assert.match(riskyHtml, /Ana &lt;b&gt;&amp;&lt;\/b&gt;/, 'cliente escapado');
assert.match(riskyHtml, /&quot;&lt;script&gt;alert\(1\)&lt;\/script&gt;&quot;/, 'subtítulo escapado');
assert.match(riskyHtml, /&lt;i&gt;taxa&lt;\/i&gt;/, 'não incluído escapado');
assert.doesNotMatch(riskyHtml, /<script>|<b>Ana|<i>taxa/, 'nenhuma tag injetada');
console.log('✅ Escape de HTML');

// 8. Foto: aceita data URL segura e descarta esquemas perigosos
const photoHtml = renderQuotationFlyerMarkup(
  { ...model, imageUrl: 'data:image/png;base64,iVBORw0KGgo=' },
  'logo.png'
);
assert.match(photoHtml, /class="quotation-flyer__photo" src="data:image\/png;base64,iVBORw0KGgo="/, 'foto embutida');
const unsafePhoto = renderQuotationFlyerMarkup({ ...model, imageUrl: 'javascript:alert(1)' }, 'logo.png');
assert.doesNotMatch(unsafePhoto, /quotation-flyer__photo/, 'foto insegura descartada');
console.log('✅ Foto segura');

// 9. Listas densas: 6 incluídos e 3 não incluídos sem lançar
const dense: QuotationFlyerModel = {
  ...model,
  included: Array.from({ length: 6 }, (_, index) => ({
    kind: 'additional' as const,
    label: `Serviço incluído ${index + 1}`,
  })),
  notIncluded: ['Taxa local', 'Bagagem despachada', 'Refeições não incluídas'],
};
const denseHtml = renderQuotationFlyerMarkup(dense, 'logo.png');
assert.match(denseHtml, /quotation-flyer--dense/, 'lista densa recebe o modo compacto');
assert.equal((denseHtml.match(/quotation-flyer__included-item/g) || []).length, 6);
assert.equal((denseHtml.match(/quotation-flyer__not-included-item/g) || []).length, 3);
assert.doesNotMatch(html, /quotation-flyer--dense/, 'lista curta não ativa o modo compacto');
console.log('✅ Listas densas');

// 10. Blocos condicionais: modelo sem transporte/hospedagem/sinal
const bare = renderQuotationFlyerMarkup(
  { ...model, transport: null, lodging: null, deposit: undefined, balanceDueDate: undefined },
  'logo.png'
);
assert.doesNotMatch(bare, /quotation-flyer__card--flights/, 'sem transporte, sem cartão de voos');
assert.doesNotMatch(bare, /quotation-flyer__card--lodging/, 'sem hospedagem, sem cartão de hotel');
assert.doesNotMatch(bare, /Pagamento/i, 'sem sinal, sem bloco de pagamento');
assert.match(bare, /Consulte-nos sobre outras saídas e datas/, 'a linha de outras saídas continua');
console.log('✅ Blocos condicionais');

// 11. O componente React partilha a mesma composição do markup
const reactHtml = renderToStaticMarkup(<QuotationFlyerTemplate model={model} />);
assert.equal(
  reactHtml,
  `<div>${renderQuotationFlyerMarkup(model, '')}</div>`,
  'React e markup partilham estrutura e classes'
);
console.log('✅ React e markup com a mesma composição');

console.log('\n🎉 TODOS OS TESTES DO TEMPLATE DA COTAÇÃO PASSARAM!\n');
