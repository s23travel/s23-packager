import assert from 'node:assert/strict';
import { register } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPackageFlyer } from '../src/services/packageFlyerService';
import { FLYER_ITEM_LABEL_MAX, itemLabelProblem, validFlyerItems } from '../supabase/functions/_shared/flyerItemsContract';
import type { Package } from '../src/types';

// O template importa o logo .png (o Vite resolve como URL); em Node é preciso o loader.
register('./pngAssetLoader.mjs', import.meta.url);
const { PackageFlyerTemplate } = await import('../src/components/packages/PackageFlyerTemplate');

const pkg: Package = {
  id: 'fixture', reference: 'TESTE', name: 'Viagem fictícia', status: 'draft',
  base_currency: 'BRL', created_at: '', updated_at: '',
  data: {
    origin: 'Porto', destination: 'Açores',
    dates: { startDate: '2027-04-12', endDate: '2027-04-19' },
    passengers: { adults: 2, children: 0, infants: 0 },
    paymentConditions: '30% de entrada e saldo antes da viagem',
    financials: { currency: 'BRL', components: [], totalCost: 500, salePrice: 1496,
      pricePerPerson: 748, profit: 996, profitPercent: 66.58, taxesAndFeesTotal: 0 },
    services: [{ id: '1', type: 'accommodation', description: 'Hotel interno', currency: 'BRL', amount: 500, quantity: 1, mealPlan: 'Café da manhã (BB)', notes: 'fornecedor secreto' }],
    supplier: 'fornecedor secreto',
  },
};

const result = createPackageFlyer(pkg);
assert.equal(result.errors.length, 0);
assert.ok(result.model);
const html = renderToStaticMarkup(<PackageFlyerTemplate model={result.model!} />).replace(/<img[^>]+>/g, '');
assert.match(html, /Porto/);
assert.match(html, /Açores/);
assert.match(html, /R\$ 748,00/);
assert.match(html, /<span>Valor<\/span>/);
assert.match(html, /por pessoa em quarto duplo/);
assert.match(html, /30% de entrada e saldo antes da viagem/);
assert.equal(result.model?.paymentConditions, '30% de entrada e saldo antes da viagem');
const flexiblePayment = createPackageFlyer({ ...pkg, data: {
  ...pkg.data, paymentConditions: 'Entrada de R$ 500,00 e restante em 6 parcelas sem juros.',
} });
assert.equal(flexiblePayment.model?.paymentConditions, 'Entrada de R$ 500,00 e restante em 6 parcelas sem juros.');
const cashPayment = createPackageFlyer({ ...pkg, data: { ...pkg.data, paymentConditions: 'À vista' } });
assert.equal(cashPayment.model?.paymentConditions, 'À vista', 'condição à vista com acento deve ser reconhecida');
assert.match(html, /café da manhã/i);
assert.doesNotMatch(html, /fornecedor secreto|Hotel interno|996/);
console.log('Prévia comercial fictícia: OK');

const legacy: Package = { ...pkg, base_currency: 'EUR', data: {
  origin: 'Lisboa', dates: { startDate: '2027-12-01', endDate: '2027-12-08' },
  passengers: { adults: 2, children: 1, infants: 1 },
  outboundTransport: { type: 'flight', route: 'Lisboa → Paris', carrier: 'Fornecedor oculto' },
  lodging: [{ id: 'h', name: 'Fornecedor oculto', destination: 'Paris', mealPlan: 'Café da manhã (BB)' }],
  additionalServices: [{ id: 'a', name: 'Passeio de barco', type: 'passeio', included: true }, { id: 'b', name: 'Seguro-viagem', type: 'seguro', included: false }],
  financials: { currency: 'EUR', components: [], totalCost: 10, salePrice: 3000, pricePerPerson: 0, profit: 2990, profitPercent: 99, taxesAndFeesTotal: 0 },
} };
const legacyResult = createPackageFlyer(legacy);
assert.ok(legacyResult.model);
const legacyHtml = renderToStaticMarkup(<PackageFlyerTemplate model={legacyResult.model!} />).replace(/<img[^>]+>/g, '');
assert.match(legacyHtml, /€ 1\.000,00/);
assert.match(legacyHtml, /Aéreo/);
assert.match(legacyHtml, /Passeio de barco/);
assert.doesNotMatch(legacyHtml, /Fornecedor oculto|Seguro-viagem/);

const invalid = createPackageFlyer({ ...pkg, data: { ...pkg.data, origin: '', dates: { startDate: '2027-02-30', endDate: '2027-01-01' }, financials: undefined } });
assert.equal(invalid.model, null);
assert.ok(invalid.errors.length >= 3);
console.log('Legado, inclusão explícita e dados ausentes: OK');

const inconsistent = createPackageFlyer({ ...pkg, data: { ...pkg.data,
  financials: { ...pkg.data.financials!, pricePerPerson: 300 },
} });
assert.equal(inconsistent.model, null, 'valor por pessoa divergente deve bloquear a prévia');

const notIncluded = createPackageFlyer({ ...pkg, data: { ...pkg.data,
  services: [{ id: 'x', type: 'insurance', description: 'Seguro não incluído', currency: 'BRL', amount: 0, quantity: 1 }],
} });
assert.ok(notIncluded.model);
assert.equal(notIncluded.model.items.length, 0);
assert.ok(notIncluded.warnings.length);
const taxes = createPackageFlyer({ ...pkg, data: { ...pkg.data,
  services: [{ id: 'tax', type: 'taxes', description: 'Taxa de embarque', currency: 'BRL', amount: 0, quantity: 1 }],
} });
assert.ok(taxes.warnings.some(warning => /taxa.*omitida|confirme.*inclus/i.test(warning)), 'taxa sem inclusão confirmada deve gerar aviso');
console.log('Inconsistências e itens não inclusos: OK');

const unsafe = createPackageFlyer({ ...pkg, data: { ...pkg.data,
  paymentConditions: 'fornecedor secreto cobra 10x de R$ 123',
  services: [
    { id: 't', type: 'outbound_transport', description: 'Trem expresso', currency: 'BRL', amount: 10, quantity: 1 },
    { id: 'a', type: 'additional', description: 'Passeio com fornecedor secreto', currency: 'BRL', amount: 10, quantity: 1 },
    { id: 'h', type: 'accommodation', description: 'Hotel secreto', mealPlan: 'sem café', currency: 'BRL', amount: 10, quantity: 1 },
  ],
} });
assert.ok(unsafe.model);
const unsafeHtml = renderToStaticMarkup(<PackageFlyerTemplate model={unsafe.model!} />).replace(/<img[^>]+>/g, '');
assert.match(unsafeHtml, /Transporte/);
assert.doesNotMatch(unsafeHtml, /Aéreo|fornecedor secreto|Hotel secreto|café da manhã|123/);
assert.equal(unsafe.model?.paymentConditions, undefined, 'condições livres não reconhecidas não devem ser anunciadas');
assert.ok(unsafe.warnings.length >= 3);

const badCurrency = createPackageFlyer({ ...pkg, data: { ...pkg.data,
  financials: { ...pkg.data.financials!, currency: 'EUR' },
} });
assert.equal(badCurrency.model, null);
const oversized = createPackageFlyer({ ...pkg, data: { ...pkg.data, destination: 'Destino fictício '.repeat(8) } });
assert.equal(oversized.model, null);
console.log('Moeda, texto operacional e limites: OK');

const tickets = createPackageFlyer({ ...pkg, data: { ...pkg.data,
  services: [{ id: 't', type: 'additional', description: 'Bilhetes de trem Tirano + Bernina Express', currency: 'BRL', amount: 10, quantity: 1 }],
} });
assert.ok(tickets.model, 'bilhetes não podem bloquear a prévia');
assert.deepEqual(tickets.model?.items, [{ kind: 'additional', label: 'Bilhetes de trem Tirano + Bernina Express' }], 'serviço adicional não pode ser descartado por nome');
const ticketsHtml = renderToStaticMarkup(<PackageFlyerTemplate model={tickets.model!} />).replace(/<img[^>]+>/g, '');
assert.match(ticketsHtml, /Bilhetes de trem Tirano \+ Bernina Express/);

const internalExtra = createPackageFlyer({ ...pkg, data: { ...pkg.data,
  services: [{ id: 't', type: 'additional', description: 'Bilhetes com fornecedor secreto', currency: 'BRL', amount: 10, quantity: 1 }],
} });
assert.equal(internalExtra.model?.items.length, 0, 'termos internos não podem ser publicados');
assert.ok(internalExtra.warnings.some(warning => /termos internos/i.test(warning)));

// O limite de 40 caracteres é do editor e do servidor; a geração não omite o serviço.
assert.equal(itemLabelProblem('Bilhetes de trem Tirano + Bernina Express'), `Use até ${FLYER_ITEM_LABEL_MAX} caracteres (tem 41).`);
assert.equal(itemLabelProblem('Bilhetes de trem'), null);
assert.ok(!validFlyerItems([{ kind: 'additional', label: 'Bilhetes de trem Tirano + Bernina Express' }]));
assert.ok(validFlyerItems([{ kind: 'additional', label: 'Bilhetes de trem' }]));
assert.ok(!validFlyerItems([{ kind: 'ticket', label: 'Bilhetes' }]));
assert.ok(!validFlyerItems([{ kind: 'additional', label: 'Bilhetes de trem', notes: 'x' }]));
assert.ok(validFlyerItems([]));

const dense = createPackageFlyer({ ...pkg, data: { ...pkg.data,
  services: [
    { id: 'h', type: 'accommodation', description: 'Hotel', mealPlan: 'Café da manhã (BB)', currency: 'BRL', amount: 1, quantity: 1 },
    ...[1, 2, 3, 4, 5].map(n => ({ id: `s${n}`, type: 'additional' as const, description: `Passeio turístico guiado pela cidade ${n}`, currency: 'BRL' as const, amount: 1, quantity: 1 })),
  ],
} });
assert.ok(dense.model);
assert.equal(dense.model?.items.length, 6);
const denseHtml = renderToStaticMarkup(<PackageFlyerTemplate model={dense.model!} />).replace(/<img[^>]+>/g, '');
assert.match(denseHtml, /package-flyer--compact/, 'lista densa precisa do modo compacto');
assert.doesNotMatch(html, /package-flyer--compact/, 'lista curta não deve encolher');

const tooMany = createPackageFlyer({ ...pkg, data: { ...pkg.data,
  services: [1, 2, 3, 4, 5, 6, 7].map(n => ({ id: `s${n}`, type: 'additional' as const, description: `Serviço incluído ${n}`, currency: 'BRL' as const, amount: 1, quantity: 1 })),
} });
assert.ok(tooMany.model, 'excesso de itens pede revisão no editor, não bloqueia a prévia');
assert.equal(tooMany.model?.items.length, 7);
assert.ok(tooMany.warnings.some(warning => /comporta 6 serviços/i.test(warning)));
console.log('Serviços adicionais, limite do editor e modo compacto: OK');

// O item sugerido da hospedagem diz o que está incluído a partir do regime registado.
const stay = (mealPlan?: string) => createPackageFlyer({ ...pkg, data: { ...pkg.data,
  services: [{ id: 'h', type: 'accommodation', description: 'Hotel', currency: 'BRL', amount: 1, quantity: 1,
    ...(mealPlan === undefined ? {} : { mealPlan }) }],
} });
const stayItems = (mealPlan?: string) => stay(mealPlan).model?.items;

assert.deepEqual(stayItems('Café da manhã (BB)'), [{ kind: 'accommodation', label: 'Hospedagem com café da manhã' }]);
assert.deepEqual(stayItems('Meia-pensão (HB)'), [{ kind: 'accommodation', label: 'Hospedagem com meia-pensão' }]);
assert.deepEqual(stayItems('Pensão completa (FB)'), [{ kind: 'accommodation', label: 'Hospedagem com pensão completa' }]);
assert.deepEqual(stayItems('Tudo incluído (AI)'), [{ kind: 'accommodation', label: 'Hospedagem com tudo incluído' }]);
for (const roomOnly of ['Apenas alojamento (RO)', 'Somente alojamento', 'Room only', 'Somente hospedagem', 'Só alojamento']) {
  const result = stay(roomOnly);
  assert.deepEqual(result.model?.items, [{ kind: 'accommodation', label: 'Hospedagem' }], `${roomOnly} não tem refeições a anunciar`);
  assert.ok(!result.warnings.some(warning => /regime/i.test(warning)), `${roomOnly} não deve avisar sobre o regime`);
}
console.log('Regimes conhecidos e apenas alojamento: OK');

// Regime livre: sai como foi registado, em minúscula inicial e sem o código entre parênteses.
assert.deepEqual(stayItems('Pequeno-almoço'), [{ kind: 'accommodation', label: 'Hospedagem com pequeno-almoço' }]);
assert.deepEqual(stayItems('Pequeno-almoço (BB)'), [{ kind: 'accommodation', label: 'Hospedagem com pequeno-almoço' }]);
assert.deepEqual(stayItems('All inclusive'), [{ kind: 'accommodation', label: 'Hospedagem com all inclusive' }]);
assert.deepEqual(stayItems('  Bed   &  breakfast (BB) '), [{ kind: 'accommodation', label: 'Hospedagem com bed & breakfast' }]);
console.log('Regime livre registado: OK');

// Pacote antigo sem regime gravado: não há refeições a afirmar, ao contrário da cotação.
const legacyWithoutMealPlan = createPackageFlyer({ ...legacy, data: {
  ...legacy.data,
  lodging: [{ id: 'h', name: 'Hotel legado', destination: 'Paris' }],
} });
assert.ok(legacyWithoutMealPlan.model);
assert.deepEqual(legacyWithoutMealPlan.model?.items, [
  { kind: 'air', label: 'Aéreo' },
  { kind: 'accommodation', label: 'Hospedagem' },
  { kind: 'additional', label: 'Passeio de barco' },
], 'pacote antigo sem regime fica em Hospedagem');
assert.ok(legacyWithoutMealPlan.warnings.some(warning => /regime da hospedagem/i.test(warning)));
console.log('Legado do pacote sem regime: OK');

// Regime que não pode ir para a peça: o texto comercial nunca é truncado nem exposto.
const withoutMealPlan = stay(undefined);
assert.deepEqual(withoutMealPlan.model?.items, [{ kind: 'accommodation', label: 'Hospedagem' }], 'regime ausente fica em Hospedagem');
assert.ok(withoutMealPlan.warnings.some(warning => /regime da hospedagem/i.test(warning)), 'regime ausente mantém o aviso');

const internalMeal = stay('Regime do fornecedor secreto');
assert.deepEqual(internalMeal.model?.items, [{ kind: 'accommodation', label: 'Hospedagem' }], 'termos internos não podem ser publicados');
assert.ok(internalMeal.warnings.some(warning => /regime da hospedagem/i.test(warning)));

const pricedMeal = stay('Meia-pensão por R$ 300');
assert.deepEqual(pricedMeal.model?.items, [{ kind: 'accommodation', label: 'Hospedagem' }], 'preços não podem ser publicados');
assert.ok(pricedMeal.warnings.some(warning => /regime da hospedagem/i.test(warning)));

const longMeal = stay('Pensão completa com bebidas incluídas e jantar');
assert.deepEqual(longMeal.model?.items, [{ kind: 'accommodation', label: 'Hospedagem' }], 'regime maior do que o espaço fica em Hospedagem');
assert.ok(longMeal.warnings.some(warning => /regime da hospedagem/i.test(warning)));

const twoStays = createPackageFlyer({ ...pkg, data: { ...pkg.data, services: [
  { id: 'h1', type: 'accommodation', description: 'Hotel A', currency: 'BRL', amount: 1, quantity: 1, mealPlan: 'Café da manhã (BB)' },
  { id: 'h2', type: 'accommodation', description: 'Hotel B', currency: 'BRL', amount: 1, quantity: 1, mealPlan: 'Meia-pensão (HB)' },
] } });
assert.deepEqual(twoStays.model?.items, [
  { kind: 'accommodation', label: 'Hospedagem com café da manhã' },
  { kind: 'accommodation', label: 'Hospedagem com meia-pensão' },
], 'duas estadas com regimes diferentes são dois itens');

const repeatedStay = createPackageFlyer({ ...pkg, data: { ...pkg.data, services: [
  { id: 'h1', type: 'accommodation', description: 'Hotel A', currency: 'BRL', amount: 1, quantity: 1, mealPlan: 'Café da manhã (BB)' },
  { id: 'h2', type: 'accommodation', description: 'Hotel A', currency: 'BRL', amount: 1, quantity: 1, mealPlan: 'Café da manhã (BB)' },
] } });
assert.equal(repeatedStay.model?.items.length, 1, 'a mesma estada repetida não duplica a linha');

for (const label of ['Hospedagem com café da manhã', 'Hospedagem com pequeno-almoço']) {
  assert.equal(itemLabelProblem(label), null, `rótulo sugerido dentro do contrato: ${label}`);
}
console.log('Regime não publicável, várias estadas e contrato dos itens: OK');
