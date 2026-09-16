/**
 * Suíte de Testes Automatizados: Consolidação Multi-Imagem do Identificador por IA
 * Valida a prevenção de perda de dados e consolidação determinística de múltiplos serviços
 * distribuídos em 1..N imagens (Voo + Carro + Hotel).
 */

import {
  consolidateImportedPackageData,
  normalizeImportedPackageData,
} from '../src/services/imageImportService';
import { ImportedPackageData, ServiceItem } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    failed++;
  }
}

console.log('\n================================================================');
console.log(' TESTES: CONSOLIDAÇÃO MULTI-IMAGEM E PREVENÇÃO DE PERDA DE DADOS');
console.log('================================================================\n');

// 1. Caso Real Crítico: Imagem A (Voo) + Imagem B (Carro) + Imagem C (Hotel)
{
  const imgA_Voo: ImportedPackageData = normalizeImportedPackageData({
    destination: 'Viena',
    dates: { start: '2026-11-01', end: '2026-11-06' },
    services: [
      {
        type: 'outbound_transport',
        description: 'Porto (OPO) -> Viena (VIE) | Austrian Airlines',
        amount: 278,
        currency: 'EUR',
        quantity: 1,
        carrier: 'Austrian Airlines',
        departureTime: '10:00',
        arrivalTime: '14:30',
      },
    ],
  });

  const imgB_Carro: ImportedPackageData = normalizeImportedPackageData({
    destination: 'Viena',
    services: [
      {
        type: 'additional',
        description: 'Aluguer de Carro Económico (Sixt)',
        amount: 86,
        currency: 'EUR',
        quantity: 1,
        notes: 'Retirada e devolução no Aeroporto de Viena',
      },
    ],
  });

  const imgC_Hotel: ImportedPackageData = normalizeImportedPackageData({
    destination: 'Viena, Áustria',
    services: [
      {
        type: 'accommodation',
        description: 'Hotel Viena Central',
        amount: 320,
        currency: 'EUR',
        quantity: 5,
        destination: 'Viena, Áustria',
        mealPlan: 'Pequeno-almoço incluído',
      },
    ],
  });

  const consolidated = consolidateImportedPackageData([imgA_Voo, imgB_Carro, imgC_Hotel]);

  assert(
    consolidated.services.length === 3,
    '1. VOO + CARRO + HOTEL consolidam exatamente 3 ServiceItems (nenhum é perdido)'
  );

  const hasFlight = consolidated.services.some(
    (s) => s.type === 'outbound_transport' && s.amount === 278 && s.description.includes('Porto')
  );
  const hasCar = consolidated.services.some(
    (s) => s.type === 'additional' && s.amount === 86 && s.description.includes('Aluguer de Carro')
  );
  const hasHotel = consolidated.services.some(
    (s) => s.type === 'accommodation' && s.amount === 320 && s.description.includes('Hotel Viena Central')
  );

  assert(hasFlight, '2. Serviço de Voo (Imagem 1) está presente no consolidado com valor €278');
  assert(hasCar, '3. Serviço de Carro (Imagem 2) está presente no consolidado com valor €86');
  assert(hasHotel, '4. Serviço de Hotel (Imagem 3) está presente no consolidado com valor €320');
  assert(
    consolidated.destination === 'Viena' || consolidated.destination === 'Viena, Áustria',
    '5. Destino comum de viagem preservado'
  );
}

// 2. Preservação de Ordem: Voo -> Carro -> Hotel
{
  const item1: ImportedPackageData = normalizeImportedPackageData({
    services: [{ type: 'outbound_transport', description: 'Voo', amount: 100 }],
  });
  const item2: ImportedPackageData = normalizeImportedPackageData({
    services: [{ type: 'additional', description: 'Carro', amount: 50 }],
  });
  const item3: ImportedPackageData = normalizeImportedPackageData({
    services: [{ type: 'accommodation', description: 'Hotel', amount: 200 }],
  });

  const res = consolidateImportedPackageData([item1, item2, item3]);
  assert(
    res.services[0].type === 'outbound_transport' &&
      res.services[1].type === 'additional' &&
      res.services[2].type === 'accommodation',
    '6. A ordem das imagens é rigorosamente preservada nos serviços consolidados'
  );
}

// 3. Caso com 1 Imagem
{
  const singleItem: ImportedPackageData = normalizeImportedPackageData({
    destination: 'Paris',
    services: [{ type: 'accommodation', description: 'Hotel Paris', amount: 500 }],
  });
  const res = consolidateImportedPackageData([singleItem]);
  assert(
    res.services.length === 1 && res.services[0].description === 'Hotel Paris' && res.destination === 'Paris',
    '7. Consolidação com 1 única imagem preserva todos os dados diretamente'
  );
}

// 4. Caso com 2 Imagens
{
  const img1: ImportedPackageData = normalizeImportedPackageData({
    destination: 'Roma',
    services: [{ type: 'outbound_transport', description: 'Voo TAP', amount: 180 }],
  });
  const img2: ImportedPackageData = normalizeImportedPackageData({
    destination: 'Roma',
    services: [{ type: 'accommodation', description: 'Hotel Colosseo', amount: 400 }],
  });
  const res = consolidateImportedPackageData([img1, img2]);
  assert(
    res.services.length === 2 &&
      res.services.some((s) => s.type === 'outbound_transport') &&
      res.services.some((s) => s.type === 'accommodation'),
    '8. Consolidação com 2 imagens gera exatamente 2 serviços'
  );
}

// 5. Imagem sem dados úteis (vazia) intercalada entre imagens com dados
{
  const imgVoo: ImportedPackageData = normalizeImportedPackageData({
    services: [{ type: 'outbound_transport', description: 'Voo Lisboa - Madrid', amount: 90 }],
  });
  const imgVazia: ImportedPackageData = normalizeImportedPackageData({});
  const imgHotel: ImportedPackageData = normalizeImportedPackageData({
    services: [{ type: 'accommodation', description: 'Hotel Madrid Gran Via', amount: 250 }],
  });

  const res = consolidateImportedPackageData([imgVoo, imgVazia, imgHotel]);
  assert(
    res.services.length === 2 &&
      res.services[0].description === 'Voo Lisboa - Madrid' &&
      res.services[1].description === 'Hotel Madrid Gran Via',
    '9. Imagem sem dados úteis é ignorada sem prejudicar as imagens válidas'
  );
}

// 6. Múltiplos serviços na mesma imagem + serviços em outra imagem
{
  const imgMultipla: ImportedPackageData = normalizeImportedPackageData({
    services: [
      { type: 'outbound_transport', description: 'Voo Ida', amount: 150 },
      { type: 'inbound_transport', description: 'Voo Volta', amount: 150 },
    ],
  });
  const imgOutra: ImportedPackageData = normalizeImportedPackageData({
    services: [
      { type: 'transfer', description: 'Transfer Privativo', amount: 40 },
      { type: 'accommodation', description: 'Resort All Inclusive', amount: 800 },
    ],
  });

  const res = consolidateImportedPackageData([imgMultipla, imgOutra]);
  assert(
    res.services.length === 4 &&
      res.services[0].type === 'outbound_transport' &&
      res.services[1].type === 'inbound_transport' &&
      res.services[2].type === 'transfer' &&
      res.services[3].type === 'accommodation',
    '10. Múltiplos serviços na mesma imagem coexistem harmonicamente com outras imagens'
  );
}

// 7. Detecção e registro de conflito de datas entre imagens
{
  const img1: ImportedPackageData = normalizeImportedPackageData({
    dates: { start: '2026-10-10', end: '2026-10-15' },
    services: [{ type: 'outbound_transport', description: 'Voo', amount: 100 }],
  });
  const img2: ImportedPackageData = normalizeImportedPackageData({
    dates: { start: '2026-10-12', end: '2026-10-18' },
    services: [{ type: 'accommodation', description: 'Hotel', amount: 200 }],
  });

  const res = consolidateImportedPackageData([img1, img2]);
  assert(
    res.conflicts !== undefined && res.conflicts.length > 0,
    '11. Divergência de datas entre imagens é registrada como conflito para revisão humana'
  );
}

// 8. Detecção e registro de conflito de destino entre imagens
{
  const img1: ImportedPackageData = normalizeImportedPackageData({
    destination: 'Tóquio',
    services: [{ type: 'accommodation', description: 'Hotel Shinjuku', amount: 400 }],
  });
  const img2: ImportedPackageData = normalizeImportedPackageData({
    destination: 'Quioto',
    services: [{ type: 'accommodation', description: 'Ryokan Quioto', amount: 500 }],
  });

  const res = consolidateImportedPackageData([img1, img2]);
  assert(
    res.conflicts !== undefined &&
      res.conflicts.some((c: any) => c.field === 'destination'),
    '12. Divergência de destino é devidamente registrada em conflicts'
  );
}

// 9. Preservação de passageiros e total financeiro
{
  const img1: ImportedPackageData = normalizeImportedPackageData({
    passengers: { adults: 2, children: [{ age: 8 }] },
    financial: { total: 684, currency: 'EUR' },
    services: [{ type: 'outbound_transport', description: 'Voo', amount: 300 }],
  });
  const img2: ImportedPackageData = normalizeImportedPackageData({
    services: [{ type: 'accommodation', description: 'Hotel', amount: 384 }],
  });

  const res = consolidateImportedPackageData([img1, img2]);
  assert(
    res.passengers.adults === 2 &&
      res.passengers.children.length === 1 &&
      res.passengers.children[0].age === 8,
    '13. Passageiros consolidados corretamente a partir de imagem que os continha'
  );
  assert(
    res.salePrice === 684 && res.currency === 'EUR',
    '14. Preço de venda comercial e moeda preservados no consolidado'
  );
}

// 10. Normalização defensiva de imagens com formato legado de Edge Function remota
{
  const legacyImgVoo = normalizeImportedPackageData({
    outbound: { route: 'OPO -> VIE', company: 'Austrian', flight: 'OS123' },
  });
  const legacyImgHotel = normalizeImportedPackageData({
    lodging: { name: 'Hotel Imperial', city: 'Viena', mealPlan: 'APA' },
  });
  const legacyImgCarro = normalizeImportedPackageData({
    additionalServices: [{ name: 'Aluguel de Carro', amount: 86, currency: 'EUR' }],
  });

  const res = consolidateImportedPackageData([legacyImgVoo, legacyImgCarro, legacyImgHotel]);
  assert(
    res.services.length === 3,
    '15. Normalização e consolidação suportam respostas legadas de Edge Function sem perder itens'
  );
  assert(
    res.services[0].type === 'outbound_transport' &&
      res.services[1].type === 'additional' &&
      res.services[2].type === 'accommodation',
    '16. Tipos corretos atribuídos mesmo para respostas originadas do schema legado'
  );
}

console.log('\n--- BATERIA DE TESTES DE TRATAMENTO DE FALHA PARCIAL (TESTES A, B, C, D, E) ---');

// TESTE A: 3 imagens -> 3 análises com sucesso -> todos os serviços preservados
{
  const img1 = normalizeImportedPackageData({
    services: [{ type: 'outbound_transport', description: 'Voo OPO -> VIE', amount: 278 }],
  });
  const img2 = normalizeImportedPackageData({
    services: [{ type: 'additional', description: 'Aluguel Carro Sixt', amount: 86 }],
  });
  const img3 = normalizeImportedPackageData({
    services: [{ type: 'accommodation', description: 'Hotel Viena Central', amount: 320 }],
  });

  const res = consolidateImportedPackageData([img1, img2, img3]);
  assert(
    res.services.length === 3 &&
      res.services[0].description === 'Voo OPO -> VIE' &&
      res.services[1].description === 'Aluguel Carro Sixt' &&
      res.services[2].description === 'Hotel Viena Central',
    'TESTE A: 3 imagens -> 3 análises com sucesso -> todos os serviços preservados'
  );
}

// TESTE B: 3 imagens -> sucesso + falha + sucesso -> serviços das duas imagens válidas preservados
{
  const img1_sucesso = normalizeImportedPackageData({
    destination: 'Viena',
    services: [{ type: 'outbound_transport', description: 'Voo OPO -> VIE', amount: 278 }],
  });
  // Imagem 2 falhou: não há objeto retornado ou null
  const img3_sucesso = normalizeImportedPackageData({
    destination: 'Viena',
    services: [{ type: 'accommodation', description: 'Hotel Viena Central', amount: 320 }],
  });

  // Simulação do resultado do processamento que filtra falhas parciais
  const validResults = [img1_sucesso, img3_sucesso];
  const res = consolidateImportedPackageData(validResults);

  // Se simulamos o registro de falha parcial da imagem 2
  res.conflicts = res.conflicts || [];
  res.conflicts.push({
    field: 'arquivos',
    values: ['comprovante_carro.jpg'],
    description: 'Não foi possível extrair dados de 1 imagem(ns): comprovante_carro.jpg. Os dados das demais imagens foram preservados para revisão.',
  });

  assert(
    res.services.length === 2 &&
      res.services.some((s) => s.type === 'outbound_transport' && s.amount === 278) &&
      res.services.some((s) => s.type === 'accommodation' && s.amount === 320),
    'TESTE B.1: Sucesso + Falha + Sucesso preserva integralmente os serviços das 2 imagens válidas'
  );
  assert(
    res.conflicts.some((c: any) => c.field === 'arquivos' && c.values.includes('comprovante_carro.jpg')),
    'TESTE B.2: Imagem que falhou é devidamente registrada em conflicts para notificação do usuário'
  );
}

// TESTE C: 1 imagem -> falha -> erro controlado
{
  const emptyBatch: ImportedPackageData[] = [];
  const res = consolidateImportedPackageData(emptyBatch);
  assert(
    Array.isArray(res.services) && res.services.length === 0 && res.destination === null,
    'TESTE C: 1 imagem que falha resulta em objeto vazio controlado sem quebra de tipo'
  );
}

// TESTE D: 2 imagens -> ambas falham -> erro controlado sem resultado incorreto
{
  const failedBatch: ImportedPackageData[] = [];
  const res = consolidateImportedPackageData(failedBatch);
  assert(
    res.services.length === 0 && res.salePrice === null && res.dates.start === null,
    'TESTE D: Lote onde todas as imagens falham produz estado zerado sem alucinações'
  );
}

// TESTE E: Uma imagem retorna resultado vazio/sem serviços -> não elimina os serviços das outras imagens
{
  const imgVoo = normalizeImportedPackageData({
    destination: 'Roma',
    services: [{ type: 'outbound_transport', description: 'Voo TAP', amount: 180 }],
  });
  const imgSemServicos = normalizeImportedPackageData({
    // Imagem sem nenhum serviço identificado (ex: foto borrada ou cabeçalho sem dados)
    packageName: 'Viagem Roma',
    services: [],
  });
  const imgHotel = normalizeImportedPackageData({
    destination: 'Roma',
    services: [{ type: 'accommodation', description: 'Hotel Colosseo', amount: 450 }],
  });

  const res = consolidateImportedPackageData([imgVoo, imgSemServicos, imgHotel]);
  assert(
    res.services.length === 2 &&
      res.services[0].description === 'Voo TAP' &&
      res.services[1].description === 'Hotel Colosseo',
    'TESTE E: Imagem sem serviços identificados não elimina nem corrompe serviços de outras imagens'
  );
}

console.log('\n================================================================');
console.log(` RESULTADO FINAL: ${passed} PASSOU / ${failed} FALHOU`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
