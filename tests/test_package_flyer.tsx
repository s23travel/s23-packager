import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPackageFlyer } from '../src/services/packageFlyerService';
import { PackageFlyerTemplate } from '../src/components/packages/PackageFlyerTemplate';
import type { Package } from '../src/types';

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
assert.match(html, /Valor por pessoa/);
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
