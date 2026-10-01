import { supabase } from '../lib/supabase';
import {
  FinancialAccount,
  CreateFinancialAccountInput,
  UpdateFinancialAccountInput,
  FinancialOperation,
  FinancialOperationStatus,
  FinancialOperationService,
  CreateFinancialOperationServiceInput,
  FinancialCommitment,
  CreateFinancialCommitmentInput,
  FinancialTransaction,
  CreateFinancialTransactionInput,
  FinancialOperationDetails,
  ApproveQuotationAndCreateOperationResult,
  RecordCommitmentSettlementInput,
  RecordCommitmentSettlementResult,
  RecordAccountTransferInput,
  RecordAccountTransferResult,
  CancelFinancialOperationResult,
  CancelOperationServiceWithAdjustmentsInput,
  CancelOperationServiceWithAdjustmentsResult,
  CreateCancellationAdjustmentInput,
  ServiceItem,
  Currency,
} from '../types';

export const financialService = {
  // ==========================================
  // 1. CONTAS FINANCEIRAS
  // ==========================================

  /**
   * Lista contas financeiras (ex.: Caixa Portugal em EUR, Caixa Brasil em BRL, cartões)
   */
  async listAccounts(activeOnly = false): Promise<FinancialAccount[]> {
    let query = supabase.from('financial_accounts').select('*').order('name');
    if (activeOnly) {
      query = query.eq('active', true);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Erro ao listar contas financeiras:', error);
      throw new Error(error.message);
    }
    return (data || []) as FinancialAccount[];
  },

  /**
   * Cria uma nova conta financeira com saldo inicial e data de referência
   */
  async createAccount(input: CreateFinancialAccountInput): Promise<FinancialAccount> {
    const { data, error } = await supabase
      .from('financial_accounts')
      .insert({
        name: input.name.trim(),
        type: input.type,
        currency: input.currency,
        description: input.description ?? null,
        active: input.active ?? true,
        initial_balance: input.initial_balance ?? 0.0,
        initial_balance_date: input.initial_balance_date ?? new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar conta financeira:', error);
      throw new Error(error.message);
    }
    return data as FinancialAccount;
  },

  /**
   * Obtém uma conta financeira pelo ID
   */
  async getAccountById(id: string): Promise<FinancialAccount | null> {
    const { data, error } = await supabase
      .from('financial_accounts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar conta financeira:', error);
      throw new Error(error.message);
    }
    return data as FinancialAccount | null;
  },

  /**
   * Atualiza campos de uma conta financeira (nome, tipo, moeda, saldo inicial, data de referência, active)
   */
  async updateAccount(
    id: string,
    updates: UpdateFinancialAccountInput
  ): Promise<FinancialAccount> {
    const { data, error } = await supabase
      .from('financial_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar conta financeira:', error);
      throw new Error(error.message);
    }
    return data as FinancialAccount;
  },

  // ==========================================
  // 2. OPERAÇÕES FINANCEIRAS
  // ==========================================

  /**
   * Busca operação financeira associada a uma cotação (máximo 1)
   */
  async getOperationByQuotationId(quotationId: string): Promise<FinancialOperation | null> {
    const { data, error } = await supabase
      .from('financial_operations')
      .select('*')
      .eq('quotation_id', quotationId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar operação financeira por cotação:', error);
      throw new Error(error.message);
    }
    return data as FinancialOperation | null;
  },

  /**
   * Obtém detalhes completos de uma operação financeira (serviços, compromissos e transações)
   */
  async getOperationDetails(operationId: string): Promise<FinancialOperationDetails | null> {
    const { data: op, error: opError } = await supabase
      .from('financial_operations')
      .select('*')
      .eq('id', operationId)
      .maybeSingle();

    if (opError) {
      console.error('Erro ao buscar operação:', opError);
      throw new Error(opError.message);
    }
    if (!op) return null;

    const [servicesRes, commitmentsRes, transactionsRes] = await Promise.all([
      supabase
        .from('financial_operation_services')
        .select('*')
        .eq('operation_id', operationId)
        .order('created_at'),
      supabase
        .from('financial_commitments')
        .select('*')
        .eq('operation_id', operationId)
        .order('created_at'),
      supabase
        .from('financial_transactions')
        .select('*')
        .eq('operation_id', operationId)
        .order('transacted_at', { ascending: false }),
    ]);

    if (servicesRes.error) throw new Error(servicesRes.error.message);
    if (commitmentsRes.error) throw new Error(commitmentsRes.error.message);
    if (transactionsRes.error) throw new Error(transactionsRes.error.message);

    return {
      ...(op as FinancialOperation),
      services: (servicesRes.data || []) as FinancialOperationService[],
      commitments: (commitmentsRes.data || []) as FinancialCommitment[],
      transactions: (transactionsRes.data || []) as FinancialTransaction[],
    };
  },

  /**
   * Aprova atomicamente uma cotação e inicializa a operação financeira no banco de dados via RPC.
   * Garante rollback total caso qualquer etapa falhe.
   */
  async approveQuotationAndCreateOperation(
    quotationId: string,
    notes?: string
  ): Promise<ApproveQuotationAndCreateOperationResult> {
    const { data, error } = await supabase.rpc('approve_quotation_and_create_operation', {
      p_quotation_id: quotationId,
      p_notes: notes ?? null,
    });

    if (error) {
      console.error('Erro na aprovação atômica da cotação:', error);
      throw new Error(error.message);
    }

    return data as ApproveQuotationAndCreateOperationResult;
  },

  /**
   * Cria uma nova operação financeira a partir de uma cotação aprovada.
   * Suporta tanto financials.salePrice quanto financials.priceTotal.amount legado.
   */
  async createOperationFromAcceptedQuotation(
    quotationId: string,
    notes?: string
  ): Promise<FinancialOperationDetails> {
    // 1. Carregar cotação
    const { data: quote, error: quoteErr } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', quotationId)
      .maybeSingle();

    if (quoteErr) throw new Error(quoteErr.message);
    if (!quote) throw new Error('Cotação não encontrada.');

    // 2. Validar status aprovado
    if (quote.status !== 'accepted') {
      throw new Error(
        `Não é possível iniciar operação financeira para cotação com status "${quote.status}". A cotação deve estar aprovada (status 'accepted').`
      );
    }

    // 3. Validar se já existe operação financeira para esta cotação (regra 1:1)
    const existing = await this.getOperationByQuotationId(quotationId);
    if (existing) {
      throw new Error('Já existe uma operação financeira vinculada a esta cotação.');
    }

    // 4. Criar registro da operação
    const { data: operation, error: createOpErr } = await supabase
      .from('financial_operations')
      .insert({
        quotation_id: quotationId,
        status: 'active',
        notes: notes ?? null,
      })
      .select()
      .single();

    if (createOpErr) throw new Error(createOpErr.message);

    const opId = operation.id;
    const quoteData = quote.data || {};
    const servicesList: ServiceItem[] = Array.isArray(quoteData.services) ? quoteData.services : [];

    // 5. Derivar serviços da cotação com status 'planned'
    const createdServices: FinancialOperationService[] = [];
    for (const s of servicesList) {
      const unitAmount = Number(s.amount || 0);
      const rawQty = Number((s as any).quantity);
      const qty = !isNaN(rawQty) && rawQty > 0 ? rawQty : 1;
      const totalCost = unitAmount * qty;

      const sCurr = String(s.currency || '').toUpperCase().trim();
      const finalCurr: Currency = (sCurr === 'EUR' || sCurr === 'BRL') ? sCurr as Currency : (quote.currency === 'BRL' ? 'BRL' : 'EUR');

      const { data: opService, error: sErr } = await supabase
        .from('financial_operation_services')
        .insert({
          operation_id: opId,
          original_service_id: s.id || null,
          type: s.type || 'other',
          description: s.description || 'Serviço da cotação',
          supplier_name: s.carrier || null,
          cost_amount: totalCost,
          cost_currency: finalCurr,
          status: 'planned',
          notes: s.notes || null,
        })
        .select()
        .single();

      if (sErr) throw new Error(sErr.message);
      if (opService) createdServices.push(opService as FinancialOperationService);
    }

    // 6. Gerar compromissos previstos:
    // Suporte tanto a financials.salePrice quanto financials.priceTotal.amount legado
    const salePrice = Number(
      quoteData.financials?.salePrice ?? quoteData.financials?.priceTotal?.amount ?? 0
    );
    const clientName = quote.client_name || 'Cliente';
    const initialCommitments: FinancialCommitment[] = [];

    if (salePrice > 0) {
      const { data: recCommitment, error: recErr } = await supabase
        .from('financial_commitments')
        .insert({
          operation_id: opId,
          operation_service_id: null,
          type: 'receivable',
          counterparty_name: clientName,
          counterparty_type: 'client',
          amount: salePrice,
          currency: quote.currency === 'BRL' ? 'BRL' : 'EUR',
          status: 'planned',
          expected_date: null,
          expected_account_id: null,
          description: `Recebimento da cotação ${quote.reference} - ${clientName}`,
        })
        .select()
        .single();

      if (recErr) throw new Error(recErr.message);
      if (recCommitment) initialCommitments.push(recCommitment as FinancialCommitment);
    }

    // Pagáveis para serviços derivados com custo > 0
    for (const opService of createdServices) {
      if (opService.cost_amount > 0) {
        const { data: payCommitment, error: payErr } = await supabase
          .from('financial_commitments')
          .insert({
            operation_id: opId,
            operation_service_id: opService.id,
            type: 'payable',
            counterparty_name: opService.supplier_name || 'Fornecedor',
            counterparty_type: 'supplier',
            amount: opService.cost_amount,
            currency: opService.cost_currency,
            status: 'planned',
            expected_date: null,
            expected_account_id: null,
            description: `Pagamento de ${opService.description}`,
          })
          .select()
          .single();

        if (payErr) throw new Error(payErr.message);
        if (payCommitment) initialCommitments.push(payCommitment as FinancialCommitment);
      }
    }

    return {
      ...(operation as FinancialOperation),
      services: createdServices,
      commitments: initialCommitments,
      transactions: [],
    };
  },

  /**
   * Atualiza o estado da operação financeira ('active', 'completed', 'cancelled')
   */
  async updateOperationStatus(
    operationId: string,
    status: FinancialOperationStatus
  ): Promise<FinancialOperation> {
    const { data, error } = await supabase
      .from('financial_operations')
      .update({ status })
      .eq('id', operationId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar status da operação:', error);
      throw new Error(error.message);
    }
    return data as FinancialOperation;
  },

  /**
   * Cancela atomicamente uma operação financeira com motivo obrigatório:
   * - Altera operação para 'cancelled' e grava motivo/data
   * - Cancela serviços ainda não concluídos
   * - Cancela somente parcelas originais ainda previstas (sem transações reais)
   * - Preserva parcelas parciais, liquidadas e movimentações reais
   */
  async cancelFinancialOperation(
    operationId: string,
    reason: string
  ): Promise<CancelFinancialOperationResult> {
    const { data, error } = await supabase.rpc('cancel_financial_operation', {
      p_operation_id: operationId,
      p_reason: reason,
    });

    if (error) {
      console.error('Erro ao cancelar operação financeira:', error);
      throw new Error(error.message);
    }

    return data as CancelFinancialOperationResult;
  },

  // ==========================================
  // 3. SERVIÇOS DA OPERAÇÃO
  // ==========================================

  /**
   * Adiciona um novo serviço avulso à operação financeira
   */
  async addOperationService(
    input: CreateFinancialOperationServiceInput
  ): Promise<FinancialOperationService> {
    const { data, error } = await supabase
      .from('financial_operation_services')
      .insert({
        operation_id: input.operation_id,
        original_service_id: input.original_service_id ?? null,
        type: input.type,
        description: input.description.trim(),
        supplier_name: input.supplier_name ?? null,
        cost_amount: input.cost_amount,
        cost_currency: input.cost_currency,
        status: input.status ?? 'planned',
        notes: input.notes ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as FinancialOperationService;
  },

  /**
   * Atualiza campos de um serviço da operação
   */
  async updateOperationService(
    serviceId: string,
    updates: Partial<FinancialOperationService>
  ): Promise<FinancialOperationService> {
    const { data, error } = await supabase
      .from('financial_operation_services')
      .update(updates)
      .eq('id', serviceId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as FinancialOperationService;
  },

  /**
   * Cancela atomicamente um serviço da operação e todos os seus pagamentos previstos abertos vinculados.
   * Executa em transação única no banco de dados via RPC cancel_operation_service:
   * - Bloqueia o serviço e seus pagamentos vinculados (FOR UPDATE);
   * - Recusa o cancelamento caso exista pagamento parcial, liquidado ou movimentação financeira real;
   * - Altera o status do serviço para 'cancelled';
   * - Altera o status de todos os pagamentos previstos abertos vinculados para 'cancelled';
   * - Garante rollback automático completo caso ocorra qualquer falha.
   */
  async cancelOperationService(
    serviceId: string
  ): Promise<{ service: FinancialOperationService; cancelledCommitmentsCount: number }> {
    const { data, error } = await supabase.rpc('cancel_operation_service', {
      p_service_id: serviceId,
    });

    if (error) {
      console.error('Erro no cancelamento atômico do serviço:', error);
      throw new Error(error.message);
    }

    // Carregar o registro atualizado do serviço para retornar ao consumidor
    const { data: updatedService, error: srvErr } = await supabase
      .from('financial_operation_services')
      .select('*')
      .eq('id', serviceId)
      .single();

    if (srvErr) throw new Error(srvErr.message);

    return {
      service: updatedService as FinancialOperationService,
      cancelledCommitmentsCount: Number(data?.cancelled_commitments_count || 0),
    };
  },

  /**
   * Cancela um serviço financeiro com fluxo de ajuste (para serviços com pagamentos parciais ou liquidados):
   * - Altera o serviço para 'cancelled'
   * - Cancela parcelas previstas ainda abertas do serviço
   * - Preserva histórico de pagamentos já realizados
   * - Cria automaticamente reembolsos previstos de fornecedores e/ou multas se informados
   */
  async cancelOperationServiceWithAdjustments(
    input: CancelOperationServiceWithAdjustmentsInput
  ): Promise<CancelOperationServiceWithAdjustmentsResult> {
    const { data, error } = await supabase.rpc('cancel_operation_service_with_adjustments', {
      p_service_id: input.service_id,
      p_reason: input.reason,
      p_supplier_refund_amount: input.supplier_refund_amount ?? 0,
      p_supplier_refund_currency: input.supplier_refund_currency ?? 'EUR',
      p_cancellation_fee_amount: input.cancellation_fee_amount ?? 0,
      p_cancellation_fee_currency: input.cancellation_fee_currency ?? 'EUR',
      p_fee_counterparty_name: input.fee_counterparty_name ?? null,
    });

    if (error) {
      console.error('Erro no cancelamento com ajustes do serviço:', error);
      throw new Error(error.message);
    }

    return data as CancelOperationServiceWithAdjustmentsResult;
  },

  /**
   * Exclui um serviço avulso da operação (apenas utilitário técnico / limpeza de testes)
   */
  async deleteOperationService(serviceId: string): Promise<void> {
    const { error } = await supabase
      .from('financial_operation_services')
      .delete()
      .eq('id', serviceId);

    if (error) throw new Error(error.message);
  },

  // ==========================================
  // 4. COMPROMISSOS PREVISTOS
  // ==========================================

  /**
   * Lista compromissos previstos
   */
  async listCommitments(operationId?: string): Promise<FinancialCommitment[]> {
    let query = supabase.from('financial_commitments').select('*').order('created_at');
    if (operationId) {
      query = query.eq('operation_id', operationId);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as FinancialCommitment[];
  },

  /**
   * Cria um compromisso financeiro previsto
   */
  async createCommitment(input: CreateFinancialCommitmentInput): Promise<FinancialCommitment> {
    const { data, error } = await supabase
      .from('financial_commitments')
      .insert({
        operation_id: input.operation_id,
        operation_service_id: input.operation_service_id ?? null,
        type: input.type,
        counterparty_name: input.counterparty_name.trim(),
        counterparty_type: input.counterparty_type ?? (input.type === 'receivable' ? 'client' : 'supplier'),
        amount: input.amount,
        currency: input.currency,
        status: input.status ?? 'planned',
        payment_method: input.payment_method ?? null,
        expected_date: input.expected_date ?? null,
        expected_account_id: input.expected_account_id ?? null,
        description: input.description ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as FinancialCommitment;
  },

  /**
   * Cria uma previsão de ajuste de cancelamento (Reembolso ao Cliente, Reembolso do Fornecedor ou Multa)
   */
  async createCancellationAdjustment(
    input: CreateCancellationAdjustmentInput
  ): Promise<FinancialCommitment> {
    const { data, error } = await supabase.rpc('create_cancellation_adjustment', {
      p_operation_id: input.operation_id,
      p_adjustment_type: input.adjustment_type,
      p_counterparty_name: input.counterparty_name,
      p_amount: input.amount,
      p_currency: input.currency,
      p_counterparty_type: input.counterparty_type ?? null,
      p_expected_date: input.expected_date ?? null,
      p_description: input.description ?? null,
      p_notes: input.notes ?? null,
      p_operation_service_id: input.operation_service_id ?? null,
    });

    if (error) {
      console.error('Erro ao criar ajuste de cancelamento:', error);
      throw new Error(error.message);
    }

    const { data: commitment, error: cErr } = await supabase
      .from('financial_commitments')
      .select('*')
      .eq('id', data.id)
      .single();

    if (cErr) throw new Error(cErr.message);
    return commitment as FinancialCommitment;
  },

  /**
   * Atualiza dados ou status de um compromisso
   */
  async updateCommitment(
    commitmentId: string,
    updates: Partial<FinancialCommitment>
  ): Promise<FinancialCommitment> {
    const { data, error } = await supabase
      .from('financial_commitments')
      .update(updates)
      .eq('id', commitmentId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as FinancialCommitment;
  },

  /**
   * Cancela uma parcela ou compromisso financeiro previsto, preservando o histórico com status 'cancelled'.
   * Regra preventiva: Itens com pagamentos reais (liquidado ou parcialmente liquidado,
   * ou com movimentações registradas) não podem ser cancelados sem tratamento de reembolso ou multa.
   */
  async cancelCommitment(commitmentId: string): Promise<FinancialCommitment> {
    // 1. Carregar compromisso
    const { data: commitment, error: getErr } = await supabase
      .from('financial_commitments')
      .select('*')
      .eq('id', commitmentId)
      .maybeSingle();

    if (getErr) throw new Error(getErr.message);
    if (!commitment) throw new Error('Compromisso informado não foi encontrado.');

    // 2. Validação preventiva contra cancelamento indevido de itens com pagamento real
    if (commitment.status === 'settled' || commitment.status === 'partially_settled') {
      throw new Error(
        'Não é possível cancelar uma parcela ou compromisso com pagamento já realizado ou parcialmente liquidado sem tratar reembolso ou multa.'
      );
    }

    // 3. Validação preventiva contra transações reais já registradas
    const { data: txs, error: txErr } = await supabase
      .from('financial_transactions')
      .select('id')
      .eq('commitment_id', commitmentId)
      .limit(1);

    if (txErr) throw new Error(txErr.message);
    if (txs && txs.length > 0) {
      throw new Error(
        'Não é possível cancelar um compromisso com movimentações financeiras já registradas sem tratar reembolso ou multa.'
      );
    }

    // 4. Efetuar cancelamento lógico preservando o registro
    const { data: updated, error: updateErr } = await supabase
      .from('financial_commitments')
      .update({ status: 'cancelled' })
      .eq('id', commitmentId)
      .select()
      .single();

    if (updateErr) throw new Error(updateErr.message);
    return updated as FinancialCommitment;
  },

  /**
   * Remove um compromisso previsto (apenas utilitário técnico / limpeza de testes)
   */
  async deleteCommitment(commitmentId: string): Promise<void> {
    const { error } = await supabase
      .from('financial_commitments')
      .delete()
      .eq('id', commitmentId);

    if (error) throw new Error(error.message);
  },

  // ==========================================
  // 5. MOVIMENTAÇÕES REAIS DE CAIXA
  // ==========================================

  /**
   * Registra uma movimentação real de caixa e atualiza o estado de liquidação do compromisso com validações estritas:
   * - Recebíveis só podem ser liquidados por entradas ('inflow')
   * - Pagáveis só podem ser liquidados por saídas ('outflow')
   * - Reembolsos e transferências não liquidam compromissos operacionais
   * - Suporta transferências cambiais (EUR <-> BRL, câmbio e taxa de remessa)
   */
  async recordTransaction(input: CreateFinancialTransactionInput): Promise<FinancialTransaction> {
    let commitment: FinancialCommitment | null = null;

    if (input.commitment_id) {
      // 1. Transferências e reembolsos não podem ser vinculados à liquidação de compromissos operacionais
      if (input.type === 'transfer' || input.type === 'refund') {
        throw new Error(
          `Transações do tipo "${input.type}" não podem ser vinculadas diretamente à liquidação de compromissos.`
        );
      }

      // 2. Carregar o compromisso para validação de tipo
      const { data: comData, error: comErr } = await supabase
        .from('financial_commitments')
        .select('*')
        .eq('id', input.commitment_id)
        .maybeSingle();

      if (comErr) throw new Error(comErr.message);
      if (!comData) throw new Error('Compromisso informado não foi encontrado.');

      commitment = comData as FinancialCommitment;

      // 3. Regra de integridade de fluxo financeiro:
      // Recebíveis só podem ser liquidados por entradas ('inflow')
      if (commitment.type === 'receivable' && input.type !== 'inflow') {
        throw new Error(
          `Compromisso a receber (receivable) só pode ser liquidado por transações de entrada (inflow). Recebido: ${input.type}.`
        );
      }

      // Pagáveis só podem ser liquidados por saídas ('outflow')
      if (commitment.type === 'payable' && input.type !== 'outflow') {
        throw new Error(
          `Compromisso a pagar (payable) só pode ser liquidado por transações de saída (outflow). Recebido: ${input.type}.`
        );
      }
    }

    // 4. Inserir a transação
    const { data: tx, error: txErr } = await supabase
      .from('financial_transactions')
      .insert({
        type: input.type,
        account_id: input.account_id,
        destination_account_id: input.destination_account_id ?? null,
        operation_id: input.operation_id ?? null,
        commitment_id: input.commitment_id ?? null,
        amount: input.amount,
        currency: input.currency,
        destination_amount: input.destination_amount ?? null,
        destination_currency: input.destination_currency ?? null,
        exchange_rate: input.exchange_rate ?? null,
        transfer_fee: input.transfer_fee ?? 0.0,
        transfer_fee_currency: input.transfer_fee_currency ?? null,
        transacted_at: input.transacted_at || new Date().toISOString(),
        counterparty_name: input.counterparty_name ?? null,
        description: input.description ?? null,
        reference: input.reference ?? null,
      })
      .select()
      .single();

    if (txErr) throw new Error(txErr.message);

    // 5. Recalcular estado de liquidação do compromisso com transações válidas do mesmo sentido
    if (commitment) {
      const validTxType = commitment.type === 'receivable' ? 'inflow' : 'outflow';

      const { data: relatedTxs, error: relErr } = await supabase
        .from('financial_transactions')
        .select('amount')
        .eq('commitment_id', commitment.id)
        .eq('type', validTxType);

      if (relErr) throw new Error(relErr.message);

      const totalPaid = (relatedTxs || []).reduce(
        (acc: number, cur: { amount: number }) => acc + Number(cur.amount),
        0
      );
      const targetAmount = Number(commitment.amount);

      let newStatus: FinancialCommitment['status'] = 'planned';
      if (totalPaid >= targetAmount) {
        newStatus = 'settled';
      } else if (totalPaid > 0) {
        newStatus = 'partially_settled';
      }

      await supabase
        .from('financial_commitments')
        .update({ status: newStatus })
        .eq('id', commitment.id);
    }

    return tx as FinancialTransaction;
  },

  /**
   * Registra uma movimentação real de liquidação (recebimento ou pagamento) de forma atômica no banco de dados via RPC:
   * - Bloqueia o compromisso e a conta com FOR UPDATE;
   * - Recusa se o compromisso estiver cancelado ou liquidado;
   * - Valida obrigatoriedade da conta e compatibilidade estrita de moeda;
   * - Valida se valor > 0 e não excede saldo pendente;
   * - Registra 'inflow' para recebíveis ou 'outflow' para pagáveis;
   * - Atualiza status do compromisso ('settled' ou 'partially_settled');
   * - Garante rollback automático total em caso de falha.
   */
  async recordCommitmentSettlement(
    input: RecordCommitmentSettlementInput
  ): Promise<RecordCommitmentSettlementResult> {
    const { data, error } = await supabase.rpc('record_commitment_settlement', {
      p_commitment_id: input.commitment_id,
      p_account_id: input.account_id,
      p_amount: input.amount,
      p_transacted_at: input.transacted_at || new Date().toISOString(),
      p_reference: input.reference ?? null,
      p_description: input.description ?? null,
      p_invoice_due_date: input.invoice_due_date ?? null,
    });

    if (error) {
      console.error('Erro ao registrar liquidação de compromisso:', error);
      throw new Error(error.message);
    }

    return data as RecordCommitmentSettlementResult;
  },

  /**
   * Registra transferência atômica entre contas financeiras
   */
  async recordAccountTransfer(
    input: RecordAccountTransferInput
  ): Promise<RecordAccountTransferResult> {
    const { data, error } = await supabase.rpc('record_account_transfer', {
      p_source_account_id: input.source_account_id,
      p_destination_account_id: input.destination_account_id,
      p_amount: input.amount,
      p_destination_amount: input.destination_amount ?? input.amount,
      p_exchange_rate: input.exchange_rate ?? null,
      p_transfer_fee: input.transfer_fee ?? 0,
      p_transfer_fee_currency: input.transfer_fee_currency ?? null,
      p_transacted_at: input.transacted_at || new Date().toISOString(),
      p_reference: input.reference ?? null,
      p_description: input.description ?? null,
      p_operation_id: input.operation_id ?? null,
    });

    if (error) {
      console.error('Erro ao transferir entre contas:', error);
      throw new Error(error.message);
    }

    return data as RecordAccountTransferResult;
  },

  /**
   * Lista movimentações reais de caixa
   */
  async listTransactions(filters?: {
    accountId?: string;
    operationId?: string;
    commitmentId?: string;
  }): Promise<FinancialTransaction[]> {
    let query = supabase
      .from('financial_transactions')
      .select('*')
      .order('transacted_at', { ascending: false });

    if (filters?.accountId) {
      query = query.eq('account_id', filters.accountId);
    }
    if (filters?.operationId) {
      query = query.eq('operation_id', filters.operationId);
    }
    if (filters?.commitmentId) {
      query = query.eq('commitment_id', filters.commitmentId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as FinancialTransaction[];
  },
};
