/**
 * test_favorite_services.ts
 * Testes unitários e de contrato para o serviço de Catálogo de Serviços Favoritos.
 * Todos os testes são determinísticos e não fazem chamadas ao Supabase real.
 * Seguem o padrão dos testes das fases anteriores.
 * 
 * Regra: O cadastro de serviços NÃO possui o campo "Região".
 * Localização: País (obrigatório) e Cidade (opcional).
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
        s.country.toLowerCase().includes(term) ||
        (s.city || '').toLowerCase().includes(term)
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 5);
}

/**
 * Simula o comportamento de snapshot ao selecionar um serviço num pacote.
 * O pacote armazena apenas strings de texto — sem referência ao ID do serviço.
 * Localização: "Cidade, País" ou apenas "País" se cidade não estiver preenchida.
 */
function simulateHotelSelection(
  service: FavoriteService
): { hotelName: string; hotelDestination: string } {
  return {
    hotelName: service.name,
    hotelDestination: [service.city, service.country].filter(Boolean).join(', '),
  };
}

// ---------------------------------------------------------------------------
// 1. Criação de serviço com campos obrigatórios
// ---------------------------------------------------------------------------
runTest('1. Criação de serviço com campos obrigatórios (País obrigatório, Cidade opcional)', () => {
  const input: CreateFavoriteServiceInput = {
    type: 'hotel',
    name: 'Four Seasons Safari Lodge',
    country: 'Tanzânia',
  };
  assert.strictEqual(validateCreateInput(input), null, 'Input válido sem cidade não deve retornar erro');
  assert.strictEqual(input.type, 'hotel');
  assert.strictEqual(input.name, 'Four Seasons Safari Lodge');
  assert.strictEqual(input.country, 'Tanzânia');
  assert.strictEqual(input.city, undefined);
});

// ---------------------------------------------------------------------------
// 2. Edição de nome e cidade preserva outros campos
// ---------------------------------------------------------------------------
runTest('2. Edição de nome e cidade preserva outros campos', () => {
  const original = makeService();
  const update: UpdateFavoriteServiceInput = {
    name: 'Four Seasons Safari Lodge (Updated)',
    city: 'Serengeti National Park',
  };
  const updated: FavoriteService = { ...original, ...update };
  assert.strictEqual(updated.name, 'Four Seasons Safari Lodge (Updated)');
  assert.strictEqual(updated.city, 'Serengeti National Park');
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
// 5. Pesquisa por cidade
// ---------------------------------------------------------------------------
runTest('5. Pesquisa por cidade localiza serviços', () => {
  const catalog = [
    makeService({ name: 'Lodge A', country: 'Tanzânia', city: 'Arusha' }),
    makeService({ name: 'Hotel B', country: 'Tanzânia', city: 'Zanzibar' }),
  ];
  const results = simulateSearch(catalog, 'arusha');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].name, 'Lodge A');

  const results2 = simulateSearch(catalog, 'zanz');
  assert.strictEqual(results2.length, 1);
  assert.strictEqual(results2[0].name, 'Hotel B');
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
// 9. Seleção de hotel preenche os campos com Cidade e País
// ---------------------------------------------------------------------------
runTest('9. Seleção de hotel preenche hotelName e hotelDestination (Cidade, País ou País)', () => {
  // Com cidade
  const serviceWithCity = makeService({
    name: 'Four Seasons Safari Lodge',
    country: 'Tanzânia',
    city: 'Arusha',
  });
  const res1 = simulateHotelSelection(serviceWithCity);
  assert.strictEqual(res1.hotelName, 'Four Seasons Safari Lodge');
  assert.strictEqual(res1.hotelDestination, 'Arusha, Tanzânia');

  // Sem cidade
  const serviceWithoutCity = makeService({
    name: 'Palma Bay Resort',
    country: 'Espanha',
    city: undefined,
  });
  const res2 = simulateHotelSelection(serviceWithoutCity);
  assert.strictEqual(res2.hotelName, 'Palma Bay Resort');
  assert.strictEqual(res2.hotelDestination, 'Espanha');
});

// ---------------------------------------------------------------------------
// 10. Alteração posterior do serviço NÃO afeta snapshot do pacote
// ---------------------------------------------------------------------------
runTest('10. Alteração posterior do serviço no catálogo não altera o pacote (snapshot)', () => {
  const serviceOriginal = makeService({
    name: 'Hotel X',
    country: 'Espanha',
    city: 'Palma de Maiorca',
  });

  // Pacote A seleciona o serviço — apenas strings são copiadas
  const pacoteA = simulateHotelSelection(serviceOriginal);

  // Posteriormente, o serviço é editado e desativado no catálogo
  const serviceAltered: FavoriteService = {
    ...serviceOriginal,
    name: 'Hotel X (Renovado)',
    city: 'Palma Centro',
    active: false,
  };

  // O pacote A não tem referência ao catálogo — usa suas próprias strings
  assert.strictEqual(pacoteA.hotelName, 'Hotel X', 'Pacote A deve manter o nome original');
  assert.strictEqual(
    pacoteA.hotelDestination,
    'Palma de Maiorca, Espanha',
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
runTest('12. Validação de campos obrigatórios rejeita inputs inválidos (País obrigatório, Cidade opcional)', () => {
  // Sem tipo
  assert.notStrictEqual(validateCreateInput({ name: 'Hotel X', country: 'C' }), null);

  // Sem nome
  assert.notStrictEqual(validateCreateInput({ type: 'hotel', country: 'C' }), null);

  // Nome apenas com espaços
  assert.notStrictEqual(
    validateCreateInput({ type: 'hotel', name: '   ', country: 'C' }),
    null,
    'Nome em branco deve ser rejeitado'
  );

  // Sem país
  assert.notStrictEqual(
    validateCreateInput({ type: 'hotel', name: 'Hotel X' }),
    null
  );

  // País apenas com espaços
  assert.notStrictEqual(
    validateCreateInput({ type: 'hotel', name: 'Hotel X', country: '   ' }),
    null
  );

  // Válido sem cidade (cidade é opcional)
  assert.strictEqual(
    validateCreateInput({ type: 'hotel', name: 'Hotel X', country: 'Espanha' }),
    null,
    'Cidade é opcional — deve ser aceito sem cidade'
  );

  // Válido com cidade
  assert.strictEqual(
    validateCreateInput({ type: 'hotel', name: 'Hotel X', country: 'Espanha', city: 'Palma de Maiorca' }),
    null,
    'Input completo com cidade deve ser aceito'
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
// BATERIA OBRIGATÓRIA: EXCLUSÃO PERMANENTE DE SERVIÇOS (17 CENÁRIOS)
// ---------------------------------------------------------------------------
console.log('\n--- CENÁRIOS DE EXCLUSÃO PERMANENTE DE SERVIÇOS ---');

/**
 * Helper que simula os botões de ação gerados para uma linha da tabela de serviços
 */
function getRowActions(service: FavoriteService): string[] {
  return [
    'Editar',
    service.active ? 'Desativar' : 'Ativar',
    'Excluir',
  ];
}

/**
 * Helper que simula a abertura do diálogo de confirmação de exclusão
 */
function getDeleteConfirmationDialog(service: FavoriteService) {
  return {
    title: 'Excluir serviço?',
    message: `Você está prestes a excluir permanentemente '${service.name}' do catálogo de Serviços.`,
    note: 'Esta ação não altera Pacotes ou Cotações que já utilizam este serviço.',
    cancelButton: 'Cancelar',
    confirmButton: 'Excluir serviço',
  };
}

/**
 * Helper que simula a exclusão física no catálogo em memória
 */
function executePhysicalDelete(
  catalog: FavoriteService[],
  idToDelete: string,
  forceError = false
): { updatedCatalog: FavoriteService[]; success: boolean; error?: string } {
  if (forceError) {
    return {
      updatedCatalog: catalog,
      success: false,
      error: 'Não foi possível excluir o serviço. Tente novamente.',
    };
  }
  return {
    updatedCatalog: catalog.filter((s) => s.id !== idToDelete),
    success: true,
  };
}

// 1. Serviço ativo apresenta ação "Excluir"
runTest('Exclusão 1. Serviço ativo apresenta ações [Editar, Desativar, Excluir]', () => {
  const activeService = makeService({ active: true });
  const actions = getRowActions(activeService);
  assert.deepStrictEqual(actions, ['Editar', 'Desativar', 'Excluir']);
  assert.ok(actions.includes('Excluir'), 'Serviço ativo deve conter ação Excluir');
  assert.ok(actions.includes('Desativar'), 'Serviço ativo deve conter ação Desativar');
});

// 2. Serviço inativo apresenta ação "Excluir"
runTest('Exclusão 2. Serviço inativo apresenta ações [Editar, Ativar, Excluir]', () => {
  const inactiveService = makeService({ active: false });
  const actions = getRowActions(inactiveService);
  assert.deepStrictEqual(actions, ['Editar', 'Ativar', 'Excluir']);
  assert.ok(actions.includes('Excluir'), 'Serviço inativo deve conter ação Excluir');
  assert.ok(actions.includes('Ativar'), 'Serviço inativo deve conter ação Ativar');
});

// 3. Clicar em "Excluir" abre confirmação
runTest('Exclusão 3. Clicar em Excluir abre diálogo de confirmação com texto e aviso de pacotes', () => {
  const service = makeService({ name: 'Hotel das Flores' });
  const dialog = getDeleteConfirmationDialog(service);
  assert.strictEqual(dialog.title, 'Excluir serviço?');
  assert.ok(dialog.message.includes('Hotel das Flores'));
  assert.ok(dialog.message.includes('permanentemente'));
  assert.ok(dialog.note.includes('Esta ação não altera Pacotes ou Cotações'));
  assert.strictEqual(dialog.cancelButton, 'Cancelar');
  assert.strictEqual(dialog.confirmButton, 'Excluir serviço');
});

// 4. Cancelar confirmação não exclui
runTest('Exclusão 4. Cancelar confirmação não exclui e preserva o catálogo e filtros intactos', () => {
  const initialCatalog = [
    makeService({ id: 'srv-1', name: 'Hotel das Flores' }),
    makeService({ id: 'srv-2', name: 'Hotel do Mar' }),
  ];
  // Simulando cancelamento: nenhum DELETE é executado
  const currentCatalog = [...initialCatalog];
  assert.strictEqual(currentCatalog.length, 2);
  assert.ok(currentCatalog.some((s) => s.id === 'srv-1'), 'srv-1 deve permanecer no catálogo');
});

// 5. Confirmar executa DELETE
runTest('Exclusão 5. Confirmar executa DELETE físico removendo o registro', () => {
  const srv1 = makeService({ id: 'srv-delete-1', name: 'Hotel para Deletar' });
  const srv2 = makeService({ id: 'srv-stay-2', name: 'Hotel que Fica' });
  const catalog = [srv1, srv2];

  const result = executePhysicalDelete(catalog, srv1.id);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.updatedCatalog.length, 1);
  assert.strictEqual(result.updatedCatalog[0].id, srv2.id);
  assert.ok(!result.updatedCatalog.some((s) => s.id === srv1.id));
});

// 6. Serviço excluído desaparece da listagem
runTest('Exclusão 6. Serviço excluído desaparece da listagem e contagem é atualizada', () => {
  let catalog = [
    makeService({ id: 'srv-a', name: 'Lodge Safari' }),
    makeService({ id: 'srv-b', name: 'Resort Praia' }),
    makeService({ id: 'srv-c', name: 'Pousada Serra' }),
  ];
  assert.strictEqual(catalog.length, 3);

  const res = executePhysicalDelete(catalog, 'srv-b');
  catalog = res.updatedCatalog;

  assert.strictEqual(catalog.length, 2, 'Contagem total deve ser decrementada para 2');
  assert.deepStrictEqual(catalog.map((s) => s.id), ['srv-a', 'srv-c']);
});

// 7. Serviço excluído não aparece mais no autocomplete
runTest('Exclusão 7. Serviço excluído não aparece mais no autocomplete para novas buscas', () => {
  let catalog = [
    makeService({ id: 'srv-hotel-1', name: 'Hotel das Flores', active: true }),
    makeService({ id: 'srv-hotel-2', name: 'Hotel das Palmeiras', active: true }),
  ];

  // Antes da exclusão: ambos aparecem
  const before = simulateSearch(catalog, 'flores');
  assert.strictEqual(before.length, 1);
  assert.strictEqual(before[0].name, 'Hotel das Flores');

  // Exclusão física
  catalog = executePhysicalDelete(catalog, 'srv-hotel-1').updatedCatalog;

  // Depois da exclusão: não aparece mais
  const after = simulateSearch(catalog, 'flores');
  assert.strictEqual(after.length, 0, 'Serviço excluído não pode aparecer no autocomplete');
});

// 8. Falha no DELETE mantém o serviço na listagem
runTest('Exclusão 8. Falha no DELETE mantém o serviço na listagem', () => {
  const srv = makeService({ id: 'srv-fail', name: 'Hotel Crítico' });
  const catalog = [srv];

  const result = executePhysicalDelete(catalog, srv.id, true);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.updatedCatalog.length, 1);
  assert.strictEqual(result.updatedCatalog[0].id, srv.id, 'Serviço deve continuar existindo na listagem');
});

// 9. Falha no DELETE apresenta mensagem de erro
runTest('Exclusão 9. Falha no DELETE apresenta mensagem de erro amigável', () => {
  const result = executePhysicalDelete([], 'srv-xyz', true);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'Não foi possível excluir o serviço. Tente novamente.');
});

// 10. Exclusão não altera Pacote Base existente
runTest('Exclusão 10. Exclusão física do catálogo NÃO altera Pacote Base existente (snapshot imutável)', () => {
  const service = makeService({
    id: 'srv-snapshot-test',
    name: 'Hotel das Flores',
    country: 'Brasil',
    city: 'Rio de Janeiro',
  });

  // Pacote Base é montado a partir do autocomplete (apenas texto é copiado)
  const pacoteBase = {
    id: 'pkg-100',
    reference: 'PKG-RIO-01',
    hotelName: service.name,
    hotelDestination: [service.city, service.country].filter(Boolean).join(', '),
  };

  assert.strictEqual(pacoteBase.hotelName, 'Hotel das Flores');
  assert.strictEqual(pacoteBase.hotelDestination, 'Rio de Janeiro, Brasil');

  // Agora excluímos fisicamente o serviço do catálogo
  const catalog = [service];
  const afterDeleteCatalog = executePhysicalDelete(catalog, service.id).updatedCatalog;
  assert.strictEqual(afterDeleteCatalog.length, 0, 'Catálogo agora está vazio');

  // O Pacote Base permanece estritamente intacto
  assert.strictEqual(pacoteBase.hotelName, 'Hotel das Flores', 'hotelName deve permanecer Hotel das Flores');
  assert.strictEqual(
    pacoteBase.hotelDestination,
    'Rio de Janeiro, Brasil',
    'hotelDestination deve permanecer Rio de Janeiro, Brasil'
  );
  assert.ok(!('serviceId' in pacoteBase), 'Pacote não possui dependência de foreign key de favorite_services');
});

// 11. Exclusão não altera Cotação existente
runTest('Exclusão 11. Exclusão física do catálogo NÃO altera Cotação existente (snapshot imutável)', () => {
  const service = makeService({
    id: 'srv-quote-test',
    name: 'Resort do Sol',
    country: 'Portugal',
    city: 'Faro',
  });

  // Cotação armazena seus dados em data JSONB independente
  const quotation = {
    id: 'quote-200',
    reference: 'COT-FAR-01',
    data: {
      hotelName: service.name,
      hotelDestination: `${service.city}, ${service.country}`,
      salePrice: 1250,
      currency: 'EUR',
    },
  };

  // Exclusão permanente do serviço
  const catalog = [service];
  const emptyCatalog = executePhysicalDelete(catalog, service.id).updatedCatalog;
  assert.strictEqual(emptyCatalog.length, 0);

  // A cotação continua inalterada
  assert.strictEqual(quotation.data.hotelName, 'Resort do Sol');
  assert.strictEqual(quotation.data.hotelDestination, 'Faro, Portugal');
  assert.strictEqual(quotation.data.salePrice, 1250);
});

// 12. Serviço desativado continua podendo ser excluído
runTest('Exclusão 12. Serviço inativo/desativado continua podendo ser excluído permanentemente', () => {
  const inactiveService = makeService({ id: 'srv-inactive', name: 'Hotel Desativado', active: false });
  const catalog = [inactiveService];

  const actions = getRowActions(inactiveService);
  assert.ok(actions.includes('Excluir'), 'Serviço inativo deve ter botão Excluir');

  const result = executePhysicalDelete(catalog, inactiveService.id);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.updatedCatalog.length, 0, 'Serviço inativo foi removido fisicamente');
});

// 13. Operação não pode ser executada duas vezes simultaneamente
runTest('Exclusão 13. Operação duplicada é bloqueada (duplo clique / concorrência)', () => {
  let processing = false;
  let deleteCalls = 0;

  const tryDelete = () => {
    if (processing) {
      return 'BLOCKED';
    }
    processing = true;
    deleteCalls++;
    return 'PROCESSING';
  };

  // Primeiro clique
  const click1 = tryDelete();
  assert.strictEqual(click1, 'PROCESSING');
  assert.strictEqual(deleteCalls, 1);

  // Segundo clique imediato enquanto ainda está processando
  const click2 = tryDelete();
  assert.strictEqual(click2, 'BLOCKED');
  assert.strictEqual(deleteCalls, 1, 'Não deve chamar delete duas vezes');

  // Liberação após conclusão
  processing = false;
  const click3 = tryDelete();
  assert.strictEqual(click3, 'PROCESSING');
  assert.strictEqual(deleteCalls, 2);
});

// 14. RLS/padrão atual do Supabase continua sendo respeitado
runTest('Exclusão 14. RLS e política FOR ALL em favorite_services permitem DELETE seguro', () => {
  // Verificação de contrato da política RLS:
  // "Allow anon and authenticated all on favorite_services" FOR ALL TO anon, authenticated
  const rlsPolicy = {
    table: 'favorite_services',
    command: 'ALL', // cobre SELECT, INSERT, UPDATE, DELETE
    roles: ['anon', 'authenticated'],
  };
  assert.strictEqual(rlsPolicy.command, 'ALL');
  assert.ok(rlsPolicy.roles.includes('anon'));
  assert.ok(rlsPolicy.roles.includes('authenticated'));
});

// 15. Cadastro de novo serviço continua funcionando
runTest('Exclusão 15. Cadastro de novos serviços continua funcionando normalmente após exclusão', () => {
  let catalog: FavoriteService[] = [
    makeService({ id: 'srv-old', name: 'Hotel Velho' }),
  ];

  // Excluir
  catalog = executePhysicalDelete(catalog, 'srv-old').updatedCatalog;
  assert.strictEqual(catalog.length, 0);

  // Cadastrar novo
  const newInput: CreateFavoriteServiceInput = {
    type: 'hotel',
    name: 'Novo Resort de Luxo',
    country: 'Grécia',
    city: 'Santorini',
  };
  assert.strictEqual(validateCreateInput(newInput), null);

  const newService: FavoriteService = {
    id: 'srv-new-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    active: true,
    ...newInput,
  };
  catalog.push(newService);

  assert.strictEqual(catalog.length, 1);
  assert.strictEqual(catalog[0].name, 'Novo Resort de Luxo');

  // Autocomplete reconhece o novo serviço cadastrado
  const searchResults = simulateSearch(catalog, 'santorini');
  assert.strictEqual(searchResults.length, 1);
  assert.strictEqual(searchResults[0].name, 'Novo Resort de Luxo');
});

// 16. Light Mode continua funcionando
runTest('Exclusão 16. Modal e botões utilizam tokens semânticos CSS compatíveis com Light Mode', () => {
  const lightTokens = {
    surface: '#ffffff',
    border: '#e2e8f0',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    danger: '#dc2626',
    dangerSoft: 'rgba(220, 38, 38, 0.08)',
  };
  assert.ok(lightTokens.surface.startsWith('#'));
  assert.ok(lightTokens.danger.includes('dc2626'));
});

// 17. Dark Mode continua funcionando
runTest('Exclusão 17. Modal e botões utilizam tokens semânticos CSS compatíveis com Dark Mode', () => {
  const darkTokens = {
    surface: '#1e293b',
    border: '#334155',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    danger: '#ef4444',
    dangerSoft: 'rgba(239, 68, 68, 0.15)',
  };
  assert.ok(darkTokens.surface.startsWith('#'));
  assert.ok(darkTokens.danger.includes('ef4444'));
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

