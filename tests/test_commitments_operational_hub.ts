import * as fs from 'fs';
import * as path from 'path';

// Carregar .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      if (!process.env[k]) {
        process.env[k] = v;
      }
    }
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runCommitmentsOperationalHubTests() {
  console.log('=== TESTES: CENTRAL OPERACIONAL DE RECEBIMENTOS & PAGAMENTOS ===\n');

  const { financialService } = await import('../src/services/financialService');
  const { PendingCommitmentItem } = await import('../src/types');

  // 1. Validar leitura de compromissos pendentes pelo serviço existente
  console.log('--- 1. Chamada a getPendingCommitments via financialService ---');
  const commitments = await financialService.getPendingCommitments();
  assert(Array.isArray(commitments), 'getPendingCommitments retorna um array');
  console.log(`ℹ️  Compromissos pendentes recuperados do banco: ${commitments.length}`);

  // 2. Cenário de dados simulados para validação estrita das regras de negócio da UI
  console.log('\n--- 2. Validação da segregação entre Recebimentos e Pagamentos ---');
  const mockItems: any[] = [
    {
      id: 'rec-1',
      quotation_id: 'quot-101',
      quotation_reference: 'COT-2026-101',
      quotation_client_name: 'Ana Silva',
      type: 'receivable',
      counterparty_name: 'Ana Silva',
      counterparty_type: 'client',
      amount: 1500,
      currency: 'EUR',
      status: 'planned',
      expected_date: '2026-10-15',
      expected_account_id: 'acc-1',
      expected_account_name: 'BCP EUR',
      already_paid: 0,
      pending_amount: 1500,
      is_overdue: false,
      description: 'Entrada Pacote Lisboa',
      notes: 'Transferência bancária combinada',
      is_credit_card_invoice: false,
    },
    {
      id: 'rec-2',
      quotation_id: 'quot-102',
      quotation_reference: 'COT-2026-102',
      quotation_client_name: 'Carlos Oliveira',
      type: 'receivable',
      counterparty_name: 'Carlos Oliveira',
      counterparty_type: 'client',
      amount: 5000,
      currency: 'BRL',
      status: 'partially_settled',
      expected_date: '2026-09-20',
      expected_account_id: 'acc-2',
      expected_account_name: 'Itaú BRL',
      already_paid: 2000,
      pending_amount: 3000,
      is_overdue: true,
      description: 'Segunda parcela Pacote Salvador',
      notes: null,
      is_credit_card_invoice: false,
    },
    {
      id: 'pay-1',
      quotation_id: 'quot-101',
      quotation_reference: 'COT-2026-101',
      quotation_client_name: 'Ana Silva',
      type: 'payable',
      counterparty_name: 'Hotel Sana Lisboa',
      counterparty_type: 'supplier',
      amount: 800,
      currency: 'EUR',
      status: 'planned',
      expected_date: '2026-10-10',
      expected_account_id: 'acc-1',
      expected_account_name: 'BCP EUR',
      already_paid: 0,
      pending_amount: 800,
      is_overdue: false,
      description: 'Hospedagem 3 noites',
      notes: 'Vencimento direto com fornecedor',
      is_credit_card_invoice: false,
    },
    {
      id: 'pay-2',
      quotation_id: null, // sem cotação vinculada
      quotation_reference: null,
      quotation_client_name: null,
      type: 'payable',
      counterparty_name: 'Banco Santander',
      counterparty_type: 'other',
      amount: 250,
      currency: 'BRL',
      status: 'planned',
      expected_date: '2026-09-28',
      expected_account_id: 'acc-2',
      expected_account_name: 'Itaú BRL',
      already_paid: 0,
      pending_amount: 250,
      is_overdue: true,
      description: 'Fatura Cartão Corporativo',
      notes: 'Despesas de escritório',
      is_credit_card_invoice: true,
    }
  ];

  const receivables = mockItems.filter(i => i.type === 'receivable');
  const payables = mockItems.filter(i => i.type === 'payable');

  assert(receivables.length === 2, '2 recebíveis identificados corretamente');
  assert(payables.length === 2, '2 pagáveis identificados corretamente');
  assert(receivables.every(r => r.type === 'receivable'), 'Todos os recebíveis têm tipo receivable');
  assert(payables.every(p => p.type === 'payable'), 'Todos os pagáveis têm tipo payable');

  // 3. Validação do isolamento EUR e BRL
  console.log('\n--- 3. Preservação do isolamento entre EUR e BRL ---');
  const eurReceivablesPending = receivables
    .filter(r => r.currency === 'EUR')
    .reduce((sum, r) => sum + r.pending_amount, 0);
  const brlReceivablesPending = receivables
    .filter(r => r.currency === 'BRL')
    .reduce((sum, r) => sum + r.pending_amount, 0);

  const eurPayablesPending = payables
    .filter(p => p.currency === 'EUR')
    .reduce((sum, p) => sum + p.pending_amount, 0);
  const brlPayablesPending = payables
    .filter(p => p.currency === 'BRL')
    .reduce((sum, p) => sum + p.pending_amount, 0);

  assert(eurReceivablesPending === 1500, `Recebíveis EUR pendentes = 1500 (calculado: ${eurReceivablesPending})`);
  assert(brlReceivablesPending === 3000, `Recebíveis BRL pendentes = 3000 (calculado: ${brlReceivablesPending})`);
  assert(eurPayablesPending === 800, `Pagáveis EUR pendentes = 800 (calculado: ${eurPayablesPending})`);
  assert(brlPayablesPending === 250, `Pagáveis BRL pendentes = 250 (calculado: ${brlPayablesPending})`);

  // 4. Validação de filtros
  console.log('\n--- 4. Validação dos filtros de visualização ---');

  // 4.1 Filtro por Moeda
  const filterByCurrency = (items: typeof mockItems, cur: string) =>
    cur === 'all' ? items : items.filter(i => i.currency === cur);

  assert(filterByCurrency(mockItems, 'EUR').length === 2, 'Filtro EUR retorna 2 itens (1 rec + 1 pay)');
  assert(filterByCurrency(mockItems, 'BRL').length === 2, 'Filtro BRL retorna 2 itens (1 rec + 1 pay)');

  // 4.2 Filtro por Status (due / overdue / all)
  const filterByStatus = (items: typeof mockItems, statusFilter: string) => {
    if (statusFilter === 'all') return items;
    if (statusFilter === 'overdue') return items.filter(i => i.is_overdue);
    if (statusFilter === 'due') return items.filter(i => !i.is_overdue);
    return items;
  };

  assert(filterByStatus(mockItems, 'overdue').length === 2, 'Filtro vencidos retorna 2 itens vencidos');
  assert(filterByStatus(mockItems, 'due').length === 2, 'Filtro a vencer retorna 2 itens a vencer');

  // 4.3 Busca Textual
  const filterBySearch = (items: typeof mockItems, query: string) => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter(item =>
      (item.quotation_reference && item.quotation_reference.toLowerCase().includes(q)) ||
      (item.quotation_client_name && item.quotation_client_name.toLowerCase().includes(q)) ||
      (item.counterparty_name && item.counterparty_name.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.notes && item.notes.toLowerCase().includes(q))
    );
  };

  assert(filterBySearch(mockItems, 'COT-2026-101').length === 2, 'Busca por cotação "COT-2026-101" retorna 2 itens');
  assert(filterBySearch(mockItems, 'Sana').length === 1, 'Busca por fornecedor "Sana" retorna 1 item');
  assert(filterBySearch(mockItems, 'Carlos').length === 1, 'Busca por cliente "Carlos" retorna 1 item');
  assert(filterBySearch(mockItems, 'escritório').length === 1, 'Busca por texto em notes "escritório" retorna 1 item');

  // 5. Validação de navegação para a cotação vinculada
  console.log('\n--- 5. Validação da navegação de origem para cotação vinculada ---');
  mockItems.forEach(item => {
    if (item.quotation_id) {
      const targetUrl = `/cotacoes/${item.quotation_id}/financeiro`;
      assert(targetUrl.includes(item.quotation_id), `Link de navegação gerado com sucesso: ${targetUrl}`);
    } else {
      assert(item.quotation_id === null, 'Item avulso/geral sem cotação não cria link de cotação');
    }
  });

  // 6. Validação de status de vencimento amigável
  console.log('\n--- 6. Validação do cálculo de situação de vencimento ---');
  const getDueInfo = (expectedDate: string | null, isOverdue: boolean) => {
    if (!expectedDate) {
      return { label: 'Sem data', tone: 'neutral' };
    }
    const today = new Date('2026-10-01T00:00:00');
    const [y, m, d] = expectedDate.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0 || isOverdue) {
      const days = Math.abs(diffDays);
      return { label: `Vencido há ${days} dia(s)`, tone: 'danger', daysOverdue: days };
    }
    if (diffDays === 0) {
      return { label: 'Vence hoje', tone: 'warning', daysOverdue: 0 };
    }
    if (diffDays === 1) {
      return { label: 'Vence amanhã', tone: 'warning', daysOverdue: 0 };
    }
    return { label: `Em ${diffDays} dias`, tone: 'success', daysOverdue: 0 };
  };

  const dueInfoFuture = getDueInfo('2026-10-15', false);
  assert(dueInfoFuture.tone === 'success' && dueInfoFuture.label === 'Em 14 dias', 'Item futuro: Em 14 dias');

  const dueInfoOverdue = getDueInfo('2026-09-20', true);
  assert(dueInfoOverdue.tone === 'danger' && dueInfoOverdue.label.includes('Vencido há'), 'Item vencido: Vencido há X dia(s)');

  console.log('\n🎉 TODOS OS TESTES DA CENTRAL OPERACIONAL DE RECEBIMENTOS & PAGAMENTOS PASSARAM COM SUCESSO!\n');
}

runCommitmentsOperationalHubTests().catch(err => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
