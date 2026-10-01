import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
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

export const FinancialPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FinancialTab>('visao_geral');
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
        if (!ref.includes(q) && !client.includes(q) && !party.includes(q) && !desc.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [commitments, commitTypeFilter, commitCurrFilter, commitStatusFilter, commitSearch]);

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
            Posição consolidada, contas bancárias, cartões, transferências e compromissos operacionais.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleOpenTransferModal}
            disabled={loading || saving}
          >
            ⇄ Transferir entre contas
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenAccountModal}
            disabled={loading || saving}
          >
            🏦 Gerenciar Contas ({allAccounts.length})
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
          onClick={() => setActiveTab('visao_geral')}
          className={`btn ${activeTab === 'visao_geral' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', borderBottom: 'none' }}
        >
          📊 Visão Geral &amp; Caixa
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('contas')}
          className={`btn ${activeTab === 'contas' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', borderBottom: 'none' }}
        >
          🏦 Cadastro de Contas ({allAccounts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('compromissos')}
          className={`btn ${activeTab === 'compromissos' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', borderBottom: 'none' }}
        >
          📑 Recebimentos &amp; Pagamentos ({commitments.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('movimentacoes')}
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
                Cadastro e Configuração de Contas
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Gestão administrativa das contas bancárias, caixas e cartões da agência.
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
          <div className="card" style={{ padding: '0.85rem 1.25rem', background: 'var(--bg-surface-elevated)', borderLeft: '4px solid var(--accent-primary)', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span>
                🏛️ <strong>Camada Administrativa:</strong> Esta tabela é focada exclusivamente no cadastro e configuração das contas (nome, tipo, moeda, saldo inicial de abertura, data de referência e status). Para registrar transferências ou conciliações com histórico de ajuste, utilize a aba <strong>Movimentações &amp; Ajustes</strong>.
              </span>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '0.78rem' }}
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
                    <th style={{ textAlign: 'right' }}>Saldo Inicial</th>
                    <th>Data de Referência</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Ações Administrativas</th>
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
                    <th style={{ textAlign: 'right' }}>Saldo Inicial</th>
                    <th>Data de Referência</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Ações Administrativas</th>
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
        </div>
      )}

      {/* ============================================================ */}
      {/* ABA 3: RECEBIMENTOS & PAGAMENTOS                              */}
      {/* ============================================================ */}
      {activeTab === 'compromissos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Barra de Filtros */}
          <div className="card" style={{ padding: '0.85rem 1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                className="form-control"
                style={{ maxWidth: '280px', fontSize: '0.85rem' }}
                placeholder="Buscar cotação, cliente, fornecedor..."
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
                <option value="receivable">Apenas Recebimentos (Clientes)</option>
                <option value="payable">Apenas Pagamentos (Fornecedores)</option>
              </select>

              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '0.85rem' }}
                value={commitCurrFilter}
                onChange={(e) => setCommitCurrFilter(e.target.value as any)}
              >
                <option value="ALL">Todas as Moedas</option>
                <option value="EUR">EUR (€)</option>
                <option value="BRL">BRL (R$)</option>
              </select>

              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '0.85rem' }}
                value={commitStatusFilter}
                onChange={(e) => setCommitStatusFilter(e.target.value as any)}
              >
                <option value="ALL">Todos os Status</option>
                <option value="overdue">🚨 Vencidos</option>
                <option value="planned">📅 A Vencer</option>
              </select>

              <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {filteredCommitments.length} compromisso(s) encontrado(s)
              </span>
            </div>
          </div>

          {/* Tabela de Compromissos */}
          <div className="card">
            <div className="table-responsive">
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Cotação / Cliente</th>
                    <th>Contraparte</th>
                    <th>Vencimento</th>
                    <th style={{ textAlign: 'right' }}>Valor Total</th>
                    <th style={{ textAlign: 'right' }}>Saldo Pendente</th>
                    <th>Conta Esperada</th>
                    <th style={{ textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCommitments.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        Nenhum compromisso encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredCommitments.map((c) => (
                      <tr key={c.id}>
                        <td>
                          {c.type === 'receivable' ? (
                            <span className="badge badge-success">Recebível</span>
                          ) : (
                            <span className="badge badge-danger">Pagável</span>
                          )}
                        </td>
                        <td>
                          <strong>{c.quotation_reference || 'Cotação'}</strong>
                          {c.quotation_client_name && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {c.quotation_client_name}
                            </span>
                          )}
                        </td>
                        <td>
                          {c.counterparty_name || '—'}
                          {c.description && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {c.description}
                            </span>
                          )}
                        </td>
                        <td>
                          {c.expected_date ? (
                            <span style={{ color: c.is_overdue ? 'var(--danger)' : 'inherit', fontWeight: c.is_overdue ? 700 : 400 }}>
                              {new Date(c.expected_date).toLocaleDateString('pt-PT')}
                              {c.is_overdue && ' (Vencido)'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Sem data</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                          {formatMoney(c.amount, c.currency as Currency)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: c.type === 'receivable' ? 'var(--success)' : 'var(--danger)' }}>
                          {formatMoney(c.pending_amount, c.currency as Currency)}
                        </td>
                        <td>
                          {c.expected_account_name ? (
                            <span className="badge badge-neutral">{c.expected_account_name}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Indefinida</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {c.quotation_id && (
                            <Link
                              to={`/cotacoes/${c.quotation_id}/financeiro`}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                              title="Abrir ambiente financeiro desta cotação"
                            >
                              Ver Cotação →
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ABA 4: MOVIMENTAÇÕES & AJUSTES                               */}
      {/* ============================================================ */}
      {activeTab === 'movimentacoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Header da Aba Movimentações */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                Movimentações Financeiras &amp; Ajustes
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Extrato contábil de entradas, saídas, transferências e conciliações de saldo.
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
                title="Transferir entre contas"
              >
                ⇄ Transferir entre contas
              </button>
            </div>
          </div>

          {/* Banner Explicativo de Transações Históricas */}
          <div className="card" style={{ padding: '0.75rem 1rem', background: 'var(--bg-surface-elevated)', borderLeft: '4px solid var(--accent-primary)', fontSize: '0.85rem' }}>
            <span>
              💡 <strong>Lançamentos Históricos:</strong> Todas as movimentações nesta área — incluindo <strong>Transferências</strong> e <strong>Ajustes de Saldo</strong> — constituem transações financeiras históricas que alimentam o motor contábil e recalculam os saldos em tempo real, sem alterar o saldo inicial ou as configurações de cadastro das contas.
            </span>
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
              Este ajuste registrará um lançamento financeiro histórico permanente no extrato contábil (<code>balance_adjustment</code>). O <strong>saldo atual</strong> é recalculado pelo motor contábil, mantendo o <strong>Saldo Inicial de Abertura</strong> e os dados cadastrais da conta rigorosamente inalterados.
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
    </div>
  );
};
