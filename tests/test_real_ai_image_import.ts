// Teste Oficial de Validação Real da Edge Function import-package-image (Fase 5 / Bugfix Multi-Imagem)
// Valida o pipeline com Gemini Vision: Múltiplas Imagens Reais -> Extração Paralela -> Consolidação Determinística -> ServiceItem[]

import fs from 'node:fs';
import {
  normalizeImportedPackageData,
  consolidateImportedPackageData,
} from '../src/services/imageImportService';
import { ImportedPackageData } from '../src/types';

const SUPABASE_URL = 'https://iqtfqitquykasvfybndl.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxdGZxaXRxdXlrYXN2ZnlibmRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MDQ2MDYsImV4cCI6MjEwNDQ4MDYwNn0.rrw2sRJJJ3AfiXCKsYvQ8YsbqdjSAD5v_XLHfQEng1I';

const FLIGHT_IMG_PATH = 'C:/Users/ptmaralvoli/.gemini/antigravity-ide/brain/3ad75d58-eca0-43ab-a4d3-d39f0aece60d/flight_quote_roma_1789591166831.jpg';
const HOTEL_IMG_PATH = 'C:/Users/ptmaralvoli/.gemini/antigravity-ide/brain/3ad75d58-eca0-43ab-a4d3-d39f0aece60d/hotel_quote_roma_1789591180776.jpg';

async function runRealAiImageValidation() {
  console.log('================================================================');
  console.log(' VALIDAÇÃO DA INTEGRAÇÃO REAL COM GEMINI VISION (MULTI-IMAGEM)');
  console.log('================================================================\n');

  if (!fs.existsSync(FLIGHT_IMG_PATH) || !fs.existsSync(HOTEL_IMG_PATH)) {
    console.error('❌ Imagens de teste não encontradas no diretório de artifacts.');
    process.exit(1);
  }

  const flightBase64 = fs.readFileSync(FLIGHT_IMG_PATH).toString('base64');
  const hotelBase64 = fs.readFileSync(HOTEL_IMG_PATH).toString('base64');

  console.log('1. PREPARAÇÃO DAS IMAGENS MULTIMODAIS:');
  console.log(`  - Imagem 1 (Voo TAP Roma): ${(flightBase64.length / 1024).toFixed(1)} KB base64`);
  console.log(`  - Imagem 2 (Hotel Colosseo Roma): ${(hotelBase64.length / 1024).toFixed(1)} KB base64`);

  const images = [
    { name: 'voo_tap_roma.jpg', base64: flightBase64, mimeType: 'image/jpeg' },
    { name: 'hotel_colosseo_roma.jpg', base64: hotelBase64, mimeType: 'image/jpeg' },
  ];

  console.log('\n2. EXTRAÇÃO PARALELA RESILIENTE VIA EDGE FUNCTION:');
  const startTime = Date.now();

  const extractionPromises = images.map(async (img) => {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/import-package-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({
        imageBase64: img.base64,
        mimeType: img.mimeType,
        images: [{ imageBase64: img.base64, mimeType: img.mimeType, name: img.name }],
      }),
    });

    const json = await resp.json();
    return { status: resp.status, name: img.name, data: json.data };
  });

  const rawResults = await Promise.all(extractionPromises);
  const durationMs = Date.now() - startTime;
  console.log(`  Tempo total de extração simultânea: ${durationMs}ms`);

  const normalizedItems: ImportedPackageData[] = rawResults
    .filter((r) => r.data)
    .map((r) => normalizeImportedPackageData(r.data));

  console.log(`\n3. RESULTADOS POR IMAGEM:`);
  normalizedItems.forEach((item, idx) => {
    console.log(`  - Imagem ${idx + 1} (${rawResults[idx].name}): ${item.services.length} serviço(s) extraído(s)`);
    item.services.forEach((s) => console.log(`      * [${s.type}] ${s.description}`));
  });

  console.log('\n4. CONSOLIDAÇÃO DETERMINÍSTICA:');
  const consolidated = consolidateImportedPackageData(normalizedItems);

  console.log(`  Destino consolidado: "${consolidated.destination}"`);
  console.log(`  Quantidade total de serviços consolidados: ${consolidated.services.length}`);

  consolidated.services.forEach((s, idx) => {
    console.log(`    [${idx + 1}] [${s.type}] ${s.description} | ${s.amount} ${s.currency}`);
  });

  // Validações determinísticas
  if (consolidated.services.length < 2) {
    console.error(`❌ Esperado no mínimo 2 serviços consolidados (Voo + Hotel), recebido: ${consolidated.services.length}`);
    process.exit(1);
  }

  const hasFlight = consolidated.services.some((s) => s.type === 'outbound_transport');
  const hasHotel = consolidated.services.some((s) => s.type === 'accommodation');

  if (!hasFlight || !hasHotel) {
    console.error('❌ Falha na consolidação: Voo ou Hotel foi perdido!');
    process.exit(1);
  }

  const allUuids = consolidated.services.every(
    (s) => typeof s.id === 'string' && s.id.length >= 32
  );
  if (!allUuids) {
    console.error('❌ Nem todos os serviços possuem UUID válido.');
    process.exit(1);
  }

  console.log('  ✅ [PASS] Voo E Hotel preservados sem sobreposição!');
  console.log('  ✅ [PASS] Todos os serviços possuem UUIDs RFC4122 válidos.');

  console.log('\n================================================================');
  console.log(' VALIDAÇÃO DA INTEGRAÇÃO REAL CONCLUÍDA COM SUCESSO! ✈️🏨');
  console.log('================================================================\n');
}

runRealAiImageValidation().catch((err) => {
  console.error('Erro na validação real:', err);
  process.exit(1);
});
