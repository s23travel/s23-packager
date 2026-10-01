import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { quotationsService } from '../../services/quotationsService';
import { financialService } from '../../services/financialService';
import {
  Quotation,
  FinancialAccount,
  FinancialAccountType,
  FinancialOperation,
  FinancialOperationService,
  FinancialCommitment,
  FinancialTransaction,
  FinancialOperationServiceStatus,
  FinancialPaymentMethod,
  FinancialAdjustmentType,
  ADJUSTMENT_TYPE_LABELS,
  Currency,
  PAYMENT_METHOD_LABELS,
  SERVICE_STATUS_LABELS,
  ACCOUNT_TYPE_LABELS,
  COMMITMENT_STATUS_LABELS,
} from '../../types';
import { FeedbackBanner } from '../../components/common/FeedbackBanner';

export const QuotationFinancialPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [quote, setQuote] = useState<Quotation | null>(null);
  const [operation, setOperation] = useState<FinancialOperation | null>(null);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [allAccounts, setAllAccounts] = useState<FinancialAccount[]>([]);
  const [services, setServices] = useState<FinancialOperationService[]>([]);
  const [commitments, setCommitments] = useState<FinancialCommitment[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);

  // Estados Fase 2C: Cancelar Operação (Modal)
  const [isCancelOperationModalOpen, setIsCancelOperationModalOpen] = useState(false);
  const [cancelOperationReason, setCancelOperationReason] = useState('');

  // Estados Fase 2C: Cancelar Serviço com Ajustes (Modal)
  const [cancelServiceTarget, setCancelServiceTarget] = useState<FinancialOperationService | null>(null);
  const [cancelServiceReason, setCancelServiceReason] = useState('');
  const [cancelServiceRefundAmount, setCancelServiceRefundAmount] = useState('0.00');
  const [cancelServiceRefundCurrency, setCancelServiceRefundCurrency] = useState<Currency>('EUR');
  const [cancelServiceFeeAmount, setCancelServiceFeeAmount] = useState('0.00');
  const [cancelServiceFeeCurrency, setCancelServiceFeeCurrency] = useState<Currency>('EUR');
  const [cancelServiceFeeCounterparty, setCancelServiceFeeCounterparty] = useState('');

  // Estados Fase 2C: Novo Ajuste de Cancelamento (Modal)
  const [isAddAdjustmentModalOpen, setIsAddAdjustmentModalOpen] = useState(false);
  const [adjType, setAdjType] = useState<FinancialAdjustmentType>('client_refund');
  const [adjCounterparty, setAdjCounterparty] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjCurrency, setAdjCurrency] = useState<Currency>('EUR');
  const [adjExpectedDate, setAdjExpectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [adjDescription, setAdjDescription] = useState('');
  const [adjNotes, setAdjNotes] = useState('');
  const [adjServiceId, setAdjServiceId] = useState('');

  // Estado para gestão de contas (Modal)
  const [isManagingAccounts, setIsManagingAccounts] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [isAddingNewAccount, setIsAddingNewAccount] = useState(false);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<FinancialAccountType>('bank_account');
  const [accCurrency, setAccCurrency] = useState<Currency>('EUR');
  const [accInitialBalance, setAccInitialBalance] = useState('0.00');
  const [accInitialDate, setAccInitialDate] = useState(new Date().toISOString().slice(0, 10));
  const [accDesc, setAccDesc] = useState('');
  const [accActive, setAccActive] = useState(true);

  // Estado para registro de movimentação real (Recebimento / Pagamento)
  const [settlementTarget, setSettlementTarget] = useState<FinancialCommitment | null>(null);
  const [settlementAccountId, setSettlementAccountId] = useState('');
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().slice(0, 10));
  const [settlementReference, setSettlementReference] = useState('');
  const [settlementDescription, setSettlementDescription] = useState('');
  const [settlementInvoiceDueDate, setSettlementInvoiceDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );

  // Estado para modal de transferência entre contas
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSourceId, setTransferSourceId] = useState('');
  const [transferDestId, setTransferDestId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDestAmount, setTransferDestAmount] = useState('');
  const [transferExchangeRate, setTransferExchangeRate] = useState('');
  const [transferFee, setTransferFee] = useState('0.00');
  const [transferFeeCurrency, setTransferFeeCurrency] = useState<Currency>('EUR');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [transferReference, setTransferReference] = useState('');
  const [transferDescription, setTransferDescription] = useState('');

  // Estado para modal / formulário de novo serviço
  const [isAddingService, setIsAddingService] = useState(false);
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServiceType, setNewServiceType] = useState('tour');
  const [newServiceSupplier, setNewServiceSupplier] = useState('');
  const [newServiceCost, setNewServiceCost] = useState('');
  const [newServiceCurrency, setNewServiceCurrency] = useState<Currency>('EUR');

  // Estados locais para edição rápida de recebimentos
  const [receivableEdits, setReceivableEdits] = useState<Record<string, Partial<FinancialCommitment>>>({});
  // Estados locais para edição rápida de parcelas de serviço
  const [payableEdits, setPayableEdits] = useState<Record<string, Partial<FinancialCommitment>>>({});
  // Estados locais para edição rápida de serviços
  const [serviceEdits, setServiceEdits] = useState<Record<string, Partial<FinancialOperationService>>>({});

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [quoteData, opData, accountsList, allAccsList] = await Promise.all([
        quotationsService.getQuotationById(id),
        financialService.getOperationByQuotationId(id),
        financialService.listAccounts(true),
        financialService.listAccounts(false),
      ]);

      setQuote(quoteData);
      setOperation(opData);
      setAccounts(accountsList);
      setAllAccounts(allAccsList);

      if (opData) {
        const details = await financialService.getOperationDetails(opData.id);
        if (details) {
          setServices(details.services || []);
          setCommitments(details.commitments || []);
          setTransactions(details.transactions || []);
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao carregar dados financeiros.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Separação de compromissos
  // Regra Fase 2C: ajustes de cancelamento têm identificação própria e não duplicam custo operacional da viagem
  const receivables = useMemo(
    () => commitments.filter((c) => c.type === 'receivable' && !c.is_cancellation_adjustment),
    [commitments]
  );

  const payables = useMemo(
    () => commitments.filter((c) => c.type === 'payable' && !c.is_cancellation_adjustment),
    [commitments]
  );

  // Faturas de Cartão de Crédito originadas por pagamentos a fornecedores
  const cardInvoices = useMemo(
    () => commitments.filter((c) => c.type === 'payable' && c.is_credit_card_invoice && !c.is_cancellation_adjustment),
    [commitments]
  );

  // Ajustes de Cancelamento (Reembolsos & Multas)
  const cancellationAdjustments = useMemo(
    () => commitments.filter((c) => c.is_cancellation_adjustment),
    [commitments]
  );

  // Totais previstos a receber e a pagar separados por EUR e BRL
  // Regra Fase 2B/2C: não conta fatura do cartão nem ajustes de cancelamento como custos operacionais originais da viagem
  const totals = useMemo(() => {
    const recEUR = receivables
      .filter((c) => c.currency === 'EUR' && c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const recBRL = receivables
      .filter((c) => c.currency === 'BRL' && c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const payEUR = payables
      .filter((c) => c.currency === 'EUR' && c.status !== 'cancelled' && !c.is_credit_card_invoice)
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const payBRL = payables
      .filter((c) => c.currency === 'BRL' && c.status !== 'cancelled' && !c.is_credit_card_invoice)
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    return { recEUR, recBRL, payEUR, payBRL };
  }, [receivables, payables]);

  // Totais de Ajustes de Cancelamento (separados por EUR e BRL)
  const adjustmentTotals = useMemo(() => {
    const clientRefundsEUR = cancellationAdjustments
      .filter((c) => c.adjustment_type === 'client_refund' && c.currency === 'EUR' && c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const clientRefundsBRL = cancellationAdjustments
      .filter((c) => c.adjustment_type === 'client_refund' && c.currency === 'BRL' && c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const supplierRefundsEUR = cancellationAdjustments
      .filter((c) => c.adjustment_type === 'supplier_refund' && c.currency === 'EUR' && c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const supplierRefundsBRL = cancellationAdjustments
      .filter((c) => c.adjustment_type === 'supplier_refund' && c.currency === 'BRL' && c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const cancellationFeesEUR = cancellationAdjustments
      .filter((c) => c.adjustment_type === 'cancellation_fee' && c.currency === 'EUR' && c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const cancellationFeesBRL = cancellationAdjustments
      .filter((c) => c.adjustment_type === 'cancellation_fee' && c.currency === 'BRL' && c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    return {
      clientRefundsEUR,
      clientRefundsBRL,
      supplierRefundsEUR,
      supplierRefundsBRL,
      cancellationFeesEUR,
      cancellationFeesBRL,
    };
  }, [cancellationAdjustments]);

  const formatMoney = (val: number, curr: Currency) => {
    return new Intl.NumberFormat(curr === 'BRL' ? 'pt-BR' : 'pt-PT', {
      style: 'currency',
      currency: curr,
    }).format(val || 0);
  };

  // ==============================================================
  // AÇÕES DE RECEBIMENTOS DO CLIENTE
  // ==============================================================

  const handleUpdateReceivableField = (id: string, field: keyof FinancialCommitment, value: any) => {
    setReceivableEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSaveReceivable = async (item: FinancialCommitment) => {
    const edits = receivableEdits[item.id];
    if (!edits) return;

    try {
      setSaving(true);
      const updated = await financialService.updateCommitment(item.id, {
        amount: edits.amount !== undefined ? Number(edits.amount) : item.amount,
        currency: edits.currency || item.currency,
        expected_date: edits.expected_date !== undefined ? (edits.expected_date ? edits.expected_date : null) : item.expected_date,
        expected_account_id: edits.expected_account_id !== undefined ? (edits.expected_account_id ? edits.expected_account_id : null) : item.expected_account_id,
        payment_method: edits.payment_method !== undefined ? (edits.payment_method ? edits.payment_method : null) : item.payment_method,
        notes: edits.notes !== undefined ? edits.notes : item.notes,
      });

      setCommitments((prev) => prev.map((c) => (c.id === item.id ? updated : c)));
      setReceivableEdits((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setFeedback({ type: 'success', message: 'Recebimento atualizado com sucesso.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao salvar recebimento: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleAddReceivableInstallment = async () => {
    if (!operation) return;
    try {
      setSaving(true);
      const newCommitment = await financialService.createCommitment({
        operation_id: operation.id,
        type: 'receivable',
        counterparty_name: quote?.client_name || 'Cliente',
        counterparty_type: 'client',
        amount: 0,
        currency: quote?.currency || 'EUR',
        status: 'planned',
        description: `Parcela de recebimento ${receivables.length + 1}`,
      });

      setCommitments((prev) => [...prev, newCommitment]);
      setFeedback({ type: 'success', message: 'Nova parcela de recebimento adicionada.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao adicionar parcela: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleSplitReceivable = async (item: FinancialCommitment) => {
    if (!operation) return;
    try {
      setSaving(true);
      const currentAmount = Number(receivableEdits[item.id]?.amount ?? item.amount);
      const half1 = Number((currentAmount / 2).toFixed(2));
      const half2 = Number((currentAmount - half1).toFixed(2));

      // Atualiza primeira metade
      const updatedFirst = await financialService.updateCommitment(item.id, {
        amount: half1,
        description: `${item.description || 'Parcela'} (1/2)`,
      });

      // Cria segunda metade
      const createdSecond = await financialService.createCommitment({
        operation_id: operation.id,
        type: 'receivable',
        counterparty_name: item.counterparty_name,
        counterparty_type: 'client',
        amount: half2,
        currency: item.currency,
        status: 'planned',
        expected_date: item.expected_date,
        expected_account_id: item.expected_account_id,
        payment_method: item.payment_method,
        description: `${item.description || 'Parcela'} (2/2)`,
      });

      setCommitments((prev) =>
        prev.map((c) => (c.id === item.id ? updatedFirst : c)).concat(createdSecond)
      );
      setReceivableEdits((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setFeedback({ type: 'success', message: 'Recebimento dividido em 2 parcelas.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao dividir recebimento: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelCommitment = async (commitmentId: string, desc: string) => {
    if (!window.confirm(`Deseja cancelar esta parcela (${desc})? O histórico será preservado.`)) return;
    try {
      setSaving(true);
      const updated = await financialService.cancelCommitment(commitmentId);
      setCommitments((prev) => prev.map((c) => (c.id === commitmentId ? updated : c)));
      setFeedback({ type: 'success', message: 'Parcela cancelada com sucesso. Histórico financeiro preservado.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao cancelar parcela: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // ==============================================================
  // AÇÕES DE SERVIÇOS E PAGAMENTOS
  // ==============================================================

  const handleUpdateServiceField = (serviceId: string, field: keyof FinancialOperationService, value: any) => {
    setServiceEdits((prev) => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        [field]: value,
      },
    }));
  };

  const handleSaveService = async (service: FinancialOperationService) => {
    const edits = serviceEdits[service.id];
    if (!edits) return;

    try {
      setSaving(true);
      const updated = await financialService.updateOperationService(service.id, {
        description: edits.description !== undefined ? edits.description : service.description,
        supplier_name: edits.supplier_name !== undefined ? edits.supplier_name : service.supplier_name,
        status: (edits.status as FinancialOperationServiceStatus) || service.status,
        cost_amount: edits.cost_amount !== undefined ? Number(edits.cost_amount) : service.cost_amount,
        cost_currency: edits.cost_currency || service.cost_currency,
        notes: edits.notes !== undefined ? edits.notes : service.notes,
      });

      setServices((prev) => prev.map((s) => (s.id === service.id ? updated : s)));
      setServiceEdits((prev) => {
        const next = { ...prev };
        delete next[service.id];
        return next;
      });
      setFeedback({ type: 'success', message: 'Serviço atualizado com sucesso.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao atualizar serviço: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operation || !newServiceDesc.trim()) return;

    try {
      setSaving(true);
      const costNum = Math.max(0, Number(newServiceCost) || 0);

      // 1. Cria o serviço na operação
      const createdService = await financialService.addOperationService({
        operation_id: operation.id,
        type: newServiceType,
        description: newServiceDesc.trim(),
        supplier_name: newServiceSupplier.trim() || undefined,
        cost_amount: costNum,
        cost_currency: newServiceCurrency,
        status: 'planned',
      });

      // 2. Se houver custo previsto, cria a primeira parcela de pagamento
      let createdCommitment: FinancialCommitment | null = null;
      if (costNum > 0) {
        createdCommitment = await financialService.createCommitment({
          operation_id: operation.id,
          operation_service_id: createdService.id,
          type: 'payable',
          counterparty_name: newServiceSupplier.trim() || 'Fornecedor',
          counterparty_type: 'supplier',
          amount: costNum,
          currency: newServiceCurrency,
          status: 'planned',
          description: `Pagamento de ${createdService.description}`,
        });
      }

      setServices((prev) => [...prev, createdService]);
      if (createdCommitment) {
        setCommitments((prev) => [...prev, createdCommitment!]);
      }

      setNewServiceDesc('');
      setNewServiceSupplier('');
      setNewServiceCost('');
      setIsAddingService(false);
      setFeedback({ type: 'success', message: 'Novo serviço adicionado ao financeiro.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao adicionar serviço: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelService = async (serviceId: string, desc: string) => {
    if (!window.confirm(`Deseja cancelar o serviço "${desc}" e todos os seus pagamentos previstos abertos? O histórico será preservado.`)) return;
    try {
      setSaving(true);
      const res = await financialService.cancelOperationService(serviceId);
      setServices((prev) =>
        prev.map((s) => (s.id === serviceId ? res.service : s))
      );
      setCommitments((prev) =>
        prev.map((c) =>
          c.operation_service_id === serviceId && c.status === 'planned'
            ? { ...c, status: 'cancelled' }
            : c
        )
      );
      setFeedback({
        type: 'success',
        message: 'Serviço e pagamentos vinculados cancelados com sucesso. Histórico preservado.',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao cancelar serviço: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // ==============================================================
  // AÇÕES FASE 2C: CANCELAMENTOS, REEMBOLSOS E MULTAS
  // ==============================================================

  const handleCancelOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operation) return;
    const trimmed = cancelOperationReason.trim();
    if (!trimmed) {
      setFeedback({ type: 'error', message: 'O motivo do cancelamento da operação é obrigatório.' });
      return;
    }

    try {
      setSaving(true);
      const res = await financialService.cancelFinancialOperation(operation.id, trimmed);
      await loadData();
      setIsCancelOperationModalOpen(false);
      setCancelOperationReason('');
      setFeedback({
        type: 'success',
        message: `Operação cancelada com sucesso. ${res.cancelled_services_count} serviço(s) e ${res.cancelled_commitments_count} parcela(s) prevista(s) foram canceladas. Histórico e pagamentos realizados preservados.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao cancelar operação: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleStartCancelService = (service: FinancialOperationService) => {
    const serviceCommitments = commitments.filter((c) => c.operation_service_id === service.id);
    const hasRealSettlement = serviceCommitments.some(
      (c) =>
        c.status === 'partially_settled' ||
        c.status === 'settled' ||
        transactions.some((t) => t.commitment_id === c.id)
    );

    if (!hasRealSettlement) {
      handleCancelService(service.id, service.description);
    } else {
      // Abre fluxo de ajuste para serviço com pagamentos reais
      setCancelServiceTarget(service);
      setCancelServiceReason('');
      setCancelServiceRefundAmount('0.00');
      setCancelServiceRefundCurrency(service.cost_currency || 'EUR');
      setCancelServiceFeeAmount('0.00');
      setCancelServiceFeeCurrency(service.cost_currency || 'EUR');
      setCancelServiceFeeCounterparty(service.supplier_name || 'Fornecedor');
    }
  };

  const handleSubmitCancelServiceWithAdjustments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelServiceTarget) return;
    const trimmed = cancelServiceReason.trim();
    if (!trimmed) {
      setFeedback({ type: 'error', message: 'O motivo do cancelamento do serviço é obrigatório.' });
      return;
    }

    const refNum = Number(cancelServiceRefundAmount) || 0;
    const feeNum = Number(cancelServiceFeeAmount) || 0;

    try {
      setSaving(true);
      await financialService.cancelOperationServiceWithAdjustments({
        service_id: cancelServiceTarget.id,
        reason: trimmed,
        supplier_refund_amount: refNum > 0 ? refNum : 0,
        supplier_refund_currency: cancelServiceRefundCurrency,
        cancellation_fee_amount: feeNum > 0 ? feeNum : 0,
        cancellation_fee_currency: cancelServiceFeeCurrency,
        fee_counterparty_name: cancelServiceFeeCounterparty.trim() || undefined,
      });

      await loadData();
      setCancelServiceTarget(null);
      setFeedback({
        type: 'success',
        message: `Serviço "${cancelServiceTarget.description}" cancelado com sucesso. Histórico preservado e ajustes registrados.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao cancelar serviço com ajustes: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddAdjustmentModal = () => {
    setAdjType('client_refund');
    setAdjCounterparty(quote?.client_name || '');
    setAdjAmount('');
    setAdjCurrency((quote?.currency as Currency) || 'EUR');
    setAdjExpectedDate(new Date().toISOString().slice(0, 10));
    setAdjDescription('');
    setAdjNotes('');
    setAdjServiceId('');
    setIsAddAdjustmentModalOpen(true);
  };

  const handleSubmitCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operation) return;

    const trimmedCp = adjCounterparty.trim();
    if (!trimmedCp) {
      setFeedback({ type: 'error', message: 'Informe a contraparte do ajuste (cliente ou fornecedor).' });
      return;
    }

    const amountNum = Number(adjAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFeedback({ type: 'error', message: 'O valor do ajuste deve ser maior que zero.' });
      return;
    }

    try {
      setSaving(true);
      await financialService.createCancellationAdjustment({
        operation_id: operation.id,
        adjustment_type: adjType,
        counterparty_name: trimmedCp,
        amount: amountNum,
        currency: adjCurrency,
        expected_date: adjExpectedDate || undefined,
        description: adjDescription.trim() || undefined,
        notes: adjNotes.trim() || undefined,
        operation_service_id: adjServiceId || undefined,
      });

      await loadData();
      setIsAddAdjustmentModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Ajuste de cancelamento (${ADJUSTMENT_TYPE_LABELS[adjType]}) registrado com sucesso.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao registrar ajuste: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // ==============================================================
  // AÇÕES DE PARCELAS DE PAGAMENTO DE SERVIÇOS
  // ==============================================================

  const handleUpdatePayableField = (id: string, field: keyof FinancialCommitment, value: any) => {
    setPayableEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSavePayable = async (item: FinancialCommitment) => {
    const edits = payableEdits[item.id];
    if (!edits) return;

    try {
      setSaving(true);
      const updated = await financialService.updateCommitment(item.id, {
        amount: edits.amount !== undefined ? Number(edits.amount) : item.amount,
        currency: edits.currency || item.currency,
        expected_date: edits.expected_date !== undefined ? (edits.expected_date ? edits.expected_date : null) : item.expected_date,
        expected_account_id: edits.expected_account_id !== undefined ? (edits.expected_account_id ? edits.expected_account_id : null) : item.expected_account_id,
        payment_method: edits.payment_method !== undefined ? (edits.payment_method ? edits.payment_method : null) : item.payment_method,
        notes: edits.notes !== undefined ? edits.notes : item.notes,
      });

      setCommitments((prev) => prev.map((c) => (c.id === item.id ? updated : c)));
      setPayableEdits((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setFeedback({ type: 'success', message: 'Parcela de pagamento atualizada.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao salvar pagamento: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayableInstallment = async (service: FinancialOperationService) => {
    if (!operation) return;
    try {
      setSaving(true);
      const newCommitment = await financialService.createCommitment({
        operation_id: operation.id,
        operation_service_id: service.id,
        type: 'payable',
        counterparty_name: service.supplier_name || 'Fornecedor',
        counterparty_type: 'supplier',
        amount: 0,
        currency: service.cost_currency,
        status: 'planned',
        description: `Parcela de pagamento - ${service.description}`,
      });

      setCommitments((prev) => [...prev, newCommitment]);
      setFeedback({ type: 'success', message: `Nova parcela de pagamento adicionada para "${service.description}".` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao adicionar parcela: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // ==============================================================
  // AÇÕES DE LIQUIDAÇÃO REAL (RECEBIMENTOS & PAGAMENTOS)
  // ==============================================================

  const getCommitmentSettlementData = (commitment: FinancialCommitment) => {
    const cTxs = transactions.filter((t) => t.commitment_id === commitment.id);
    const validTxType = commitment.type === 'receivable' ? 'inflow' : 'outflow';
    const totalSettled = cTxs
      .filter((t) => t.type === validTxType)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const pendingBalance = Math.max(0, Number(commitment.amount || 0) - totalSettled);
    return { cTxs, totalSettled, pendingBalance };
  };

  const handleOpenSettlement = (c: FinancialCommitment) => {
    const { pendingBalance } = getCommitmentSettlementData(c);
    const isCreditCardBlocked = c.type === 'receivable' || c.is_credit_card_invoice;
    const matchingAccounts = accounts.filter(
      (a) => a.currency === c.currency && a.active && (!isCreditCardBlocked || a.type !== 'credit_card')
    );
    setSettlementTarget(c);
    setSettlementAccountId(matchingAccounts[0]?.id || '');
    setSettlementAmount(pendingBalance.toFixed(2));
    setSettlementDate(new Date().toISOString().slice(0, 10));
    setSettlementReference('');
    setSettlementDescription('');
    setSettlementInvoiceDueDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  };

  const handleSubmitSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementTarget) return;

    const amountNum = Number(settlementAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFeedback({ type: 'error', message: 'O valor da movimentação deve ser maior que zero.' });
      return;
    }

    if (!settlementAccountId) {
      setFeedback({ type: 'error', message: 'Selecione a conta financeira para registrar a movimentação.' });
      return;
    }

    const selectedAcc = accounts.find((a) => a.id === settlementAccountId);
    if (!selectedAcc || selectedAcc.currency !== settlementTarget.currency) {
      setFeedback({
        type: 'error',
        message: `A conta deve ter a mesma moeda (${settlementTarget.currency}) do compromisso.`,
      });
      return;
    }

    if (settlementTarget.type === 'receivable' && selectedAcc.type === 'credit_card') {
      setFeedback({
        type: 'error',
        message: 'Não é permitido utilizar conta do tipo cartão de crédito para registrar recebimentos de clientes.',
      });
      return;
    }

    if (settlementTarget.is_credit_card_invoice && selectedAcc.type === 'credit_card') {
      setFeedback({
        type: 'error',
        message: 'Não é permitido pagar a fatura de um cartão com outro cartão de crédito.',
      });
      return;
    }

    if (selectedAcc.type === 'credit_card' && !settlementInvoiceDueDate) {
      setFeedback({
        type: 'error',
        message: 'A data de vencimento da fatura é obrigatória para pagamentos com cartão de crédito.',
      });
      return;
    }

    try {
      setSaving(true);
      const res = await financialService.recordCommitmentSettlement({
        commitment_id: settlementTarget.id,
        account_id: settlementAccountId,
        amount: amountNum,
        transacted_at: settlementDate,
        reference: settlementReference.trim() || undefined,
        description: settlementDescription.trim() || undefined,
        invoice_due_date: selectedAcc.type === 'credit_card' ? settlementInvoiceDueDate : undefined,
      });

      await loadData();
      setSettlementTarget(null);

      const actionName = settlementTarget.type === 'receivable' ? 'Recebimento' : 'Pagamento';
      const statusLabel = COMMITMENT_STATUS_LABELS[res.commitment_status] || res.commitment_status;
      const invoiceNotice = res.invoice_commitment_id
        ? ' Uma nova parcela prevista da fatura do cartão foi criada automaticamente.'
        : '';
      setFeedback({
        type: 'success',
        message: `${actionName} de ${formatMoney(res.amount, res.currency)} registrado com sucesso. Situação: ${statusLabel}.${invoiceNotice}`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao registrar movimentação: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // ==============================================================
  // AÇÕES DE TRANSFERÊNCIA ENTRE CONTAS (MODAL)
  // ==============================================================

  const handleOpenTransferModal = () => {
    const eligibleAccounts = allAccounts.filter((a) => a.active && a.type !== 'credit_card');
    setTransferSourceId(eligibleAccounts[0]?.id || '');
    setTransferDestId(eligibleAccounts[1]?.id || '');
    setTransferAmount('');
    setTransferDestAmount('');
    setTransferExchangeRate('');
    setTransferFee('0.00');
    setTransferFeeCurrency('EUR');
    setTransferDate(new Date().toISOString().slice(0, 10));
    setTransferReference('');
    setTransferDescription('');
    setIsTransferModalOpen(true);
  };

  const handleSourceAmountChange = (val: string, sourceAcc?: FinancialAccount, destAcc?: FinancialAccount) => {
    setTransferAmount(val);
    const num = Number(val);
    if (!sourceAcc || !destAcc || isNaN(num) || num <= 0) return;

    if (sourceAcc.currency === destAcc.currency) {
      setTransferDestAmount(val);
    } else if (transferExchangeRate && Number(transferExchangeRate) > 0) {
      setTransferDestAmount((num * Number(transferExchangeRate)).toFixed(2));
    }
  };

  const handleExchangeRateChange = (rateStr: string) => {
    setTransferExchangeRate(rateStr);
    const rate = Number(rateStr);
    const srcNum = Number(transferAmount);
    if (!isNaN(rate) && rate > 0 && !isNaN(srcNum) && srcNum > 0) {
      setTransferDestAmount((srcNum * rate).toFixed(2));
    }
  };

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferSourceId || !transferDestId) {
      setFeedback({ type: 'error', message: 'Selecione as contas de origem e destino.' });
      return;
    }

    if (transferSourceId === transferDestId) {
      setFeedback({ type: 'error', message: 'A conta de origem e destino devem ser diferentes.' });
      return;
    }

    const sourceAcc = allAccounts.find((a) => a.id === transferSourceId);
    const destAcc = allAccounts.find((a) => a.id === transferDestId);

    if (!sourceAcc || !destAcc) {
      setFeedback({ type: 'error', message: 'Contas selecionadas não encontradas.' });
      return;
    }

    if (sourceAcc.type === 'credit_card' || destAcc.type === 'credit_card') {
      setFeedback({ type: 'error', message: 'Contas do tipo cartão de crédito não podem ser usadas em transferências.' });
      return;
    }

    const amountNum = Number(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFeedback({ type: 'error', message: 'O valor de origem da transferência deve ser maior que zero.' });
      return;
    }

    let destAmountNum = Number(transferDestAmount);
    if (sourceAcc.currency === destAcc.currency) {
      destAmountNum = amountNum;
    } else {
      if (isNaN(destAmountNum) || destAmountNum <= 0) {
        setFeedback({ type: 'error', message: 'O valor de destino da transferência deve ser maior que zero.' });
        return;
      }
    }

    const rateNum = Number(transferExchangeRate);

    try {
      setSaving(true);
      const res = await financialService.recordAccountTransfer({
        source_account_id: transferSourceId,
        destination_account_id: transferDestId,
        amount: amountNum,
        destination_amount: destAmountNum,
        exchange_rate: sourceAcc.currency !== destAcc.currency && !isNaN(rateNum) && rateNum > 0 ? rateNum : undefined,
        transfer_fee: Number(transferFee) || 0,
        transfer_fee_currency: transferFeeCurrency,
        transacted_at: transferDate,
        reference: transferReference.trim() || undefined,
        description: transferDescription.trim() || undefined,
        operation_id: operation?.id,
      });

      await loadData();
      setIsTransferModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Transferência de ${formatMoney(res.source_amount, res.source_currency)} de "${res.source_account_name}" para "${res.destination_account_name}" (${formatMoney(res.destination_amount, res.destination_currency)}) registrada com sucesso.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao registrar transferência: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // ==============================================================
  // AÇÕES DE GESTÃO DE CONTAS (MODAL)
  // ==============================================================

  const handleOpenAccountModal = () => {
    setIsManagingAccounts(true);
    setIsAddingNewAccount(false);
    setEditingAccountId(null);
  };

  const handleStartNewAccount = () => {
    setIsAddingNewAccount(true);
    setEditingAccountId(null);
    setAccName('');
    setAccType('bank_account');
    setAccCurrency('EUR');
    setAccInitialBalance('0.00');
    setAccInitialDate(new Date().toISOString().slice(0, 10));
    setAccDesc('');
    setAccActive(true);
  };

  const handleStartEditAccount = (acc: FinancialAccount) => {
    setEditingAccountId(acc.id);
    setIsAddingNewAccount(false);
    setAccName(acc.name);
    setAccType(acc.type);
    setAccCurrency(acc.currency);
    setAccInitialBalance(Number(acc.initial_balance || 0).toFixed(2));
    setAccInitialDate(acc.initial_balance_date || new Date().toISOString().slice(0, 10));
    setAccDesc(acc.description || '');
    setAccActive(acc.active);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) {
      setFeedback({ type: 'error', message: 'O nome da conta é obrigatório.' });
      return;
    }

    try {
      setSaving(true);
      if (editingAccountId) {
        await financialService.updateAccount(editingAccountId, {
          name: accName.trim(),
          type: accType,
          currency: accCurrency,
          initial_balance: Number(accInitialBalance) || 0,
          initial_balance_date: accInitialDate,
          description: accDesc.trim() || null,
          active: accActive,
        });
        setFeedback({ type: 'success', message: `Conta "${accName.trim()}" atualizada com sucesso.` });
      } else {
        await financialService.createAccount({
          name: accName.trim(),
          type: accType,
          currency: accCurrency,
          initial_balance: Number(accInitialBalance) || 0,
          initial_balance_date: accInitialDate,
          description: accDesc.trim() || null,
          active: accActive,
        });
        setFeedback({ type: 'success', message: `Nova conta "${accName.trim()}" cadastrada com sucesso.` });
      }

      const [activeAccs, allAccs] = await Promise.all([
        financialService.listAccounts(true),
        financialService.listAccounts(false),
      ]);
      setAccounts(activeAccs);
      setAllAccounts(allAccs);
      setIsAddingNewAccount(false);
      setEditingAccountId(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao salvar conta: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Carregando dados financeiros...</p>
      </div>
    );
  }

  if (!quote || !operation) {
    return (
      <div className="placeholder-view">
        <h3>Financeiro não disponível</h3>
        <p>A cotação solicitada não existe ou ainda não foi aprovada comercialmente.</p>
        <Link to="/cotacoes" className="btn btn-primary">
          Voltar para Cotações
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Cabeçalho */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Link to={`/cotacoes/${quote.id}`} className="btn btn-sm btn-secondary">
              ← Voltar para Cotação
            </Link>
            <span className="badge badge-neutral"><code>{quote.reference}</code></span>
            <span className="badge badge-success">Aprovada</span>
          </div>
          <h1 className="page-title">
            Financeiro: Cotação {quote.reference}
          </h1>
          <p className="page-subtitle">
            Cliente: <strong>{quote.client_name || 'Não informado'}</strong> • Moeda Comercial: <strong>{quote.currency}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleOpenTransferModal}
          >
            ⇄ Transferir entre contas
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleOpenAccountModal}
          >
            🏦 Gerenciar Contas ({accounts.length})
          </button>
          {operation.status !== 'cancelled' ? (
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                borderColor: 'var(--color-danger, #ef4444)',
                color: 'var(--color-danger, #ef4444)',
              }}
              onClick={() => {
                setCancelOperationReason('');
                setIsCancelOperationModalOpen(true);
              }}
              title="Cancelar a operação financeira com motivo obrigatório"
            >
              ✕ Cancelar operação
            </button>
          ) : (
            <span
              className="badge badge-danger"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
            >
              Operação Cancelada
            </span>
          )}
        </div>
      </div>

      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {/* Banner de Operação Cancelada */}
      {operation.status === 'cancelled' && (
        <div
          style={{
            padding: '0.85rem 1.15rem',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid var(--color-danger, #ef4444)',
            borderRadius: 'var(--radius-md, 6px)',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <strong style={{ color: 'var(--color-danger, #ef4444)', fontSize: '0.95rem' }}>
              ⚠️ Esta operação financeira está cancelada
            </strong>
            {operation.cancelled_at && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Data do cancelamento: {new Date(operation.cancelled_at).toLocaleDateString('pt-PT')}
              </span>
            )}
          </div>
          {operation.cancellation_reason && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <strong>Motivo registrado:</strong> <em>"{operation.cancellation_reason}"</em>
            </div>
          )}
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Serviços não concluídos e parcelas não pagas foram cancelados. Todos os recebimentos e pagamentos já realizados continuam preservados no histórico.
          </div>
        </div>
      )}

      {/* Cards de Totais Previstos Separados por EUR e BRL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Receber Previsto (EUR)
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.25rem' }}>
            {formatMoney(totals.recEUR, 'EUR')}
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Receber Previsto (BRL)
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.25rem' }}>
            {formatMoney(totals.recBRL, 'BRL')}
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Pagar Previsto (EUR)
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)', marginTop: '0.25rem' }}>
            {formatMoney(totals.payEUR, 'EUR')}
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Pagar Previsto (BRL)
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)', marginTop: '0.25rem' }}>
            {formatMoney(totals.payBRL, 'BRL')}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SEÇÃO 1: RECEBIMENTOS DO CLIENTE */}
      {/* ============================================================== */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Recebimentos</h2>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Parcelas previstas do cliente {quote.client_name ? `(${quote.client_name})` : ''}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={handleAddReceivableInstallment}
            disabled={saving}
          >
            + Adicionar Parcela de Recebimento
          </button>
        </div>

        {receivables.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem 0' }}>
            Nenhum recebimento previsto registrado para esta cotação.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {receivables.map((rec, idx) => {
              const isCancelled = rec.status === 'cancelled';
              const { cTxs, totalSettled, pendingBalance } = getCommitmentSettlementData(rec);
              const isSettled = rec.status === 'settled' || (pendingBalance <= 0.005 && totalSettled > 0);
              const isPartial = rec.status === 'partially_settled' || (totalSettled > 0 && !isSettled);

              const edits = receivableEdits[rec.id] || {};
              const currentAmount = edits.amount !== undefined ? edits.amount : rec.amount;
              const currentCurrency = edits.currency || rec.currency;
              const currentDate = edits.expected_date !== undefined ? edits.expected_date : (rec.expected_date || '');
              const currentAccount = edits.expected_account_id !== undefined ? edits.expected_account_id : (rec.expected_account_id || '');
              const currentMethod = edits.payment_method !== undefined ? edits.payment_method : (rec.payment_method || '');
              const currentNotes = edits.notes !== undefined ? edits.notes : (rec.notes || '');
              const hasChanges = Object.keys(edits).length > 0;

              return (
                <div
                  key={rec.id}
                  style={{
                    border: isCancelled ? '1px dashed var(--border-subtle)' : isSettled ? '1px solid var(--success-border, var(--border-subtle))' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    background: isCancelled ? 'var(--bg-surface)' : isSettled ? 'var(--bg-surface-elevated)' : 'var(--bg-surface-elevated)',
                    opacity: isCancelled ? 0.65 : 1,
                  }}
                >
                  {/* Cabeçalho da Parcela */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-neutral" style={{ fontWeight: 600 }}>
                        Parcela {idx + 1}
                      </span>
                      {isCancelled && (
                        <span className="badge badge-danger">Cancelada</span>
                      )}
                      {!isCancelled && isSettled && (
                        <span className="badge badge-success">Liquidado</span>
                      )}
                      {!isCancelled && isPartial && (
                        <span className="badge badge-primary">Parcial</span>
                      )}
                      {!isCancelled && !isSettled && !isPartial && (
                        <span className="badge badge-warning">Previsto</span>
                      )}
                      <span
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: isCancelled ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: isCancelled ? 'line-through' : 'none',
                        }}
                      >
                        {rec.description || 'Recebimento do Cliente'}
                      </span>
                      {isCancelled && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          (Preservado no histórico • Ignorado nos totais)
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {!isCancelled && !isSettled && pendingBalance > 0 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-success"
                          onClick={() => handleOpenSettlement(rec)}
                          disabled={saving}
                          style={{ fontWeight: 600 }}
                        >
                          ✓ Registrar recebimento
                        </button>
                      )}

                      {!isCancelled && totalSettled === 0 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleSplitReceivable(rec)}
                          disabled={saving}
                          title="Dividir esta parcela em duas de valores iguais"
                        >
                          Dividir em 2 parcelas
                        </button>
                      )}

                      {!isCancelled && hasChanges && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleSaveReceivable(rec)}
                          disabled={saving}
                        >
                          Salvar Alterações
                        </button>
                      )}

                      {!isCancelled && totalSettled === 0 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger-outline"
                          onClick={() => handleCancelCommitment(rec.id, rec.description || `Parcela ${idx + 1}`)}
                          disabled={saving}
                        >
                          Cancelar Parcela
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Resumo Financeiro da Parcela */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '1.25rem',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      padding: '0.5rem 0.75rem',
                      marginBottom: '0.75rem',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Previsto: </span>
                      <strong>{formatMoney(rec.amount, rec.currency)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Recebido Real: </span>
                      <strong style={{ color: totalSettled > 0 ? 'var(--success)' : 'inherit' }}>
                        {formatMoney(totalSettled, rec.currency)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Saldo Pendente: </span>
                      <strong style={{ color: pendingBalance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {formatMoney(pendingBalance, rec.currency)}
                      </strong>
                    </div>
                  </div>

                  {/* Campos Editáveis */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Valor Previsto</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={currentAmount}
                        disabled={isCancelled || isSettled || saving}
                        onChange={(e) => handleUpdateReceivableField(rec.id, 'amount', e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Moeda</label>
                      <select
                        className="form-select"
                        value={currentCurrency}
                        disabled={isCancelled || isSettled || totalSettled > 0 || saving}
                        onChange={(e) => handleUpdateReceivableField(rec.id, 'currency', e.target.value as Currency)}
                      >
                        <option value="EUR">EUR (€)</option>
                        <option value="BRL">BRL (R$)</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Data Prevista</label>
                      <input
                        type="date"
                        className="form-control"
                        value={currentDate || ''}
                        disabled={isCancelled || saving}
                        onChange={(e) => handleUpdateReceivableField(rec.id, 'expected_date', e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Conta de Entrada Prevista</label>
                      <select
                        className="form-select"
                        value={currentAccount || ''}
                        disabled={isCancelled || saving}
                        onChange={(e) => handleUpdateReceivableField(rec.id, 'expected_account_id', e.target.value)}
                      >
                        <option value="">— Nenhuma conta —</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.currency})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Método de Pagamento</label>
                      <select
                        className="form-select"
                        value={currentMethod || ''}
                        disabled={isCancelled || saving}
                        onChange={(e) => handleUpdateReceivableField(rec.id, 'payment_method', e.target.value as FinancialPaymentMethod)}
                      >
                        <option value="">— Selecionar —</option>
                        {(Object.keys(PAYMENT_METHOD_LABELS) as FinancialPaymentMethod[]).map((m) => (
                          <option key={m} value={m}>
                            {PAYMENT_METHOD_LABELS[m]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Observação</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ex: Entrada 30% PIX, Saldo no cartão..."
                        value={currentNotes ?? ''}
                        disabled={isCancelled || saving}
                        onChange={(e) => handleUpdateReceivableField(rec.id, 'notes', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Lista Discreta de Movimentações Reais Recebidas */}
                  {cTxs.length > 0 && (
                    <div
                      style={{
                        marginTop: '0.85rem',
                        padding: '0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          marginBottom: '0.5rem',
                        }}
                      >
                        Histórico de Recebimentos Reais ({cTxs.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {cTxs.map((tx) => {
                          const acc = allAccounts.find((a) => a.id === tx.account_id);
                          return (
                            <div
                              key={tx.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '0.8rem',
                                padding: '0.35rem 0',
                                borderBottom: '1px dashed var(--border-subtle)',
                                flexWrap: 'wrap',
                                gap: '0.5rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                                  +{formatMoney(tx.amount, tx.currency)}
                                </span>
                                <span>
                                  {new Date(tx.transacted_at).toLocaleDateString('pt-PT')}
                                </span>
                                {acc && (
                                  <span style={{ color: 'var(--text-secondary)' }}>
                                    • Conta: <strong>{acc.name}</strong>
                                  </span>
                                )}
                                {tx.reference && (
                                  <span style={{ color: 'var(--text-muted)' }}>
                                    (Ref: {tx.reference})
                                  </span>
                                )}
                              </div>
                              {tx.description && (
                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.75rem' }}>
                                  {tx.description}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* ============================================================== */}
      {/* SEÇÃO 2: SERVIÇOS & PAGAMENTOS PREVISTOS */}
      {/* ============================================================== */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Serviços</h2>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Serviços da viagem e respectivos pagamentos previstos a fornecedores
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setIsAddingService(true)}
            disabled={saving || isAddingService}
          >
            + Adicionar Serviço
          </button>
        </div>

        {/* Modal / Formulário Inline de Novo Serviço */}
        {isAddingService && (
          <form
            onSubmit={handleAddService}
            style={{
              border: '2px dashed var(--accent-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              background: 'var(--accent-soft)',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Novo Serviço Pós-Aprovação
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Descrição do Serviço *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Jantar de boas-vindas..."
                  className="form-control"
                  value={newServiceDesc}
                  onChange={(e) => setNewServiceDesc(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Tipo de Serviço</label>
                <select
                  className="form-select"
                  value={newServiceType}
                  onChange={(e) => setNewServiceType(e.target.value)}
                >
                  <option value="lodging">Hospedagem</option>
                  <option value="flight">Voo / Transporte</option>
                  <option value="transfer">Transfer</option>
                  <option value="tour">Passeio / Atividade</option>
                  <option value="insurance">Seguro</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Fornecedor</label>
                <input
                  type="text"
                  placeholder="Nome do fornecedor"
                  className="form-control"
                  value={newServiceSupplier}
                  onChange={(e) => setNewServiceSupplier(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Custo Previsto</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="form-control"
                  value={newServiceCost}
                  onChange={(e) => setNewServiceCost(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Moeda</label>
                <select
                  className="form-select"
                  value={newServiceCurrency}
                  onChange={(e) => setNewServiceCurrency(e.target.value as Currency)}
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="BRL">BRL (R$)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setIsAddingService(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
                Confirmar Serviço
              </button>
            </div>
          </form>
        )}

        {services.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem 0' }}>
            Nenhum serviço registrado nesta operação.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {services.map((srv) => {
              const sEdits = serviceEdits[srv.id] || {};
              const currentDesc = sEdits.description !== undefined ? sEdits.description : srv.description;
              const currentSupplier = sEdits.supplier_name !== undefined ? sEdits.supplier_name : (srv.supplier_name || '');
              const currentStatus = (sEdits.status as FinancialOperationServiceStatus) || srv.status;
              const isServiceCancelled = currentStatus === 'cancelled';
              const serviceHasChanges = Object.keys(sEdits).length > 0;

              // Parcelas de pagamento deste serviço
              const servicePayables = payables.filter((p) => p.operation_service_id === srv.id);

              return (
                <div
                  key={srv.id}
                  style={{
                    border: isServiceCancelled ? '1px dashed var(--border-subtle)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.25rem',
                    background: 'var(--bg-surface)',
                    opacity: isServiceCancelled ? 0.75 : 1,
                  }}
                >
                  {/* Linha Principal do Serviço */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                          {srv.type}
                        </span>
                        <span
                          className={`badge ${
                            currentStatus === 'completed'
                              ? 'badge-success'
                              : currentStatus === 'cancelled'
                              ? 'badge-danger'
                              : currentStatus === 'contracted'
                              ? 'badge-primary'
                              : 'badge-warning'
                          }`}
                        >
                          {SERVICE_STATUS_LABELS[currentStatus] || currentStatus}
                        </span>
                        {srv.cost_amount > 0 && (
                          <span
                            style={{
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)',
                              textDecoration: isServiceCancelled ? 'line-through' : 'none',
                            }}
                          >
                            • Custo Base: {formatMoney(srv.cost_amount, srv.cost_currency)}
                          </span>
                        )}
                        {isServiceCancelled && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            (Serviço cancelado • Histórico preservado)
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        className="form-control"
                        style={{
                          fontWeight: 600,
                          fontSize: '1rem',
                          textDecoration: isServiceCancelled ? 'line-through' : 'none',
                        }}
                        value={currentDesc}
                        disabled={isServiceCancelled || saving}
                        onChange={(e) => handleUpdateServiceField(srv.id, 'description', e.target.value)}
                      />
                    </div>

                    {/* Fornecedor, Status e Ações */}
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div className="form-group" style={{ margin: 0, minWidth: 160 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Fornecedor</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Nome do Fornecedor"
                          value={currentSupplier ?? ''}
                          disabled={isServiceCancelled || saving}
                          onChange={(e) => handleUpdateServiceField(srv.id, 'supplier_name', e.target.value)}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0, minWidth: 140 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Estado do Serviço</label>
                        <select
                          className="form-select"
                          value={currentStatus}
                          disabled={isServiceCancelled || saving}
                          onChange={(e) =>
                            handleUpdateServiceField(
                              srv.id,
                              'status',
                              e.target.value as FinancialOperationServiceStatus
                            )
                          }
                        >
                          {(Object.keys(SERVICE_STATUS_LABELS) as FinancialOperationServiceStatus[]).map((st) => (
                            <option key={st} value={st}>
                              {SERVICE_STATUS_LABELS[st]}
                            </option>
                          ))}
                        </select>
                      </div>

                      {!isServiceCancelled && serviceHasChanges && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleSaveService(srv)}
                          disabled={saving}
                        >
                          Salvar Serviço
                        </button>
                      )}

                      {!isServiceCancelled && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger-outline"
                          onClick={() => handleStartCancelService(srv)}
                          disabled={saving}
                        >
                          Cancelar Serviço
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sub-seção: Pagamentos Previstos do Serviço */}
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        Pagamentos Previstos para este Serviço
                      </span>
                      {!isServiceCancelled && (
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleAddPayableInstallment(srv)}
                          disabled={saving}
                        >
                          + Adicionar Parcela de Pagamento
                        </button>
                      )}
                    </div>

                    {servicePayables.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', margin: 0 }}>
                        {isServiceCancelled
                          ? 'Nenhum pagamento registrado.'
                          : 'Nenhum pagamento previsto registrado para este serviço. Clique em "+ Adicionar Parcela de Pagamento".'}
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {servicePayables.map((pay, pIdx) => {
                          const isPayCancelled = pay.status === 'cancelled';
                          const pEdits = payableEdits[pay.id] || {};
                          const pAmount = pEdits.amount !== undefined ? pEdits.amount : pay.amount;
                          const pCurrency = pEdits.currency || pay.currency;
                          const pDate = pEdits.expected_date !== undefined ? pEdits.expected_date : (pay.expected_date || '');
                          const pAccount = pEdits.expected_account_id !== undefined ? pEdits.expected_account_id : (pay.expected_account_id || '');
                          const pMethod = pEdits.payment_method !== undefined ? pEdits.payment_method : (pay.payment_method || '');
                          const pNotes = pEdits.notes !== undefined ? pEdits.notes : (pay.notes || '');
                          const payHasChanges = Object.keys(pEdits).length > 0;

                          const { cTxs: payTxs, totalSettled: payPaidAmount, pendingBalance: payPendingBalance } = getCommitmentSettlementData(pay);
                          const isPaySettled = pay.status === 'settled' || (payPaidAmount >= pay.amount && pay.amount > 0);
                          const isPayPartiallySettled = pay.status === 'partially_settled' || (payPaidAmount > 0 && !isPaySettled);

                          return (
                            <div
                              key={pay.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr)) auto',
                                gap: '0.65rem',
                                alignItems: 'flex-end',
                                padding: '0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                background: isPayCancelled ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                                border: isPayCancelled ? '1px dashed var(--border-subtle)' : '1px solid var(--border-subtle)',
                                opacity: isPayCancelled ? 0.65 : 1,
                              }}
                            >
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>
                                  Parcela {pIdx + 1} (Valor)
                                  {isPayCancelled ? (
                                    <span className="badge badge-danger" style={{ fontSize: '0.65rem', marginLeft: '0.35rem' }}>
                                      Cancelada
                                    </span>
                                  ) : isPaySettled ? (
                                    <span className="badge badge-success" style={{ fontSize: '0.65rem', marginLeft: '0.35rem' }}>
                                      Liquidada
                                    </span>
                                  ) : isPayPartiallySettled ? (
                                    <span className="badge badge-warning" style={{ fontSize: '0.65rem', marginLeft: '0.35rem' }}>
                                      Parcial
                                    </span>
                                  ) : (
                                    <span className="badge badge-neutral" style={{ fontSize: '0.65rem', marginLeft: '0.35rem' }}>
                                      Prevista
                                    </span>
                                  )}
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="form-control"
                                  value={pAmount}
                                  disabled={isPayCancelled || isServiceCancelled || isPaySettled || saving}
                                  onChange={(e) => handleUpdatePayableField(pay.id, 'amount', e.target.value)}
                                />
                              </div>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Moeda</label>
                                <select
                                  className="form-select"
                                  value={pCurrency}
                                  disabled={isPayCancelled || isServiceCancelled || isPaySettled || payTxs.length > 0 || saving}
                                  onChange={(e) => handleUpdatePayableField(pay.id, 'currency', e.target.value as Currency)}
                                >
                                  <option value="EUR">EUR (€)</option>
                                  <option value="BRL">BRL (R$)</option>
                                </select>
                              </div>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Data Prevista</label>
                                <input
                                  type="date"
                                  className="form-control"
                                  value={pDate || ''}
                                  disabled={isPayCancelled || isServiceCancelled || saving}
                                  onChange={(e) => handleUpdatePayableField(pay.id, 'expected_date', e.target.value)}
                                />
                              </div>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Conta de Saída</label>
                                <select
                                  className="form-select"
                                  value={pAccount || ''}
                                  disabled={isPayCancelled || isServiceCancelled || saving}
                                  onChange={(e) => handleUpdatePayableField(pay.id, 'expected_account_id', e.target.value)}
                                >
                                  <option value="">— Nenhuma conta —</option>
                                  {accounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                      {acc.name} ({acc.currency})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Forma de Pagamento</label>
                                <select
                                  className="form-select"
                                  value={pMethod || ''}
                                  disabled={isPayCancelled || isServiceCancelled || saving}
                                  onChange={(e) => handleUpdatePayableField(pay.id, 'payment_method', e.target.value as FinancialPaymentMethod)}
                                >
                                  <option value="">— Selecionar —</option>
                                  {(Object.keys(PAYMENT_METHOD_LABELS) as FinancialPaymentMethod[]).map((m) => (
                                    <option key={m} value={m}>
                                      {PAYMENT_METHOD_LABELS[m]}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Observação</label>
                                <input
                                  type="text"
                                  placeholder="Notas..."
                                  className="form-control"
                                  value={pNotes ?? ''}
                                  disabled={isPayCancelled || isServiceCancelled || saving}
                                  onChange={(e) => handleUpdatePayableField(pay.id, 'notes', e.target.value)}
                                />
                              </div>

                              <div style={{ display: 'flex', gap: '0.35rem', alignSelf: 'flex-end', flexWrap: 'wrap' }}>
                                {!isPayCancelled && !isServiceCancelled && payHasChanges && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    onClick={() => handleSavePayable(pay)}
                                    disabled={saving}
                                  >
                                    Salvar
                                  </button>
                                )}
                                {!isPayCancelled && !isServiceCancelled && !isPaySettled && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-danger-outline"
                                    onClick={() => handleCancelCommitment(pay.id, `Parcela ${pIdx + 1}`)}
                                    disabled={saving}
                                    title="Cancelar parcela de pagamento"
                                  >
                                    Cancelar Parcela
                                  </button>
                                )}
                              </div>

                              {/* Barra de Status e Ação de Liquidação */}
                              <div
                                style={{
                                  gridColumn: '1 / -1',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '0.45rem 0.65rem',
                                  background: 'var(--bg-surface-elevated)',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: '0.8rem',
                                  color: 'var(--text-secondary)',
                                  flexWrap: 'wrap',
                                  gap: '0.5rem',
                                }}
                              >
                                <div>
                                  Previsto: <strong>{formatMoney(Number(pAmount || 0), pCurrency)}</strong> • Pago Real:{' '}
                                  <strong style={{ color: 'var(--color-danger, #ef4444)' }}>
                                    {formatMoney(payPaidAmount, pCurrency)}
                                  </strong>{' '}
                                  • Saldo Pendente:{' '}
                                  <strong
                                    style={{
                                      color: payPendingBalance > 0 ? 'var(--accent-primary)' : 'var(--color-success, #22c55e)',
                                    }}
                                  >
                                    {formatMoney(payPendingBalance, pCurrency)}
                                  </strong>
                                </div>

                                {!isPayCancelled && !isServiceCancelled && !isPaySettled && payPendingBalance > 0 && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', fontWeight: 600 }}
                                    onClick={() => handleOpenSettlement(pay)}
                                    disabled={saving}
                                    title="Registrar pagamento real para esta parcela"
                                  >
                                    ✓ Registrar pagamento
                                  </button>
                                )}
                              </div>

                              {/* Histórico Discreto de Pagamentos Reais */}
                              {payTxs.length > 0 && (
                                <div
                                  style={{
                                    gridColumn: '1 / -1',
                                    marginTop: '0.25rem',
                                    padding: '0.6rem 0.75rem',
                                    background: 'var(--bg-surface-elevated)',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-subtle)',
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      color: 'var(--text-muted)',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.04em',
                                      marginBottom: '0.4rem',
                                    }}
                                  >
                                    Histórico de Pagamentos Reais ({payTxs.length})
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {payTxs.map((tx) => {
                                      const acc = allAccounts.find((a) => a.id === tx.account_id);
                                      return (
                                        <div
                                          key={tx.id}
                                          style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            fontSize: '0.8rem',
                                            padding: '0.3rem 0',
                                            borderBottom: '1px dashed var(--border-subtle)',
                                            flexWrap: 'wrap',
                                            gap: '0.5rem',
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                                            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                                              -{formatMoney(tx.amount, tx.currency)}
                                            </span>
                                            <span>
                                              {new Date(tx.transacted_at).toLocaleDateString('pt-PT')}
                                            </span>
                                            {acc && (
                                              <span style={{ color: 'var(--text-secondary)' }}>
                                                • Conta: <strong>{acc.name}</strong>
                                              </span>
                                            )}
                                            {tx.reference && (
                                              <span style={{ color: 'var(--text-muted)' }}>
                                                (Ref: {tx.reference})
                                              </span>
                                            )}
                                          </div>
                                          {tx.description && (
                                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.75rem' }}>
                                              {tx.description}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Sub-seção: Ajustes de Cancelamento do Serviço (Reembolso / Multa) */}
                  {(() => {
                    const serviceAdjustments = commitments.filter(
                      (c) => c.operation_service_id === srv.id && c.is_cancellation_adjustment
                    );
                    if (serviceAdjustments.length === 0) return null;

                    return (
                      <div
                        style={{
                          marginTop: '0.85rem',
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                            ⚖️ Ajustes do Cancelamento deste Serviço ({serviceAdjustments.length})
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            (Reembolsos e multas vinculados ao serviço cancelado)
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {serviceAdjustments.map((adj) => {
                            const { cTxs, totalSettled, pendingBalance } = getCommitmentSettlementData(adj);
                            const isSettled = adj.status === 'settled' || (totalSettled >= adj.amount && adj.amount > 0);
                            const isPartial = adj.status === 'partially_settled' || (totalSettled > 0 && !isSettled);
                            const isCancelled = adj.status === 'cancelled';
                            const isSupplierRefund = adj.adjustment_type === 'supplier_refund';

                            return (
                              <div
                                key={adj.id}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  padding: '0.65rem 0.85rem',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'var(--bg-surface-elevated)',
                                  border: isCancelled ? '1px dashed var(--border-subtle)' : '1px solid var(--border-subtle)',
                                  gap: '0.4rem',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                    {adj.adjustment_type === 'supplier_refund' && (
                                      <span className="badge badge-success">Reembolso do Fornecedor</span>
                                    )}
                                    {adj.adjustment_type === 'cancellation_fee' && (
                                      <span className="badge badge-danger">Multa de Cancelamento</span>
                                    )}
                                    {adj.adjustment_type === 'client_refund' && (
                                      <span className="badge badge-warning">Reembolso ao Cliente</span>
                                    )}
                                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{adj.counterparty_name}</span>
                                    {isCancelled ? (
                                      <span className="badge badge-neutral">Cancelado</span>
                                    ) : isSettled ? (
                                      <span className="badge badge-success">Liquidado</span>
                                    ) : isPartial ? (
                                      <span className="badge badge-warning">Parcial</span>
                                    ) : (
                                      <span className="badge badge-neutral">Previsto</span>
                                    )}
                                  </div>

                                  {!isSettled && !isCancelled && pendingBalance > 0 && (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-primary"
                                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                                      onClick={() => handleOpenSettlement(adj)}
                                      disabled={saving}
                                    >
                                      {isSupplierRefund ? '✓ Registrar Recebimento' : '✓ Registrar Pagamento'}
                                    </button>
                                  )}
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                  <span>Previsto: <strong>{formatMoney(adj.amount, adj.currency)}</strong></span>
                                  <span>
                                    {isSupplierRefund ? 'Recebido: ' : 'Pago: '}
                                    <strong style={{ color: isSupplierRefund ? 'var(--color-success, #22c55e)' : 'var(--color-danger, #ef4444)' }}>
                                      {formatMoney(totalSettled, adj.currency)}
                                    </strong>
                                  </span>
                                  <span>
                                    Saldo:{' '}
                                    <strong style={{ color: pendingBalance > 0 ? 'var(--accent-primary)' : 'var(--color-success, #22c55e)' }}>
                                      {formatMoney(pendingBalance, adj.currency)}
                                    </strong>
                                  </span>
                                  {adj.notes && <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>({adj.notes})</span>}
                                </div>

                                {cTxs.length > 0 && (
                                  <div style={{ marginTop: '0.2rem', fontSize: '0.72rem' }}>
                                    {cTxs.map((tx) => {
                                      const acc = allAccounts.find((a) => a.id === tx.account_id);
                                      return (
                                        <div key={tx.id} style={{ display: 'flex', gap: '0.4rem', color: 'var(--text-secondary)', padding: '0.1rem 0' }}>
                                          <span className={tx.type === 'inflow' ? 'badge badge-success' : 'badge badge-warning'} style={{ fontSize: '0.65rem' }}>
                                            {tx.type === 'inflow' ? '+' : '-'}{formatMoney(tx.amount, tx.currency)}
                                          </span>
                                          <span>{new Date(tx.transacted_at).toLocaleDateString('pt-PT')}</span>
                                          {acc && <span>Conta: <strong>{acc.name}</strong></span>}
                                          {tx.reference && <span>(Ref: {tx.reference})</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* SEÇÃO 3: FATURAS DE CARTÃO DE CRÉDITO */}
      {/* ============================================================== */}
      {cardInvoices.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                💳 Faturas de Cartão de Crédito ({cardInvoices.length})
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Faturas geradas por pagamentos de fornecedores no cartão de crédito. Registre a saída bancária ou de caixa ao quitar a fatura.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {cardInvoices.map((inv) => {
              const { cTxs, totalSettled, pendingBalance } = getCommitmentSettlementData(inv);
              const isSettled = inv.status === 'settled' || (totalSettled >= inv.amount && inv.amount > 0);
              const isPartial = inv.status === 'partially_settled' || (totalSettled > 0 && !isSettled);

              return (
                <div
                  key={inv.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {inv.counterparty_name}
                      </span>
                      {isSettled ? (
                        <span className="badge badge-success">Fatura Liquidada</span>
                      ) : isPartial ? (
                        <span className="badge badge-warning">Parcialmente Paga</span>
                      ) : (
                        <span className="badge badge-neutral">Vencimento Previsto</span>
                      )}
                      {inv.expected_date && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          • Vencimento: <strong>{new Date(inv.expected_date).toLocaleDateString('pt-PT')}</strong>
                        </span>
                      )}
                    </div>

                    {!isSettled && pendingBalance > 0 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => handleOpenSettlement(inv)}
                        disabled={saving}
                      >
                        ✓ Registrar Pagamento da Fatura
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {inv.description}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '1.25rem',
                      fontSize: '0.8rem',
                      background: 'var(--bg-surface)',
                      padding: '0.4rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>Valor da Fatura: <strong>{formatMoney(inv.amount, inv.currency)}</strong></span>
                    <span>Pago: <strong style={{ color: 'var(--color-danger, #ef4444)' }}>{formatMoney(totalSettled, inv.currency)}</strong></span>
                    <span>Saldo a Pagar: <strong style={{ color: pendingBalance > 0 ? 'var(--accent-primary)' : 'var(--color-success, #22c55e)' }}>{formatMoney(pendingBalance, inv.currency)}</strong></span>
                  </div>

                  {cTxs.length > 0 && (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        Histórico de Pagamento da Fatura ({cTxs.length}):
                      </div>
                      {cTxs.map((tx) => {
                        const acc = allAccounts.find((a) => a.id === tx.account_id);
                        return (
                          <div key={tx.id} style={{ display: 'flex', gap: '0.5rem', color: 'var(--text-secondary)', padding: '0.15rem 0' }}>
                            <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>
                              -{formatMoney(tx.amount, tx.currency)}
                            </span>
                            <span>{new Date(tx.transacted_at).toLocaleDateString('pt-PT')}</span>
                            {acc && <span>Conta de Débito: <strong>{acc.name}</strong></span>}
                            {tx.reference && <span>(Ref: {tx.reference})</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SEÇÃO 4: AJUSTES DE CANCELAMENTO (REEMBOLSOS & MULTAS) */}
      {/* Exibida apenas quando a operação financeira estiver cancelada */}
      {/* ============================================================== */}
      {operation.status === 'cancelled' && (
        <div className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ⚖️ Ajustes de Cancelamento ({cancellationAdjustments.length})
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Previsões de devoluções a clientes, reembolsos de fornecedores e multas de cancelamento vinculadas à operação cancelada.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleOpenAddAdjustmentModal}
              disabled={saving}
            >
              + Novo Ajuste de Cancelamento
            </button>
          </div>

        {/* Resumo de Ajustes separados por EUR e BRL */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Reembolsos a Clientes (A Pagar)
            </span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-danger, #ef4444)', marginTop: '0.2rem' }}>
              {adjustmentTotals.clientRefundsEUR > 0 && <div>{formatMoney(adjustmentTotals.clientRefundsEUR, 'EUR')}</div>}
              {adjustmentTotals.clientRefundsBRL > 0 && <div>{formatMoney(adjustmentTotals.clientRefundsBRL, 'BRL')}</div>}
              {adjustmentTotals.clientRefundsEUR === 0 && adjustmentTotals.clientRefundsBRL === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>0,00 €</span>}
            </div>
          </div>

          <div style={{ padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Reembolsos de Fornecedores (A Receber)
            </span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-success, #22c55e)', marginTop: '0.2rem' }}>
              {adjustmentTotals.supplierRefundsEUR > 0 && <div>{formatMoney(adjustmentTotals.supplierRefundsEUR, 'EUR')}</div>}
              {adjustmentTotals.supplierRefundsBRL > 0 && <div>{formatMoney(adjustmentTotals.supplierRefundsBRL, 'BRL')}</div>}
              {adjustmentTotals.supplierRefundsEUR === 0 && adjustmentTotals.supplierRefundsBRL === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>0,00 €</span>}
            </div>
          </div>

          <div style={{ padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Multas / Custos (A Pagar)
            </span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-danger, #ef4444)', marginTop: '0.2rem' }}>
              {adjustmentTotals.cancellationFeesEUR > 0 && <div>{formatMoney(adjustmentTotals.cancellationFeesEUR, 'EUR')}</div>}
              {adjustmentTotals.cancellationFeesBRL > 0 && <div>{formatMoney(adjustmentTotals.cancellationFeesBRL, 'BRL')}</div>}
              {adjustmentTotals.cancellationFeesEUR === 0 && adjustmentTotals.cancellationFeesBRL === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>0,00 €</span>}
            </div>
          </div>
        </div>

        {/* Lista de Ajustes */}
        {cancellationAdjustments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, padding: '0.5rem 0' }}>
            Nenhum ajuste de cancelamento registrado para esta operação.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {cancellationAdjustments.map((adj) => {
              const { cTxs, totalSettled, pendingBalance } = getCommitmentSettlementData(adj);
              const isSettled = adj.status === 'settled' || (totalSettled >= adj.amount && adj.amount > 0);
              const isPartial = adj.status === 'partially_settled' || (totalSettled > 0 && !isSettled);
              const isCancelled = adj.status === 'cancelled';
              const isSupplierRefund = adj.adjustment_type === 'supplier_refund';

              return (
                <div
                  key={adj.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-elevated)',
                    border: isCancelled ? '1px dashed var(--border-subtle)' : '1px solid var(--border-subtle)',
                    opacity: isCancelled ? 0.7 : 1,
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {adj.adjustment_type === 'client_refund' && (
                        <span className="badge badge-warning">Reembolso ao Cliente</span>
                      )}
                      {adj.adjustment_type === 'supplier_refund' && (
                        <span className="badge badge-success">Reembolso do Fornecedor</span>
                      )}
                      {adj.adjustment_type === 'cancellation_fee' && (
                        <span className="badge badge-danger">Multa de Cancelamento</span>
                      )}

                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {adj.counterparty_name}
                      </span>

                      {isCancelled ? (
                        <span className="badge badge-neutral">Cancelado</span>
                      ) : isSettled ? (
                        <span className="badge badge-success">Liquidado</span>
                      ) : isPartial ? (
                        <span className="badge badge-warning">Parcial</span>
                      ) : (
                        <span className="badge badge-neutral">Previsto</span>
                      )}

                      {adj.expected_date && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          • Data Prevista: <strong>{new Date(adj.expected_date).toLocaleDateString('pt-PT')}</strong>
                        </span>
                      )}
                    </div>

                    {!isSettled && !isCancelled && pendingBalance > 0 && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleOpenSettlement(adj)}
                          disabled={saving}
                        >
                          {isSupplierRefund ? '✓ Registrar Recebimento' : '✓ Registrar Pagamento'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger-outline"
                          onClick={() => handleCancelCommitment(adj.id, adj.description || 'Ajuste')}
                          disabled={saving}
                          title="Cancelar ajuste"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>

                  {adj.description && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {adj.description}
                    </div>
                  )}

                  {adj.notes && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Notas: {adj.notes}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      gap: '1.25rem',
                      fontSize: '0.8rem',
                      background: 'var(--bg-surface)',
                      padding: '0.4rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>Valor Previsto: <strong>{formatMoney(adj.amount, adj.currency)}</strong></span>
                    <span>
                      {isSupplierRefund ? 'Recebido Real: ' : 'Pago Real: '}
                      <strong style={{ color: isSupplierRefund ? 'var(--color-success, #22c55e)' : 'var(--color-danger, #ef4444)' }}>
                        {formatMoney(totalSettled, adj.currency)}
                      </strong>
                    </span>
                    <span>
                      Saldo Pendente:{' '}
                      <strong style={{ color: pendingBalance > 0 ? 'var(--accent-primary)' : 'var(--color-success, #22c55e)' }}>
                        {formatMoney(pendingBalance, adj.currency)}
                      </strong>
                    </span>
                  </div>

                  {/* Histórico Discreto de Movimentações */}
                  {cTxs.length > 0 && (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        Histórico de Liquidação ({cTxs.length}):
                      </div>
                      {cTxs.map((tx) => {
                        const acc = allAccounts.find((a) => a.id === tx.account_id);
                        return (
                          <div key={tx.id} style={{ display: 'flex', gap: '0.5rem', color: 'var(--text-secondary)', padding: '0.15rem 0' }}>
                            <span className={tx.type === 'inflow' ? 'badge badge-success' : 'badge badge-warning'} style={{ fontSize: '0.65rem' }}>
                              {tx.type === 'inflow' ? '+' : '-'}{formatMoney(tx.amount, tx.currency)}
                            </span>
                            <span>{new Date(tx.transacted_at).toLocaleDateString('pt-PT')}</span>
                            {acc && <span>Conta: <strong>{acc.name}</strong></span>}
                            {tx.reference && <span>(Ref: {tx.reference})</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}

      {/* Modal de Registro de Movimentação Real (Recebimento ou Pagamento) */}
      {settlementTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg, 8px)',
              padding: '1.5rem',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                {settlementTarget.type === 'receivable'
                  ? 'Registrar Recebimento'
                  : settlementTarget.is_credit_card_invoice
                  ? 'Registrar Pagamento de Fatura do Cartão'
                  : 'Registrar Pagamento'}
              </h3>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setSettlementTarget(null)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            {/* Resumo do compromisso */}
            {(() => {
              const { pendingBalance, totalSettled } = getCommitmentSettlementData(settlementTarget);
              const isCreditCardBlocked = settlementTarget.type === 'receivable' || Boolean(settlementTarget.is_credit_card_invoice);
              const matchingAccounts = allAccounts.filter(
                (a) => a.currency === settlementTarget.currency && a.active && (!isCreditCardBlocked || a.type !== 'credit_card')
              );
              const selectedAccount = allAccounts.find((a) => a.id === settlementAccountId);
              const isCardAccountSelected = selectedAccount?.type === 'credit_card';

              return (
                <form onSubmit={handleSubmitSettlement}>
                  <div
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: '1rem',
                      fontSize: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                    }}
                  >
                    <div>
                      <strong>Parcela:</strong> {settlementTarget.description || (settlementTarget.type === 'receivable' ? 'Recebimento' : 'Pagamento')}
                    </div>
                    <div>
                      <strong>Valor Total Previsto:</strong> {formatMoney(settlementTarget.amount, settlementTarget.currency)}
                    </div>
                    <div>
                      <strong>Já Liquidado:</strong> {formatMoney(totalSettled, settlementTarget.currency)}
                    </div>
                    <div style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                      <strong>Saldo Pendente:</strong> {formatMoney(pendingBalance, settlementTarget.currency)}
                    </div>
                  </div>

                  {matchingAccounts.length === 0 ? (
                    <div className="card" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-primary)', marginBottom: '1rem' }}>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        ⚠️ Não há contas ativas elegíveis cadastradas na moeda <strong>{settlementTarget.currency}</strong>.
                      </p>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        style={{ marginTop: '0.5rem' }}
                        onClick={() => {
                          setSettlementTarget(null);
                          handleOpenAccountModal();
                          handleStartNewAccount();
                          setAccCurrency(settlementTarget.currency);
                        }}
                      >
                        + Cadastrar Conta em {settlementTarget.currency}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          Conta Financeira ({settlementTarget.currency}) *
                        </label>
                        <select
                          className="form-select"
                          required
                          value={settlementAccountId}
                          onChange={(e) => setSettlementAccountId(e.target.value)}
                        >
                          <option value="">Selecione uma conta...</option>
                          {matchingAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({ACCOUNT_TYPE_LABELS[a.type] || a.type}) - Moeda: {a.currency}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Campo obrigatório de vencimento da fatura quando conta for cartão de crédito */}
                      {isCardAccountSelected && (
                        <div
                          className="form-group"
                          style={{
                            background: 'var(--accent-soft)',
                            padding: '0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--accent-primary)',
                            marginBottom: '1rem',
                          }}
                        >
                          <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Data de Vencimento da Fatura do Cartão *
                          </label>
                          <input
                            type="date"
                            required
                            className="form-control"
                            value={settlementInvoiceDueDate}
                            onChange={(e) => setSettlementInvoiceDueDate(e.target.value)}
                          />
                          <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                            💳 Este pagamento liquidará o fornecedor no cartão e gerará automaticamente uma nova parcela prevista da fatura do cartão para vencimento nesta data.
                          </small>
                        </div>
                      )}

                      <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, margin: 0 }}>
                            Valor da Movimentação ({settlementTarget.currency}) *
                          </label>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}
                            onClick={() => setSettlementAmount(pendingBalance.toFixed(2))}
                          >
                            Usar Saldo Total ({formatMoney(pendingBalance, settlementTarget.currency)})
                          </button>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={pendingBalance}
                          required
                          className="form-control"
                          value={settlementAmount}
                          onChange={(e) => setSettlementAmount(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          Data da Movimentação *
                        </label>
                        <input
                          type="date"
                          required
                          className="form-control"
                          value={settlementDate}
                          onChange={(e) => setSettlementDate(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          Referência / Comprovante (opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Pix 1234, DOC, Transf #99..."
                          className="form-control"
                          value={settlementReference}
                          onChange={(e) => setSettlementReference(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          Observação (opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Notas internas..."
                          className="form-control"
                          value={settlementDescription}
                          onChange={(e) => setSettlementDescription(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setSettlementTarget(null)}
                          disabled={saving}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={saving || !settlementAccountId || Number(settlementAmount) <= 0 || (isCardAccountSelected && !settlementInvoiceDueDate)}
                        >
                          {saving
                            ? 'Gravando...'
                            : settlementTarget.type === 'receivable'
                            ? 'Registrar Recebimento'
                            : isCardAccountSelected
                            ? 'Pagar com Cartão & Gerar Fatura'
                            : 'Registrar Pagamento'}
                        </button>
                      </div>
                    </>
                  )}
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal de Gestão de Contas */}
      {isManagingAccounts && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg, 8px)',
              padding: '1.5rem',
              maxWidth: '750px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  Gestão de Contas Financeiras
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Cadastre e gerencie as contas bancárias, caixas e cartões da agência
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setIsManagingAccounts(false)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            {/* Formulário de Nova / Editar Conta */}
            {(isAddingNewAccount || editingAccountId) ? (
              <form
                onSubmit={handleSaveAccount}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1.5rem',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                    {editingAccountId ? 'Editar Conta' : 'Nova Conta Financeira'}
                  </h4>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setIsAddingNewAccount(false);
                      setEditingAccountId(null);
                    }}
                  >
                    Cancelar
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Nome da Conta *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Santander EUR, Nubank BRL..."
                      className="form-control"
                      value={accName}
                      onChange={(e) => setAccName(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Tipo de Conta *</label>
                    <select
                      className="form-select"
                      value={accType}
                      onChange={(e) => setAccType(e.target.value as FinancialAccountType)}
                    >
                      {(Object.keys(ACCOUNT_TYPE_LABELS) as FinancialAccountType[]).map((t) => (
                        <option key={t} value={t}>
                          {ACCOUNT_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Moeda *</label>
                    <select
                      className="form-select"
                      value={accCurrency}
                      onChange={(e) => setAccCurrency(e.target.value as Currency)}
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="BRL">BRL (R$)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Saldo Inicial *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="form-control"
                      value={accInitialBalance}
                      onChange={(e) => setAccInitialBalance(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Data de Referência *</label>
                    <input
                      type="date"
                      required
                      className="form-control"
                      value={accInitialDate}
                      onChange={(e) => setAccInitialDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Status</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}>
                      <input
                        type="checkbox"
                        id="accActiveCheck"
                        checked={accActive}
                        onChange={(e) => setAccActive(e.target.checked)}
                      />
                      <label htmlFor="accActiveCheck" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                        Conta Ativa
                      </label>
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Descrição / Detalhes (opcional)</label>
                  <input
                    type="text"
                    placeholder="Agência, conta, titular ou observações..."
                    className="form-control"
                    value={accDesc}
                    onChange={(e) => setAccDesc(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setIsAddingNewAccount(false);
                      setEditingAccountId(null);
                    }}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-primary"
                    disabled={saving || !accName.trim()}
                  >
                    {saving ? 'Salvando...' : editingAccountId ? 'Salvar Alterações' : 'Cadastrar Conta'}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleStartNewAccount}
                  disabled={saving}
                >
                  + Nova Conta
                </button>
              </div>
            )}

            {/* Lista de Contas */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-subtle)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>Nome</th>
                    <th style={{ padding: '0.5rem' }}>Tipo</th>
                    <th style={{ padding: '0.5rem' }}>Moeda</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Saldo Inicial</th>
                    <th style={{ padding: '0.5rem' }}>Data Ref.</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {allAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Nenhuma conta cadastrada. Clique em "+ Nova Conta" para começar.
                      </td>
                    </tr>
                  ) : (
                    allAccounts.map((acc) => (
                      <tr key={acc.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 600 }}>{acc.name}</td>
                        <td style={{ padding: '0.5rem' }}>{ACCOUNT_TYPE_LABELS[acc.type] || acc.type}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <span className="badge badge-neutral">{acc.currency}</span>
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                          {formatMoney(Number(acc.initial_balance || 0), acc.currency)}
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          {acc.initial_balance_date ? new Date(acc.initial_balance_date).toLocaleDateString('pt-PT') : '—'}
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          {acc.active ? (
                            <span className="badge badge-success">Ativa</span>
                          ) : (
                            <span className="badge badge-neutral">Inativa</span>
                          )}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            onClick={() => handleStartEditAccount(acc)}
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsManagingAccounts(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Transferência entre Contas */}
      {isTransferModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg, 8px)',
              padding: '1.5rem',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  Transferir entre Contas
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Movimentação financeira interna entre contas bancárias ou caixas
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setIsTransferModalOpen(false)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitTransfer}>
              {/* Contas elegíveis: ativas e exceto cartão de crédito */}
              {(() => {
                const eligibleAccounts = allAccounts.filter((a) => a.active && a.type !== 'credit_card');
                const sourceAcc = eligibleAccounts.find((a) => a.id === transferSourceId);
                const destAcc = eligibleAccounts.find((a) => a.id === transferDestId);
                const isCrossCurrency = sourceAcc && destAcc && sourceAcc.currency !== destAcc.currency;

                if (eligibleAccounts.length < 2) {
                  return (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      É necessário ter pelo menos 2 contas bancárias ou de caixa ativas cadastradas para realizar transferências.
                      <div style={{ marginTop: '1rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setIsTransferModalOpen(false)}
                        >
                          Fechar
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Linha Conta de Origem */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          Conta de Origem (Débito) *
                        </label>
                        <select
                          className="form-select"
                          required
                          value={transferSourceId}
                          onChange={(e) => {
                            const newSourceId = e.target.value;
                            setTransferSourceId(newSourceId);
                            const newSrc = eligibleAccounts.find((a) => a.id === newSourceId);
                            handleSourceAmountChange(transferAmount, newSrc, destAcc);
                          }}
                        >
                          {eligibleAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id} disabled={acc.id === transferDestId}>
                              {acc.name} ({acc.currency}) - {ACCOUNT_TYPE_LABELS[acc.type] || acc.type}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          Valor de Origem ({sourceAcc?.currency || ''}) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="0.00"
                          className="form-control"
                          value={transferAmount}
                          onChange={(e) => handleSourceAmountChange(e.target.value, sourceAcc, destAcc)}
                        />
                      </div>
                    </div>

                    {/* Linha Conta de Destino */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          Conta de Destino (Crédito) *
                        </label>
                        <select
                          className="form-select"
                          required
                          value={transferDestId}
                          onChange={(e) => {
                            const newDestId = e.target.value;
                            setTransferDestId(newDestId);
                            const newDst = eligibleAccounts.find((a) => a.id === newDestId);
                            handleSourceAmountChange(transferAmount, sourceAcc, newDst);
                          }}
                        >
                          {eligibleAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id} disabled={acc.id === transferSourceId}>
                              {acc.name} ({acc.currency}) - {ACCOUNT_TYPE_LABELS[acc.type] || acc.type}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          Valor de Destino ({destAcc?.currency || ''}) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="0.00"
                          className="form-control"
                          value={sourceAcc?.currency === destAcc?.currency ? transferAmount : transferDestAmount}
                          disabled={sourceAcc?.currency === destAcc?.currency}
                          onChange={(e) => setTransferDestAmount(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Taxa de Câmbio (se moedas diferentes) */}
                    {isCrossCurrency && (
                      <div
                        style={{
                          padding: '0.75rem',
                          background: 'var(--bg-surface-elevated)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                            Taxa de Câmbio (1 {sourceAcc?.currency} = ? {destAcc?.currency}) *
                          </label>
                          <input
                            type="number"
                            step="0.0001"
                            required
                            placeholder="Ex: 6.1500"
                            className="form-control"
                            value={transferExchangeRate}
                            onChange={(e) => handleExchangeRateChange(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {/* Custo de Remessa Opcional */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          Custo de Remessa / Tarifa (opcional)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="form-control"
                          value={transferFee}
                          onChange={(e) => setTransferFee(e.target.value)}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          Moeda da Tarifa
                        </label>
                        <select
                          className="form-select"
                          value={transferFeeCurrency}
                          onChange={(e) => setTransferFeeCurrency(e.target.value as Currency)}
                        >
                          <option value="EUR">EUR (€)</option>
                          <option value="BRL">BRL (R$)</option>
                        </select>
                      </div>
                    </div>

                    {/* Data, Referência e Observação */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          Data da Transferência *
                        </label>
                        <input
                          type="date"
                          required
                          className="form-control"
                          value={transferDate}
                          onChange={(e) => setTransferDate(e.target.value)}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          Referência / Comprovante (opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: TED 987, Câmbio #45..."
                          className="form-control"
                          value={transferReference}
                          onChange={(e) => setTransferReference(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        Observação (opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Motivo da transferência, envio de remessa internacional..."
                        className="form-control"
                        value={transferDescription}
                        onChange={(e) => setTransferDescription(e.target.value)}
                      />
                    </div>

                    {/* Botões de Ação */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setIsTransferModalOpen(false)}
                        disabled={saving}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={
                          saving ||
                          !transferSourceId ||
                          !transferDestId ||
                          transferSourceId === transferDestId ||
                          Number(transferAmount) <= 0 ||
                          (isCrossCurrency && (Number(transferDestAmount) <= 0 || !transferExchangeRate || Number(transferExchangeRate) <= 0))
                        }
                      >
                        {saving ? 'Transferindo...' : 'Confirmar Transferência'}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* Modal de Cancelar Operação */}
      {isCancelOperationModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg, 8px)',
              padding: '1.5rem',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-danger, #ef4444)' }}>
                ✕ Cancelar Operação Financeira
              </h3>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setIsCancelOperationModalOpen(false)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: '0.75rem 0.85rem',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginBottom: '1rem',
              }}
            >
              Ao confirmar o cancelamento da operação:
              <ul style={{ margin: '0.4rem 0 0 1.2rem', padding: 0 }}>
                <li>A operação será alterada para <strong>Cancelada</strong>;</li>
                <li>Serviços ainda não concluídos serão cancelados;</li>
                <li>Parcelas previstas abertas serão canceladas;</li>
                <li><strong>Todos os pagamentos e recebimentos já efetuados serão preservados no histórico.</strong></li>
              </ul>
            </div>

            <form onSubmit={handleCancelOperation}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  Motivo do Cancelamento *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Informe o motivo detalhado do cancelamento da viagem/operação..."
                  className="form-control"
                  value={cancelOperationReason}
                  onChange={(e) => setCancelOperationReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCancelOperationModalOpen(false)}
                  disabled={saving}
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'var(--color-danger, #ef4444)', borderColor: 'var(--color-danger, #ef4444)' }}
                  disabled={saving || !cancelOperationReason.trim()}
                >
                  {saving ? 'Cancelando...' : 'Confirmar Cancelamento da Operação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Cancelar Serviço com Ajustes */}
      {cancelServiceTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg, 8px)',
              padding: '1.5rem',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-danger, #ef4444)' }}>
                  Cancelar Serviço: {cancelServiceTarget.description}
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Este serviço possui pagamentos reais registrados. O histórico será preservado.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setCancelServiceTarget(null)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitCancelServiceWithAdjustments}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  Motivo do Cancelamento *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ex: Cancelamento solicitado pelo passageiro, no-show do fornecedor..."
                  className="form-control"
                  value={cancelServiceReason}
                  onChange={(e) => setCancelServiceReason(e.target.value)}
                />
              </div>

              {/* Ajustes de Cancelamento do Serviço */}
              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Ajustes Financeiros do Cancelamento (opcional):
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>
                  Se deixar em 0, o valor já pago ao fornecedor será considerado custo definitivo, sem previsão de devolução ou multa adicional.
                </p>

                {/* Reembolso do Fornecedor */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      Reembolso Previsto do Fornecedor (Entrada)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      value={cancelServiceRefundAmount}
                      onChange={(e) => setCancelServiceRefundAmount(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      Moeda
                    </label>
                    <select
                      className="form-select"
                      value={cancelServiceRefundCurrency}
                      onChange={(e) => setCancelServiceRefundCurrency(e.target.value as Currency)}
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="BRL">BRL (R$)</option>
                    </select>
                  </div>
                </div>

                {/* Multa de Cancelamento */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      Multa / Taxa de Cancelamento (Saída)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      value={cancelServiceFeeAmount}
                      onChange={(e) => setCancelServiceFeeAmount(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      Moeda da Multa
                    </label>
                    <select
                      className="form-select"
                      value={cancelServiceFeeCurrency}
                      onChange={(e) => setCancelServiceFeeCurrency(e.target.value as Currency)}
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="BRL">BRL (R$)</option>
                    </select>
                  </div>
                </div>

                {Number(cancelServiceFeeAmount) > 0 && (
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      Credor da Multa (Fornecedor / Cia Aérea / Operadora)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={cancelServiceFeeCounterparty}
                      onChange={(e) => setCancelServiceFeeCounterparty(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCancelServiceTarget(null)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'var(--color-danger, #ef4444)', borderColor: 'var(--color-danger, #ef4444)' }}
                  disabled={saving || !cancelServiceReason.trim()}
                >
                  {saving ? 'Cancelando...' : 'Confirmar Cancelamento com Ajustes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Novo Ajuste de Cancelamento */}
      {isAddAdjustmentModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg, 8px)',
              padding: '1.5rem',
              maxWidth: '540px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  Novo Ajuste de Cancelamento
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Registre uma previsão de reembolso a cliente, reembolso de fornecedor ou multa
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setIsAddAdjustmentModalOpen(false)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitCreateAdjustment}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    Tipo de Ajuste *
                  </label>
                  <select
                    className="form-select"
                    value={adjType}
                    onChange={(e) => {
                      const newType = e.target.value as FinancialAdjustmentType;
                      setAdjType(newType);
                      if (newType === 'client_refund') {
                        setAdjCounterparty(quote?.client_name || '');
                      } else {
                        setAdjCounterparty('');
                      }
                    }}
                  >
                    <option value="client_refund">Reembolso ao Cliente (Gera Saída / Pagamento)</option>
                    <option value="supplier_refund">Reembolso do Fornecedor (Gera Entrada / Recebimento)</option>
                    <option value="cancellation_fee">Multa / Custo de Cancelamento (Gera Saída / Pagamento)</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    Contraparte (Cliente ou Fornecedor) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nome da pessoa ou empresa..."
                    className="form-control"
                    value={adjCounterparty}
                    onChange={(e) => setAdjCounterparty(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      Valor Previsto *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      className="form-control"
                      value={adjAmount}
                      onChange={(e) => setAdjAmount(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      Moeda *
                    </label>
                    <select
                      className="form-select"
                      value={adjCurrency}
                      onChange={(e) => setAdjCurrency(e.target.value as Currency)}
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="BRL">BRL (R$)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      Data Prevista (opcional)
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      value={adjExpectedDate}
                      onChange={(e) => setAdjExpectedDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      Serviço Vinculado (opcional)
                    </label>
                    <select
                      className="form-select"
                      value={adjServiceId}
                      onChange={(e) => setAdjServiceId(e.target.value)}
                    >
                      <option value="">Geral / Sem serviço específico</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.description} ({s.status})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    Descrição / Identificação do Ajuste
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Devolução 50% pacote, Retenção taxa administrativa..."
                    className="form-control"
                    value={adjDescription}
                    onChange={(e) => setAdjDescription(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    Observações Internas (opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Detalhes sobre a política de cancelamento, acordo firmado..."
                    className="form-control"
                    value={adjNotes}
                    onChange={(e) => setAdjNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsAddAdjustmentModalOpen(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || !adjCounterparty.trim() || Number(adjAmount) <= 0}
                  >
                    {saving ? 'Salvando...' : 'Salvar Ajuste'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
