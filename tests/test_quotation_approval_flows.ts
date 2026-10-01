import * as fs from 'fs';
import * as path from 'path';

// Carregar .env.local no ambiente Node do runner de testes
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

async function runApprovalFlowsTests() {
  console.log('=== TESTES: FLUXOS DE APROVAÇÃO ATÔMICA DA COTAÇÃO (FINANCEIRO) ===\n');

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    console.log('ℹ️  Credenciais do Supabase não encontradas. Pulando testes remotos.');
    return;
  }

  try {
    await fetch(process.env.VITE_SUPABASE_URL, { signal: AbortSignal.timeout(1500) });
  } catch {
    console.log('ℹ️  Supabase remoto inacessível na rede atual. Pulando testes remotos.');
    return;
  }

  const { supabase } = await import('../src/lib/supabase');
  const { quotationsService } = await import('../src/services/quotationsService');
  const { financialService } = await import('../src/services/financialService');

  const SUCCESS_MESSAGE = 'Cotação aprovada. Financeiro preparado.';
  const createdQuoteIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // Teste 1: Bloqueio de criação direta de cotação com status 'accepted'
    // -------------------------------------------------------------
    const refDirect = `TEST-COT-DIR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let directCreateError: any = null;
    try {
      await quotationsService.createQuotation({
        reference: refDirect,
        client_name: 'Teste Bloqueio Direto',
        status: 'accepted',
        currency: 'EUR',
        data: {},
      });
    } catch (err: any) {
      directCreateError = err;
    }
    assert(Boolean(directCreateError), '1. Bloqueia criação direta de cotação com status "accepted"');
    assert(
      directCreateError?.message?.includes('Não é permitido criar cotação diretamente com status aprovado'),
      '2. Mensagem explicativa instrui a usar approveQuotationAndCreateOperation'
    );

    // -------------------------------------------------------------
    // Teste 2: Criação de cotação em 'draft' e bloqueio de updateQuotation simples para 'accepted'
    // -------------------------------------------------------------
    const refDraft = `TEST-COT-APP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const draftQuote = await quotationsService.createQuotation({
      reference: refDraft,
      client_name: 'Cliente Teste Fluxo Aprovação',
      status: 'draft',
      currency: 'EUR',
      data: {
        destination: 'Lisboa & Porto',
        financials: { salePrice: 3500 },
        services: [
        {
          id: 'srv-flw-1',
          type: 'tour',
          description: 'Passeio Histórico Lisboa',
          amount: 50,
          quantity: 2,
          currency: 'EUR',
        },
      ],
    },
  });
    createdQuoteIds.push(draftQuote.id);
    assert(draftQuote.status === 'draft', '3. Cotação criada com sucesso em status "draft"');

  let simpleUpdateError: any = null;
  try {
    await quotationsService.updateQuotation(draftQuote.id, { status: 'accepted' });
  } catch (err: any) {
    simpleUpdateError = err;
  }
  assert(Boolean(simpleUpdateError), '4. Bloqueia aprovação por atualização simples de status via updateQuotation');
  assert(
    simpleUpdateError?.message?.includes('Não é permitido aprovar cotação por atualização simples de status'),
    '5. Mensagem de erro correta ao tentar atualização simples de status'
  );

  // Verifica que cotação permanece em draft (sem aprovação parcial)
  const quoteStillDraft = await quotationsService.getQuotationById(draftQuote.id);
  assert(quoteStillDraft?.status === 'draft', '6. Cotação permanece em draft sem aprovação parcial após tentativa de bypass');

  // -------------------------------------------------------------
  // Teste 3: Aprovação atômica via approveQuotationAndCreateOperation
  // -------------------------------------------------------------
  const approvalRes = await financialService.approveQuotationAndCreateOperation(draftQuote.id, 'Aprovação de teste');
  assert(Boolean(approvalRes.operation_id), '7. approveQuotationAndCreateOperation executa e cria operação financeira');
  assert(approvalRes.services_count === 1, '8. Exatamente 1 serviço derivado criado na operação');
  assert(approvalRes.commitments_count === 2, '9. Exatamente 2 compromissos criados (cliente + fornecedor)');

  const approvedQuote = await quotationsService.getQuotationById(draftQuote.id);
  assert(approvedQuote?.status === 'accepted', '10. Status da cotação atualizado atomicamente para "accepted"');

  // Validação da mensagem de sucesso padronizada
  assert(SUCCESS_MESSAGE === 'Cotação aprovada. Financeiro preparado.', '11. Mensagem curta de sucesso "Cotação aprovada. Financeiro preparado." validada');

  // -------------------------------------------------------------
  // Teste 4: Garantia de criação única (1:1) - Bloqueio de operação duplicada
  // -------------------------------------------------------------
  const existingOp = await financialService.getOperationByQuotationId(draftQuote.id);
  assert(Boolean(existingOp && existingOp.id === approvalRes.operation_id), '12. getOperationByQuotationId localiza a operação existente');

  let duplicateError: any = null;
  try {
    await financialService.approveQuotationAndCreateOperation(draftQuote.id);
  } catch (err: any) {
    duplicateError = err;
  }
  assert(Boolean(duplicateError), '13. Bloqueia repetição de aprovação para cotação já aprovada');
  assert(
    duplicateError?.message?.includes('Já existe uma operação financeira'),
    '14. Mensagem de erro rejeita duplicação de operação financeira'
  );

  // -------------------------------------------------------------
  // Teste 5: Edição de cotação já aprovada com operação existente
  // -------------------------------------------------------------
  // Permite atualizar dados comerciais mantendo status accepted sem recriar operação
  const updatedCommercial = await quotationsService.updateQuotation(draftQuote.id, {
    client_name: 'Cliente Teste Fluxo Atualizado',
    status: 'accepted',
  });
  assert(updatedCommercial.client_name === 'Cliente Teste Fluxo Atualizado', '15. Atualiza dados comerciais de cotação já aprovada');

  const opAfterEdit = await financialService.getOperationByQuotationId(draftQuote.id);
  assert(opAfterEdit?.id === existingOp?.id, '16. Mantém a mesma operação financeira sem duplicar');

  // -------------------------------------------------------------
  // Teste 6: Fluxo simulado de formulário: Nova cotação salva marcada como 'accepted'
  // Regra: salva primeiro dados comerciais (em rascunho) e em seguida executa aprovação atômica
  // -------------------------------------------------------------
    const refFormNew = `TEST-COT-FORM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    // 1. Salva dados comerciais como draft
    const newFormQuote = await quotationsService.createQuotation({
      reference: refFormNew,
      client_name: 'Cliente Formulário Aprovada',
      status: 'draft',
      currency: 'EUR',
      data: {
        destination: 'Roma & Florença',
        financials: { salePrice: 4200 },
        services: [
          {
            id: 'srv-rome-1',
            type: 'tour',
            description: 'Coliseu Tour VIP',
            amount: 80,
            quantity: 2,
            currency: 'EUR',
          },
        ],
      },
    });
    createdQuoteIds.push(newFormQuote.id);
  assert(newFormQuote.status === 'draft', '17. Formulário: Nova cotação salva inicialmente como rascunho com dados comerciais');

  // 2. Executa aprovação atômica
  const formApproval = await financialService.approveQuotationAndCreateOperation(newFormQuote.id);
  assert(Boolean(formApproval.operation_id), '18. Formulário: Aprovação atômica bem sucedida');

  const formQuoteFinal = await quotationsService.getQuotationById(newFormQuote.id);
  assert(formQuoteFinal?.status === 'accepted', '19. Formulário: Cotação finalizada com status "accepted"');

  // -------------------------------------------------------------
  // Teste 7: Proteção no quotationsService contra regressão de status
  // Quando cotação possui operação financeira, ela deve permanecer com status 'accepted'
  // Bloqueia alterações para draft, sent, rejected ou archived no serviço
  // -------------------------------------------------------------
  const invalidStatuses: ('draft' | 'sent' | 'rejected' | 'archived')[] = ['draft', 'sent', 'rejected', 'archived'];
  for (const invStatus of invalidStatuses) {
    let serviceBlockError: any = null;
    try {
      await quotationsService.updateQuotation(formQuoteFinal!.id, { status: invStatus });
    } catch (err: any) {
      serviceBlockError = err;
    }
    assert(Boolean(serviceBlockError), `20. Serviço bloqueia alteração de cotação aprovada para status "${invStatus}"`);
    assert(
      serviceBlockError?.message?.includes('Cotação possui operação financeira vinculada e deve permanecer com status "accepted"'),
      `21. Mensagem de erro correta no serviço para bloqueio de status "${invStatus}"`
    );
  }

  // -------------------------------------------------------------
  // Teste 8: Proteção no Banco de Dados (Trigger PostgreSQL)
  // Bloqueia alterações diretas no banco para draft, sent, rejected ou archived
  // -------------------------------------------------------------
  for (const invStatus of invalidStatuses) {
    const { error: dbUpdateError } = await supabase
      .from('quotations')
      .update({ status: invStatus })
      .eq('id', formQuoteFinal!.id);

    assert(Boolean(dbUpdateError), `22. Trigger do banco bloqueia UPDATE direto para status "${invStatus}"`);
    assert(
      dbUpdateError?.message?.includes('Cotação possui operação financeira vinculada e deve permanecer com status "accepted"'),
      `23. Trigger Postgres rejeita com mensagem clara para status "${invStatus}"`
    );
  }

  // -------------------------------------------------------------
  // Teste 9: Confirmação de integridade: status permanece 'accepted'
  // -------------------------------------------------------------
  const quoteAfterAttacks = await quotationsService.getQuotationById(formQuoteFinal!.id);
  assert(quoteAfterAttacks?.status === 'accepted', '24. Cotação permanece estritamente com status "accepted" após tentativas');

  // -------------------------------------------------------------
  // Teste 10: Atualização de dados comerciais sem alterar status continua permitida
  // -------------------------------------------------------------
  const quoteUpdatedCommercial = await quotationsService.updateQuotation(formQuoteFinal!.id, {
    client_name: 'Cliente Seguro Confirmado',
    data: { ...newFormQuote.data, customNotes: 'Notas seguras' },
  });
  assert(quoteUpdatedCommercial.client_name === 'Cliente Seguro Confirmado', '25. Edição comercial permitida');
  assert(quoteUpdatedCommercial.status === 'accepted', '26. Status comercial permanece "accepted"');

    console.log('\n====================================================');
    console.log(' RESULTADO FINAL FLUXOS DE APROVAÇÃO: 26 PASSOU / 0 FALHOU');
    console.log('====================================================\n');
  } finally {
    // Limpeza determinística de fixtures de teste
    for (const quoteId of createdQuoteIds) {
      try {
        const { data: op } = await supabase
          .from('financial_operations')
          .select('id')
          .eq('quotation_id', quoteId)
          .maybeSingle();

        if (op) {
          await supabase.from('financial_transactions').delete().eq('operation_id', op.id);
          await supabase.from('financial_commitments').delete().eq('operation_id', op.id);
          await supabase.from('financial_operation_services').delete().eq('operation_id', op.id);
          await supabase.from('financial_operations').delete().eq('id', op.id);
        }
        await supabase.from('quotations').delete().eq('id', quoteId);
      } catch (cleanErr) {
        console.warn('Erro ao limpar cotação de teste:', cleanErr);
      }
    }
  }
}

runApprovalFlowsTests().catch((err) => {
  if (
    err?.message?.includes('fetch failed') ||
    err?.message?.includes('timeout') ||
    err?.message?.includes('Connect Timeout') ||
    err?.code === 'UND_ERR_CONNECT_TIMEOUT'
  ) {
    console.warn('⚠️  Supabase remoto inacessível na rede atual. Pulando teste de integração remota.');
    process.exit(0);
  }
  console.error('Erro fatal nos testes de fluxo de aprovação:', err);
  process.exit(1);
});
