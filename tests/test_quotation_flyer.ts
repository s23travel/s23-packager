import assert from 'node:assert/strict';
import { createQuotationFlyer } from '../src/services/quotationFlyerService';
import { createPackageFlyer } from '../src/services/packageFlyerService';
import type { Quotation, ServiceItem } from '../src/types';

console.log('=== TESTES: MODELO DA LÂMINA DE COTAÇÃO ===\n');

function transport(
  id: string,
  type: 'outbound_transport' | 'inbound_transport',
  description: string,
  times: { departureTime: string; arrivalTime: string },
  notes = 'Bagagem de mão incluída'
): ServiceItem {
  return {
    id,
    type,
    description,
    currency: 'EUR',
    amount: 0,
    quantity: 1,
    carrier: 'easyJet',
    notes,
    ...times,
  };
}

function hotel(overrides: Partial<ServiceItem> = {}): ServiceItem {
  return {
    id: 'hotel',
    type: 'accommodation',
    description: 'Ibis Paris Alésia Montparnasse 14ème',
    currency: 'EUR',
    amount: 0,
    quantity: 1,
    mealPlan: 'Café da manhã (BB)',
    ...overrides,
  };
}

// Fixture inspirada na COT-2026-059.
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
      hotel(),
    ],
  },
};

// 1. Contrato completo da fixture principal
const result = createQuotationFlyer(quote);
assert.equal(result.errors.length, 0, `sem erros bloqueantes: ${result.errors.join(' | ')}`);
assert.ok(result.model, 'modelo deve existir com os dados obrigatórios');
const model = result.model!;

assert.equal(model.version, 1);
assert.equal(model.template, 'quotation');
assert.equal(model.clientName, 'Sandra Colognesi', 'cliente é a primeira linha do título');
assert.equal(model.proposalDate, '11/11/2026', 'data da cotação em DD/MM/AAAA');
assert.equal(model.origin, 'Porto');
assert.equal(model.destination, 'Paris', 'destino é a segunda linha do título');
assert.equal(model.dates.period, '02 ABR — 05 ABR 2027');
assert.equal(model.dates.start, '02/04/2027');
assert.equal(model.dates.end, '05/04/2027');
assert.equal(model.passengers.adults, 2);
assert.equal(model.passengers.children, 0);
assert.equal(model.passengers.infants, 0);
assert.equal(model.passengers.label, '2 adultos');
console.log('✅ Título, data, datas e passageiros');

assert.ok(model.transport, 'transporte deve ser derivado dos serviços');
assert.equal(model.transport.outbound.carrier, 'easyJet');
assert.equal(model.transport.outbound.date, '02/04/2027');
assert.equal(model.transport.outbound.route, 'OPO — ORY', 'rota extraída do description');
assert.equal(model.transport.outbound.departureTime, '08:10');
assert.equal(model.transport.outbound.arrivalTime, '11:05');
assert.equal(model.transport.outbound.fareLabel, 'Tarifa para 2 adultos');
assert.equal(model.transport.outbound.baggage, 'Bagagem de mão incluída');
assert.equal(model.transport.inbound.carrier, 'easyJet');
assert.equal(model.transport.inbound.date, '05/04/2027');
assert.equal(model.transport.inbound.route, 'ORY — OPO');
assert.equal(model.transport.inbound.departureTime, '18:40');
assert.equal(model.transport.inbound.arrivalTime, '19:45');
console.log('✅ Transporte (companhia, rotas, datas, horários, tarifa e bagagem)');

assert.ok(model.lodging, 'hospedagem deve ser derivada do serviço');
assert.equal(model.lodging.name, 'Ibis Paris Alésia Montparnasse 14ème');
assert.equal(model.lodging.dateRange, '02 ABR — 05 ABR 2027');
assert.equal(model.lodging.nights, '3 noites');
assert.equal(model.lodging.mealPlan, 'café da manhã');
console.log('✅ Hospedagem (hotel, período, noites e regime)');

assert.deepEqual(model.included, [
  { kind: 'air', label: 'Aéreo' },
  { kind: 'accommodation', label: 'Hospedagem com café da manhã' },
]);
assert.deepEqual(model.notIncluded, ['Taxa local de 34€ paga no hotel', 'Bagagem despachada']);
console.log('✅ Incluídos e não incluídos');

assert.deepEqual(model.price.total, { amount: 700, currency: 'EUR', formatted: '€ 700,00' });
assert.deepEqual(model.price.perPerson, { amount: 350, currency: 'EUR', formatted: '€ 350,00' });
assert.deepEqual(model.deposit, { amount: 250, currency: 'EUR', formatted: '€ 250,00' });
assert.equal(model.balanceDueDate, '20/03', 'restante em DD/MM');
console.log('✅ Total, por pessoa, sinal e restante');

// 2. Nenhum dado interno vaza para o modelo
const serialized = JSON.stringify(model);
for (const key of ['reference', 'paymentConditions', 'localTaxNotes', 'extraServicesNotes', 'customNotes', 'validUntil']) {
  assert.equal(key in model, false, `o modelo não deve expor ${key}`);
}
for (const leaked of ['fornecedor secreto', 'Taxa local interna', 'Nota interna', 'Observação interna', 'COT-2026-059']) {
  assert.equal(serialized.includes(leaked), false, `o modelo não deve conter "${leaked}"`);
}
console.log('✅ Sem dados internos, referência ou validade');

// 3. Default da data quando o formulário não informa
const defaultDate = createQuotationFlyer({
  ...quote,
  data: { ...quote.data, proposalDate: undefined },
});
assert.equal(defaultDate.model?.proposalDate, '11/11/2026', 'cai na data de created_at');
const fallbackDate = createQuotationFlyer({ ...quote, created_at: '2026-10-01T10:00:00Z', data: { ...quote.data, proposalDate: undefined } });
assert.equal(fallbackDate.model?.proposalDate, '01/10/2026');
console.log('✅ Fallback da data da cotação');

// 4. Erros bloqueantes
const noClient = createQuotationFlyer({ ...quote, client_name: null });
assert.equal(noClient.model, null);
assert.ok(noClient.errors.some(error => /cliente/i.test(error)));

const noPlaces = createQuotationFlyer({
  ...quote,
  data: { ...quote.data, origin: '', destination: '', services: [], lodging: undefined },
});
assert.equal(noPlaces.model, null);
assert.ok(noPlaces.errors.some(error => /origem/i.test(error)));
assert.ok(noPlaces.errors.some(error => /destino/i.test(error)));

const badDates = createQuotationFlyer({
  ...quote,
  data: { ...quote.data, dates: { startDate: '2027-02-30', endDate: '2027-01-01' } },
});
assert.equal(badDates.model, null);
assert.ok(badDates.errors.some(error => /datas/i.test(error)));

const noPrice = createQuotationFlyer({
  ...quote,
  data: { ...quote.data, financials: { ...quote.data.financials!, salePrice: 0, priceTotal: undefined } },
});
assert.equal(noPrice.model, null);
assert.ok(noPrice.errors.some(error => /preço/i.test(error)));

const divergentCurrency = createQuotationFlyer({
  ...quote,
  data: { ...quote.data, financials: { ...quote.data.financials!, currency: 'BRL' } },
});
assert.equal(divergentCurrency.model, null);
assert.ok(divergentCurrency.errors.some(error => /moeda/i.test(error)));

const longClient = createQuotationFlyer({ ...quote, client_name: 'Cliente '.repeat(9).trim() });
assert.equal(longClient.model, null, 'cliente acima de 60 caracteres bloqueia');
const longDestination = createQuotationFlyer({ ...quote, data: { ...quote.data, destination: 'Destino fictício '.repeat(4).trim() } });
assert.equal(longDestination.model, null, 'destino acima de 45 caracteres bloqueia');
const longSum = createQuotationFlyer({ ...quote, data: { ...quote.data, origin: 'Origem muito longa para a lâmina', destination: 'Destino muito longo para a lâmina' } });
assert.equal(longSum.model, null, 'soma de origem e destino acima de 55 bloqueia');
console.log('✅ Erros bloqueantes e limites de título');

// 5. Avisos não bloqueantes: sinal, não incluídos e serviços omitidos
const minimal = createQuotationFlyer({
  ...quote,
  data: {
    ...quote.data,
    depositAmount: undefined,
    balanceDueDate: undefined,
    notIncluded: [],
    services: [],
    lodging: undefined,
  },
});
assert.ok(minimal.model, 'falta de sinal/não incluídos não bloqueia a peça');
assert.equal(minimal.model?.deposit, undefined);
assert.equal(minimal.model?.balanceDueDate, undefined);
assert.equal(minimal.model?.transport, null);
assert.equal(minimal.model?.lodging, null);
assert.ok(minimal.warnings.some(warning => /sinal/i.test(warning)));
assert.ok(minimal.warnings.some(warning => /não incluídos/i.test(warning)));
assert.ok(minimal.warnings.some(warning => /transporte|voos/i.test(warning)));
assert.ok(minimal.warnings.some(warning => /hospedagem/i.test(warning)));
console.log('✅ Avisos não bloqueantes');

// 6. Serviços adicionais: termos internos e limites do contrato
const items = createQuotationFlyer({
  ...quote,
  data: {
    ...quote.data,
    services: [
      ...quote.data.services!,
      { id: 'a1', type: 'additional', description: 'Passeio de barco', currency: 'EUR', amount: 0, quantity: 1 },
      { id: 'a2', type: 'additional', description: 'Tour com fornecedor secreto', currency: 'EUR', amount: 0, quantity: 1 },
      { id: 'a3', type: 'additional', description: 'Bilhetes de trem Tirano + Bernina Express', currency: 'EUR', amount: 0, quantity: 1 },
      { id: 'a4', type: 'transfer', description: 'Transfer aeroporto', currency: 'EUR', amount: 0, quantity: 1 },
      { id: 'a5', type: 'insurance', description: 'Seguro-viagem', currency: 'EUR', amount: 0, quantity: 1 },
      { id: 'a6', type: 'additional', description: 'Ingresso no museu', currency: 'EUR', amount: 0, quantity: 1 },
    ],
  },
});
assert.ok(items.model);
assert.ok((items.model?.included.length || 0) <= 6, 'o contrato aceita no máximo 6 incluídos');
assert.ok(items.model!.included.every(item => item.label.length <= 40), 'rótulos têm no máximo 40 caracteres');
assert.equal(
  items.model!.included.some(item => item.label.includes('Bilhetes de trem Tirano')),
  false,
  'rótulo acima de 40 caracteres é omitido'
);
assert.equal(items.model!.included.some(item => /fornecedor/i.test(item.label)), false);
assert.ok(items.warnings.some(warning => /termos internos/i.test(warning)));
assert.ok(items.warnings.some(warning => /comporta 6 serviços/i.test(warning) || /40 caracteres/i.test(warning)));
console.log('✅ Limites de incluídos e termos internos');

// 7. Não incluídos: limite de 3 linhas e texto público
const notIncluded = createQuotationFlyer({
  ...quote,
  data: {
    ...quote.data,
    notIncluded: [
      '  Taxa local de 34€ paga no hotel  ',
      'Bagagem despachada',
      'Custo interno do fornecedor',
      'Refeições não incluídas',
      'Quarta linha que não cabe',
    ],
  },
});
assert.deepEqual(notIncluded.model?.notIncluded, [
  'Taxa local de 34€ paga no hotel',
  'Bagagem despachada',
]);
assert.ok(notIncluded.warnings.some(warning => /termos internos/i.test(warning)));
const manyLines = createQuotationFlyer({
  ...quote,
  data: { ...quote.data, notIncluded: ['Taxa local', 'Bagagem', 'Refeições', 'Quarta linha'] },
});
assert.deepEqual(manyLines.model?.notIncluded, ['Taxa local', 'Bagagem', 'Refeições'], 'no máximo 3 linhas');
console.log('✅ Não incluídos normalizados e sem termos internos');

// 8. Passageiros: adultos, crianças e bebés no rótulo; pagantes na tarifa
const family = createQuotationFlyer({
  ...quote,
  data: { ...quote.data, passengers: { adults: 2, children: 1, infants: 1 } },
});
assert.equal(family.model?.passengers.label, '2 adultos · 1 criança · 1 bebê');
assert.equal(family.model?.transport?.outbound.fareLabel, 'Tarifa para 3 pagantes');
assert.deepEqual(family.model?.price.perPerson, { amount: 233.33, currency: 'EUR', formatted: '€ 233,33' });
console.log('✅ Passageiros e tarifa por pagantes');

// 9. Rotas: fallback para origem/destino quando o description não tem códigos
const noCodes = createQuotationFlyer({
  ...quote,
  data: {
    ...quote.data,
    services: [
      transport('out', 'outbound_transport', 'Voo direto para Paris', { departureTime: '08:10', arrivalTime: '11:05' }),
      transport('in', 'inbound_transport', 'Voo direto de volta', { departureTime: '18:40', arrivalTime: '19:45' }),
      hotel(),
    ],
  },
});
assert.equal(noCodes.model?.transport?.outbound.route, 'Porto — Paris');
assert.equal(noCodes.model?.transport?.inbound.route, 'Paris — Porto');
console.log('✅ Fallback das rotas');

// 10. Legado sem `services`: normalização da estrutura antiga
const legacy = createQuotationFlyer({
  ...quote,
  data: {
    ...quote.data,
    services: undefined,
    outboundTransport: { type: 'flight', route: 'Voo de ida Porto (OPO) para Paris (ORY)', carrier: 'easyJet', departureTime: '08:10', arrivalTime: '11:05', notes: 'Bagagem de mão incluída' },
    inboundTransport: { type: 'flight', route: 'Voo de volta Paris (ORY) para Porto (OPO)', carrier: 'easyJet', departureTime: '18:40', arrivalTime: '19:45' },
    lodging: [{ id: 'h', name: 'Ibis Paris', destination: 'Paris', mealPlan: 'Café da manhã (BB)', nights: 3 }],
  },
});
assert.ok(legacy.model, `legado deve gerar modelo: ${legacy.errors.join(' | ')}`);
assert.equal(legacy.model?.transport?.outbound.carrier, 'easyJet');
assert.equal(legacy.model?.transport?.outbound.route, 'OPO — ORY');
assert.equal(legacy.model?.lodging?.name, 'Ibis Paris');
console.log('✅ Estrutura legada');

// 11. Paridade do modelo de pacote após a extração dos helpers
const pkg = {
  id: 'fixture', reference: 'TESTE', name: 'Viagem fictícia', status: 'draft' as const,
  base_currency: 'BRL' as const, created_at: '', updated_at: '',
  data: {
    origin: 'Porto', destination: 'Açores',
    dates: { startDate: '2027-04-12', endDate: '2027-04-19' },
    passengers: { adults: 2, children: 0, infants: 0 },
    paymentConditions: '30% de entrada e saldo antes da viagem',
    financials: {
      currency: 'BRL' as const, components: [], totalCost: 500, salePrice: 1496,
      pricePerPerson: 748, profit: 996, profitPercent: 66.58, taxesAndFeesTotal: 0,
    },
    services: [{
      id: '1', type: 'accommodation' as const, description: 'Hotel interno',
      currency: 'BRL' as const, amount: 500, quantity: 1,
      mealPlan: 'Café da manhã (BB)', notes: 'fornecedor secreto',
    }],
    supplier: 'fornecedor secreto',
  },
};
const pkgResult = createPackageFlyer(pkg);
assert.equal(pkgResult.errors.length, 0);
assert.deepEqual(pkgResult.model, {
  version: 1,
  origin: 'Porto',
  destination: 'Açores',
  period: '12 a 19 de abril de 2027',
  price: { amount: 748, currency: 'BRL', formatted: 'R$ 748,00' },
  items: [{ kind: 'accommodation', label: 'Hospedagem com café da manhã' }],
  paymentConditions: '30% de entrada e saldo antes da viagem',
});
const pkgLegacy = createPackageFlyer({
  ...pkg,
  base_currency: 'EUR',
  data: {
    origin: 'Lisboa',
    dates: { startDate: '2027-12-01', endDate: '2027-12-08' },
    passengers: { adults: 2, children: 1, infants: 1 },
    outboundTransport: { type: 'flight', route: 'Lisboa → Paris', carrier: 'Fornecedor oculto' },
    lodging: [{ id: 'h', name: 'Fornecedor oculto', destination: 'Paris', mealPlan: 'Café da manhã (BB)' }],
    additionalServices: [
      { id: 'a', name: 'Passeio de barco', type: 'passeio', included: true },
      { id: 'b', name: 'Seguro-viagem', type: 'seguro', included: false },
    ],
    financials: { currency: 'EUR', components: [], totalCost: 10, salePrice: 3000, pricePerPerson: 0, profit: 2990, profitPercent: 99, taxesAndFeesTotal: 0 },
  },
});
assert.ok(pkgLegacy.model);
assert.deepEqual(pkgLegacy.model?.items, [
  { kind: 'air', label: 'Aéreo' },
  { kind: 'accommodation', label: 'Hospedagem com café da manhã' },
  { kind: 'additional', label: 'Passeio de barco' },
]);
assert.equal(pkgLegacy.model?.price.formatted, '€ 1.000,00');
console.log('✅ Paridade do modelo de pacote');

// Regime em falta: o editor mostra café da manhã, a peça segue o mesmo default.
const withoutMealPlan = createQuotationFlyer({
  ...quote,
  data: {
    ...quote.data,
    services: quote.data.services!.map(service =>
      service.type === 'accommodation' ? { ...service, mealPlan: undefined } : service
    ),
  },
});
assert.equal(withoutMealPlan.model?.lodging?.mealPlan, 'café da manhã', 'regime em falta usa o default do editor');
assert.ok(
  withoutMealPlan.model?.included.some(item => item.label === 'Hospedagem com café da manhã'),
  'a lista de incluídos acompanha o default do regime'
);
console.log('✅ Regime da hospedagem em falta');

// 12. Regime da hospedagem na lista de incluídos: mesma regra da lâmina de pacote.
const flights = quote.data.services!.filter(service => service.type !== 'accommodation');
const quoteWithStay = (overrides: Partial<ServiceItem> = {}): Quotation => ({
  ...quote,
  data: {
    ...quote.data,
    services: [...flights, hotel(overrides)],
  },
});

// O cartão de hospedagem mantém o regime em linha própria, sem o prefixo da lista.
const established: Array<[string, string, string]> = [
  ['Café da manhã (BB)', 'Hospedagem com café da manhã', 'café da manhã'],
  ['Meia-pensão (HB)', 'Hospedagem com meia-pensão', 'meia-pensão'],
  ['Pensão completa (FB)', 'Hospedagem com pensão completa', 'pensão completa'],
  ['Tudo incluído (AI)', 'Hospedagem com tudo incluído', 'tudo incluído'],
];
for (const [registered, label, cardMealPlan] of established) {
  const stay = createQuotationFlyer(quoteWithStay({ mealPlan: registered }));
  assert.deepEqual(stay.model?.included, [
    { kind: 'air', label: 'Aéreo' },
    { kind: 'accommodation', label },
  ], `${registered} vira "${label}"`);
  assert.equal(stay.model?.lodging?.mealPlan, cardMealPlan, 'cartão de hospedagem sem o prefixo "Hospedagem com"');
}
console.log('✅ Regimes conhecidos na proposta de viagem e no cartão');

// Apenas alojamento: a lista não menciona o regime e não gera aviso.
for (const registered of ['Apenas alojamento (RO)', 'Somente alojamento', 'Room only']) {
  const stay = createQuotationFlyer(quoteWithStay({ mealPlan: registered }));
  assert.deepEqual(stay.model?.included, [
    { kind: 'air', label: 'Aéreo' },
    { kind: 'accommodation', label: 'Hospedagem' },
  ], `${registered} não tem refeições a anunciar`);
  assert.ok(!stay.warnings.some(warning => /regime/i.test(warning)), `${registered} não deve avisar sobre o regime`);
}
const roomOnlyCard = createQuotationFlyer(quoteWithStay({ mealPlan: 'Apenas alojamento (RO)' }));
assert.equal(roomOnlyCard.model?.lodging?.mealPlan, 'apenas alojamento', 'o cartão continua a mostrar apenas alojamento como linha própria');
console.log('✅ Apenas alojamento na proposta de viagem');

// Refeições vencem a palavra alojamento: o regime composto nomeia a refeição, sem aviso.
for (const [registered, label] of [
  ['Alojamento com café da manhã', 'Hospedagem com café da manhã'],
  ['Alojamento e meia-pensão', 'Hospedagem com meia-pensão'],
  ['Alojamento com tudo incluído', 'Hospedagem com tudo incluído'],
] as const) {
  const stay = createQuotationFlyer(quoteWithStay({ mealPlan: registered }));
  assert.deepEqual(stay.model?.included, [
    { kind: 'air', label: 'Aéreo' },
    { kind: 'accommodation', label },
  ], `${registered} nomeia a refeição`);
  assert.ok(!stay.warnings.some(warning => /regime/i.test(warning)), `${registered} não deve avisar sobre o regime`);
}
for (const registered of ['Somente hospedagem', 'Só hospedagem']) {
  const stay = createQuotationFlyer(quoteWithStay({ mealPlan: registered }));
  assert.deepEqual(stay.model?.included, [
    { kind: 'air', label: 'Aéreo' },
    { kind: 'accommodation', label: 'Hospedagem' },
  ], `${registered} não tem refeições a anunciar`);
}
console.log('✅ Alojamento com refeições na proposta de viagem');

// Guardas: o texto registado nunca vira afirmação errada nem expõe dados internos.
const pricedCode = createQuotationFlyer(quoteWithStay({ mealPlan: 'Pensão completa (R$ 300)' }));
assert.deepEqual(pricedCode.model?.included, [
  { kind: 'air', label: 'Aéreo' },
  { kind: 'accommodation', label: 'Hospedagem' },
], 'preço entre parênteses não pode ser publicado');
assert.ok(pricedCode.warnings.some(warning => /regime da hospedagem/i.test(warning)));
assert.ok(!JSON.stringify(pricedCode.model).includes('300'), 'o preço do regime não vaza para o modelo');
assert.equal(pricedCode.model?.lodging?.mealPlan, undefined, 'o cartão não afirma um regime com preço');

const contactMeal = createQuotationFlyer(quoteWithStay({ mealPlan: 'Café da manhã +351 960 153 290' }));
assert.deepEqual(contactMeal.model?.included, [
  { kind: 'air', label: 'Aéreo' },
  { kind: 'accommodation', label: 'Hospedagem' },
], 'contactos não podem ser publicados');
assert.ok(contactMeal.warnings.some(warning => /regime da hospedagem/i.test(warning)));

const negativeMeal = createQuotationFlyer(quoteWithStay({ mealPlan: 'sem café' }));
assert.deepEqual(negativeMeal.model?.included, [
  { kind: 'air', label: 'Aéreo' },
  { kind: 'accommodation', label: 'Hospedagem' },
], 'regime negativo não vira afirmação');
assert.ok(negativeMeal.warnings.some(warning => /regime da hospedagem/i.test(warning)));

const shoutedMeal = createQuotationFlyer(quoteWithStay({ mealPlan: 'PEQUENO-ALMOÇO' }));
assert.deepEqual(shoutedMeal.model?.included, [
  { kind: 'air', label: 'Aéreo' },
  { kind: 'accommodation', label: 'Hospedagem com pequeno-almoço' },
], 'regime em maiúsculas desce por inteiro');
console.log('✅ Guardas do regime na proposta de viagem');

// Regime livre: sai como foi registado, em minúscula inicial e sem o código entre parênteses.
const freeRegime = createQuotationFlyer(quoteWithStay({ mealPlan: 'Pequeno-almoço (BB)' }));
assert.deepEqual(freeRegime.model?.included, [
  { kind: 'air', label: 'Aéreo' },
  { kind: 'accommodation', label: 'Hospedagem com pequeno-almoço' },
]);
console.log('✅ Regime livre registado na proposta de viagem');

// Regime que não pode ir para a peça: "Hospedagem" com aviso, sem truncar o texto.
for (const registered of ['Regime do fornecedor secreto', 'Pensão completa com bebidas incluídas e jantar']) {
  const stay = createQuotationFlyer(quoteWithStay({ mealPlan: registered }));
  assert.deepEqual(stay.model?.included, [
    { kind: 'air', label: 'Aéreo' },
    { kind: 'accommodation', label: 'Hospedagem' },
  ], `${registered} não pode ser publicado`);
  assert.ok(stay.warnings.some(warning => /regime da hospedagem/i.test(warning)), `${registered} deve avisar sobre o regime`);
}
console.log('✅ Regime não publicável na proposta de viagem');

// Duas estadas com regimes diferentes são dois itens; a mesma estada repetida não duplica.
const twoStays = createQuotationFlyer({
  ...quote,
  data: {
    ...quote.data,
    services: [
      ...flights,
      hotel({ id: 'h1', description: 'Hotel A', mealPlan: 'Café da manhã (BB)' }),
      hotel({ id: 'h2', description: 'Hotel B', mealPlan: 'Meia-pensão (HB)' }),
    ],
  },
});
assert.deepEqual(twoStays.model?.included, [
  { kind: 'air', label: 'Aéreo' },
  { kind: 'accommodation', label: 'Hospedagem com café da manhã' },
  { kind: 'accommodation', label: 'Hospedagem com meia-pensão' },
], 'duas estadas com regimes diferentes são dois itens');
console.log('✅ Várias estadas na proposta de viagem');

// 13. Legado: cotação antiga sem regime assume café da manhã, como o editor já mostra.
const legacyWithoutMealPlan = createQuotationFlyer({
  ...quote,
  data: {
    ...quote.data,
    services: undefined,
    outboundTransport: quote.data.outboundTransport ?? { type: 'flight', route: 'Voo de ida Porto (OPO) para Paris (ORY)', carrier: 'easyJet', departureTime: '08:10', arrivalTime: '11:05' },
    inboundTransport: quote.data.inboundTransport ?? { type: 'flight', route: 'Voo de volta Paris (ORY) para Porto (OPO)', carrier: 'easyJet', departureTime: '18:40', arrivalTime: '19:45' },
    lodging: [{ id: 'h', name: 'Ibis Paris', destination: 'Paris', nights: 3 }],
  },
});
assert.ok(legacyWithoutMealPlan.model, `legado sem regime deve gerar modelo: ${legacyWithoutMealPlan.errors.join(' | ')}`);
assert.equal(legacyWithoutMealPlan.model?.lodging?.mealPlan, 'café da manhã', 'cartão de hospedagem mantém o default do editor');
assert.deepEqual(legacyWithoutMealPlan.model?.included, [
  { kind: 'air', label: 'Aéreo' },
  { kind: 'accommodation', label: 'Hospedagem com café da manhã' },
], 'cotação antiga sem regime continua a anunciar café da manhã');
console.log('✅ Legado da cotação sem regime');

console.log('\n🎉 TODOS OS TESTES DO MODELO DA COTAÇÃO PASSARAM!\n');
