import assert from 'node:assert/strict';

// Stub de sessionStorage para o teste offline do rascunho (não há browser no Node).
const storage = new Map<string, string>();
(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, String(value));
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => storage.clear(),
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
  get length() {
    return storage.size;
  },
} as Storage;

import { saveQuoteDraft, getQuoteDraft, clearQuoteDraft } from '../src/services/quoteDraftService';
import {
  NOT_INCLUDED_MAX_ITEMS,
  NOT_INCLUDED_MAX_LENGTH,
  depositOverSalePriceWarning,
  formatBalanceDueDate,
  formatProposalDate,
  normalizeNotIncluded,
  parseDepositAmount,
  resolveProposalDate,
} from '../src/services/quotationFlyerFields';

console.log('=== TESTES: CAMPOS DA LÂMINA NA COTAÇÃO ===\n');

// 1. Rascunho preserva os quatro campos novos
saveQuoteDraft({
  reference: 'COT-2026-059',
  clientName: 'Sandra Colognesi',
  status: 'draft',
  currency: 'EUR',
  startDate: '2027-04-02',
  endDate: '2027-04-05',
  durationDays: 4,
  durationNights: 3,
  adults: 2,
  children: 0,
  infants: 0,
  salePrice: 700,
  proposalDate: '2026-11-11',
  depositAmount: 250,
  balanceDueDate: '2027-03-20',
  notIncluded: ['Taxa local de 34€ paga no hotel', 'Bagagem despachada'],
});

const restored = getQuoteDraft();
assert.ok(restored, 'o rascunho deve ser recuperado');
assert.equal(restored?.proposalDate, '2026-11-11', 'data da cotação preservada no rascunho');
assert.equal(restored?.depositAmount, 250, 'sinal preservado no rascunho');
assert.equal(restored?.balanceDueDate, '2027-03-20', 'data-limite do restante preservada no rascunho');
assert.deepEqual(
  restored?.notIncluded,
  ['Taxa local de 34€ paga no hotel', 'Bagagem despachada'],
  'lista de não incluídos preservada no rascunho'
);
clearQuoteDraft();
assert.equal(getQuoteDraft(), null, 'rascunho removido');
console.log('✅ Rascunho preserva os quatro campos');

// 2. Normalização da lista de não incluídos
assert.equal(NOT_INCLUDED_MAX_ITEMS, 3, 'limite de 3 linhas');
assert.equal(NOT_INCLUDED_MAX_LENGTH, 100, 'limite de 100 caracteres por linha');
assert.deepEqual(
  normalizeNotIncluded(['  Taxa local  ', '', '   ', 'Bagagem  ', 'Seguro', 'Linha excedente']),
  ['Taxa local', 'Bagagem', 'Seguro'],
  'trim, descarte de vazias e limite de 3 linhas'
);
assert.deepEqual(normalizeNotIncluded(undefined), [], 'entrada ausente vira lista vazia');
assert.deepEqual(normalizeNotIncluded('texto solto'), [], 'entrada inválida vira lista vazia');
const longLine = 'x'.repeat(150);
const longResult = normalizeNotIncluded([longLine]);
assert.equal(longResult.length, 1, 'linha longa não é descartada');
assert.equal(longResult[0].length, NOT_INCLUDED_MAX_LENGTH, 'linha longa é truncada em 100 caracteres');
console.log('✅ Normalização de notIncluded');

// 3. Sinal como número (aceita texto do formulário, rejeita inválidos)
assert.equal(parseDepositAmount(250), 250, 'número direto');
assert.equal(parseDepositAmount('250'), 250, 'texto numérico');
assert.equal(parseDepositAmount('250,555'), 250.56, 'vírgula decimal arredondada a 2 casas');
assert.equal(parseDepositAmount(0), 0, 'sinal zero é válido');
assert.equal(parseDepositAmount(-1), undefined, 'negativo é descartado');
assert.equal(parseDepositAmount('abc'), undefined, 'texto inválido é descartado');
assert.equal(parseDepositAmount(''), undefined, 'vazio é descartado');
assert.match(depositOverSalePriceWarning(800, 700) || '', /maior que o preço de venda/);
assert.equal(depositOverSalePriceWarning(250, 700), null, 'sinal dentro do preço não gera aviso');
console.log('✅ Sinal numérico e aviso não bloqueante');

// 4. Data da cotação com default a partir de created_at
assert.equal(
  resolveProposalDate(undefined, '2026-10-01T10:00:00Z'),
  '2026-10-01',
  'sem data no formulário, usa a data da cotação'
);
assert.equal(
  resolveProposalDate('', '2026-10-01T10:00:00Z'),
  '2026-10-01',
  'data vazia também cai no default'
);
assert.equal(
  resolveProposalDate('2026-11-11', '2026-10-01T10:00:00Z'),
  '2026-11-11',
  'data editada prevalece sobre created_at'
);
assert.equal(resolveProposalDate('2026-11-11', undefined), '2026-11-11', 'ISO válido sem created_at');
assert.match(resolveProposalDate(undefined, undefined), /^\d{4}-\d{2}-\d{2}$/, 'sem fontes, usa hoje em ISO');
console.log('✅ Default de proposalDate a partir de created_at');

// 5. Formatação para o detalhe
assert.equal(formatProposalDate('2026-11-11'), '11/11/2026', 'DD/MM/AAAA');
assert.equal(formatProposalDate(undefined), '', 'ausente vira string vazia');
assert.equal(formatBalanceDueDate('2027-03-20'), '20/03', 'DD/MM');
assert.equal(formatBalanceDueDate('2027-03-20T00:00:00Z'), '20/03', 'aceita ISO completo');
console.log('✅ Formatação DD/MM/AAAA e DD/MM');

console.log('\n🎉 TODOS OS TESTES DE CAMPOS DA COTAÇÃO PASSARAM!\n');
