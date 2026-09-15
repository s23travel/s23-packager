import assert from 'node:assert';
import {
  roundMoney,
  roundPercent,
  convertCurrency,
  calculateCosts,
  calculatePricePerPerson,
  calculateProfit,
  calculateProfitPercent,
  calculateFinancialSummary,
  calculateSuggestedSalePrice,
  DEFAULT_PROFIT_MARGIN_PERCENT,
} from '../src/services/financeService';
import { CostComponent, PackageData, QuotationData } from '../src/types';

console.log('=== INICIANDO BATERIA DE TESTES DO MOTOR FINANCEIRO DETERMINÍSTICO (FASE 4) ===\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err: any) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`   Detalhe: ${err.message}`);
    testsFailed++;
  }
}

// 1. Um pacote com vários custos na mesma moeda.
runTest('1. Pacote com vários custos na mesma moeda (EUR)', () => {
  const components: CostComponent[] = [
    { id: '1', category: 'outbound_transport', description: 'Voo LIS-MAD', amount: 250, currency: 'EUR', quantity: 2 },
    { id: '2', category: 'lodging', description: 'Hotel Madrid 4 noites', amount: 600, currency: 'EUR', quantity: 1 },
    { id: '3', category: 'taxes', description: 'Taxa turística', amount: 25.50, currency: 'EUR', quantity: 2 },
  ];
  const result = calculateCosts(components, 'EUR');
  assert.strictEqual(result.conversionError, undefined);
  // (250 * 2) + 600 + (25.50 * 2) = 500 + 600 + 51 = 1151.00
  assert.strictEqual(result.totalCost, 1151.00);
  assert.strictEqual(result.taxesAndFeesTotal, 51.00);
});

// 2. Soma de transporte + hospedagem + serviços.
runTest('2. Soma de transporte de ida e volta + hospedagem + serviços', () => {
  const components: CostComponent[] = [
    { id: '1', category: 'outbound_transport', description: 'Voo Ida', amount: 350.50, currency: 'EUR', quantity: 1 },
    { id: '2', category: 'inbound_transport', description: 'Voo Volta', amount: 320.25, currency: 'EUR', quantity: 1 },
    { id: '3', category: 'lodging', description: 'Resort 5 noites', amount: 800.00, currency: 'EUR', quantity: 1 },
    { id: '4', category: 'services', description: 'Transfer VIP & City Tour', amount: 150.00, currency: 'EUR', quantity: 1 },
  ];
  const result = calculateCosts(components, 'EUR');
  // 350.50 + 320.25 + 800.00 + 150.00 = 1620.75
  assert.strictEqual(result.totalCost, 1620.75);
});

// 3. Cálculo de preço por pessoa.
runTest('3. Cálculo de preço por pessoa (adultos + crianças, bebês não dividem)', () => {
  // Caso A: 2 adultos + 1 criança = 3 pagantes. Preço: 3000 -> 1000 por pessoa
  const p1 = calculatePricePerPerson(3000, { adults: 2, children: 1, infants: 1 });
  assert.strictEqual(p1, 1000.00);

  // Caso B: 2 adultos + 0 crianças = 2 pagantes. Preço: 2500 -> 1250 por pessoa
  const p2 = calculatePricePerPerson(2500, { adults: 2, children: 0, infants: 0 });
  assert.strictEqual(p2, 1250.00);

  // Caso C: passageiros indefinidos ou zerados (fallback para divisor 1, sem divisão por zero)
  const p3 = calculatePricePerPerson(1500, null);
  assert.strictEqual(p3, 1500.00);
});

// 4. Cálculo de lucro positivo.
runTest('4. Cálculo de lucro positivo (venda > custo)', () => {
  const salePrice = 3500.00;
  const totalCost = 2800.00;
  const profit = calculateProfit(salePrice, totalCost);
  assert.strictEqual(profit, 700.00);
});

// 5. Cálculo de margem percentual.
runTest('5. Cálculo de margem percentual determinística', () => {
  const salePrice = 4000.00;
  const totalCost = 3000.00;
  // Lucro = 1000. Margem = (1000 / 4000) * 100 = 25.00%
  const margin = calculateProfitPercent(salePrice, totalCost);
  assert.strictEqual(margin, 25.00);
});

// 6. Lucro negativo.
runTest('6. Lucro negativo (custo > venda)', () => {
  const salePrice = 2000.00;
  const totalCost = 2500.00;
  const profit = calculateProfit(salePrice, totalCost);
  const margin = calculateProfitPercent(salePrice, totalCost);
  assert.strictEqual(profit, -500.00);
  assert.strictEqual(margin, -25.00);
});

// 7. Preço de venda igual a zero.
runTest('7. Preço de venda igual a zero (sem divisão por zero ou NaN/Infinity)', () => {
  const salePrice = 0;
  const totalCost = 1500.00;
  const profit = calculateProfit(salePrice, totalCost);
  const margin = calculateProfitPercent(salePrice, totalCost);
  const pricePerPerson = calculatePricePerPerson(salePrice, { adults: 2, children: 0, infants: 0 });
  assert.strictEqual(profit, -1500.00);
  assert.strictEqual(margin, 0); // Margem protegida retorna 0, nunca -Infinity ou NaN
  assert.strictEqual(pricePerPerson, 0);
  assert(!Number.isNaN(margin));
  assert(Number.isFinite(margin));
});

// 8. Custo zero.
runTest('8. Custo zero (lucro igual a 100% da venda)', () => {
  const salePrice = 2000.00;
  const totalCost = 0;
  const profit = calculateProfit(salePrice, totalCost);
  const margin = calculateProfitPercent(salePrice, totalCost);
  assert.strictEqual(profit, 2000.00);
  assert.strictEqual(margin, 100.00);
});

// 9. Conversão EUR → BRL.
runTest('9. Conversão EUR → BRL (Convenção: 1 EUR = X BRL)', () => {
  // 100 EUR a uma taxa de 6.20 = 620.00 BRL
  const conv = convertCurrency(100, 'EUR', 'BRL', 6.20);
  assert.strictEqual(conv.error, undefined);
  assert.strictEqual(conv.converted, 620.00);

  // Teste com centavos: 150.50 EUR * 6.2550 = 941.3775 -> 941.38 BRL
  const conv2 = convertCurrency(150.50, 'EUR', 'BRL', 6.2550);
  assert.strictEqual(conv2.converted, 941.38);
});

// 10. Conversão BRL → EUR.
runTest('10. Conversão BRL → EUR (Convenção: BRL / taxa)', () => {
  // 620 BRL a uma taxa de 6.20 = 100.00 EUR
  const conv = convertCurrency(620, 'BRL', 'EUR', 6.20);
  assert.strictEqual(conv.error, undefined);
  assert.strictEqual(conv.converted, 100.00);

  // Teste fracionário: 3100 BRL / 6.20 = 500.00 EUR
  const conv2 = convertCurrency(3100, 'BRL', 'EUR', 6.20);
  assert.strictEqual(conv2.converted, 500.00);
});

// 11. Moeda diferente sem câmbio (bloqueio do cálculo e mensagem clara).
runTest('11. Moeda diferente sem taxa de câmbio (bloqueia cálculo com mensagem descritiva)', () => {
  const components: CostComponent[] = [
    { id: '1', category: 'lodging', description: 'Hotel no Brasil', amount: 1500, currency: 'BRL', quantity: 1 },
  ];
  // Target é EUR, mas taxa não foi informada
  const result = calculateCosts(components, 'EUR', null);
  assert.strictEqual(result.totalCost, 0);
  assert(result.conversionError !== undefined);
  assert(result.conversionError.includes('Câmbio manual obrigatório não informado'));

  // Validação no resumo consolidado
  const summary = calculateFinancialSummary({
    components,
    salePrice: 1000,
    targetCurrency: 'EUR',
    exchangeRate: null,
  });
  assert(summary.conversionError !== null && summary.conversionError !== undefined);
  assert.strictEqual(summary.totalCost, 0);
  assert.strictEqual(summary.profit, 0);
});

// 12. Arredondamento monetário e precisão.
runTest('12. Precisão de arredondamento monetário (evita imprecisões de floating point)', () => {
  // 0.1 + 0.2 em JS nativo = 0.30000000000000004
  const sum = 0.1 + 0.2;
  const rounded = roundMoney(sum);
  assert.strictEqual(rounded, 0.30);

  // 123.456 -> 123.46
  assert.strictEqual(roundMoney(123.456), 123.46);
  // 123.454 -> 123.45
  assert.strictEqual(roundMoney(123.454), 123.45);
  // Porcentagem
  assert.strictEqual(roundPercent(33.333333), 33.33);
});

// 13. Snapshot financeiro de uma quotation.
runTest('13. Snapshot financeiro independente de uma cotação', () => {
  const packageFinancials = calculateFinancialSummary({
    components: [
      { id: 'c1', category: 'lodging', description: 'Hotel Paris', amount: 1200, currency: 'EUR', quantity: 1 },
      { id: 'c2', category: 'outbound_transport', description: 'Voo', amount: 800, currency: 'EUR', quantity: 1 },
    ],
    salePrice: 2600,
    targetCurrency: 'EUR',
    passengers: { adults: 2, children: 0, infants: 0 },
  });

  const packageData: PackageData = {
    financials: packageFinancials,
  };

  // Simula a criação da cotação clonando profundamente o snapshot
  const quotationData: QuotationData = JSON.parse(JSON.stringify(packageData));
  quotationData.snapshotCreatedAt = new Date().toISOString();

  // Verifica que os dados foram preservados no snapshot
  assert.strictEqual(quotationData.financials?.totalCost, 2000.00);
  assert.strictEqual(quotationData.financials?.salePrice, 2600.00);
  assert.strictEqual(quotationData.financials?.profit, 600.00);
  assert.strictEqual(quotationData.financials?.profitPercent, 23.08);
  assert.strictEqual(quotationData.financials?.pricePerPerson, 1300.00);
});

// 14. Alteração do package sem alterar os valores da quotation.
runTest('14. Alteração no package base não afeta a cotação existente (independência total)', () => {
  const initialFinancials = calculateFinancialSummary({
    components: [
      { id: 'c1', category: 'lodging', description: 'Hotel', amount: 1000, currency: 'EUR', quantity: 1 },
    ],
    salePrice: 1500,
    targetCurrency: 'EUR',
  });

  const packageObj = {
    id: 'pkg-1',
    data: {
      financials: initialFinancials,
    },
  };

  // Cria cotação snapshot
  const quotationObj = {
    id: 'quote-1',
    package_id: packageObj.id,
    data: JSON.parse(JSON.stringify(packageObj.data)),
  };

  // Altera o pacote: aumento de custos e novo preço
  packageObj.data.financials = calculateFinancialSummary({
    components: [
      { id: 'c1', category: 'lodging', description: 'Hotel', amount: 2000, currency: 'EUR', quantity: 1 },
    ],
    salePrice: 2800,
    targetCurrency: 'EUR',
  });

  // Valida que o pacote mudou
  assert.strictEqual(packageObj.data.financials.totalCost, 2000.00);
  assert.strictEqual(packageObj.data.financials.salePrice, 2800.00);

  // Valida categoricamente que a cotação PERMANECEU INALTERADA
  assert.strictEqual(quotationObj.data.financials.totalCost, 1000.00);
  assert.strictEqual(quotationObj.data.financials.salePrice, 1500.00);
  assert.strictEqual(quotationObj.data.financials.profit, 500.00);
});

// 15. Cálculo automático de Preço de Venda com margem padrão de 12% (custo + 12%)
runTest('15. Preço de venda sugerido: soma dos custos + 12% de margem de lucro', () => {
  assert.strictEqual(DEFAULT_PROFIT_MARGIN_PERCENT, 12);
  
  // Custo 1000 EUR -> 1000 * 1.12 = 1120.00 EUR
  const price1 = calculateSuggestedSalePrice(1000);
  assert.strictEqual(price1, 1120.00);

  // Custo 1200 EUR -> 1200 * 1.12 = 1344.00 EUR
  const price2 = calculateSuggestedSalePrice(1200);
  assert.strictEqual(price2, 1344.00);

  // Custo fracionado 350.50 EUR -> 350.50 * 1.12 = 392.56 EUR
  const price3 = calculateSuggestedSalePrice(350.50);
  assert.strictEqual(price3, 392.56);
});

// 16. Proteção contra custos zerados ou inválidos no cálculo do preço sugerido
runTest('16. Proteção para cálculo sugerido com custo zero ou negativo', () => {
  assert.strictEqual(calculateSuggestedSalePrice(0), 0);
  assert.strictEqual(calculateSuggestedSalePrice(-50), 0);
  assert.strictEqual(calculateSuggestedSalePrice(NaN), 0);
});

console.log(`\n=== RESULTADO: ${testsPassed} PASSOU, ${testsFailed} FALHOU ===`);
if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('🎉 TODOS OS 16 TESTES MATEMÁTICOS E DE NEGÓCIO PASSARAM COM SUCESSO!\n');
}
