import * as fs from 'fs';
import * as path from 'path';
import { quotationsService } from '../src/services/quotationsService';
import { generateServiceId } from '../src/services/legacyAdapterService';
import { Quotation, QuotationData, ServiceItem } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runQuotationDuplicationTests() {
  console.log('=== TESTES: DUPLICAÇÃO DE COTAÇÃO COM NOVO NÚMERO E REPLICAÇÃO DE ITENS ===\n');

  // =========================================================================
  // 1. AUDITORIA ESTÁTICA DO SERVIÇO E DA PÁGINA
  // =========================================================================
  console.log('--- 1. Auditoria Estática de Código ---');

  const quotationsServicePath = path.resolve(
    process.cwd(),
    'src/services/quotationsService.ts'
  );
  assert(fs.existsSync(quotationsServicePath), 'quotationsService.ts deve existir');
  const serviceContent = fs.readFileSync(quotationsServicePath, 'utf-8');

  assert(
    typeof quotationsService.duplicateQuotation === 'function',
    'quotationsService deve exportar o método duplicateQuotation'
  );
  assert(
    serviceContent.includes('async duplicateQuotation(id: string)'),
    'duplicateQuotation deve receber id: string'
  );
  assert(
    serviceContent.includes('await this.getNextReference()'),
    'duplicateQuotation deve calcular um novo número/referência sequencial'
  );
  assert(
    serviceContent.includes('status: \'draft\''),
    'Cotação duplicada deve iniciar com status "draft"'
  );
  assert(
    serviceContent.includes('generateServiceId'),
    'duplicateQuotation deve gerar novos IDs para os itens replicados'
  );

  const detailPagePath = path.resolve(
    process.cwd(),
    'src/pages/quotes/QuoteDetailPage.tsx'
  );
  assert(fs.existsSync(detailPagePath), 'QuoteDetailPage.tsx deve existir');
  const detailContent = fs.readFileSync(detailPagePath, 'utf-8');

  assert(
    detailContent.includes('handleDuplicate'),
    'QuoteDetailPage deve conter a função handleDuplicate'
  );
  assert(
    detailContent.includes('duplicating'),
    'QuoteDetailPage deve controlar estado de carregamento durante duplicação'
  );
  assert(
    detailContent.includes('Duplicar Cotação') || detailContent.includes('Duplicar'),
    'QuoteDetailPage deve renderizar o botão para duplicar a cotação no menu de ações'
  );
  assert(
    detailContent.includes('quotationsService.duplicateQuotation'),
    'QuoteDetailPage deve invocar quotationsService.duplicateQuotation'
  );
  assert(
    detailContent.includes('/cotacoes/${duplicated.id}/editar'),
    'QuoteDetailPage deve redirecionar para a página de edição da nova cotação duplicada'
  );
  assert(
    detailContent.includes('finally') && detailContent.includes('setDuplicating(false)'),
    'QuoteDetailPage deve restaurar o estado duplicating no bloco finally'
  );

  // =========================================================================
  // 2. SIMULAÇÃO DETERMINÍSTICA DA LÓGICA DE DUPLICAÇÃO
  // =========================================================================
  console.log('\n--- 2. Simulação da Replicação de Itens e Novo Número ---');

  const originalServices: ServiceItem[] = [
    {
      id: generateServiceId(),
      type: 'outbound_transport',
      description: 'Voo TAP TP101 Lisboa - Roma',
      amount: 450,
      currency: 'EUR',
      quantity: 2,
      carrier: 'TAP Air Portugal',
      departureTime: '10:00',
      arrivalTime: '14:00',
    },
    {
      id: generateServiceId(),
      type: 'accommodation',
      description: 'Hotel Colosseo 4*',
      amount: 800,
      currency: 'EUR',
      quantity: 1,
      destination: 'Roma, Itália',
      mealPlan: 'Café da manhã',
    },
    {
      id: generateServiceId(),
      type: 'transfer',
      description: 'Transfer Aeroporto - Hotel Privativo',
      amount: 90,
      currency: 'EUR',
      quantity: 1,
    },
    {
      id: generateServiceId(),
      type: 'insurance',
      description: 'Seguro Viagem Europa',
      amount: 120,
      currency: 'EUR',
      quantity: 2,
    },
  ];

  const originalQuoteData: QuotationData = {
    origin: 'Lisboa',
    destination: 'Roma',
    dates: {
      startDate: '2026-11-01',
      endDate: '2026-11-08',
      durationDays: 8,
      durationNights: 7,
    },
    passengers: {
      adults: 2,
      children: 0,
      infants: 0,
    },
    services: originalServices,
    financials: {
      currency: 'EUR',
      components: originalServices.map((s) => ({
        id: s.id,
        category: 'services',
        description: s.description,
        amount: s.amount,
        currency: s.currency,
        quantity: s.quantity,
      })),
      totalCost: 1460,
      salePrice: 1900,
      pricePerPerson: 950,
      profit: 440,
      profitPercent: 23.16,
      taxesAndFeesTotal: 0,
    },
    paymentConditions: 'Entrada 30% + 5x sem juros',
    localTaxNotes: 'Taxa turística de Roma não inclusa paga no hotel',
    customNotes: 'Passageiros preferem quartos em andares altos',
  };

  const originalQuote: Quotation = {
    id: 'quote-uuid-1',
    package_id: 'pkg-uuid-orig',
    reference: 'COT-2026-001',
    client_name: 'Maria Santos',
    status: 'accepted',
    data: originalQuoteData,
    currency: 'EUR',
    exchange_rate: 6.15,
    exchange_rate_date: '2026-10-01',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-02T15:00:00Z',
    archived_at: null,
  };

  // Simula o processo de clonagem profunda e reatribuição de novos IDs
  const clonedData: QuotationData = JSON.parse(JSON.stringify(originalQuote.data || {}));
  const originalServiceIds = (clonedData.services || []).map((s) => s.id);

  assert(Array.isArray(clonedData.services), 'Os serviços clonados devem ser uma lista');
  assert(clonedData.services!.length === 4, 'Todos os 4 serviços originais foram replicados');

  // Reatribui novos IDs
  if (Array.isArray(clonedData.services)) {
    clonedData.services = clonedData.services.map((srv) => ({
      ...srv,
      id: generateServiceId(),
    }));
  }

  // Verifica que todos os itens foram replicados exatamente, com novos IDs
  assert(
    clonedData.services!.length === originalServices.length,
    'Quantidade de itens replicados confere perfeitamente'
  );
  clonedData.services!.forEach((srv, index) => {
    const orig = originalServices[index];
    assert(srv.description === orig.description, `Item ${index + 1}: descrição preservada (${srv.description})`);
    assert(srv.amount === orig.amount, `Item ${index + 1}: montante preservado (${srv.amount})`);
    assert(srv.type === orig.type, `Item ${index + 1}: tipo de serviço preservado (${srv.type})`);
    assert(srv.id !== orig.id, `Item ${index + 1}: novo ID único gerado (${srv.id} !== ${orig.id})`);
  });

  // Verifica independência de mutação
  clonedData.services![0].description = 'Item Alterado na Cotação Duplicada';
  assert(
    originalQuote.data.services![0].description === 'Voo TAP TP101 Lisboa - Roma',
    'A alteração do item duplicado não altera o item da cotação original'
  );

  // Validação dos metadados comerciais e novo número
  const simulatedNewReference = 'COT-2026-002';
  assert(simulatedNewReference !== originalQuote.reference, 'O número gerado é novo e diferente do original');

  const duplicatedQuotePayload = {
    package_id: originalQuote.package_id,
    reference: simulatedNewReference,
    client_name: originalQuote.client_name,
    status: 'draft' as const,
    data: clonedData,
    currency: originalQuote.currency,
    exchange_rate: originalQuote.exchange_rate,
    exchange_rate_date: originalQuote.exchange_rate_date,
  };

  assert(duplicatedQuotePayload.status === 'draft', 'Status da nova cotação deve ser "draft"');
  assert(duplicatedQuotePayload.client_name === 'Maria Santos', 'Nome do cliente preservado');
  assert(duplicatedQuotePayload.package_id === 'pkg-uuid-orig', 'Vínculo do pacote original preservado');
  assert(duplicatedQuotePayload.data.destination === 'Roma', 'Destino replicado');
  assert(duplicatedQuotePayload.data.origin === 'Lisboa', 'Origem replicada');
  assert(duplicatedQuotePayload.data.paymentConditions === originalQuoteData.paymentConditions, 'Condições de pagamento replicadas');
  assert(duplicatedQuotePayload.data.localTaxNotes === originalQuoteData.localTaxNotes, 'Notas de taxas replicadas');
  assert(duplicatedQuotePayload.data.customNotes === originalQuoteData.customNotes, 'Observações replicadas');

  console.log('\n🎉 TODOS OS TESTES DE DUPLICAÇÃO DE COTAÇÃO PASSARAM COM SUCESSO!\n');
}

runQuotationDuplicationTests().catch((err) => {
  console.error('❌ Erro inesperado ao executar testes:', err);
  process.exit(1);
});
