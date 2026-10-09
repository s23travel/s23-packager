/**
 * Testes de Integração Real: RPC split_financial_commitment em Supabase DEV (rskhshtewkgrllbtamsr)
 *
 * Cobertura Real contra o PostgreSQL de DEV:
 * 1. Verificação de segurança de ambiente (.env.local apontando exclusivamente para DEV)
 * 2. Cenário 1: Divisão normal de parcelas pares (50/50) com persistência real
 * 3. Cenário 2: Divisão determinística de cêntimos ímpares (CEIL na 1ª parcela e soma exata)
 * 4. Cenário 3: Divisão com montante personalizado (p_first_amount)
 * 5. Cenário 4: Bloqueio sob lock de compromisso liquidado (status = 'settled')
 * 6. Cenário 5: Bloqueio sob lock de compromisso com movimentações financeiras registradas
 * 7. Cenário 6: Bloqueio de compromisso sob operação financeira cancelada
 * 8. Cenário 7: Atomicidade e rollback integral no PostgreSQL após tentativa inválida
 * 9. Teardown rigoroso em bloco finally (remove exclusivamente fixtures de teste criadas)
 */

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

async function runLiveSplitCommitmentTests() {
  console.log('=== TESTES DE INTEGRAÇÃO REAL: split_financial_commitment EM SUPABASE DEV ===\n');

  const DEV_PROJECT_REF = 'rskhshtewkgrllbtamsr';
  const PROD_REF = 'iqtfqitquykasvfybndl';

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

  assert(Boolean(supabaseUrl), '1. VITE_SUPABASE_URL está configurada');
  assert(Boolean(supabaseKey), '2. VITE_SUPABASE_ANON_KEY está configurada');
  assert(supabaseUrl.includes(DEV_PROJECT_REF), '3. VITE_SUPABASE_URL aponta para o projeto de desenvolvimento (DEV: rskhshtewkgrllbtamsr)');
  assert(!supabaseUrl.includes(PROD_REF), '4. VITE_SUPABASE_URL NÃO aponta para produção');

  // Teste de conectividade
  try {
    await fetch(supabaseUrl, { signal: AbortSignal.timeout(3000) });
  } catch (err: any) {
    console.warn('⚠️ Supabase remoto inacessível na rede atual. Pulando testes.');
    return;
  }

  const { supabase } = await import('../src/lib/supabase');
  const { quotationsService } = await import('../src/services/quotationsService');
  const { financialService } = await import('../src/services/financialService');

  const createdQuoteIds: string[] = [];
  const createdAccountIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // Preparação: Criar cotação e aprovar para gerar operação financeira de teste
    // -------------------------------------------------------------
    console.log('--- Preparação de Fixtures Efêmeras em DEV ---');
    const quoteRef1 = `TEST-SPLIT-DEV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const testQuote1 = await quotationsService.createQuotation({
      reference: quoteRef1,
      client_name: 'Cliente Teste Split Live 1',
      status: 'draft',
      currency: 'EUR',
      data: {
        destination: 'Madeira',
        financials: { salePrice: 1000 },
        services: [
          {
            id: 'srv-split-1',
            type: 'tour',
            description: 'Passeio Levada',
            amount: 100,
            quantity: 1,
            currency: 'EUR',
          },
        ],
      },
    });
    createdQuoteIds.push(testQuote1.id);
    assert(Boolean(testQuote1.id), '5. Cotação de teste 1 criada em status draft');

    const approval1 = await financialService.approveQuotationAndCreateOperation(testQuote1.id, 'Aprovação teste split');
    const operation1Id = approval1.operation_id;
    assert(Boolean(operation1Id), '6. Operação financeira de teste 1 gerada com sucesso');

    // Criar conta bancária de teste para simulação de liquidação
    const testAccount = await financialService.createAccount({
      name: `Conta Teste Split Live ${Date.now()}`,
      type: 'bank_account',
      currency: 'EUR',
      initial_balance: 5000,
    });
    createdAccountIds.push(testAccount.id);
    assert(Boolean(testAccount.id), '7. Conta bancária de teste criada');

    // -------------------------------------------------------------
    // Cenário 1: Divisão Par (50/50)
    // -------------------------------------------------------------
    console.log('\n--- Cenário 1: Divisão de Valores Pares em Cêntimos ---');
    const comm1 = await financialService.createCommitment({
      operation_id: operation1Id,
      type: 'receivable',
      counterparty_name: 'Cliente Par',
      counterparty_type: 'client',
      amount: 100.00,
      currency: 'EUR',
      status: 'planned',
      description: 'Recebimento Par Teste',
    });

    const splitRes1 = await financialService.splitCommitment({
      commitment_id: comm1.id,
    });

    assert(splitRes1.success === true, '8. splitCommitment executou com sucesso para valor par');
    assert(splitRes1.first_amount === 50.00, '9. Retorno da 1ª parcela = 50.00 EUR');
    assert(splitRes1.second_amount === 50.00, '10. Retorno da 2ª parcela = 50.00 EUR');

    // Validar diretamente na tabela PostgreSQL
    const { data: dbComm1 } = await supabase.from('financial_commitments').select('*').eq('id', comm1.id).single();
    const { data: dbComm1Second } = await supabase.from('financial_commitments').select('*').eq('id', splitRes1.second_commitment.id).single();

    assert(Number(dbComm1.amount) === 50.00, '11. PostgreSQL persistiu 50.00 EUR na 1ª parcela');
    assert(dbComm1.description.includes('(1/2)'), '12. PostgreSQL atualizou descrição para (1/2)');
    assert(Number(dbComm1Second.amount) === 50.00, '13. PostgreSQL persistiu 50.00 EUR na 2ª parcela');
    assert(dbComm1Second.description.includes('(2/2)'), '14. PostgreSQL definiu descrição (2/2) na nova parcela');
    assert(dbComm1Second.status === 'planned', '15. 2ª parcela persistida com status "planned"');
    assert(dbComm1Second.operation_id === operation1Id, '16. 2ª parcela vinculada à mesma operação financeira');

    // -------------------------------------------------------------
    // Cenário 2: Divisão de Cêntimos Ímpares (CEIL na 1ª parcela)
    // -------------------------------------------------------------
    console.log('\n--- Cenário 2: Divisão de Cêntimos Ímpares com Conservação Estrita ---');
    const comm2 = await financialService.createCommitment({
      operation_id: operation1Id,
      type: 'receivable',
      counterparty_name: 'Cliente Ímpar',
      counterparty_type: 'client',
      amount: 100.05,
      currency: 'EUR',
      status: 'planned',
      description: 'Recebimento Ímpar Teste',
    });

    const splitRes2 = await financialService.splitCommitment({
      commitment_id: comm2.id,
    });

    assert(splitRes2.first_amount === 50.03, '17. 1ª parcela recebeu teto determinístico (50.03 EUR)');
    assert(splitRes2.second_amount === 50.02, '18. 2ª parcela recebeu restante exato (50.02 EUR)');

    const { data: dbComm2 } = await supabase.from('financial_commitments').select('*').eq('id', comm2.id).single();
    const { data: dbComm2Second } = await supabase.from('financial_commitments').select('*').eq('id', splitRes2.second_commitment.id).single();

    const sumDb = Number((Number(dbComm2.amount) + Number(dbComm2Second.amount)).toFixed(2));
    assert(sumDb === 100.05, '19. PostgreSQL conservou a soma exata: 50.03 + 50.02 = 100.05 EUR');

    // -------------------------------------------------------------
    // Cenário 3: Divisão Customizada (p_first_amount)
    // -------------------------------------------------------------
    console.log('\n--- Cenário 3: Divisão com Parcela Personalizada ---');
    const comm3 = await financialService.createCommitment({
      operation_id: operation1Id,
      type: 'receivable',
      counterparty_name: 'Cliente Custom',
      counterparty_type: 'client',
      amount: 100.00,
      currency: 'EUR',
      status: 'planned',
      description: 'Recebimento Customizado',
    });

    const splitRes3 = await financialService.splitCommitment({
      commitment_id: comm3.id,
      first_amount: 33.33,
    });

    assert(splitRes3.first_amount === 33.33, '20. 1ª parcela customizada = 33.33 EUR');
    assert(splitRes3.second_amount === 66.67, '21. 2ª parcela complementar = 66.67 EUR');

    const { data: dbComm3 } = await supabase.from('financial_commitments').select('*').eq('id', comm3.id).single();
    const { data: dbComm3Second } = await supabase.from('financial_commitments').select('*').eq('id', splitRes3.second_commitment.id).single();

    assert(Number(dbComm3.amount) === 33.33 && Number(dbComm3Second.amount) === 66.67, '22. PostgreSQL persistiu exatamente 33.33 e 66.67 EUR');

    // -------------------------------------------------------------
    // Cenário 4: Bloqueio sob Lock de Compromisso Liquidado
    // -------------------------------------------------------------
    console.log('\n--- Cenário 4: Bloqueio sob Lock de Compromisso Liquidado ---');
    const comm4 = await financialService.createCommitment({
      operation_id: operation1Id,
      type: 'receivable',
      counterparty_name: 'Cliente Liquidado',
      counterparty_type: 'client',
      amount: 80.00,
      currency: 'EUR',
      status: 'planned',
      description: 'Recebimento Liquidado',
    });

    // Liquidar compromisso via RPC oficial
    await financialService.recordCommitmentSettlement({
      commitment_id: comm4.id,
      account_id: testAccount.id,
      amount: 80.00,
    });

    let settledError: any = null;
    try {
      await financialService.splitCommitment({
        commitment_id: comm4.id,
      });
    } catch (err: any) {
      settledError = err;
    }

    assert(Boolean(settledError), '23. splitCommitment rejeita compromisso liquidado');
    assert(
      settledError?.message?.includes('já liquidado'),
      '24. Mensagem de erro do PostgreSQL confirma: "Não é possível dividir um compromisso já liquidado."'
    );

    // -------------------------------------------------------------
    // Cenário 5: Bloqueio sob Lock de Compromisso com Movimentações Reais
    // -------------------------------------------------------------
    console.log('\n--- Cenário 5: Bloqueio de Compromisso com Movimentações Registradas ---');
    const comm5 = await financialService.createCommitment({
      operation_id: operation1Id,
      type: 'receivable',
      counterparty_name: 'Cliente Parcial',
      counterparty_type: 'client',
      amount: 150.00,
      currency: 'EUR',
      status: 'planned',
      description: 'Recebimento Parcial',
    });

    // Liquidação parcial de 50 EUR
    await financialService.recordCommitmentSettlement({
      commitment_id: comm5.id,
      account_id: testAccount.id,
      amount: 50.00,
    });

    let txError: any = null;
    try {
      await financialService.splitCommitment({
        commitment_id: comm5.id,
      });
    } catch (err: any) {
      txError = err;
    }

    assert(Boolean(txError), '25. splitCommitment rejeita compromisso parcialmente liquidado');
    assert(
      txError?.message?.includes('parcialmente liquidado') || txError?.message?.includes('movimentações financeiras'),
      '26. Mensagem de erro do PostgreSQL bloqueia operação com transações reais'
    );

    // -------------------------------------------------------------
    // Cenário 6: Bloqueio sob Operação Financeira Cancelada
    // -------------------------------------------------------------
    console.log('\n--- Cenário 6: Bloqueio de Compromisso em Operação Cancelada ---');
    const quoteRef2 = `TEST-SPLIT-CANC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const testQuote2 = await quotationsService.createQuotation({
      reference: quoteRef2,
      client_name: 'Cliente Teste Cancelamento',
      status: 'draft',
      currency: 'EUR',
      data: { destination: 'Porto', financials: { salePrice: 500 } },
    });
    createdQuoteIds.push(testQuote2.id);

    const approval2 = await financialService.approveQuotationAndCreateOperation(testQuote2.id, 'Teste op cancelada');
    const operation2Id = approval2.operation_id;

    const comm6 = await financialService.createCommitment({
      operation_id: operation2Id,
      type: 'receivable',
      counterparty_name: 'Cliente Op Cancelada',
      counterparty_type: 'client',
      amount: 200.00,
      currency: 'EUR',
      status: 'planned',
      description: 'Compromisso em Op Cancelada',
    });

    // Cancelar a operação pai via RPC oficial
    await financialService.cancelFinancialOperation(operation2Id, 'Cancelamento de teste');

    let opCancError: any = null;
    try {
      await financialService.splitCommitment({
        commitment_id: comm6.id,
      });
    } catch (err: any) {
      opCancError = err;
    }

    assert(Boolean(opCancError), '27. splitCommitment rejeita divisão sob operação cancelada');
    assert(
      opCancError?.message?.includes('operação financeira cancelada') || opCancError?.message?.includes('cancelado'),
      '28. Mensagem de erro do PostgreSQL confirma rejeição sob operação cancelada'
    );

    // -------------------------------------------------------------
    // Cenário 7: Atomicidade e Rollback no PostgreSQL após Tentativa Inválida
    // -------------------------------------------------------------
    console.log('\n--- Cenário 7: Atomicidade e Rollback Integral no PostgreSQL ---');
    const comm7 = await financialService.createCommitment({
      operation_id: operation1Id,
      type: 'receivable',
      counterparty_name: 'Cliente Rollback',
      counterparty_type: 'client',
      amount: 75.00,
      currency: 'EUR',
      status: 'planned',
      description: 'Recebimento Rollback Intacto',
    });

    // Contar compromissos antes da tentativa inválida
    const { count: countBefore } = await supabase
      .from('financial_commitments')
      .select('*', { count: 'exact', head: true })
      .eq('operation_id', operation1Id);

    let invalidAmountError: any = null;
    try {
      // Passar montante da 1ª parcela igual ao total (75.00), violando regra
      await financialService.splitCommitment({
        commitment_id: comm7.id,
        first_amount: 75.00,
      });
    } catch (err: any) {
      invalidAmountError = err;
    }

    assert(Boolean(invalidAmountError), '29. Chamada inválida (first_amount >= total) gerou exceção esperada');
    assert(
      invalidAmountError?.message?.includes('menor que o valor total'),
      '30. Mensagem de erro correta do PostgreSQL validada'
    );

    // Verificar no PostgreSQL que o compromisso original permaneceu 100% INTACTO
    const { data: dbComm7After } = await supabase.from('financial_commitments').select('*').eq('id', comm7.id).single();
    const { count: countAfter } = await supabase
      .from('financial_commitments')
      .select('*', { count: 'exact', head: true })
      .eq('operation_id', operation1Id);

    assert(Number(dbComm7After.amount) === 75.00, '31. Rollback preservou o montante original de 75.00 EUR (sem corte de 50%)');
    assert(dbComm7After.description === 'Recebimento Rollback Intacto', '32. Rollback preservou a descrição original intacta');
    assert(countBefore === countAfter, '33. Rollback garantiu que nenhuma parcela órfã foi criada no banco de dados');

    console.log('\n=============================================================');
    console.log('🎉 TODOS OS 33 TESTES DE INTEGRAÇÃO REAL EM DEV PASSARAM!');
    console.log('=============================================================\n');
  } finally {
    // -------------------------------------------------------------
    // Limpeza Estrita e Protegida: Remove apenas as fixtures criadas neste teste
    // -------------------------------------------------------------
    console.log('--- Limpeza Determinística de Fixtures de Teste em DEV ---');
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
        console.log(`🧹 Fixtures da cotação ${quoteId} removidas com sucesso.`);
      } catch (cleanErr) {
        console.warn(`Erro ao limpar cotação de teste ${quoteId}:`, cleanErr);
      }
    }

    for (const accId of createdAccountIds) {
      try {
        await supabase.from('financial_transactions').delete().eq('account_id', accId);
        await supabase.from('financial_accounts').delete().eq('id', accId);
        console.log(`🧹 Conta bancária de teste ${accId} removida com sucesso.`);
      } catch (cleanErr) {
        console.warn(`Erro ao limpar conta de teste ${accId}:`, cleanErr);
      }
    }
  }
}

runLiveSplitCommitmentTests().catch((err) => {
  console.error('Erro fatal nos testes de integração real:', err);
  process.exit(1);
});
