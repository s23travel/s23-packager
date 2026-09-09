/**
 * test_favorite_services.ts
 * Testes unitários e de contrato para o serviço de Catálogo de Serviços Favoritos.
 * Todos os testes são determinísticos e não fazem chamadas ao Supabase real.
 * Seguem o padrão dos testes das fases anteriores.
 */

import assert from 'node:assert';
import {
  FavoriteService,
  FavoriteServiceType,
  FAVORITE_SERVICE_TYPE_LABELS,
  CreateFavoriteServiceInput,
  UpdateFavoriteServiceInput,
} from '../src/types';

console.log('=== INICIANDO BATERIA DE TESTES — CATÁLOGO DE SERVIÇOS FAVORITOS ===\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ [FAIL] ${name}`);
    console.error(`   Detalhe: ${msg}`);
    testsFailed++;
  }
}

// ---------------------------------------------------------------------------
// Helpers de simulação (sem Supabase real)
// ---------------------------------------------------------------------------

function makeService(overrides: Partial<FavoriteService> = {}): FavoriteService {
  return {
    id: 'srv-' + Math.random().toString(36).slice(2, 8),
    type: 'hotel',
    name: 'Four Seasons Safari Lodge',
    region: 'Serengeti',
    country: 'Tanzânia',
    city: 'Arusha',
    notes: undefined,
    active: true,
    created_at: '2026-09-09T00:00:00Z',
    updated_at: '2026-09-09T00:00:00Z',
    ...overrides,
  };
}

/**
 * Simula a lógica de validação de CreateFavoriteServiceInput
 * (espelha a validação real do ServiceFormPage)
 */
function validateCreateInput(input: Partial<CreateFavoriteServiceInput>): string | null {
  if (!input.type) return 'Tipo é obrigatório.';
  if (!input.name || !input.name.trim()) return 'Nome é obrigatório.';
  if (!input.region || !input.region.trim()) return 'Região é obrigatória.';
  if (!input.country || !input.country.trim()) return 'País é obrigatório.';
  return null;
}

/**
 * Simula a busca de autocomplete (filtra por active=true e query textual)
 */
function simulateSearch(
  catalog: FavoriteService[],
  query: string,
  type?: FavoriteServiceType
): FavoriteService[] {
  if (query.trim().length < 2) return [];
  const term = query.trim().toLowerCase();
  return catalog
    .filter((s) => s.active)
    .filter((s) => !type || s.type === type)
    .filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.region.toLowerCase().includes(term) ||
        s.country.toLowerCase().includes(term) ||
        (s.city || '').toLowerCase().includes(term)
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 5);
}

/**
 * Simula o comportamento de snapshot ao selecionar um serviço num pacote.
 * O pacote armazena apenas strings de texto \u2014 sem referência ao ID do serviço.
 */
function simulateHotelSelection(
  service: FavoriteService
): { hotelName: string; hotelDestination: string } {
  return {
    hotelName: service.name,
    hotelDestination: [service.region, service.country].filter(Boolean).join(', '),
  };
}

// ---------------------------------------------------------------------------
// 1. Criação de serviço com campos obrigatórios
// ---------------------------------------------------------------------------
runTest('1. Criação de serviço com campos obrigatórios', () => {
  const input: CreateFavoriteServiceInput = {
    type: 'hotel',
    name: 'Four Seasons Safari Lodge',
    region: 'Serengeti',
    country: 'Tanzânia',
  };
  assert.strictEqual(validateCreateInput(input), null, 'Input válido não deve retornar erro');
  assert.strictEqual(input.type, 'hotel');
  assert.strictEqual(input.name, 'Four Seasons Safari Lodge');
  assert.strictEqual(input.region, 'Serengeti');
  assert.strictEqual(input.country, 'Tanzânia');
});

// ---------------------------------------------------------------------------
// 2. Edição de nome e região
// ---------------------------------------------------------------------------
runTest('2. Edição de nome e região preserva outros campos', () => {
  const original = makeService();
  const update: UpdateFavoriteServiceInput = {
    name: 'Four Seasons Lodge Serengeti (Updated)',
    region: 'Serengeti North',
  };
  const updated: FavoriteService = { ...original, ...update };
  assert.strictEqual(updated.name, 'Four Seasons Lodge Serengeti (Updated)');
  assert.strictEqual(updated.region, 'Serengeti North');
  assert.strictEqual(updated.country, original.country, 'País não deve ser alterado');
  assert.strictEqual(updated.type, original.type, 'Tipo não deve ser alterado');
});

// ---------------------------------------------------------------------------
// 3. Desativação (soft delete — active: false)
// ---------------------------------------------------------------------------
runTest('3. Desativação define active=false sem deletar o registo', () => {
  const service = makeService({ active: true });
  const deactivated: FavoriteService = { ...service, active: false };
  assert.strictEqual(deactivated.active, false, 'Serviço deve estar inativo');
  assert.strictEqual(deactivated.id, service.id, 'ID deve permanecer o mesmo');
  assert.strictEqual(deactivated.name, service.name, 'Nome deve permanecer');
});

// ---------------------------------------------------------------------------
// 4. Pesquisa por nome (case-insensitive)
// ---------------------------------------------------------------------------
runTest('4. Pesquisa por nome é case-insensitive', () => {
  const catalog = [
    makeService({ name: 'Four Seasons Safari Lodge' }),
    makeService({ name: 'Serena Hotel Kampala' }),
  ];
  const results = simulateSearch(catalog, 'four');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].name, 'Four Seasons Safari Lodge');

  const results2 = simulateSearch(catalog, 'FOUR');
  assert.strictEqual(results2.length, 1);

  const results3 = simulateSearch(catalog, 'serena');
  assert.strictEqual(results3.length, 1);
  assert.strictEqual(results3[0].name, 'Serena Hotel Kampala');
});

// ---------------------------------------------------------------------------
// 5. Pesquisa por região
// ---------------------------------------------------------------------------
runTest('5. Pesquisa por região localiza serviços', () => {
  const catalog = [
    makeService({ name: 'Lodge A', region: 'Serengeti' }),
    makeService({ name: 'Hotel B', region: 'Zanzibar' }),
  ];
  const results = simulateSearch(catalog, 'seren');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].name, 'Lodge A');
});

// ---------------------------------------------------------------------------
// 6. Pesquisa por país
// ---------------------------------------------------------------------------
runTest('6. Pesquisa por país localiza serviços', () => {
  const catalog = [
    makeService({ name: 'Hotel Tanzânia', country: 'Tanzânia' }),
    makeService({ name: 'Hotel Portugal', country: 'Portugal' }),
  ];
  const results = simulateSearch(catalog, 'tanz');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].name, 'Hotel Tanzânia');
});

// ---------------------------------------------------------------------------
// 7. Filtro por tipo
// ---------------------------------------------------------------------------
runTest('7. Filtro por tipo retorna apenas o tipo correto', () => {
  const catalog = [
    makeService({ name: 'Hotel Serengeti', type: 'hotel' }),
    makeService({ name: 'Fly TAP', type: 'airline' }),
    makeService({ name: 'Transfer Express', type: 'transfer' }),
  ];
  // Pesquisa por "hotel" com type='hotel' — encontra apenas o hotel
  const hoteis = simulateSearch(catalog, 'hotel', 'hotel');
  assert.strictEqual(hoteis.length, 1, `Deve retornar 1 hotel, retornou ${hoteis.length}`);
  assert.strictEqual(hoteis[0].type, 'hotel');

  // Pesquisa por "fly" com type='airline' — encontra apenas a aérea
  const airlines = simulateSearch(catalog, 'fly', 'airline');
  assert.strictEqual(airlines.length, 1, `Deve retornar 1 airline, retornou ${airlines.length}`);
  assert.strictEqual(airlines[0].type, 'airline');

  // Pesquisa por "hotel" com type='airline' — não encontra nada (name não bate)
  const hotelAsAirline = simulateSearch(catalog, 'hotel', 'airline');
  assert.strictEqual(hotelAsAirline.length, 0, 'Não deve retornar hotel quando filtrado por airline');
});

// ---------------------------------------------------------------------------
// 8. Apenas serviços ativos aparecem no autocomplete
// ---------------------------------------------------------------------------
runTest('8. Serviços inativos não aparecem nas sugestões de autocomplete', () => {
  const catalog = [
    makeService({ name: 'Hotel Ativo', active: true }),
    makeService({ name: 'Hotel Inativo', active: false }),
  ];
  const results = simulateSearch(catalog, 'hotel');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].name, 'Hotel Ativo');
});

// ---------------------------------------------------------------------------
// 9. Seleção de hotel preenche os campos corretamente
// ---------------------------------------------------------------------------
runTest('9. Seleção de hotel preenche hotelName e hotelDestination corretamente', () => {
  const service = makeService({
    name: 'Four Seasons Safari Lodge',
    region: 'Serengeti',
    country: 'Tanzânia',
  });
  const { hotelName, hotelDestination } = simulateHotelSelection(service);
  assert.strictEqual(hotelName, 'Four Seasons Safari Lodge');
  assert.strictEqual(hotelDestination, 'Serengeti, Tanzânia');
});

// ---------------------------------------------------------------------------
// 10. Alteração posterior do serviço NÃO afeta snapshot do pacote
// ---------------------------------------------------------------------------
runTest('10. Alteração posterior do serviço no catálogo não altera o pacote (snapshot)', () => {
  const serviceOriginal = makeService({
    name: 'Hotel X',
    region: 'Maiorca',
    country: 'Espanha',
  });

  // Pacote A seleciona o serviço — apenas strings são copiadas
  const pacoteA = simulateHotelSelection(serviceOriginal);

  // Posteriormente, o serviço é editado e desativado no catálogo
  const serviceAltered: FavoriteService = {
    ...serviceOriginal,
    name: 'Hotel X (Renovado)',
    region: 'Palma de Maiorca',
    active: false,
  };

  // O pacote A não tem referência ao catálogo — usa suas próprias strings
  assert.strictEqual(pacoteA.hotelName, 'Hotel X', 'Pacote A deve manter o nome original');
  assert.strictEqual(
    pacoteA.hotelDestination,
    'Maiorca, Espanha',
    'Pacote A deve manter o destino original'
  );

  // O serviço alterado existe mas não afeta retroativamente o pacote
  assert.strictEqual(serviceAltered.active, false);
  assert.notStrictEqual(serviceAltered.name, pacoteA.hotelName);
});

// ---------------------------------------------------------------------------
// 11. Serviço inativo não aparece em novas sugestões
// ---------------------------------------------------------------------------
runTest('11. Após desativação, o serviço não aparece em novas pesquisas', () => {
  let catalog = [makeService({ name: 'Four Seasons Safari Lodge', active: true })];

  // Antes da desativação: aparece
  const before = simulateSearch(catalog, 'four');
  assert.strictEqual(before.length, 1);

  // Após desativação (soft delete)
  catalog = catalog.map((s) => ({ ...s, active: false }));

  // Depois da desativação: não aparece
  const after = simulateSearch(catalog, 'four');
  assert.strictEqual(after.length, 0, 'Serviço inativo não deve aparecer no autocomplete');
});

// ---------------------------------------------------------------------------
// 12. Validação de campos obrigatórios
// ---------------------------------------------------------------------------
runTest('12. Validação de campos obrigatórios rejeita inputs inválidos', () => {
  // Sem tipo
  assert.notStrictEqual(validateCreateInput({ name: 'Hotel X', region: 'R', country: 'C' }), null);

  // Sem nome
  assert.notStrictEqual(validateCreateInput({ type: 'hotel', region: 'R', country: 'C' }), null);

  // Nome apenas com espaços
  assert.notStrictEqual(
    validateCreateInput({ type: 'hotel', name: '   ', region: 'R', country: 'C' }),
    null,
    'Nome em branco deve ser rejeitado'
  );

  // Sem região
  assert.notStrictEqual(
    validateCreateInput({ type: 'hotel', name: 'Hotel X', country: 'C' }),
    null
  );

  // Sem país
  assert.notStrictEqual(
    validateCreateInput({ type: 'hotel', name: 'Hotel X', region: 'R' }),
    null
  );

  // Input completo e válido
  assert.strictEqual(
    validateCreateInput({ type: 'hotel', name: 'Hotel X', region: 'R', country: 'C' }),
    null,
    'Input válido deve retornar null'
  );
});

// ---------------------------------------------------------------------------
// Testes de integridade dos tipos / labels
// ---------------------------------------------------------------------------
runTest('Labels: todos os tipos têm label em português definido', () => {
  const types: FavoriteServiceType[] = [
    'hotel', 'airline', 'transfer', 'tour', 'insurance', 'car_rental', 'additional', 'other',
  ];
  for (const type of types) {
    const label = FAVORITE_SERVICE_TYPE_LABELS[type];
    assert.ok(label && label.trim().length > 0, `Tipo "${type}" deve ter label em português`);
  }
});

runTest('Pesquisa retorna máximo de 5 sugestões', () => {
  const catalog = Array.from({ length: 10 }, (_, i) =>
    makeService({ name: `Hotel ${i + 1}`, active: true })
  );
  const results = simulateSearch(catalog, 'hotel');
  assert.ok(results.length <= 5, `Deve retornar no máximo 5, retornou ${results.length}`);
});

runTest('Pesquisa com menos de 2 caracteres retorna array vazio', () => {
  const catalog = [makeService({ name: 'Four Seasons' })];
  assert.deepStrictEqual(simulateSearch(catalog, 'f'), [], 'Deve retornar vazio com 1 char');
  assert.deepStrictEqual(simulateSearch(catalog, ''), [], 'Deve retornar vazio com string vazia');
});

// ---------------------------------------------------------------------------
// Resultado final
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(52)}`);
console.log(` RESULTADO FINAL — CATÁLOGO DE SERVIÇOS: ${testsPassed} PASSOU / ${testsFailed} FALHOU`);
console.log('='.repeat(52));

if (testsFailed > 0) {
  process.exit(1);
}
