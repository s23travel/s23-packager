// Suíte de Testes Automatizados: Importação de Dados de Imagem de Cotação
// Valida pré-validação de arquivos, normalização de dados estruturados da IA,
// integridade de tipos, ausência de alucinação de dados ausentes e mapeamento nos formulários.

import {
  validateImageFile,
  normalizeImportedPackageData,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
} from '../src/services/imageImportService';
import { ImportedPackageData } from '../src/types';
import { syncOperationalWithFinancials } from '../src/services/packageFinancialSyncService';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

console.log('\n====================================================');
console.log(' TESTES: IMPORTAÇÃO DE DADOS DE IMAGEM PARA COTAÇÕES ');
console.log('====================================================\n');

// ----------------------------------------------------
// 1. Validação de Formatos Aceitos e Rejeitados
// ----------------------------------------------------
console.log('--- Cenário 1: Validação de Formatos de Arquivo (PNG, JPG, JPEG) ---');

// Mock helper para simular File no Node/tsx
function createMockFile(name: string, type: string, sizeBytes: number): any {
  return {
    name,
    type,
    size: sizeBytes,
  };
}

const validPng = createMockFile('cotacao-voo.png', 'image/png', 1024 * 1024);
const resPng = validateImageFile(validPng);
assert(resPng.valid === true, '1. Imagem PNG válida dentro do limite é aceita');

const validJpg = createMockFile('orcamento_hotel.jpg', 'image/jpeg', 2 * 1024 * 1024);
const resJpg = validateImageFile(validJpg);
assert(resJpg.valid === true, '2. Imagem JPG válida dentro do limite é aceita');

const validJpeg = createMockFile('proposta_viagem.jpeg', 'image/jpeg', 500 * 1024);
const resJpeg = validateImageFile(validJpeg);
assert(resJpeg.valid === true, '3. Imagem JPEG válida dentro do limite é aceita');

const invalidPdf = createMockFile('cotacao.pdf', 'application/pdf', 1024 * 1024);
const resPdf = validateImageFile(invalidPdf);
assert(resPdf.valid === false && resPdf.error?.includes('PNG, JPG ou JPEG') === true, '4. Arquivo PDF é rejeitado com mensagem explicativa');

const invalidDocx = createMockFile('orcamento.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1024 * 1024);
const resDocx = validateImageFile(invalidDocx);
assert(resDocx.valid === false, '5. Arquivo Word (.docx) é categoricamente rejeitado');

const invalidTxt = createMockFile('notas.txt', 'text/plain', 500);
const resTxt = validateImageFile(invalidTxt);
assert(resTxt.valid === false, '6. Arquivo de texto (.txt) é categoricamente rejeitado');

// ----------------------------------------------------
// 2. Validação de Tamanho do Arquivo
// ----------------------------------------------------
console.log('\n--- Cenário 2: Validação de Limites de Tamanho ---');

const emptyFile = createMockFile('vazio.jpg', 'image/jpeg', 0);
const resEmpty = validateImageFile(emptyFile);
assert(resEmpty.valid === false && resEmpty.error?.includes('vazio') === true, '7. Arquivo de tamanho zero (0 bytes) é rejeitado');

const oversizedFile = createMockFile('foto_gigante.jpg', 'image/jpeg', 9 * 1024 * 1024); // 9MB
const resOversized = validateImageFile(oversizedFile);
assert(resOversized.valid === false && resOversized.error?.includes('8MB') === true, '8. Arquivo maior que 8MB é rejeitado com menção ao limite do MVP');

const nullFile = validateImageFile(null as any);
assert(nullFile.valid === false, '9. Arquivo nulo ou indefinido retorna erro amigável sem quebrar');

// ----------------------------------------------------
// 3. Normalização e Ausência de Alucinação
// ----------------------------------------------------
console.log('\n--- Cenário 3: Normalização dos Dados Estruturados da IA ---');

const mockAiResponse = {
  packageName: 'Pacote Santiago & Atacama',
  dates: {
    start: '2026-11-10',
    end: '2026-11-17',
  },
  passengers: {
    adults: 2,
    children: [{ age: 8 }],
  },
  outbound: {
    route: 'GRU → SCL',
    company: 'LATAM',
    flight: 'LA750',
    departureTime: '08:30',
    arrivalTime: '12:45',
  },
  inbound: {
    route: 'SCL → GRU',
    company: 'LATAM',
    flight: 'LA751',
    departureTime: '18:00',
    arrivalTime: '21:50',
  },
  lodging: {
    name: 'Hotel Cumbres Lastarria',
    city: 'Santiago',
    country: 'Chile',
    room: 'Superior Double',
    mealPlan: 'Café da Manhã',
    checkIn: '2026-11-10',
    checkOut: '2026-11-17',
  },
  additionalServices: [
    {
      name: 'Transfer Aeroporto / Hotel / Aeroporto',
      date: '2026-11-10',
      description: 'Veículo privativo',
      currency: 'USD',
      amount: 120,
    },
  ],
  financial: {
    currency: 'USD',
    taxesAndFees: 85,
    total: 2450,
  },
};

const normalized = normalizeImportedPackageData(mockAiResponse);

assert(normalized.packageName === 'Pacote Santiago & Atacama', '10. Nome do pacote é extraído corretamente');
assert(normalized.dates.start === '2026-11-10' && normalized.dates.end === '2026-11-17', '11. Datas ISO são extraídas com precisão');
assert(normalized.passengers.adults === 2 && normalized.passengers.children.length === 1, '12. Passageiros e idades das crianças são normalizados');
assert(normalized.outbound.flight === 'LA750' && normalized.outbound.company === 'LATAM', '13. Dados de voo de ida são preservados');
assert(normalized.lodging.name === 'Hotel Cumbres Lastarria' && normalized.lodging.city === 'Santiago', '14. Hotelaria e localização são mapeados');
assert(normalized.additionalServices.length === 1 && normalized.additionalServices[0].amount === 120, '15. Serviços adicionais e valores são preservados');
assert(normalized.financial.total === 2450 && normalized.financial.currency === 'USD', '16. Valores financeiros e moeda são extraídos');

// ----------------------------------------------------
// 4. Campos Ausentes Devem Ser Estritamente Null
// ----------------------------------------------------
console.log('\n--- Cenário 4: Preservação Estrita de Null para Dados Ausentes ---');

const partialAiResponse = {
  dates: {
    start: '2026-12-01',
    end: null,
  },
  passengers: {
    adults: null,
    children: [],
  },
  outbound: {
    route: 'LIS → MAD',
  },
  inbound: {},
  lodging: {
    name: 'Hotel Ritz',
  },
  financial: {
    total: '1.850,50', // string com vírgula para teste de parser monetário
  },
};

const partialNormalized = normalizeImportedPackageData(partialAiResponse);

assert(partialNormalized.dates.end === null, '17. Data de retorno ausente permanece null');
assert(partialNormalized.passengers.adults === null, '18. Quantidade de adultos ausente permanece null (não inventa 2 nem 1)');
assert(partialNormalized.inbound.route === null, '19. Rota de volta ausente permanece null');
assert(partialNormalized.lodging.city === null && partialNormalized.lodging.country === null, '20. Cidade e país ausentes permanecem null');
assert(partialNormalized.financial.total === 1850.5, '21. String monetária com vírgula ("1.850,50") é convertida deterministicamente para 1850.5');

// ----------------------------------------------------
// 5. Integração com a Herança Financeira (Seção 3 -> Seção 4)
// ----------------------------------------------------
console.log('\n--- Cenário 5: Herança Financeira a Partir dos Dados Importados ---');

const inheritedComponents = syncOperationalWithFinancials([], {
  outboundRoute: `${normalized.outbound.route} | ${normalized.outbound.company} | ${normalized.outbound.flight}`,
  inboundRoute: `${normalized.inbound.route} | ${normalized.inbound.company} | ${normalized.inbound.flight}`,
  hotelName: normalized.lodging.name || '',
  baseCurrency: 'EUR',
});

assert(inheritedComponents.length === 3, '22. Dados importados na Seção 3 geram automaticamente os 3 componentes na Seção 4');
assert(inheritedComponents[0].category === 'outbound_transport', '23. Primeiro componente é Transporte de ida');
assert(inheritedComponents[1].category === 'inbound_transport', '24. Segundo componente é Transporte de volta');
assert(inheritedComponents[2].category === 'lodging' && inheritedComponents[2].description === 'Hotel Cumbres Lastarria', '25. Terceiro componente é Hospedagem com o nome do hotel importado');

console.log('\n====================================================');
console.log(` RESULTADO FINAL: ${passed} PASSOU / ${failed} FALHOU`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
}
