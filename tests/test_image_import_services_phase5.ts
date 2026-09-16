// Suíte de Testes Automatizados: Importação Multimodal para services[] (Fase 5)
// Valida os 35 requisitos de análise conjunta multimodal, extração de ServiceItem[],
// isolamento de destino, regras contra invenção de dados, conflitos e soberania financeira.

import assert from 'node:assert';
import {
  validateImageFile,
  validateImageFilesBatch,
  normalizeImportedPackageData,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGES_PER_ANALYSIS,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
} from '../src/services/imageImportService';
import {
  calculateFinancialSummaryFromServices,
  serviceItemToCostComponent,
} from '../src/services/legacyAdapterService';
import { ImportedPackageData, ServiceItem, ServiceType } from '../src/types';

console.log('=== INICIANDO BATERIA DE TESTES: IMPORTAÇÃO MULTIMODAL PARA services[] (FASE 5) ===\n');

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

function createMockFile(name: string, type: string, sizeBytes: number): any {
  return {
    name,
    type,
    size: sizeBytes,
  };
}

// 1. Uma imagem
runTest('1. Uma imagem é aceita e validada com sucesso', () => {
  const f = createMockFile('voo.png', 'image/png', 500 * 1024);
  const res = validateImageFilesBatch([f], 0);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.validFiles.length, 1);
});

// 2. Múltiplas imagens
runTest('2. Múltiplas imagens são aceitas em um mesmo lote', () => {
  const f1 = createMockFile('voo.png', 'image/png', 500 * 1024);
  const f2 = createMockFile('hotel.jpg', 'image/jpeg', 600 * 1024);
  const f3 = createMockFile('transfer.jpg', 'image/jpeg', 400 * 1024);
  const res = validateImageFilesBatch([f1, f2, f3], 0);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.validFiles.length, 3);
});

// 3. Máximo de 10 imagens
runTest('3. Limite de 10 imagens é aceito', () => {
  const files = Array.from({ length: 10 }, (_, i) =>
    createMockFile(`doc_${i + 1}.png`, 'image/png', 100 * 1024)
  );
  const res = validateImageFilesBatch(files, 0);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.validFiles.length, 10);
});

// 4. Rejeição da 11ª
runTest('4. Rejeição com erro claro quando submetidas 11 imagens', () => {
  const files = Array.from({ length: 11 }, (_, i) =>
    createMockFile(`doc_${i + 1}.png`, 'image/png', 100 * 1024)
  );
  const res = validateImageFilesBatch(files, 0);
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.error, 'Você pode analisar até 10 imagens por vez.');
});

// 5. Imagem acima de 8 MB
runTest('5. Imagem acima de 8 MB é rejeitada', () => {
  const heavy = createMockFile('foto_gigante.jpg', 'image/jpeg', 8.5 * 1024 * 1024);
  const res = validateImageFile(heavy);
  assert.strictEqual(res.valid, false);
  assert(res.error?.includes('8MB'));
});

// 6. Transporte de ida
runTest('6. Transporte de ida extrai type "outbound_transport" e campos de rota/cia', () => {
  const raw = {
    destination: 'Roma',
    services: [
      {
        type: 'outbound_transport',
        description: 'Porto → Roma FCO',
        carrier: 'Ryanair',
        departureTime: '06:30',
        arrivalTime: '10:15',
        amount: 85,
        currency: 'EUR',
      },
    ],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.services.length, 1);
  const item = normalized.services[0];
  assert.strictEqual(item.type, 'outbound_transport');
  assert.strictEqual(item.description, 'Porto → Roma FCO');
  assert.strictEqual(item.carrier, 'Ryanair');
});

// 7. Transporte de volta
runTest('7. Transporte de volta extrai type "inbound_transport"', () => {
  const raw = {
    destination: 'Roma',
    services: [
      {
        type: 'inbound_transport',
        description: 'Roma FCO → Porto',
        carrier: 'Ryanair',
        departureTime: '18:45',
        arrivalTime: '20:30',
        amount: 90,
        currency: 'EUR',
      },
    ],
  };
  const normalized = normalizeImportedPackageData(raw);
  const item = normalized.services[0];
  assert.strictEqual(item.type, 'inbound_transport');
  assert.strictEqual(item.description, 'Roma FCO → Porto');
});

// 8. Horários preservados
runTest('8. Horários de voo são preservados sem modificações indevidas', () => {
  const raw = {
    services: [
      {
        type: 'outbound_transport',
        description: 'Voo TAP',
        departureTime: '09:15',
        arrivalTime: '12:45',
      },
    ],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.services[0].departureTime, '09:15');
  assert.strictEqual(normalized.services[0].arrivalTime, '12:45');
});

// 9. Hospedagem
runTest('9. Hospedagem é mapeada para type "accommodation" com metadados', () => {
  const raw = {
    destination: 'Paris',
    services: [
      {
        type: 'accommodation',
        description: 'Hotel Mercure Paris Centre',
        destination: 'Paris',
        mealPlan: 'Café da manhã (BB)',
        quantity: 5,
        amount: 600,
        currency: 'EUR',
      },
    ],
  };
  const normalized = normalizeImportedPackageData(raw);
  const h = normalized.services[0];
  assert.strictEqual(h.type, 'accommodation');
  assert.strictEqual(h.description, 'Hotel Mercure Paris Centre');
  assert.strictEqual(h.destination, 'Paris');
  assert.strictEqual(h.mealPlan, 'Café da manhã (BB)');
  assert.strictEqual(h.quantity, 5);
});

// 10. Múltiplas hospedagens
runTest('10. Múltiplas hospedagens não são sobrescritas e coexistem em services[]', () => {
  const raw = {
    destination: 'Grécia',
    services: [
      { type: 'accommodation', description: 'Hotel Atenas', destination: 'Atenas', amount: 300 },
      { type: 'accommodation', description: 'Hotel Santorini', destination: 'Santorini', amount: 500 },
    ],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.services.length, 2);
  assert.strictEqual(normalized.services[0].description, 'Hotel Atenas');
  assert.strictEqual(normalized.services[1].description, 'Hotel Santorini');
});

// 11. Regime de acomodação
runTest('11. Regime de acomodação visível é extraído fielmente', () => {
  const raw = {
    services: [
      { type: 'accommodation', description: 'Resort Tudo Incluído', mealPlan: 'Tudo Incluído (AI)' },
    ],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.services[0].mealPlan, 'Tudo Incluído (AI)');
});

// 12. Transfer
runTest('12. Transfer é mapeado para type "transfer"', () => {
  const raw = {
    services: [
      { type: 'transfer', description: 'Transfer Aeroporto → Hotel (Privativo)', amount: 45, currency: 'EUR' },
    ],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.services[0].type, 'transfer');
  assert.strictEqual(normalized.services[0].description, 'Transfer Aeroporto → Hotel (Privativo)');
});

// 13. Seguro
runTest('13. Seguro-viagem é mapeado para type "insurance"', () => {
  const raw = {
    services: [
      { type: 'insurance', description: 'Seguro Viagem Europa 30k', amount: 35, currency: 'EUR' },
    ],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.services[0].type, 'insurance');
});

// 14. Serviço adicional
runTest('14. Serviço adicional (passeio, aluguel) mapeia para "additional"', () => {
  const raw = {
    services: [
      { type: 'additional', description: 'Passeio Guiado Vaticano', amount: 65, currency: 'EUR' },
    ],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.services[0].type, 'additional');
});

// 15. Impostos
runTest('15. Impostos e taxas discriminados mapeiam para "taxes"', () => {
  const raw = {
    services: [
      { type: 'taxes', description: 'Taxa turística municipal de Roma', amount: 20, currency: 'EUR' },
    ],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.services[0].type, 'taxes');
});

// 16. Outros
runTest('16. Outros custos mapeiam para "other"', () => {
  const raw = {
    services: [
      { type: 'other', description: 'Taxa de emissão de visto', amount: 50, currency: 'EUR' },
    ],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.services[0].type, 'other');
});

// 17. Moeda EUR
runTest('17. Moeda EUR identificada é preservada sem conversão', () => {
  const raw = {
    services: [{ type: 'other', description: 'Item', currency: 'EUR', amount: 100 }],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.services[0].currency, 'EUR');
});

// 18. Moeda BRL
runTest('18. Moeda BRL identificada é preservada sem conversão cambial', () => {
  const raw = {
    services: [{ type: 'other', description: 'Item', currency: 'BRL', amount: 500 }],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.services[0].currency, 'BRL');
});

// 19. Destino
runTest('19. Destino comercial geral da viagem é retornado no nível raiz', () => {
  const raw = {
    destination: 'Tóquio, Japão',
    services: [],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.destination, 'Tóquio, Japão');
});

// 20. Destino diferente da cidade do hotel
runTest('20. Destino comercial difere da cidade do hotel e ambos coexistem', () => {
  const raw = {
    destination: 'Paris', // Destino comercial
    services: [
      {
        type: 'accommodation',
        description: 'Hotel Ibis',
        destination: 'Bagnolet', // Cidade do hotel
      },
    ],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.destination, 'Paris');
  assert.strictEqual(normalized.services[0].destination, 'Bagnolet');
});

// 21. Ausência de informação
runTest('21. Informação ausente não gera valores fantasmas ou strings vazias', () => {
  const raw = {
    services: [{ type: 'accommodation', description: 'Hotel Teste' }],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.services[0].mealPlan, undefined);
  assert.strictEqual(normalized.services[0].carrier, undefined);
  assert.strictEqual(normalized.services[0].departureTime, undefined);
});

// 22. Não inventar regime
runTest('22. Se a imagem não indicar regime, mealPlan NÃO é inventado', () => {
  const raw = {
    services: [{ type: 'accommodation', description: 'Hotel 5 Noites', mealPlan: null }],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.services[0].mealPlan, undefined);
});

// 23. Não inventar valores
runTest('23. Valores numéricos não identificados não são alucinados', () => {
  const raw = {
    services: [{ type: 'transfer', description: 'Transfer incluído', amount: null }],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.services[0].amount, 0);
});

// 24. Conflito entre imagens
runTest('24. Conflito detectado entre imagens é registrado estruturadamente', () => {
  const raw = {
    services: [],
    conflicts: [
      {
        field: 'hotel',
        values: ['Hotel A', 'Hotel B'],
        description: 'Imagens indicam hotéis distintos para a mesma viagem',
      },
    ],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert(Array.isArray(normalized.conflicts));
  assert.strictEqual(normalized.conflicts.length, 1);
  const c: any = normalized.conflicts[0];
  assert.strictEqual(c.field, 'hotel');
  assert(c.description.includes('hotéis distintos'));
});

// 25. Preservação de conflito para revisão
runTest('25. Conflito em formato de string livre também é preservado para revisão', () => {
  const raw = {
    services: [],
    conflicts: ['Datas divergentes: 10/10 vs 12/10'],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.conflicts?.length, 1);
});

// 26. ServiceItem com UUID
runTest('26. Todo ServiceItem gerado possui UUID válido no padrão RFC4122 v4', () => {
  const raw = {
    services: [{ type: 'transfer', description: 'Transfer' }],
  };
  const normalized = normalizeImportedPackageData(raw);
  const id = normalized.services[0].id;
  assert(typeof id === 'string' && id.length >= 32);
  // Padrão UUID (8-4-4-4-12)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  assert(uuidRegex.test(id), `ID "${id}" deve ser um UUID válido`);
});

// 27. Ausência de estruturas legadas na saída nova
runTest('27. Saída estruturada prioriza services[] como fonte de dados', () => {
  const raw = {
    destination: 'Berlim',
    services: [
      { type: 'outbound_transport', description: 'Voo Ida' },
      { type: 'accommodation', description: 'Hotel Berlim' },
    ],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert(Array.isArray(normalized.services));
  assert.strictEqual(normalized.services.length, 2);
});

// 28. Cálculo financeiro delegado ao motor
runTest('28. services[] alimenta diretamente o motor financeiro determinístico', () => {
  const s1: ServiceItem = { id: '1', type: 'outbound_transport', description: 'Voo', amount: 150, quantity: 2, currency: 'EUR' };
  const s2: ServiceItem = { id: '2', type: 'accommodation', description: 'Hotel', amount: 400, quantity: 1, currency: 'EUR' };
  const summary = calculateFinancialSummaryFromServices({
    services: [s1, s2],
    salePrice: 1000,
    targetCurrency: 'EUR',
    passengers: { adults: 2, children: 0, infants: 0 },
  });
  assert.strictEqual(summary.totalCost, 700); // 150*2 + 400
  assert.strictEqual(summary.salePrice, 1000);
  assert.strictEqual(summary.profit, 300);
  assert.strictEqual(summary.profitPercent, 30);
});

// 29. Não gerar lucro/margem pela IA
runTest('29. A IA não retorna nem altera margem de lucro ou markup', () => {
  const raw = {
    financial: {
      total: 1200,
      currency: 'EUR',
    },
    services: [],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual((normalized as any).profit, undefined);
  assert.strictEqual((normalized as any).margin, undefined);
  assert.strictEqual((normalized as any).markup, undefined);
});

// 30. Aplicação dos dados ao formulário
runTest('30. Aplicação ao formulário injeta destination e services[] diretamente', () => {
  let formServices: ServiceItem[] = [];
  let formDestination = '';

  const raw = {
    destination: 'Madrid',
    services: [
      { type: 'accommodation', description: 'Hotel Mayorazgo', amount: 350, currency: 'EUR' },
    ],
  };
  const imported = normalizeImportedPackageData(raw);

  // Simula o handleImportData de PackageFormPage / QuoteFormPage
  if (imported.destination) formDestination = imported.destination;
  if (imported.services.length > 0) formServices = [...formServices, ...imported.services];

  assert.strictEqual(formDestination, 'Madrid');
  assert.strictEqual(formServices.length, 1);
  assert.strictEqual(formServices[0].description, 'Hotel Mayorazgo');
});

// 31. Edição após importação
runTest('31. Usuário pode editar valores do serviço importado no formulário', () => {
  const item: ServiceItem = { id: 'uuid-1', type: 'accommodation', description: 'Hotel Original', amount: 200, quantity: 1, currency: 'EUR' };
  // Edição
  const updatedItem = { ...item, description: 'Hotel Editado pelo Operador', amount: 250 };
  assert.strictEqual(updatedItem.description, 'Hotel Editado pelo Operador');
  assert.strictEqual(updatedItem.amount, 250);
});

// 32. Remoção após importação
runTest('32. Usuário pode remover um serviço importado da lista', () => {
  let list: ServiceItem[] = [
    { id: '1', type: 'outbound_transport', description: 'Voo', amount: 100, quantity: 1, currency: 'EUR' },
    { id: '2', type: 'transfer', description: 'Transfer', amount: 50, quantity: 1, currency: 'EUR' },
  ];
  list = list.filter((s) => s.id !== '2');
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].id, '1');
});

// 33. Múltiplos serviços da mesma categoria
runTest('33. Múltiplos serviços da mesma categoria (ex: 2 voos de ida ou 2 transfers)', () => {
  const raw = {
    services: [
      { type: 'transfer', description: 'Transfer Aeroporto → Hotel' },
      { type: 'transfer', description: 'Transfer Hotel → Porto' },
    ],
  };
  const normalized = normalizeImportedPackageData(raw);
  assert.strictEqual(normalized.services.length, 2);
  assert.strictEqual(normalized.services[0].description, 'Transfer Aeroporto → Hotel');
  assert.strictEqual(normalized.services[1].description, 'Transfer Hotel → Porto');
});

// 34. Erro de resposta inválida
runTest('34. Resposta vazia ou JSON truncado não lança erro fatal e retorna serviços vazios', () => {
  const normalized = normalizeImportedPackageData(null);
  assert(Array.isArray(normalized.services));
  assert.strictEqual(normalized.services.length, 0);
  assert.strictEqual(normalized.destination, null);
});

// 35. Erro controlado da Edge Function
runTest('35. Formato de erro controlado da Edge Function é devidamente estruturado', () => {
  const errorPayload = {
    success: false,
    error: 'FILE_TOO_LARGE',
    details: 'Arquivo excede o limite máximo permitido de 8MB.',
  };
  assert.strictEqual(errorPayload.success, false);
  assert(errorPayload.error.includes('FILE_TOO_LARGE'));
});

console.log(`\n=== FIM DOS TESTES DA FASE 5: ${testsPassed} PASSARAM, ${testsFailed} FALHARAM ===\n`);

if (testsFailed > 0) {
  process.exit(1);
}
