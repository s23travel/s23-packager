import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { financialService } from '../../services/financialService';
import { financialAlertsService } from '../../services/financialAlertsService';
import { supabase } from '../../lib/supabase';
import {
  FinancialAccount,
  AccountBalanceSummary,
  ConsolidatedBalancesResult,
  PendingCommitmentItem,
  FinancialTransaction,
  FinancialTransactionType,
  FinancialAccountType,
  Currency,
  ACCOUNT_TYPE_LABELS,
  BalanceAdjustmentDirection,
} from '../../types';
import { WeeklyCashFlowCalendar } from '../../components/finance/WeeklyCashFlowCalendar';
import { FinancialAlertsPanel } from '../../components/finance/FinancialAlertsPanel';

type FinancialTab = 'visao_geral' | 'contas' | 'compromissos' | 'movimentacoes';

const formatMoney = (val: number, curr: Currency) => {
  return new Intl.NumberFormat(curr === 'BRL' ? 'pt-BR' : 'pt-PT', {
    style: 'currency',
    currency: curr,
  }).format(val || 0);
};

const getDueInfo = (expectedDate: string | null, isOverdue: boolean) => {
  if (!expectedDate) {
    return {
      label: 'Sem data',
      badgeClass: 'badge-neutral',
      subtext: 'Data não informada',
      isOverdue: false,
    };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(expectedDate + 'T00:00:00');
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (isOverdue || diffDays < 0) {
    const daysAgo = Math.max(1, Math.abs(diffDays));
    return {
      label: 'Vencido',
      badgeClass: 'badge-danger',
      subtext: daysAgo === 1 ? '1 dia de atraso' : `${daysAgo} dias de atraso`,
      isOverdue: true,
    };
  }
  if (diffDays === 0) {
    return {
      label: 'Vence hoje',
      badgeClass: 'badge-warning',
      subtext: 'Prazo limite hoje',
      isOverdue: false,
    };
  }
  if (diffDays === 1) {
    return {
      label: 'A vencer',
      badgeClass: 'badge-neutral',
      subtext: 'Vence amanhã',
      isOverdue: false,
    };
  }
  return {
    label: 'A vencer',
    badgeClass: 'badge-neutral',
    subtext: `Vence em ${diffDays} dias`,
    isOverdue: false,
  };
};

const getCommitmentStatusBadge = (status: string, type: 'receivable' | 'payable') => {
  if (status === 'partially_settled') {
    return (
      <span className="badge badge-warning" title="Parcela com liquidação parcial registrada">
        {type === 'receivable' ? 'Parcialmente Recebido' : 'Parcialmente Pago'}
      </span>
    );
  }
  if (status === 'settled') {
    return <span className="badge badge-success">Liquidado</span>;
  }
  if (status === 'cancelled') {
    return <span className="badge badge-neutral">Cancelado</span>;
  }
  return <span className="badge badge-neutral">Previsto</span>;
};

export const FinancialPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as FinancialTab | null;
  const validTabs: FinancialTab[] = ['visao_geral', 'contas', 'compromissos', 'movimentacoes'];
  const [activeTab, setActiveTab] = useState<FinancialTab>(
    urlTab && validTabs.includes(urlTab) ? urlTab : 'visao_geral'
  );

  useEffect(() => {
    const t = searchParams.get('tab') as FinancialTab | null;
    if (t && validTabs.includes(t) && t !== activeTab) {
      setActiveTab(t);
    }
  }, [searchParams]);

  const handleTabChange = (tab: FinancialTab) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Dados financeiros globais
  const [consolidated, setConsolidated] = useState<ConsolidatedBalancesResult | null>(null);
  const [accountsSummary, setAccountsSummary] = useState<AccountBalanceSummary[]>([]);
  const [allAccounts, setAllAccounts] = useState<FinancialAccount[]>([]);
  const [commitments, setCommitments] = useState<PendingCommitmentItem[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);

  // Filtros de Compromissos
  const [commitTypeFilter, setCommitTypeFilter] = useState<'ALL' | 'receivable' | 'payable'>('ALL');
  const [commitCurrFilter, setCommitCurrFilter] = useState<'ALL' | Currency>('ALL');
  const [commitStatusFilter, setCommitStatusFilter] = useState<'ALL' | 'overdue' | 'planned'>('ALL');
  const [commitSearch, setCommitSearch] = useState('');

  // Filtros de Movimentações
  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | FinancialTransactionType>('ALL');
  const [txAccountFilter, setTxAccountFilter] = useState<'ALL' | string>('ALL');

  // Estado do Modal de Gestão de Contas
  const [isManagingAccounts, setIsManagingAccounts] = useState(false);
  const [isAddingNewAccount, setIsAddingNewAccount] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<FinancialAccountType>('bank_account');
  const [accCurrency, setAccCurrency] = useState<Currency>('EUR');
  const [accInitialBalance, setAccInitialBalance] = useState('0.00');
  const [accInitialDate, setAccInitialDate] = useState(new Date().toISOString().slice(0, 10));
  const [accDesc, setAccDesc] = useState('');
  const [accActive, setAccActive] = useState(true);

  // Edição inline de nome de conta
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  // Estado do Ajuste de Saldo (Área de Movimentações)
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjAccountId, setAdjAccountId] = useState('');
  const [adjBalanceDirection, setAdjBalanceDirection] = useState<BalanceAdjustmentDirection>('positive');
  const [adjBalanceAmount, setAdjBalanceAmount] = useState('');
  const [adjBalanceReason, setAdjBalanceReason] = useState('');
  const [adjBalanceDate, setAdjBalanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [adjBalanceReference, setAdjBalanceReference] = useState('');

  // Estado do Modal de Transferência
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSourceId, setTransferSourceId] = useState('');
  const [transferDestId, setTransferDestId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDestAmount, setTransferDestAmount] = useState('');
  const [transferExchangeRate, setTransferExchangeRate] = useState('');
  const [transferFee, setTransferFee] = useState('');
  const [transferFeeCurrency, setTransferFeeCurrency] = useState<Currency>('EUR');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [transferDesc, setTransferDesc] = useState('');
  const [transferRef, setTransferRef] = useState('');

  // Estado do Modal de Liquidação Operacional (Compromissos Pendentes)
  const [settlementTarget, setSettlementTarget] = useState<PendingCommitmentItem | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementAccountId, setSettlementAccountId] = useState('');
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().slice(0, 10));
  const [settlementReference, setSettlementReference] = useState('');
  const [settlementDescription, setSettlementDescription] = useState('');
  const [settlementInvoiceDueDate, setSettlementInvoiceDueDate] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [balancesRes, accountsSumRes, allAccsRes, commitmentsRes, txRes] = await Promise.all([
        financialService.getConsolidatedBalances(),
        financialService.getAccountBalances({ activeOnly: false }),
        financialService.listAccounts(false),
        financialService.getPendingCommitments(),
        supabase.from('financial_transactions').select('*').order('transacted_at', { ascending: false }).limit(60),
      ]);
      setConsolidated(balancesRes);
      setAccountsSummary(accountsSumRes);
      setAllAccounts(allAccsRes);
      setCommitments(commitmentsRes);
      setTransactions((txRes.data || []) as FinancialTransaction[]);
    } catch (err: any) {
      console.error('Erro ao carregar dados do ambiente financeiro global:', err);
      setFeedback({ type: 'error', message: err.message || 'Falha ao carregar dados financeiros.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Alertas calculados via motor
  const liveAlerts = useMemo(() => {
    return financialAlertsService.generateFinancialAlerts({
      accounts: accountsSummary,
      commitments,
    });
  }, [accountsSummary, commitments]);

  // Contas administrativas separadas por moeda
  const eurAccountsAdmin = useMemo(() => allAccounts.filter((a) => a.currency === 'EUR'), [allAccounts]);
  const brlAccountsAdmin = useMemo(() => allAccounts.filter((a) => a.currency === 'BRL'), [allAccounts]);

  // Contas elegíveis para transferências (ativas)
  const activeAccounts = useMemo(() => allAccounts.filter((a) => a.active), [allAccounts]);
  const sourceAcc = useMemo(() => activeAccounts.find((a) => a.id === transferSourceId), [activeAccounts, transferSourceId]);
  const destAcc = useMemo(() => activeAccounts.find((a) => a.id === transferDestId), [activeAccounts, transferDestId]);
  const isCrossCurrency = sourceAcc && destAcc && sourceAcc.currency !== destAcc.currency;

  // Filtragem de compromissos
  const filteredCommitments = useMemo(() => {
    return commitments.filter((item) => {
      if (commitTypeFilter !== 'ALL' && item.type !== commitTypeFilter) return false;
      if (commitCurrFilter !== 'ALL' && item.currency !== commitCurrFilter) return false;
      if (commitStatusFilter === 'overdue' && !item.is_overdue) return false;
      if (commitStatusFilter === 'planned' && item.is_overdue) return false;
      if (commitSearch.trim()) {
        const q = commitSearch.toLowerCase();
        const ref = (item.quotation_reference || '').toLowerCase();
        const client = (item.quotation_client_name || '').toLowerCase();
        const party = (item.counterparty_name || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const notes = (item.notes || '').toLowerCase();
        if (!ref.includes(q) && !client.includes(q) && !party.includes(q) && !desc.includes(q) && !notes.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [commitments, commitTypeFilter, commitCurrFilter, commitStatusFilter, commitSearch]);

  // Compromissos filtrados divididos em Recebimentos e Pagamentos
  const filteredReceivables = useMemo(() => {
    return filteredCommitments.filter((item) => item.type === 'receivable');
  }, [filteredCommitments]);

  const filteredPayables = useMemo(() => {
    return filteredCommitments.filter((item) => item.type === 'payable');
  }, [filteredCommitments]);

  // Métricas gerais da central operacional de compromissos pendentes
  const commitmentMetrics = useMemo(() => {
    let totalReceivablesEur = 0;
    let totalReceivablesBrl = 0;
    let totalPayablesEur = 0;
    let totalPayablesBrl = 0;
    let overdueReceivablesEur = 0;
    let overdueReceivablesBrl = 0;
    let overduePayablesEur = 0;
    let overduePayablesBrl = 0;
    let overdueCount = 0;
    let plannedCount = 0;

    for (const c of commitments) {
      const pending = Number(c.pending_amount || 0);
      if (c.type === 'receivable') {
        if (c.currency === 'EUR') {
          totalReceivablesEur += pending;
          if (c.is_overdue) overdueReceivablesEur += pending;
        } else {
          totalReceivablesBrl += pending;
          if (c.is_overdue) overdueReceivablesBrl += pending;
        }
      } else {
        if (c.currency === 'EUR') {
          totalPayablesEur += pending;
          if (c.is_overdue) overduePayablesEur += pending;
        } else {
          totalPayablesBrl += pending;
          if (c.is_overdue) overduePayablesBrl += pending;
        }
      }
      if (c.is_overdue) overdueCount++;
      else plannedCount++;
    }

    return {
      totalReceivablesEur,
      totalReceivablesBrl,
      totalPayablesEur,
      totalPayablesBrl,
      overdueReceivablesEur,
      overdueReceivablesBrl,
      overduePayablesEur,
      overduePayablesBrl,
      overdueCount,
      plannedCount,
    };
  }, [commitments]);

  // Subtotais dos itens filtrados atualmente visíveis
  const filteredReceivableTotals = useMemo(() => {
    const eur = filteredReceivables.filter((c) => c.currency === 'EUR').reduce((sum, c) => sum + Number(c.pending_amount || 0), 0);
    const brl = filteredReceivables.filter((c) => c.currency === 'BRL').reduce((sum, c) => sum + Number(c.pending_amount || 0), 0);
    return { eur, brl };
  }, [filteredReceivables]);

  const filteredPayableTotals = useMemo(() => {
    const eur = filteredPayables.filter((c) => c.currency === 'EUR').reduce((sum, c) => sum + Number(c.pending_amount || 0), 0);
    const brl = filteredPayables.filter((c) => c.currency === 'BRL').reduce((sum, c) => sum + Number(c.pending_amount || 0), 0);
    return { eur, brl };
  }, [filteredPayables]);

  // Filtragem de transações
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (txTypeFilter !== 'ALL' && tx.type !== txTypeFilter) return false;
      if (txAccountFilter !== 'ALL' && tx.account_id !== txAccountFilter && tx.destination_account_id !== txAccountFilter) {
        return false;
      }
      return true;
    });
  }, [transactions, txTypeFilter, txAccountFilter]);

  // Handlers de Gestão de Contas
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
    setAccInitialBalance(String(acc.initial_balance));
    setAccInitialDate(acc.initial_balance_date || new Date().toISOString().slice(0, 10));
    setAccDesc(acc.description || '');
    setAccActive(acc.active);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;
    try {
      setSaving(true);
      if (editingAccountId) {
        await financialService.updateAccount(editingAccountId, {
          name: accName.trim(),
          type: accType,
          description: accDesc.trim() || null,
          active: accActive,
        });
        setFeedback({ type: 'success', message: 'Conta financeira atualizada com sucesso.' });
      } else {
        await financialService.createAccount({
          name: accName.trim(),
          type: accType,
          currency: accCurrency,
          initial_balance: Number(accInitialBalance) || 0,
          initial_balance_date: accInitialDate || new Date().toISOString().slice(0, 10),
          description: accDesc.trim() || undefined,
          active: accActive,
        });
        setFeedback({ type: 'success', message: 'Nova conta cadastrada com sucesso.' });
      }
      setIsAddingNewAccount(false);
      setEditingAccountId(null);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao salvar conta: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditName = (acc: FinancialAccount) => {
    setEditingNameId(acc.id);
    setEditingNameValue(acc.name);
  };

  const handleSaveAccountName = async (accId: string) => {
    if (!editingNameValue.trim()) {
      setEditingNameId(null);
      return;
    }
    try {
      setSaving(true);
      await financialService.updateAccountName(accId, editingNameValue.trim());
      setFeedback({ type: 'success', message: 'Nome da conta atualizado com sucesso.' });
      setEditingNameId(null);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao renomear conta: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAccountActive = async (acc: FinancialAccount) => {
    try {
      setSaving(true);
      const nextActive = !acc.active;
      await financialService.toggleAccountActive(acc.id, nextActive);
      setFeedback({
        type: 'success',
        message: `Conta "${acc.name}" ${nextActive ? 'reativada' : 'desativada'} com sucesso.`,
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao atualizar status da conta: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // Handlers de Ajuste de Saldo (Área de Movimentações)
  const handleOpenNewAdjustment = (targetAccountId?: string) => {
    const chosenId = targetAccountId || (activeAccounts.length > 0 ? activeAccounts[0].id : '');
    setAdjAccountId(chosenId);
    setAdjBalanceDirection('positive');
    setAdjBalanceAmount('');
    setAdjBalanceReason('');
    setAdjBalanceDate(new Date().toISOString().slice(0, 10));
    setAdjBalanceReference('');
    setIsAdjustmentModalOpen(true);
  };

  const handleSaveBalanceAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAccount = allAccounts.find((a) => a.id === adjAccountId);
    if (!targetAccount) {
      setFeedback({ type: 'error', message: 'Selecione uma conta ativa para o ajuste.' });
      return;
    }
    if (!targetAccount.active) {
      setFeedback({ type: 'error', message: 'Ajuste de saldo não permitido em conta desativada.' });
      return;
    }
    const amount = Number(adjBalanceAmount);
    if (!amount || amount <= 0) {
      setFeedback({ type: 'error', message: 'O valor do ajuste deve ser maior que zero.' });
      return;
    }
    if (!adjBalanceReason.trim()) {
      setFeedback({ type: 'error', message: 'O motivo do ajuste é obrigatório.' });
      return;
    }
    try {
      setSaving(true);
      await financialService.recordBalanceAdjustment({
        account_id: targetAccount.id,
        amount,
        direction: adjBalanceDirection,
        reason: adjBalanceReason.trim(),
        adjusted_at: adjBalanceDate ? new Date(adjBalanceDate + 'T12:00:00').toISOString() : new Date().toISOString(),
        reference: adjBalanceReference.trim() || undefined,
      });
      setIsAdjustmentModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Transação de ajuste de ${adjBalanceDirection === 'positive' ? '+' : '−'}${formatMoney(amount, targetAccount.currency)} registrada com sucesso em "${targetAccount.name}".`,
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao registrar ajuste: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // Handlers de Transferência
  const handleOpenTransferModal = () => {
    if (activeAccounts.length < 2) {
      setFeedback({ type: 'error', message: 'São necessárias pelo menos duas contas ativas para transferir.' });
      return;
    }
    const src = activeAccounts[0];
    const dst = activeAccounts[1] || activeAccounts[0];
    setTransferSourceId(src.id);
    setTransferDestId(dst.id);
    setTransferAmount('');
    setTransferDestAmount('');
    setTransferExchangeRate('');
    setTransferFee('');
    setTransferFeeCurrency(src.currency);
    setTransferDate(new Date().toISOString().slice(0, 10));
    setTransferDesc('');
    setTransferRef('');
    setIsTransferModalOpen(true);
  };

  const handleSourceAmountChange = (val: string, sAcc?: FinancialAccount, dAcc?: FinancialAccount) => {
    setTransferAmount(val);
    const num = Number(val);
    if (!num || isNaN(num) || !sAcc || !dAcc) return;
    if (sAcc.currency === dAcc.currency) {
      setTransferDestAmount(val);
    } else {
      const rate = Number(transferExchangeRate);
      if (rate > 0) {
        setTransferDestAmount((num * rate).toFixed(2));
      }
    }
  };

  const handleExchangeRateChange = (rateStr: string) => {
    setTransferExchangeRate(rateStr);
    const rate = Number(rateStr);
    const amt = Number(transferAmount);
    if (rate > 0 && amt > 0) {
      setTransferDestAmount((amt * rate).toFixed(2));
    }
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceAcc || !destAcc || sourceAcc.id === destAcc.id) {
      setFeedback({ type: 'error', message: 'Contas de origem e destino devem ser diferentes.' });
      return;
    }
    const amt = Number(transferAmount);
    if (!amt || amt <= 0) {
      setFeedback({ type: 'error', message: 'O valor da transferência deve ser maior que zero.' });
      return;
    }
    let destAmt = amt;
    let rate: number | null = null;
    if (isCrossCurrency) {
      destAmt = Number(transferDestAmount);
      rate = Number(transferExchangeRate);
      if (!destAmt || destAmt <= 0 || !rate || rate <= 0) {
        setFeedback({ type: 'error', message: 'Taxa de câmbio e valor de destino são obrigatórios para moedas diferentes.' });
        return;
      }
    }
    const fee = transferFee ? Number(transferFee) : 0;
    try {
      setSaving(true);
      await financialService.recordAccountTransfer({
        source_account_id: sourceAcc.id,
        destination_account_id: destAcc.id,
        amount: amt,
        destination_amount: destAmt,
        exchange_rate: isCrossCurrency && rate ? rate : undefined,
        transfer_fee: fee,
        transfer_fee_currency: fee > 0 ? transferFeeCurrency : undefined,
        transacted_at: transferDate ? new Date(transferDate + 'T12:00:00').toISOString() : new Date().toISOString(),
        description: transferDesc.trim() || undefined,
        reference: transferRef.trim() || undefined,
      });
      setIsTransferModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Transferência de ${formatMoney(amt, sourceAcc.currency)} para ${destAcc.name} realizada com sucesso.`,
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao realizar transferência: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // Handlers de Liquidação Operacional de Compromissos (Recebimentos e Pagamentos)
  const handleOpenSettlement = (c: PendingCommitmentItem) => {
    const isCreditCardBlocked = c.type === 'receivable' || Boolean(c.is_credit_card_invoice);
    const matchingAccounts = allAccounts.filter(
      (a) => a.currency === c.currency && a.active && (!isCreditCardBlocked || a.type !== 'credit_card')
    );
    // Prioriza conta esperada se existir e for compatível
    const defaultAcc = matchingAccounts.find((a) => a.id === c.expected_account_id) || matchingAccounts[0];

    setSettlementTarget(c);
    setSettlementAccountId(defaultAcc?.id || '');
    setSettlementAmount(c.pending_amount.toFixed(2));
    setSettlementDate(new Date().toISOString().slice(0, 10));
    setSettlementReference('');
    setSettlementDescription('');

    // Sugere vencimento da fatura do cartão daqui a 30 dias se for pagamento com cartão
    const invoiceDate = new Date();
    invoiceDate.setDate(invoiceDate.getDate() + 30);
    setSettlementInvoiceDueDate(invoiceDate.toISOString().slice(0, 10));
  };

  const handleSubmitSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementTarget) return;

    const amountNum = Number(settlementAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFeedback({ type: 'error', message: 'O valor da liquidação deve ser maior que zero.' });
      return;
    }

    if (amountNum > settlementTarget.pending_amount + 0.001) {
      setFeedback({
        type: 'error',
        message: `O valor informado (${formatMoney(amountNum, settlementTarget.currency)}) excede o saldo pendente deste compromisso (${formatMoney(settlementTarget.pending_amount, settlementTarget.currency)}).`,
      });
      return;
    }

    if (!settlementAccountId) {
      setFeedback({ type: 'error', message: 'Selecione a conta financeira utilizada para a liquidação.' });
      return;
    }

    const selectedAcc = allAccounts.find((a) => a.id === settlementAccountId);
    if (!selectedAcc || selectedAcc.currency !== settlementTarget.currency) {
      setFeedback({
        type: 'error',
        message: `A moeda da conta selecionada deve ser idêntica à do compromisso (${settlementTarget.currency}).`,
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
        transacted_at: settlementDate ? new Date(settlementDate + 'T12:00:00').toISOString() : new Date().toISOString(),
        reference: settlementReference.trim() || undefined,
        description: settlementDescription.trim() || undefined,
        invoice_due_date: selectedAcc.type === 'credit_card' ? settlementInvoiceDueDate : undefined,
      });

      await loadData();
      setSettlementTarget(null);

      const actionName = settlementTarget.type === 'receivable' ? 'Recebimento' : 'Pagamento';
      const isFull = res.commitment_status === 'settled';
      const invoiceNotice = res.invoice_commitment_id
        ? ' A fatura correspondente do cartão foi programada e adicionada aos compromissos futuros.'
        : '';
      const residualNotice = !isFull
        ? ` Saldo residual restante: ${formatMoney(res.pending_balance, res.currency)} (permanece pendente).`
        : ' Compromisso 100% quitado e baixado da lista de pendências.';

      setFeedback({
        type: 'success',
        message: `${actionName} de ${formatMoney(res.amount, res.currency)} liquidado com sucesso.${residualNotice}${invoiceNotice}`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao registrar liquidação: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="financial-page" style={{ paddingBottom: '3rem' }}>
      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`alert ${feedback.type === 'error' ? 'alert-danger' : 'alert-success'}`}
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            boxShadow: 'var(--shadow-lg)',
            maxWidth: '480px',
          }}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            className="btn btn-sm"
            style={{ padding: '0.1rem 0.4rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
            onClick={() => setFeedback(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Hero Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Ambiente Financeiro Global</h1>
          <p className="page-subtitle">
            Posição consolidada de tesouraria, administração cadastral de contas, compromissos operacionais e extrato contábil.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleOpenTransferModal}
            disabled={loading || saving}
            title="Transferir recursos entre contas gerando lançamentos históricos"
          >
            ⇄ Transferir entre contas
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenAccountModal}
            disabled={loading || saving}
            title="Cadastrar nova conta ou gerenciar dados cadastrais"
          >
            🏦 Administrar Contas ({allAccounts.length})
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadData}
            disabled={loading || saving}
            title="Recarregar dados financeiros"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => handleTabChange('visao_geral')}
          className={`btn ${activeTab === 'visao_geral' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', borderBottom: 'none' }}
        >
          📊 Visão Geral
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('contas')}
          className={`btn ${activeTab === 'contas' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', borderBottom: 'none' }}
        >
          🏦 Contas ({allAccounts.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('compromissos')}
          className={`btn ${activeTab === 'compromissos' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', borderBottom: 'none' }}
        >
          📑 Recebimentos &amp; Pagamentos ({commitments.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('movimentacoes')}
          className={`btn ${activeTab === 'movimentacoes' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', borderBottom: 'none' }}
        >
          📈 Movimentações &amp; Ajustes ({transactions.length})
        </button>
      </div>

      {/* ============================================================ */}
      {/* ABA 1: VISÃO GERAL                                            */}
      {/* ============================================================ */}
      {activeTab === 'visao_geral' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header da Aba Visão Geral */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                Visão Geral do Caixa &amp; Alertas Operacionais
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Posição financeira consolidada em tempo real por moeda, projeções de curto prazo e alertas de tesouraria.
              </p>
            </div>
          </div>

          {/* Bento KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* Bloco EUR */}
            <div className="card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Portugal (EUR)
                </span>
                <span className="badge badge-neutral">EUR</span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                {loading ? '—' : formatMoney(consolidated?.EUR?.current_balance || 0, 'EUR')}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Disponível em caixa bancário
              </div>
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>A Receber</span>
                  <strong style={{ color: 'var(--success)' }}>+{formatMoney(consolidated?.EUR?.total_pending_receivables || 0, 'EUR')}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>A Pagar</span>
                  <strong style={{ color: 'var(--danger)' }}>-{formatMoney(consolidated?.EUR?.total_pending_payables || 0, 'EUR')}</strong>
                </div>
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Saldo Projetado: </span>
                <strong style={{ color: (consolidated?.EUR?.projected_balance || 0) >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
                  {formatMoney(consolidated?.EUR?.projected_balance || 0, 'EUR')}
                </strong>
              </div>
            </div>

            {/* Bloco BRL */}
            <div className="card" style={{ borderLeft: '4px solid var(--color-success, #10b981)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Brasil (BRL)
                </span>
                <span className="badge badge-neutral">BRL</span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                {loading ? '—' : formatMoney(consolidated?.BRL?.current_balance || 0, 'BRL')}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Disponível em caixa bancário
              </div>
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>A Receber</span>
                  <strong style={{ color: 'var(--success)' }}>+{formatMoney(consolidated?.BRL?.total_pending_receivables || 0, 'BRL')}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>A Pagar</span>
                  <strong style={{ color: 'var(--danger)' }}>-{formatMoney(consolidated?.BRL?.total_pending_payables || 0, 'BRL')}</strong>
                </div>
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Saldo Projetado: </span>
                <strong style={{ color: (consolidated?.BRL?.projected_balance || 0) >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
                  {formatMoney(consolidated?.BRL?.projected_balance || 0, 'BRL')}
                </strong>
              </div>
            </div>

            {/* Bloco Cartões de Crédito */}
            <div className="card" style={{ borderLeft: '4px solid var(--color-warning, #f59e0b)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Cartões de Crédito
                </span>
                <span className="badge badge-warning">Faturas / Limite</span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                {loading ? '—' : formatMoney(consolidated?.EUR?.credit_card_balance || 0, 'EUR')}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Uso em cartões corporativos (EUR)
              </div>
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Faturas liquidadas via débito na conta bancária correspondente.
              </div>
            </div>
          </div>

          {/* Painel de Alertas */}
          <FinancialAlertsPanel alerts={liveAlerts} loading={loading} />

          {/* Calendário Semanal */}
          <WeeklyCashFlowCalendar />
        </div>
      )}

      {/* ============================================================ */}
      {/* ABA 2: CADASTRO E CONFIGURAÇÃO DE CONTAS                     */}
      {/* ============================================================ */}
      {activeTab === 'contas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header da Aba */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                Contas — Cadastro, Status e Dados de Abertura
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Administração cadastral de contas bancárias, caixas e cartões da agência. Esta área não realiza lançamentos contábeis.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleStartNewAccount}
            >
              + Nova Conta
            </button>
          </div>

          {/* Banner Explicativo da Camada Administrativa */}
          <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--bg-surface-elevated)', borderLeft: '4px solid var(--accent-primary)', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ flex: '1 1 520px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  🏛️ Painel Administrativo de Cadastro &amp; Saldos de Abertura
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  Esta tela destina-se <strong>exclusivamente ao cadastro de contas, edição de nomes, ativação/desativação e fixação dos dados de abertura</strong> (saldo inicial e data de referência). Ela <strong>não processa lançamentos nem registra movimentações</strong>. Para transferências entre contas ou conciliações com lançamento histórico de ajuste, utilize a aba <strong>Movimentações &amp; Ajustes</strong>.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                onClick={() => setActiveTab('movimentacoes')}
              >
                Ir para Movimentações &amp; Ajustes →
              </button>
            </div>
          </div>

          {/* Tabela Portugal (EUR) */}
          <div className="card">
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🇵🇹 Contas em Portugal (EUR)
              <span className="badge badge-neutral">{eurAccountsAdmin.length}</span>
            </h4>
            <div className="table-responsive">
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Nome da Conta</th>
                    <th>Tipo</th>
                    <th>Moeda</th>
                    <th style={{ textAlign: 'right' }}>Saldo de Abertura</th>
                    <th>Data de Abertura</th>
                    <th>Status Cadastral</th>
                    <th style={{ textAlign: 'center' }}>Ações Cadastrais</th>
                  </tr>
                </thead>
                <tbody>
                  {eurAccountsAdmin.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                        Nenhuma conta em EUR cadastrada.
                      </td>
                    </tr>
                  ) : (
                    eurAccountsAdmin.map((acc) => (
                      <tr key={acc.id} style={{ opacity: acc.active ? 1 : 0.6 }}>
                        <td style={{ fontWeight: 600 }}>
                          {editingNameId === acc.id ? (
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <input
                                type="text"
                                className="form-control"
                                style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem', height: '28px', maxWidth: '220px' }}
                                value={editingNameValue}
                                onChange={(e) => setEditingNameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveAccountName(acc.id);
                                  if (e.key === 'Escape') setEditingNameId(null);
                                }}
                                autoFocus
                              />
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
                                onClick={() => handleSaveAccountName(acc.id)}
                                disabled={saving}
                              >✓</button>
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
                                onClick={() => setEditingNameId(null)}
                              >✕</button>
                            </div>
                          ) : (
                            <span
                              title="Clique para renomear"
                              style={{ cursor: 'pointer', borderBottom: '1px dashed var(--border-subtle)' }}
                              onClick={() => handleStartEditName(acc)}
                            >
                              {acc.name}
                            </span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {ACCOUNT_TYPE_LABELS[acc.type] || acc.type}
                        </td>
                        <td>
                          <span className="badge badge-neutral">{acc.currency}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatMoney(Number(acc.initial_balance || 0), acc.currency)}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {acc.initial_balance_date ? new Date(acc.initial_balance_date).toLocaleDateString('pt-PT') : '—'}
                        </td>
                        <td>
                          {acc.active ? (
                            <span className="badge badge-success">Ativa</span>
                          ) : (
                            <span className="badge badge-neutral">Inativa</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                              onClick={() => handleStartEditName(acc)}
                              disabled={saving}
                              title="Renomear conta"
                            >
                              Editar nome
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${acc.active ? 'btn-danger' : 'btn-secondary'}`}
                              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                              onClick={() => handleToggleAccountActive(acc)}
                              disabled={saving}
                              title={acc.active ? 'Desativar conta' : 'Reativar conta'}
                            >
                              {acc.active ? 'Desativar' : 'Ativar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabela Brasil (BRL) */}
          <div className="card">
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🇧🇷 Contas no Brasil (BRL)
              <span className="badge badge-neutral">{brlAccountsAdmin.length}</span>
            </h4>
            <div className="table-responsive">
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Nome da Conta</th>
                    <th>Tipo</th>
                    <th>Moeda</th>
                    <th style={{ textAlign: 'right' }}>Saldo de Abertura</th>
                    <th>Data de Abertura</th>
                    <th>Status Cadastral</th>
                    <th style={{ textAlign: 'center' }}>Ações Cadastrais</th>
                  </tr>
                </thead>
                <tbody>
                  {brlAccountsAdmin.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                        Nenhuma conta em BRL cadastrada.
                      </td>
                    </tr>
                  ) : (
                    brlAccountsAdmin.map((acc) => (
                      <tr key={acc.id} style={{ opacity: acc.active ? 1 : 0.6 }}>
                        <td style={{ fontWeight: 600 }}>
                          {editingNameId === acc.id ? (
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <input
                                type="text"
                                className="form-control"
                                style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem', height: '28px', maxWidth: '220px' }}
                                value={editingNameValue}
                                onChange={(e) => setEditingNameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveAccountName(acc.id);
                                  if (e.key === 'Escape') setEditingNameId(null);
                                }}
                                autoFocus
                              />
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
                                onClick={() => handleSaveAccountName(acc.id)}
                                disabled={saving}
                              >✓</button>
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
                                onClick={() => setEditingNameId(null)}
                              >✕</button>
                            </div>
                          ) : (
                            <span
                              title="Clique para renomear"
                              style={{ cursor: 'pointer', borderBottom: '1px dashed var(--border-subtle)' }}
                              onClick={() => handleStartEditName(acc)}
                            >
                              {acc.name}
                            </span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {ACCOUNT_TYPE_LABELS[acc.type] || acc.type}
                        </td>
                        <td>
                          <span className="badge badge-neutral">{acc.currency}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatMoney(Number(acc.initial_balance || 0), acc.currency)}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {acc.initial_balance_date ? new Date(acc.initial_balance_date).toLocaleDateString('pt-PT') : '—'}
                        </td>
                        <td>
                          {acc.active ? (
                            <span className="badge badge-success">Ativa</span>
                          ) : (
                            <span className="badge badge-neutral">Inativa</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                              onClick={() => handleStartEditName(acc)}
                              disabled={saving}
                              title="Renomear conta"
                            >
                              Editar nome
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${acc.active ? 'btn-danger' : 'btn-secondary'}`}
                              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                              onClick={() => handleToggleAccountActive(acc)}
                              disabled={saving}
                              title={acc.active ? 'Desativar conta' : 'Reativar conta'}
                            >
                              {acc.active ? 'Desativar' : 'Ativar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Nota de rodapé da camada administrativa */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.45,
            }}
          >
            ℹ️ <strong>Entendimento Contábil:</strong> O <em>Saldo de Abertura</em> representa o saldo inicial informado no momento do cadastro ou abertura da conta. Ele é uma referência estática e <strong>não é alterado</strong> por transferências, pagamentos, recebimentos ou ajustes. O saldo disponível e consolidado em tempo real é apurado na aba <strong>Visão Geral</strong>, e qualquer conciliação deve ser lançada na aba <strong>Movimentações &amp; Ajustes</strong>.
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ABA 3: RECEBIMENTOS & PAGAMENTOS                              */}
      {/* ============================================================ */}
      {activeTab === 'compromissos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header da Aba */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Central Operacional de Recebimentos &amp; Pagamentos
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Gestão e acompanhamento operacional de compromissos pendentes: recebimentos de clientes e pagamentos a fornecedores.
              </p>
            </div>
          </div>

          {/* Cards de Resumo Operacional (Bento) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {/* Recebíveis EUR */}
            <div className="card" style={{ borderLeft: '4px solid var(--success)', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Recebíveis Portugal (EUR)
                </span>
                <span className="badge badge-neutral">EUR</span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--success)' }}>
                +{formatMoney(commitmentMetrics.totalReceivablesEur, 'EUR')}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {commitmentMetrics.overdueReceivablesEur > 0 ? (
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                    🚨 {formatMoney(commitmentMetrics.overdueReceivablesEur, 'EUR')} em atraso
                  </span>
                ) : (
                  <span>Nenhum recebível EUR em atraso</span>
                )}
              </div>
            </div>

            {/* Recebíveis BRL */}
            <div className="card" style={{ borderLeft: '4px solid var(--success)', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Recebíveis Brasil (BRL)
                </span>
                <span className="badge badge-neutral">BRL</span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--success)' }}>
                +{formatMoney(commitmentMetrics.totalReceivablesBrl, 'BRL')}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {commitmentMetrics.overdueReceivablesBrl > 0 ? (
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                    🚨 {formatMoney(commitmentMetrics.overdueReceivablesBrl, 'BRL')} em atraso
                  </span>
                ) : (
                  <span>Nenhum recebível BRL em atraso</span>
                )}
              </div>
            </div>

            {/* Pagáveis EUR */}
            <div className="card" style={{ borderLeft: '4px solid var(--danger)', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Pagáveis Portugal (EUR)
                </span>
                <span className="badge badge-neutral">EUR</span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--danger)' }}>
                -{formatMoney(commitmentMetrics.totalPayablesEur, 'EUR')}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {commitmentMetrics.overduePayablesEur > 0 ? (
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                    🚨 {formatMoney(commitmentMetrics.overduePayablesEur, 'EUR')} em atraso
                  </span>
                ) : (
                  <span>Nenhum pagamento EUR em atraso</span>
                )}
              </div>
            </div>

            {/* Pagáveis BRL */}
            <div className="card" style={{ borderLeft: '4px solid var(--danger)', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Pagáveis Brasil (BRL)
                </span>
                <span className="badge badge-neutral">BRL</span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--danger)' }}>
                -{formatMoney(commitmentMetrics.totalPayablesBrl, 'BRL')}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {commitmentMetrics.overduePayablesBrl > 0 ? (
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                    🚨 {formatMoney(commitmentMetrics.overduePayablesBrl, 'BRL')} em atraso
                  </span>
                ) : (
                  <span>Nenhum pagamento BRL em atraso</span>
                )}
              </div>
            </div>
          </div>

          {/* Barra de Filtros */}
          <div className="card" style={{ padding: '0.85rem 1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                className="form-control"
                style={{ flex: '1 1 260px', minWidth: '260px', fontSize: '0.85rem' }}
                placeholder="Buscar cotação, cliente, fornecedor, descrição..."
                value={commitSearch}
                onChange={(e) => setCommitSearch(e.target.value)}
              />

              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '0.85rem' }}
                value={commitTypeFilter}
                onChange={(e) => setCommitTypeFilter(e.target.value as any)}
              >
                <option value="ALL">Todos os Tipos</option>
                <option value="receivable">📥 Apenas Recebimentos (Clientes)</option>
                <option value="payable">📤 Apenas Pagamentos (Fornecedores)</option>
              </select>

              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '0.85rem' }}
                value={commitCurrFilter}
                onChange={(e) => setCommitCurrFilter(e.target.value as any)}
              >
                <option value="ALL">Todas as Moedas</option>
                <option value="EUR">🇵🇹 EUR (€)</option>
                <option value="BRL">🇧🇷 BRL (R$)</option>
              </select>

              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '0.85rem' }}
                value={commitStatusFilter}
                onChange={(e) => setCommitStatusFilter(e.target.value as any)}
              >
                <option value="ALL">Todos os Prazos</option>
                <option value="overdue">🚨 Apenas Vencidos</option>
                <option value="planned">📅 A Vencer / Em dia</option>
              </select>

              {(commitSearch || commitTypeFilter !== 'ALL' || commitCurrFilter !== 'ALL' || commitStatusFilter !== 'ALL') && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: '0.8rem' }}
                  onClick={() => {
                    setCommitSearch('');
                    setCommitTypeFilter('ALL');
                    setCommitCurrFilter('ALL');
                    setCommitStatusFilter('ALL');
                  }}
                  title="Limpar todos os filtros"
                >
                  Limpar Filtros
                </button>
              )}

              <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {filteredCommitments.length} compromisso(s) filtrado(s)
                {commitTypeFilter === 'ALL' && (
                  <> ({filteredReceivables.length} recebimento(s), {filteredPayables.length} pagamento(s))</>
                )}
              </span>
            </div>
          </div>

          {/* SEÇÃO 1: RECEBIMENTOS DE CLIENTES */}
          {(commitTypeFilter === 'ALL' || commitTypeFilter === 'receivable') && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📥</span> Recebimentos de Clientes
                    <span className="badge badge-success">{filteredReceivables.length}</span>
                  </h4>
                  <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Compromissos pendentes a receber decorrentes de cotações aprovadas e vendas de viagens.
                  </p>
                </div>
                <div style={{ fontSize: '0.82rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Saldo Filtrado a Receber:</span>
                  {filteredReceivableTotals.eur > 0 && (
                    <strong style={{ color: 'var(--success)' }}>+{formatMoney(filteredReceivableTotals.eur, 'EUR')}</strong>
                  )}
                  {filteredReceivableTotals.brl > 0 && (
                    <strong style={{ color: 'var(--success)' }}>+{formatMoney(filteredReceivableTotals.brl, 'BRL')}</strong>
                  )}
                  {filteredReceivableTotals.eur === 0 && filteredReceivableTotals.brl === 0 && (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Cotação Vinculada</th>
                      <th>Cliente / Descrição</th>
                      <th>Moeda</th>
                      <th style={{ textAlign: 'right' }}>Valor Total</th>
                      <th style={{ textAlign: 'right' }}>Saldo a Receber</th>
                      <th>Data Prevista</th>
                      <th>Situação / Prazo</th>
                      <th>Status</th>
                      <th>Conta Esperada</th>
                      <th style={{ textAlign: 'center' }}>Origem</th>
                      <th style={{ textAlign: 'center' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReceivables.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                          Nenhum recebimento de cliente encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredReceivables.map((c) => {
                        const dueInfo = getDueInfo(c.expected_date, c.is_overdue);
                        return (
                          <tr key={c.id}>
                            <td>
                              {c.quotation_id ? (
                                <Link
                                  to={`/cotacoes/${c.quotation_id}/financeiro`}
                                  style={{ fontWeight: 700, color: 'var(--accent-primary)', textDecoration: 'none' }}
                                  title="Ver ambiente financeiro da cotação"
                                >
                                  {c.quotation_reference || 'Cotação'}
                                </Link>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Avulso</span>
                              )}
                              {c.quotation_client_name && (
                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {c.quotation_client_name}
                                </span>
                              )}
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{c.counterparty_name || 'Cliente'}</div>
                              {c.description && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.description}</div>
                              )}
                              {c.notes && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                  Obs: {c.notes}
                                </div>
                              )}
                            </td>
                            <td>
                              <span className="badge badge-neutral">{c.currency}</span>
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                              {formatMoney(c.amount, c.currency as Currency)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                              +{formatMoney(c.pending_amount, c.currency as Currency)}
                              {c.already_paid > 0 && (
                                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                  Recebido: {formatMoney(c.already_paid, c.currency as Currency)}
                                </span>
                              )}
                            </td>
                            <td>
                              {c.expected_date ? (
                                <span>{new Date(c.expected_date).toLocaleDateString('pt-PT')}</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${dueInfo.badgeClass}`}>
                                {dueInfo.label}
                              </span>
                              {dueInfo.subtext && (
                                <span style={{ display: 'block', fontSize: '0.72rem', color: dueInfo.isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                                  {dueInfo.subtext}
                                </span>
                              )}
                            </td>
                            <td>
                              {getCommitmentStatusBadge(c.status, 'receivable')}
                            </td>
                            <td>
                              {c.expected_account_name ? (
                                <span className="badge badge-neutral">{c.expected_account_name}</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Indefinida</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {c.quotation_id ? (
                                <Link
                                  to={`/cotacoes/${c.quotation_id}/financeiro`}
                                  className="btn btn-sm btn-secondary"
                                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap' }}
                                  title="Abrir ambiente financeiro desta cotação"
                                >
                                  Ver Cotação →
                                </Link>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', whiteSpace: 'nowrap' }}
                                onClick={() => handleOpenSettlement(c)}
                                disabled={saving}
                                title="Registrar recebimento real (parcial ou total)"
                              >
                                ✓ Liquidar
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SEÇÃO 2: PAGAMENTOS A FORNECEDORES */}
          {(commitTypeFilter === 'ALL' || commitTypeFilter === 'payable') && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📤</span> Pagamentos a Fornecedores
                    <span className="badge badge-danger">{filteredPayables.length}</span>
                  </h4>
                  <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Compromissos pendentes a pagar a companhias aéreas, operadoras, hotéis e fornecedores de serviços.
                  </p>
                </div>
                <div style={{ fontSize: '0.82rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Saldo Filtrado a Pagar:</span>
                  {filteredPayableTotals.eur > 0 && (
                    <strong style={{ color: 'var(--danger)' }}>-{formatMoney(filteredPayableTotals.eur, 'EUR')}</strong>
                  )}
                  {filteredPayableTotals.brl > 0 && (
                    <strong style={{ color: 'var(--danger)' }}>-{formatMoney(filteredPayableTotals.brl, 'BRL')}</strong>
                  )}
                  {filteredPayableTotals.eur === 0 && filteredPayableTotals.brl === 0 && (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Cotação Vinculada</th>
                      <th>Fornecedor / Descrição</th>
                      <th>Moeda</th>
                      <th style={{ textAlign: 'right' }}>Valor Total</th>
                      <th style={{ textAlign: 'right' }}>Saldo a Pagar</th>
                      <th>Data Prevista</th>
                      <th>Situação / Prazo</th>
                      <th>Status</th>
                      <th>Conta / Cartão Previsto</th>
                      <th style={{ textAlign: 'center' }}>Origem</th>
                      <th style={{ textAlign: 'center' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayables.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                          Nenhum pagamento a fornecedor encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredPayables.map((c) => {
                        const dueInfo = getDueInfo(c.expected_date, c.is_overdue);
                        return (
                          <tr key={c.id}>
                            <td>
                              {c.quotation_id ? (
                                <Link
                                  to={`/cotacoes/${c.quotation_id}/financeiro`}
                                  style={{ fontWeight: 700, color: 'var(--accent-primary)', textDecoration: 'none' }}
                                  title="Ver ambiente financeiro da cotação"
                                >
                                  {c.quotation_reference || 'Cotação'}
                                </Link>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Avulso</span>
                              )}
                              {c.quotation_client_name && (
                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {c.quotation_client_name}
                                </span>
                              )}
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <span>{c.counterparty_name || 'Fornecedor'}</span>
                                {c.is_credit_card_invoice && (
                                  <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>Cartão de Crédito</span>
                                )}
                                {c.is_cancellation_adjustment && (
                                  <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>Ajuste Cancelamento</span>
                                )}
                              </div>
                              {c.description && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.description}</div>
                              )}
                              {c.notes && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                  Obs: {c.notes}
                                </div>
                              )}
                            </td>
                            <td>
                              <span className="badge badge-neutral">{c.currency}</span>
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                              {formatMoney(c.amount, c.currency as Currency)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                              -{formatMoney(c.pending_amount, c.currency as Currency)}
                              {c.already_paid > 0 && (
                                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                  Pago: {formatMoney(c.already_paid, c.currency as Currency)}
                                </span>
                              )}
                            </td>
                            <td>
                              {c.expected_date ? (
                                <span>{new Date(c.expected_date).toLocaleDateString('pt-PT')}</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${dueInfo.badgeClass}`}>
                                {dueInfo.label}
                              </span>
                              {dueInfo.subtext && (
                                <span style={{ display: 'block', fontSize: '0.72rem', color: dueInfo.isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                                  {dueInfo.subtext}
                                </span>
                              )}
                            </td>
                            <td>
                              {getCommitmentStatusBadge(c.status, 'payable')}
                            </td>
                            <td>
                              {c.expected_account_name ? (
                                <span className="badge badge-neutral">{c.expected_account_name}</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Indefinida</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {c.quotation_id ? (
                                <Link
                                  to={`/cotacoes/${c.quotation_id}/financeiro`}
                                  className="btn btn-sm btn-secondary"
                                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap' }}
                                  title="Abrir ambiente financeiro desta cotação"
                                >
                                  Ver Cotação →
                                </Link>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', whiteSpace: 'nowrap' }}
                                onClick={() => handleOpenSettlement(c)}
                                disabled={saving}
                                title={c.is_credit_card_invoice ? 'Registrar pagamento de fatura do cartão' : 'Registrar pagamento real (parcial ou total)'}
                              >
                                ✓ Liquidar
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* ABA 4: MOVIMENTAÇÕES & AJUSTES                               */}
      {/* ============================================================ */}
      {activeTab === 'movimentacoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header da Aba Movimentações */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                Movimentações &amp; Ajustes
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Extrato contábil do livro-razão. Transferências entre contas e conciliações criam movimentos históricos no extrato.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => handleOpenNewAdjustment()}
                disabled={loading || saving || activeAccounts.length === 0}
                title="Registrar um lançamento histórico de ajuste de saldo"
              >
                ± Registrar ajuste
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={handleOpenTransferModal}
                disabled={loading || saving || activeAccounts.length < 2}
                title="Transferir entre contas gerando movimentações históricas"
              >
                ⇄ Transferir entre contas
              </button>
            </div>
          </div>

          {/* Destaque Explicativo de Transações Históricas (Cards em grid) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.85rem' }}>
            <div
              className="card"
              style={{
                padding: '0.85rem 1rem',
                background: 'var(--bg-surface-elevated)',
                borderLeft: '4px solid var(--accent-primary)',
                fontSize: '0.83rem',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>📜</span> Lançamentos Históricos Imutáveis
              </div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Tanto <strong>Ajustes de Saldo</strong> quanto <strong>Transferências</strong> geram transações financeiras permanentes no histórico contábil (livro-razão), associadas a data, valor, referência e justificativa para conciliação e auditoria.
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: '0.85rem 1rem',
                background: 'var(--bg-surface-elevated)',
                borderLeft: '4px solid var(--color-success, #10b981)',
                fontSize: '0.83rem',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>🔒</span> Saldo de Abertura Inalterado
              </div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Movimentações e conciliações <strong>não alteram os dados de abertura</strong> das contas. O saldo disponível apurado pelo sistema resulta da soma estrita entre o saldo de abertura cadastrado e a totalidade das transações históricas executadas.
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="card" style={{ padding: '0.85rem 1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '0.85rem' }}
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value as any)}
              >
                <option value="ALL">Todos os Tipos de Transação</option>
                <option value="inflow">Entradas (Inflow)</option>
                <option value="outflow">Saídas (Outflow)</option>
                <option value="transfer">Transferências</option>
                <option value="refund">Reembolsos</option>
                <option value="balance_adjustment">Ajustes de Saldo</option>
              </select>

              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '0.85rem' }}
                value={txAccountFilter}
                onChange={(e) => setTxAccountFilter(e.target.value)}
              >
                <option value="ALL">Todas as Contas</option>
                {allAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>

              <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {filteredTransactions.length} movimentação(ões) recente(s)
              </span>
            </div>
          </div>

          {/* Tabela de Transações */}
          <div className="card">
            <div className="table-responsive">
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Conta</th>
                    <th>Descrição / Motivo</th>
                    <th>Referência</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        Nenhuma movimentação de caixa encontrada.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const acc = allAccounts.find((a) => a.id === tx.account_id);
                      const dest = allAccounts.find((a) => a.id === tx.destination_account_id);
                      const isPositiveAdj = tx.type === 'balance_adjustment' && tx.adjustment_direction === 'positive';
                      const isNegativeAdj = tx.type === 'balance_adjustment' && tx.adjustment_direction === 'negative';

                      return (
                        <tr key={tx.id}>
                          <td>{new Date(tx.transacted_at).toLocaleDateString('pt-PT')}</td>
                          <td>
                            {tx.type === 'inflow' && <span className="badge badge-success">Entrada</span>}
                            {tx.type === 'outflow' && <span className="badge badge-danger">Saída</span>}
                            {tx.type === 'transfer' && <span className="badge badge-warning">Transferência</span>}
                            {tx.type === 'refund' && <span className="badge badge-neutral">Reembolso</span>}
                            {tx.type === 'balance_adjustment' && (
                              <span className={`badge ${isPositiveAdj ? 'badge-success' : 'badge-danger'}`}>
                                Ajuste ({isPositiveAdj ? '+' : '−'})
                              </span>
                            )}
                          </td>
                          <td>
                            <strong>{acc?.name || tx.account_id}</strong>
                            {dest && (
                              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                ➜ {dest.name}
                              </span>
                            )}
                          </td>
                          <td>{tx.description || '—'}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{tx.reference || '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            <span
                              style={{
                                color:
                                  tx.type === 'inflow' || isPositiveAdj
                                    ? 'var(--success)'
                                    : tx.type === 'outflow' || isNegativeAdj
                                    ? 'var(--danger)'
                                    : 'inherit',
                              }}
                            >
                              {tx.type === 'inflow' || isPositiveAdj ? '+' : tx.type === 'outflow' || isNegativeAdj ? '-' : ''}
                              {formatMoney(tx.amount, tx.currency)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: GESTÃO DE CONTAS                                      */}
      {/* ============================================================ */}
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
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  Cadastro e Configuração de Contas
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Administração cadastral de contas bancárias, caixas e cartões da agência.
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

            {/* Aviso de Camada Administrativa */}
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                fontSize: '0.82rem',
                lineHeight: '1.45',
              }}
            >
              <strong style={{ color: 'var(--accent-primary)', display: 'block', marginBottom: '0.15rem' }}>
                🏛️ Painel Administrativo de Cadastro
              </strong>
              Este painel destina-se exclusivamente ao cadastro de contas, edição de nomes, ativação/desativação e fixação do saldo e data de abertura. <strong>Não realiza lançamentos ou movimentações financeiras.</strong> Para conciliações de saldo ou transferências, utilize a aba <strong>Movimentações &amp; Ajustes</strong>.
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
                      <option value="bank_account">Conta Corrente / Bancária</option>
                      <option value="cash">Caixa Físico / Dinheiro</option>
                      <option value="credit_card">Cartão de Crédito</option>
                      <option value="other">Outro</option>
                    </select>
                  </div>

                  {!editingAccountId && (
                    <>
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
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Saldo de Abertura ({accCurrency})</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="form-control"
                          value={accInitialBalance}
                          onChange={(e) => setAccInitialBalance(e.target.value)}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Data do Saldo</label>
                        <input
                          type="date"
                          className="form-control"
                          value={accInitialDate}
                          onChange={(e) => setAccInitialDate(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Descrição / Observações</label>
                  <input
                    type="text"
                    placeholder="Agência, conta, detalhes adicionais..."
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
                    <th style={{ padding: '0.5rem' }}>Nome da Conta</th>
                    <th style={{ padding: '0.5rem' }}>Tipo</th>
                    <th style={{ padding: '0.5rem' }}>Moeda</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Saldo de Abertura</th>
                    <th style={{ padding: '0.5rem' }}>Data de Abertura</th>
                    <th style={{ padding: '0.5rem' }}>Status Cadastral</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>Ações Cadastrais</th>
                  </tr>
                </thead>
                <tbody>
                  {allAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Nenhuma conta cadastrada.
                      </td>
                    </tr>
                  ) : (
                    allAccounts.map((acc) => (
                      <tr key={acc.id} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: acc.active ? 1 : 0.6 }}>
                        <td style={{ padding: '0.5rem', fontWeight: 600, minWidth: '160px' }}>
                          {editingNameId === acc.id ? (
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <input
                                type="text"
                                className="form-control"
                                style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem', height: '28px' }}
                                value={editingNameValue}
                                onChange={(e) => setEditingNameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveAccountName(acc.id);
                                  if (e.key === 'Escape') setEditingNameId(null);
                                }}
                                autoFocus
                              />
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
                                onClick={() => handleSaveAccountName(acc.id)}
                                disabled={saving}
                              >✓</button>
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
                                onClick={() => setEditingNameId(null)}
                              >✕</button>
                            </div>
                          ) : (
                            <span
                              title="Clique para renomear"
                              style={{ cursor: 'pointer', borderBottom: '1px dashed var(--border-subtle)' }}
                              onClick={() => handleStartEditName(acc)}
                            >
                              {acc.name}
                            </span>
                          )}
                        </td>
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
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                              onClick={() => handleStartEditAccount(acc)}
                              disabled={saving}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${acc.active ? 'btn-danger' : 'btn-secondary'}`}
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                              onClick={() => handleToggleAccountActive(acc)}
                              disabled={saving}
                            >
                              {acc.active ? 'Desativar' : 'Ativar'}
                            </button>
                          </div>
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

      {/* ============================================================ */}
      {/* MODAL: TRANSFERÊNCIA ENTRE CONTAS                           */}
      {/* ============================================================ */}
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
              maxWidth: '620px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                  ⇄ Transferência entre Contas
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Movimentação financeira interna entre caixas e contas bancárias da S23
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

            {/* Aviso de Movimento Histórico */}
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.82rem',
                lineHeight: '1.45',
              }}
            >
              <strong style={{ color: 'var(--accent-primary)', display: 'block', marginBottom: '0.15rem' }}>
                ℹ️ Lançamento de Movimento Histórico
              </strong>
              Esta transferência cria duas movimentações no extrato histórico: uma saída na conta de origem e uma entrada na conta de destino. Os saldos de abertura e configurações de cadastro de ambas as contas permanecem inalterados.
            </div>

            <form onSubmit={handleExecuteTransfer}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
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
                        const newSrcId = e.target.value;
                        setTransferSourceId(newSrcId);
                        const newSrc = activeAccounts.find((a) => a.id === newSrcId);
                        handleSourceAmountChange(transferAmount, newSrc, destAcc);
                      }}
                    >
                      {activeAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id} disabled={acc.id === transferDestId}>
                          {acc.name} ({acc.currency}) - {ACCOUNT_TYPE_LABELS[acc.type] || acc.type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      Valor ({sourceAcc?.currency || ''}) *
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
                        const newDst = activeAccounts.find((a) => a.id === newDestId);
                        handleSourceAmountChange(transferAmount, sourceAcc, newDst);
                      }}
                    >
                      {activeAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id} disabled={acc.id === transferSourceId}>
                          {acc.name} ({acc.currency}) - {ACCOUNT_TYPE_LABELS[acc.type] || acc.type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      Valor Destino ({destAcc?.currency || ''}) *
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

                {/* Custo de Remessa */}
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

                {/* Data e Referência */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Data *</label>
                    <input
                      type="date"
                      required
                      className="form-control"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Referência / DOC</label>
                    <input
                      type="text"
                      placeholder="Ex: REMESSA-2026-01"
                      className="form-control"
                      value={transferRef}
                      onChange={(e) => setTransferRef(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Descrição / Motivo</label>
                  <input
                    type="text"
                    placeholder="Descrição da transferência..."
                    className="form-control"
                    value={transferDesc}
                    onChange={(e) => setTransferDesc(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
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
                  disabled={saving || !transferAmount}
                >
                  {saving ? 'Registrando...' : 'Confirmar Transferência'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: REGISTRAR AJUSTE DE SALDO                             */}
      {/* ============================================================ */}
      {isAdjustmentModalOpen && (
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
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                  ± Registrar Ajuste de Saldo
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Movimentação contábil para conciliação do saldo real em caixa
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setIsAdjustmentModalOpen(false)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            {/* Aviso Explicativo de Transação Histórica */}
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
                fontSize: '0.82rem',
                lineHeight: '1.45',
              }}
            >
              <strong style={{ color: 'var(--accent-primary)', display: 'block', marginBottom: '0.2rem' }}>
                ℹ️ Criação de Transação Histórica
              </strong>
              Este ajuste registrará um lançamento financeiro histórico permanente no extrato contábil (<code>balance_adjustment</code>). O <strong>saldo atual</strong> é recalculado pelo motor contábil, mantendo o <strong>Saldo de Abertura</strong> e os dados cadastrais da conta rigorosamente inalterados.
            </div>

            <form onSubmit={handleSaveBalanceAdjustment}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    Conta Financeira *
                  </label>
                  <select
                    className="form-select"
                    value={adjAccountId}
                    onChange={(e) => setAdjAccountId(e.target.value)}
                    required
                  >
                    {activeAccounts.length === 0 ? (
                      <option value="">Nenhuma conta ativa disponível</option>
                    ) : (
                      activeAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.currency}) — {ACCOUNT_TYPE_LABELS[a.type] || a.type}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      Tipo de Ajuste *
                    </label>
                    <select
                      className="form-select"
                      value={adjBalanceDirection}
                      onChange={(e) => setAdjBalanceDirection(e.target.value as BalanceAdjustmentDirection)}
                      required
                    >
                      <option value="positive">+ Positivo (aumenta o saldo atual)</option>
                      <option value="negative">− Negativo (reduz o saldo atual)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      Valor ({allAccounts.find((a) => a.id === adjAccountId)?.currency || 'EUR'}) *
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      className="form-control"
                      placeholder="0.00"
                      value={adjBalanceAmount}
                      onChange={(e) => setAdjBalanceAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      Data do Ajuste *
                    </label>
                    <input
                      type="date"
                      required
                      className="form-control"
                      value={adjBalanceDate}
                      onChange={(e) => setAdjBalanceDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      Referência / Documento (opcional)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ex: CONCIL-001"
                      value={adjBalanceReference}
                      onChange={(e) => setAdjBalanceReference(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    Motivo / Justificativa *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="Descreva o motivo contábil do ajuste (obrigatório)..."
                    value={adjBalanceReason}
                    onChange={(e) => setAdjBalanceReason(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setIsAdjustmentModalOpen(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-sm btn-primary"
                  disabled={saving || !adjBalanceAmount || !adjBalanceReason.trim() || !adjAccountId}
                >
                  {saving ? 'Registrando...' : `Registrar Ajuste ${adjBalanceDirection === 'positive' ? '(+)' : '(−)'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL DE LIQUIDAÇÃO OPERACIONAL (RECEBIMENTOS & PAGAMENTOS)  */}
      {/* ============================================================ */}
      {settlementTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            zIndex: 9999,
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
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Header do Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {settlementTarget.type === 'receivable' ? (
                    <><span>📥</span> Registrar Recebimento</>
                  ) : settlementTarget.is_credit_card_invoice ? (
                    <><span>💳</span> Registrar Pagamento da Fatura do Cartão</>
                  ) : (
                    <><span>📤</span> Registrar Pagamento a Fornecedor</>
                  )}
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Liquidação operacional em caixa com registro de movimentação permanente
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setSettlementTarget(null)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            {/* Card de Resumo do Compromisso */}
            {(() => {
              const isCreditCardBlocked = settlementTarget.type === 'receivable' || Boolean(settlementTarget.is_credit_card_invoice);
              const eligibleAccounts = allAccounts.filter(
                (a) => a.currency === settlementTarget.currency && a.active && (!isCreditCardBlocked || a.type !== 'credit_card')
              );
              const selectedAcc = allAccounts.find((a) => a.id === settlementAccountId);
              const isCardAccountSelected = selectedAcc?.type === 'credit_card';

              const enteredAmount = Number(settlementAmount) || 0;
              const pendingBal = settlementTarget.pending_amount;
              const residual = Math.max(0, pendingBal - enteredAmount);
              const isFull = enteredAmount > 0 && Math.abs(enteredAmount - pendingBal) < 0.005;
              const isPartial = enteredAmount > 0 && enteredAmount < pendingBal - 0.005;
              const isOver = enteredAmount > pendingBal + 0.005;

              return (
                <form onSubmit={handleSubmitSettlement}>
                  <div
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.85rem 1rem',
                      marginBottom: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                          {settlementTarget.type === 'receivable' ? 'Cliente' : 'Fornecedor'}
                        </span>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                          {settlementTarget.counterparty_name || 'Contraparte'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                          {settlementTarget.currency}
                        </span>
                        {settlementTarget.quotation_id && (
                          <Link
                            to={`/cotacoes/${settlementTarget.quotation_id}/financeiro`}
                            className="badge badge-primary"
                            style={{ textDecoration: 'none' }}
                            title="Abrir ambiente financeiro desta cotação"
                          >
                            {settlementTarget.quotation_reference || 'Cotação'}
                          </Link>
                        )}
                      </div>
                    </div>

                    {settlementTarget.description && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <strong>Item / Parcela:</strong> {settlementTarget.description}
                      </div>
                    )}

                    {settlementTarget.quotation_client_name && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <strong>Cliente da Viagem:</strong> {settlementTarget.quotation_client_name}
                      </div>
                    )}

                    {settlementTarget.notes && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Obs: {settlementTarget.notes}
                      </div>
                    )}

                    {/* Bento de Valores */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.5rem',
                        marginTop: '0.35rem',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Previsto</div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginTop: '0.15rem' }}>
                          {formatMoney(settlementTarget.amount, settlementTarget.currency)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Já Liquidado</div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {formatMoney(settlementTarget.already_paid, settlementTarget.currency)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', background: 'rgba(59, 130, 246, 0.08)', borderRadius: 'var(--radius-sm)', padding: '0.2rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 700 }}>Saldo Pendente</div>
                        <div style={{ fontWeight: 800, fontSize: '0.92rem', color: settlementTarget.type === 'receivable' ? 'var(--success)' : 'var(--danger)', marginTop: '0.15rem' }}>
                          {formatMoney(settlementTarget.pending_amount, settlementTarget.currency)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {eligibleAccounts.length === 0 ? (
                    <div className="card" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'var(--danger)', marginBottom: '1rem', padding: '1rem' }}>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 600 }}>
                        ⚠️ Não há contas financeiras ativas elegíveis cadastradas na moeda {settlementTarget.currency}.
                      </p>
                      <p style={{ margin: '0.35rem 0 0.75rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Para liquidar este compromisso sem conversão indevida, cadastre ou ative previamente uma conta em {settlementTarget.currency}.
                      </p>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setSettlementTarget(null);
                          handleTabChange('contas');
                          handleStartNewAccount();
                          setAccCurrency(settlementTarget.currency);
                        }}
                      >
                        + Cadastrar Conta em {settlementTarget.currency}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                      {/* Campo 1: Valor a Liquidar */}
                      <div className="form-group" style={{ margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, margin: 0 }}>
                            Valor da Liquidação ({settlementTarget.currency}) *
                          </label>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}
                              onClick={() => setSettlementAmount(pendingBal.toFixed(2))}
                              title="Preencher valor total pendente"
                            >
                              Total ({formatMoney(pendingBal, settlementTarget.currency)})
                            </button>
                            {pendingBal > 1 && (
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}
                                onClick={() => setSettlementAmount((pendingBal / 2).toFixed(2))}
                                title="Preencher 50% do saldo pendente"
                              >
                                50%
                              </button>
                            )}
                          </div>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={pendingBal}
                          required
                          className={`form-control ${isOver ? 'is-invalid' : ''}`}
                          placeholder="0.00"
                          value={settlementAmount}
                          onChange={(e) => setSettlementAmount(e.target.value)}
                        />

                        {/* Indicador visual de Liquidação Parcial vs Total */}
                        <div style={{ marginTop: '0.35rem', fontSize: '0.78rem' }}>
                          {isOver && (
                            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                              ⚠️ O valor excede o saldo pendente de {formatMoney(pendingBal, settlementTarget.currency)}.
                            </span>
                          )}
                          {isFull && (
                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                              ✨ Liquidação Total: o compromisso será 100% quitado e baixado da lista de pendências.
                            </span>
                          )}
                          {isPartial && (
                            <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                              ⚡ Liquidação Parcial: restará saldo pendente de <strong>{formatMoney(residual, settlementTarget.currency)}</strong> que continuará ativo nesta central.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Campo 2: Conta Financeira Utilizada */}
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                          Conta Financeira Utilizada ({settlementTarget.currency}) *
                        </label>
                        <select
                          className="form-select"
                          value={settlementAccountId}
                          onChange={(e) => setSettlementAccountId(e.target.value)}
                          required
                        >
                          <option value="">Selecione a conta...</option>
                          {eligibleAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.currency}) — {ACCOUNT_TYPE_LABELS[a.type] || a.type}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Aviso e Data de Vencimento da Fatura se for Cartão de Crédito */}
                      {isCardAccountSelected && settlementTarget.type === 'payable' && (
                        <div
                          style={{
                            background: 'rgba(99, 102, 241, 0.08)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.85rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.6rem',
                          }}
                        >
                          <div style={{ fontSize: '0.8rem', lineHeight: '1.4', color: 'var(--text-primary)' }}>
                            <strong style={{ color: '#6366f1', display: 'block', marginBottom: '0.15rem' }}>
                              💳 Pagamento via Cartão de Crédito
                            </strong>
                            A quitação com o fornecedor é realizada pelo cartão. Uma nova fatura do cartão será programada nos pagamentos pendentes para a data de vencimento indicada abaixo, <strong>sem débito bancário antecipado</strong>.
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              Data de Vencimento da Fatura do Cartão *
                            </label>
                            <input
                              type="date"
                              required
                              className="form-control"
                              value={settlementInvoiceDueDate}
                              onChange={(e) => setSettlementInvoiceDueDate(e.target.value)}
                            />
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                              Data em que a fatura deste cartão vencerá para liquidação via conta bancária.
                            </span>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                        {/* Campo 3: Data Efetiva */}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                            Data Efetiva da Movimentação *
                          </label>
                          <input
                            type="date"
                            required
                            className="form-control"
                            value={settlementDate}
                            onChange={(e) => setSettlementDate(e.target.value)}
                          />
                        </div>

                        {/* Campo 4: Referência / Documento */}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                            Referência / Documento (opcional)
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Ex: Comprovante PIX, TED, NSU..."
                            value={settlementReference}
                            onChange={(e) => setSettlementReference(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Campo 5: Observações / Descrição */}
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                          Observações / Descrição (opcional)
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Ex: Liquidação autorizada por..."
                          value={settlementDescription}
                          onChange={(e) => setSettlementDescription(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Ações do Modal */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => setSettlementTarget(null)}
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-sm btn-primary"
                      disabled={
                        saving ||
                        eligibleAccounts.length === 0 ||
                        !settlementAccountId ||
                        !settlementAmount ||
                        isOver ||
                        enteredAmount <= 0 ||
                        (isCardAccountSelected && settlementTarget.type === 'payable' && !settlementInvoiceDueDate)
                      }
                    >
                      {saving
                        ? 'Processando Liquidação...'
                        : isFull
                        ? '✓ Confirmar Liquidação Total'
                        : '✓ Confirmar Liquidação Parcial'}
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
