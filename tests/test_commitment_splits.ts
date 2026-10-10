/**
 * Testes Isolados de Validação: Divisão Atômica de Compromissos Financeiros (split_financial_commitment)
 *
 * Cobertura:
 * 1. Verificação estática da migração SQL (lock FOR UPDATE, revalidações, determinismo em cêntimos, grants)
 * 2. Divisão normal (valores pares em cêntimos)
 * 3. Divisão de valores ímpares em cêntimos (regra determinística com CEIL e conservação exata)
 * 4. Divisão customizada com p_first_amount
 * 5. Rejeição de valores inválidos (<= 0, < 0.02, first_amount >= total)
 * 6. Rejeição de estados não elegíveis (settled, partially_settled, cancelled, operação cancelada, faturas CC, ajustes)
 * 7. Rejeição de compromisso com movimentações financeiras vinculadas
 * 8. Simulação de atomicidade e rollback garantido em caso de falha no segundo passo
 * 9. Verificação de contratos de tipo e método tipado no financialService
 * 10. Proteção na página contra divisões com edições pendentes não salvas
 */

import * as fs from 'fs';
import * as path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${message}`);
}

// Simulador da regra determinística de cêntimos do PostgreSQL
function calculateSplitCents(totalAmount: number, customFirstAmount?: number): { first: number; second: number } {
  const totalCents = Math.round(totalAmount * 100);

  if (totalCents <= 0) {
    throw new Error('O valor do compromisso original deve ser maior que zero.');
  }
  if (totalCents < 2) {
    throw new Error('O valor do compromisso original (0.01) não pode ser dividido em duas parcelas positivas.');
  }

  let firstCents: number;
  let secondCents: number;

  if (customFirstAmount !== undefined && customFirstAmount !== null) {
    firstCents = Math.round(customFirstAmount * 100);
    if (firstCents <= 0) {
      throw new Error('O valor da primeira parcela deve ser maior que zero.');
    }
    if (firstCents >= totalCents) {
      throw new Error(`O valor da primeira parcela (${customFirstAmount}) deve ser menor que o valor total do compromisso (${totalAmount}).`);
    }
    secondCents = totalCents - firstCents;
  } else {
    // CEIL(totalCents / 2.0)
    firstCents = Math.ceil(totalCents / 2.0);
    secondCents = totalCents - firstCents;
  }

  const finalFirst = Number((firstCents / 100).toFixed(2));
  const finalSecond = Number((secondCents / 100).toFixed(2));

  // Invariante
  if (Number((finalFirst + finalSecond).toFixed(2)) !== Number(totalAmount.toFixed(2))) {
    throw new Error(`Inconsistência de soma: ${finalFirst} + ${finalSecond} !== ${totalAmount}`);
  }

  return { first: finalFirst, second: finalSecond };
}

// Simulador da máquina de validação da RPC split_financial_commitment
interface MockCommitment {
  id: string;
  operation_id: string;
  amount: number;
  status: string;
  is_credit_card_invoice?: boolean;
  is_cancellation_adjustment?: boolean;
  description?: string;
}

interface MockOperation {
  id: string;
  status: string;
}

interface MockTransaction {
  id: string;
  commitment_id: string;
}

function simulateRpcSplit(
  commitmentId: string,
  commitments: MockCommitment[],
  operations: MockOperation[],
  transactions: MockTransaction[],
  customFirstAmount?: number,
  shouldSimulateStep2Failure = false
): { updatedFirst: MockCommitment; createdSecond: MockCommitment } {
  if (!commitmentId) {
    throw new Error('O identificador do compromisso é obrigatório.');
  }

  // Snapshot inicial para garantia de rollback
  const initialSnapshot = JSON.parse(JSON.stringify(commitments));

  try {
    // 1. SELECT * FOR UPDATE
    const comm = commitments.find((c) => c.id === commitmentId);
    if (!comm) {
      throw new Error('Compromisso financeiro informado não foi encontrado.');
    }

    // 2. Revalidar sob lock
    if (comm.status === 'cancelled') {
      throw new Error('Não é possível dividir um compromisso cancelado.');
    }
    if (comm.status === 'settled') {
      throw new Error('Não é possível dividir um compromisso já liquidado.');
    }
    if (comm.status === 'partially_settled') {
      throw new Error('Não é possível dividir um compromisso parcialmente liquidado.');
    }
    if (comm.status !== 'planned') {
      throw new Error(`Apenas compromissos com status "planned" podem ser divididos (status atual: ${comm.status}).`);
    }

    // 3. Transações vinculadas
    const hasTxs = transactions.some((tx) => tx.commitment_id === commitmentId);
    if (hasTxs) {
      throw new Error('Não é possível dividir um compromisso que já possui movimentações financeiras registradas.');
    }

    // 4. Cartão de crédito ou cancelamento
    if (comm.is_credit_card_invoice) {
      throw new Error('Não é permitido dividir faturas originadas por pagamentos com cartão de crédito.');
    }
    if (comm.is_cancellation_adjustment) {
      throw new Error('Não é permitido dividir compromissos originados por ajustes de cancelamento ou reembolsos.');
    }

    // 5. Operação pai FOR UPDATE
    const op = operations.find((o) => o.id === comm.operation_id);
    if (!op) {
      throw new Error('Operação financeira vinculada não foi encontrada.');
    }
    if (op.status === 'cancelled') {
      throw new Error('Não é possível dividir compromissos de uma operação financeira cancelada.');
    }

    // 6. Cálculo dos valores determinísticos
    const { first, second } = calculateSplitCents(comm.amount, customFirstAmount);

    // 7. Passo 1: Atualizar 1ª parcela
    comm.amount = first;
    comm.description = `${comm.description || 'Parcela'} (1/2)`;

    // Falha deliberada de simulação de transação
    if (shouldSimulateStep2Failure) {
      throw new Error('Falha catastrófica simulada durante inserção da 2ª parcela (ex: constraint violation)');
    }

    // 8. Passo 2: Inserir 2ª parcela
    const createdSecond: MockCommitment = {
      id: `comm-split-${Date.now()}-${Math.random()}`,
      operation_id: comm.operation_id,
      amount: second,
      status: 'planned',
      description: `${comm.description || 'Parcela'} (2/2)`,
    };
    commitments.push(createdSecond);

    return { updatedFirst: comm, createdSecond };
  } catch (err) {
    // Simulação do ROLLBACK automático do PostgreSQL
    commitments.length = 0;
    commitments.push(...initialSnapshot);
    throw err;
  }
}

async function runSplitCommitmentTests() {
  console.log('=== TESTES ISOLADOS: DIVISÃO ATÔMICA DE COMPROMISSOS (PRIORIDADE 1) ===\n');

  // -------------------------------------------------------------
  // GRUPO 1: Validação Estática do Ficheiro de Migração SQL
  // -------------------------------------------------------------
  console.log('--- Grupo 1: Inspeção da Migração SQL ---');
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261010010000_atomic_split_financial_commitment.sql'
  );

  assert(fs.existsSync(migrationPath), '1. Ficheiro de migração 20261010010000_atomic_split_financial_commitment.sql existe');

  const rawSqlContent = fs.readFileSync(migrationPath, 'utf-8');
  const sqlContent = rawSqlContent.replace(/\r\n/g, '\n');
  assert(sqlContent.includes('CREATE OR REPLACE FUNCTION public.split_financial_commitment'), '2. Migração declara função public.split_financial_commitment');
  assert(sqlContent.includes('WHERE id = p_commitment_id\n  FOR UPDATE;'), '3. Migração executa lock explícito FOR UPDATE em financial_commitments');
  assert(sqlContent.includes('WHERE id = v_comm.operation_id\n  FOR UPDATE;'), '4. Migração executa lock explícito FOR UPDATE na operação financeira pai');
  assert(sqlContent.includes("v_comm.status <> 'planned'"), '5. Migração revalida status = planned sob lock');
  assert(sqlContent.includes("v_comm.status = 'cancelled'"), '6. Migração bloqueia compromisso cancelado');
  assert(sqlContent.includes("v_comm.status = 'settled'"), '7. Migração bloqueia compromisso liquidado');
  assert(sqlContent.includes("v_comm.status = 'partially_settled'"), '8. Migração bloqueia compromisso parcialmente liquidado');
  assert(sqlContent.includes('FROM public.financial_transactions\n    WHERE commitment_id = p_commitment_id'), '9. Migração revalida ausência de transações reais sob lock');
  assert(sqlContent.includes('v_comm.is_credit_card_invoice IS TRUE'), '10. Migração protege faturas de cartão contra divisão');
  assert(sqlContent.includes('v_comm.is_cancellation_adjustment IS TRUE'), '11. Migração protege ajustes de cancelamento contra divisão');
  assert(sqlContent.includes("v_op.status = 'cancelled'"), '12. Migração protege operações canceladas contra divisão');
  assert(sqlContent.includes('ROUND(v_comm.amount * 100)::INT;'), '13. Migração faz cálculo determinístico em cêntimos inteiros');
  assert(sqlContent.includes('CEIL(v_total_cents / 2.0)::INT;'), '14. Migração utiliza CEIL determinístico para a 1ª parcela em cêntimos ímpares');
  assert(sqlContent.includes('(v_final_first_amount + v_final_second_amount) <> v_comm.amount'), '15. Migração valida invariante estrita de conservação exata');
  assert(sqlContent.includes('SECURITY DEFINER'), '16. Migração define SECURITY DEFINER');
  assert(sqlContent.includes('SET search_path = public'), '17. Migração define SET search_path = public');
  assert(sqlContent.includes('GRANT EXECUTE ON FUNCTION public.split_financial_commitment(UUID, NUMERIC, DATE, TEXT, TEXT) TO anon, authenticated;'), '18. Migração define privilégios estritos para anon, authenticated');

  // -------------------------------------------------------------
  // GRUPO 2: Divisão Normal (Valores Pares em Cêntimos)
  // -------------------------------------------------------------
  console.log('\n--- Grupo 2: Divisão Normal de Cêntimos Pares ---');
  const even1 = calculateSplitCents(100.00);
  assert(even1.first === 50.00 && even1.second === 50.00, '19. 100.00 EUR divide exatamente em 50.00 e 50.00');
  assert(even1.first + even1.second === 100.00, '20. Soma da divisão de 100.00 é exatamente 100.00');

  const even2 = calculateSplitCents(1234.56);
  assert(even2.first === 617.28 && even2.second === 617.28, '21. 1234.56 EUR divide em 617.28 e 617.28');
  assert(Number((even2.first + even2.second).toFixed(2)) === 1234.56, '22. Soma da divisão de 1234.56 é exatamente 1234.56');

  const even3 = calculateSplitCents(0.02);
  assert(even3.first === 0.01 && even3.second === 0.01, '23. Mínimo divisível 0.02 EUR divide em 0.01 e 0.01');

  // -------------------------------------------------------------
  // GRUPO 3: Divisão com Cêntimos Ímpares (Determinismo e Conservação)
  // -------------------------------------------------------------
  console.log('\n--- Grupo 3: Divisão de Valores com Cêntimos Ímpares ---');
  const odd1 = calculateSplitCents(100.05);
  assert(odd1.first === 50.03, '24. 100.05 EUR atribui 50.03 EUR (teto em cêntimos) à 1ª parcela');
  assert(odd1.second === 50.02, '25. 100.05 EUR atribui 50.02 EUR à 2ª parcela');
  assert(Number((odd1.first + odd1.second).toFixed(2)) === 100.05, '26. Soma exata conservada: 50.03 + 50.02 = 100.05');

  const odd2 = calculateSplitCents(0.03);
  assert(odd2.first === 0.02 && odd2.second === 0.01, '27. 0.03 EUR divide em 0.02 e 0.01 sem perda');
  assert(Number((odd2.first + odd2.second).toFixed(2)) === 0.03, '28. Soma exata conservada: 0.02 + 0.01 = 0.03');

  // Teste de estresse com 1000 valores ímpares arbitrários
  let stressPassed = true;
  for (let c = 3; c <= 2000; c += 2) {
    const val = Number((c / 100).toFixed(2));
    const res = calculateSplitCents(val);
    if (res.first <= 0 || res.second <= 0 || Number((res.first + res.second).toFixed(2)) !== val) {
      stressPassed = false;
      break;
    }
  }
  assert(stressPassed, '29. Teste determinístico de estresse em 1000 valores ímpares consecutivos passou com conservação exata');

  // -------------------------------------------------------------
  // GRUPO 4: Divisão Customizada (p_first_amount)
  // -------------------------------------------------------------
  console.log('\n--- Grupo 4: Divisão com Parcela Customizada ---');
  const custom1 = calculateSplitCents(100.00, 33.33);
  assert(custom1.first === 33.33 && custom1.second === 66.67, '30. Total 100.00 com 1ª parcela 33.33 resulta em 33.33 e 66.67');
  assert(Number((custom1.first + custom1.second).toFixed(2)) === 100.00, '31. Soma exata conservada com parcela customizada');

  const custom2 = calculateSplitCents(100.00, 0.01);
  assert(custom2.first === 0.01 && custom2.second === 99.99, '32. Total 100.00 com 1ª parcela mínima 0.01 resulta em 0.01 e 99.99');

  // -------------------------------------------------------------
  // GRUPO 5: Rejeição de Valores Inválidos
  // -------------------------------------------------------------
  console.log('\n--- Grupo 5: Rejeição de Valores Inválidos ---');
  let errZero = false;
  try {
    calculateSplitCents(0.00);
  } catch (e: any) {
    errZero = e.message.includes('maior que zero');
  }
  assert(errZero, '33. Valor 0.00 é rejeitado');

  let errNeg = false;
  try {
    calculateSplitCents(-50.00);
  } catch (e: any) {
    errNeg = e.message.includes('maior que zero');
  }
  assert(errNeg, '34. Valor negativo é rejeitado');

  let errIndivisible = false;
  try {
    calculateSplitCents(0.01);
  } catch (e: any) {
    errIndivisible = e.message.includes('não pode ser dividido em duas parcelas positivas');
  }
  assert(errIndivisible, '35. Valor 0.01 (indivisível em centavos positivos) é rejeitado');

  let errCustomZero = false;
  try {
    calculateSplitCents(100.00, 0);
  } catch (e: any) {
    errCustomZero = e.message.includes('maior que zero');
  }
  assert(errCustomZero, '36. 1ª parcela customizada de valor zero é rejeitada');

  let errCustomGreater = false;
  try {
    calculateSplitCents(100.00, 100.00);
  } catch (e: any) {
    errCustomGreater = e.message.includes('menor que o valor total');
  }
  assert(errCustomGreater, '37. 1ª parcela customizada igual ou maior que o total é rejeitada');

  // -------------------------------------------------------------
  // GRUPO 6: Rejeição de Estados Não Elegíveis
  // -------------------------------------------------------------
  console.log('\n--- Grupo 6: Rejeição de Estados Não Elegíveis ---');
  const baseOp: MockOperation = { id: 'op-1', status: 'active' };

  let errSettled = false;
  try {
    simulateRpcSplit(
      'comm-settled',
      [{ id: 'comm-settled', operation_id: 'op-1', amount: 100, status: 'settled' }],
      [baseOp],
      []
    );
  } catch (e: any) {
    errSettled = e.message.includes('já liquidado');
  }
  assert(errSettled, '38. Compromisso com status "settled" é rejeitado');

  let errPartiallySettled = false;
  try {
    simulateRpcSplit(
      'comm-part',
      [{ id: 'comm-part', operation_id: 'op-1', amount: 100, status: 'partially_settled' }],
      [baseOp],
      []
    );
  } catch (e: any) {
    errPartiallySettled = e.message.includes('parcialmente liquidado');
  }
  assert(errPartiallySettled, '39. Compromisso com status "partially_settled" é rejeitado');

  let errCancelled = false;
  try {
    simulateRpcSplit(
      'comm-canc',
      [{ id: 'comm-canc', operation_id: 'op-1', amount: 100, status: 'cancelled' }],
      [baseOp],
      []
    );
  } catch (e: any) {
    errCancelled = e.message.includes('cancelado');
  }
  assert(errCancelled, '40. Compromisso com status "cancelled" é rejeitado');

  let errCcInvoice = false;
  try {
    simulateRpcSplit(
      'comm-cc',
      [{ id: 'comm-cc', operation_id: 'op-1', amount: 100, status: 'planned', is_credit_card_invoice: true }],
      [baseOp],
      []
    );
  } catch (e: any) {
    errCcInvoice = e.message.includes('faturas originadas por pagamentos com cartão');
  }
  assert(errCcInvoice, '41. Fatura de cartão de crédito (is_credit_card_invoice) é rejeitada');

  let errAdj = false;
  try {
    simulateRpcSplit(
      'comm-adj',
      [{ id: 'comm-adj', operation_id: 'op-1', amount: 100, status: 'planned', is_cancellation_adjustment: true }],
      [baseOp],
      []
    );
  } catch (e: any) {
    errAdj = e.message.includes('ajustes de cancelamento');
  }
  assert(errAdj, '42. Ajuste de cancelamento (is_cancellation_adjustment) é rejeitado');

  let errOpCancelled = false;
  try {
    simulateRpcSplit(
      'comm-op-canc',
      [{ id: 'comm-op-canc', operation_id: 'op-canc', amount: 100, status: 'planned' }],
      [{ id: 'op-canc', status: 'cancelled' }],
      []
    );
  } catch (e: any) {
    errOpCancelled = e.message.includes('operação financeira cancelada');
  }
  assert(errOpCancelled, '43. Compromisso de operação financeira cancelada é rejeitado');

  // -------------------------------------------------------------
  // GRUPO 7: Rejeição de Compromisso com Transações Reais
  // -------------------------------------------------------------
  console.log('\n--- Grupo 7: Rejeição de Compromisso com Transações Vinculadas ---');
  let errTx = false;
  try {
    simulateRpcSplit(
      'comm-with-tx',
      [{ id: 'comm-with-tx', operation_id: 'op-1', amount: 100, status: 'planned' }],
      [baseOp],
      [{ id: 'tx-1', commitment_id: 'comm-with-tx' }]
    );
  } catch (e: any) {
    errTx = e.message.includes('movimentações financeiras registradas');
  }
  assert(errTx, '44. Compromisso com transação real vinculada é rejeitado');

  // -------------------------------------------------------------
  // GRUPO 8: Simulação de Atomicidade e Rollback Garantido
  // -------------------------------------------------------------
  console.log('\n--- Grupo 8: Atomicidade e Rollback em Caso de Falha ---');
  const mockCommitmentsList: MockCommitment[] = [
    { id: 'comm-atomic', operation_id: 'op-1', amount: 250.00, status: 'planned', description: 'Recebimento Inicial' },
  ];

  let rollbackCaught = false;
  try {
    simulateRpcSplit('comm-atomic', mockCommitmentsList, [baseOp], [], undefined, true);
  } catch (e: any) {
    rollbackCaught = true;
  }

  assert(rollbackCaught, '45. Exceção deliberada durante a 2ª etapa foi acionada');
  assert(mockCommitmentsList.length === 1, '46. Nenhuma segunda parcela órfã foi persistida');
  assert(mockCommitmentsList[0].amount === 250.00, '47. Parcela original NÃO sofreu corte de 50% (rollback restaurou montante integral)');
  assert(mockCommitmentsList[0].description === 'Recebimento Inicial', '48. Descrição original foi restaurada intacta');

  // Execução de sucesso para validar integridade
  const successResult = simulateRpcSplit('comm-atomic', mockCommitmentsList, [baseOp], []);
  assert(mockCommitmentsList.length === 2, '49. Divisão bem-sucedida resultou em 2 parcelas');
  assert(successResult.updatedFirst.amount === 125.00, '50. 1ª parcela atualizada para 125.00');
  assert(successResult.createdSecond.amount === 125.00, '51. 2ª parcela criada com 125.00');
  assert(Number((successResult.updatedFirst.amount + successResult.createdSecond.amount).toFixed(2)) === 250.00, '52. Soma total após divisão bem-sucedida é exatamente 250.00');

  // -------------------------------------------------------------
  // GRUPO 9: Verificação de Tipos e Contrato no financialService
  // -------------------------------------------------------------
  console.log('\n--- Grupo 9: Contratos de Serviço e Tipos ---');
  const { financialService } = await import('../src/services/financialService');
  assert(typeof financialService.splitCommitment === 'function', '53. financialService.splitCommitment é uma função exportada');

  // -------------------------------------------------------------
  // GRUPO 10: Verificação de Proteção na Página do Módulo Financeiro
  // -------------------------------------------------------------
  console.log('\n--- Grupo 10: Proteção em QuotationFinancialPage ---');
  const pagePath = path.resolve(process.cwd(), 'src/pages/quotes/QuotationFinancialPage.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf-8');

  assert(pageContent.includes('financialService.splitCommitment'), '54. QuotationFinancialPage chama financialService.splitCommitment');
  assert(!pageContent.includes('const currentAmount = Number(receivableEdits[item.id]?.amount ?? item.amount);'), '55. QuotationFinancialPage eliminou cálculo client-side inseguro com receivableEdits');
  assert(pageContent.includes('Existem alterações não salvas nesta parcela. Salve as alterações antes de dividir.'), '56. QuotationFinancialPage bloqueia divisão quando há edições locais não salvas');

  console.log('\n=============================================================');
  console.log('🎉 TODOS OS 56 TESTES ISOLADOS PASSARAM COM SUCESSO!');
  console.log('=============================================================\n');
}

runSplitCommitmentTests().catch((err) => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});
