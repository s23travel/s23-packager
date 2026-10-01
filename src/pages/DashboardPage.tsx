import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { packagesService } from '../services/packagesService';
import { quotationsService } from '../services/quotationsService';
import { financialService } from '../services/financialService';
import {
  Package,
  Quotation,
  ConsolidatedBalancesResult,
  AccountBalanceSummary,
  PendingCommitmentItem,
  Currency,
  ACCOUNT_TYPE_LABELS,
} from '../types';
import { StatusBadge } from '../components/common/Badge';
import { Pagination } from '../components/common/Pagination';
import { WeeklyCashFlowCalendar } from '../components/finance/WeeklyCashFlowCalendar';
import { FinancialAlertsPanel } from '../components/finance/FinancialAlertsPanel';
import { financialAlertsService } from '../services/financialAlertsService';

const PAGE_SIZE = 6;

const formatMoney = (val: number, curr: Currency) => {
  return new Intl.NumberFormat(curr === 'BRL' ? 'pt-BR' : 'pt-PT', {
    style: 'currency',
    currency: curr,
  }).format(val || 0);
};

export const DashboardPage: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [consolidated, setConsolidated] = useState<ConsolidatedBalancesResult | null>(null);
  const [accounts, setAccounts] = useState<AccountBalanceSummary[]>([]);
  const [overdueCommitments, setOverdueCommitments] = useState<PendingCommitmentItem[]>([]);
  const [allCommitments, setAllCommitments] = useState<PendingCommitmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Paginação independente para pacotes e cotações recentes
  const [packagePage, setPackagePage] = useState(1);
  const [quotePage, setQuotePage] = useState(1);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Consulta atômica única: commitmentsRes já contém todos os pendentes e a flag is_overdue
      const [pkgs, qts, balancesRes, accountsRes, commitmentsRes] = await Promise.all([
        packagesService.listPackages(),
        quotationsService.listQuotations(),
        financialService.getConsolidatedBalances(),
        financialService.getAccountBalances({ activeOnly: true }),
        financialService.getPendingCommitments(),
      ]);
      setPackages(pkgs);
      setQuotes(qts);
      setConsolidated(balancesRes);
      setAccounts(accountsRes);
      setOverdueCommitments(commitmentsRes.filter((c) => c.is_overdue));
      setAllCommitments(commitmentsRes);
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      console.error('Erro ao carregar dados do dashboard financeiro:', e);
      setError(e?.message || 'Falha ao carregar posição financeira.');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadData();
  }, []);

  // Contas filtradas por moeda
  const eurAccounts = useMemo(
    () => accounts.filter((a) => a.currency === 'EUR'),
    [accounts]
  );
  const brlAccounts = useMemo(
    () => accounts.filter((a) => a.currency === 'BRL'),
    [accounts]
  );

  // Alertas financeiros críticos objetivos
  const criticalAlerts = useMemo(() => {
    const list: string[] = [];

    // 1. Compromissos vencidos
    const overduePayablesCount = overdueCommitments.filter((c) => c.type === 'payable').length;
    const overdueReceivablesCount = overdueCommitments.filter((c) => c.type === 'receivable').length;

    if (overduePayablesCount > 0) {
      list.push(`${overduePayablesCount} pagamento(s) a fornecedor vencido(s)`);
    }
    if (overdueReceivablesCount > 0) {
      list.push(`${overdueReceivablesCount} recebimento(s) de cliente atrasado(s)`);
    }

    // 2. Contas bancárias ativas com saldo atual negativo
    const negativeBankAccounts = accounts.filter(
      (a) => a.account_type !== 'credit_card' && a.current_balance < 0
    );
    if (negativeBankAccounts.length > 0) {
      list.push(`${negativeBankAccounts.length} conta(s) com saldo devedor em caixa`);
    }

    // 3. Contas com projeção negativa
    const negativeProjectedAccounts = accounts.filter(
      (a) => a.account_type !== 'credit_card' && a.projected_balance < 0
    );
    if (negativeProjectedAccounts.length > 0) {
      list.push(`${negativeProjectedAccounts.length} conta(s) com saldo projetado negativo`);
    }

    return list;
  }, [overdueCommitments, accounts]);

  // Alertas Financeiros Detalhados e Ações Rápidas (Fase 3D)
  const financialAlerts = useMemo(() => {
    return financialAlertsService.generateFinancialAlerts({
      accounts,
      commitments: allCommitments,
    });
  }, [accounts, allCommitments]);

  // Ordenações para atividades recentes
  const sortedPackages = useMemo(() => {
    return [...packages].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [packages]);

  const sortedQuotes = useMemo(() => {
    return [...quotes].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [quotes]);

  const totalPackagePages = Math.max(1, Math.ceil(sortedPackages.length / PAGE_SIZE));
  const totalQuotePages = Math.max(1, Math.ceil(sortedQuotes.length / PAGE_SIZE));

  useEffect(() => {
    if (packagePage > totalPackagePages) {
      setPackagePage(totalPackagePages);
    }
  }, [packagePage, totalPackagePages]);

  useEffect(() => {
    if (quotePage > totalQuotePages) {
      setQuotePage(totalQuotePages);
    }
  }, [quotePage, totalQuotePages]);

  const paginatedPackages = useMemo(() => {
    return sortedPackages.slice(
      (packagePage - 1) * PAGE_SIZE,
      packagePage * PAGE_SIZE
    );
  }, [sortedPackages, packagePage]);

  const paginatedQuotes = useMemo(() => {
    return sortedQuotes.slice(
      (quotePage - 1) * PAGE_SIZE,
      quotePage * PAGE_SIZE
    );
  }, [sortedQuotes, quotePage]);

  return (
    <div className="page-body">
      {/* Topo / Page Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Visão geral</h1>
          <p className="page-subtitle">
            Posição de caixa, liquidez consolidada e operações da S23 Travel
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            onClick={loadData}
            className="btn btn-secondary"
            title="Atualizar dados financeiros"
            disabled={loading}
          >
            {loading ? 'Atualizando...' : '↻ Atualizar'}
          </button>
          <Link to="/pacotes/novo" className="btn btn-secondary">
            + Novo Pacote
          </Link>
          <Link to="/cotacoes/novo" className="btn btn-primary">
            + Nova Cotação
          </Link>
        </div>
      </div>

      {/* Erro de Carregamento */}
      {error && (
        <div
          style={{
            padding: '0.85rem 1rem',
            backgroundColor: 'var(--danger-soft)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            fontSize: '13px',
          }}
        >
          <strong>Atenção:</strong> {error}
        </div>
      )}

      {/* Faixa de Alertas Financeiros Críticos */}
      <div
        className="card"
        style={{
          padding: '0.85rem 1.1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          backgroundColor:
            loading
              ? 'var(--bg-surface)'
              : criticalAlerts.length > 0
              ? 'var(--warning-soft)'
              : 'var(--bg-surface)',
          borderLeft:
            loading
              ? '4px solid var(--border-subtle)'
              : criticalAlerts.length > 0
              ? '4px solid var(--warning)'
              : '4px solid var(--success)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, flexShrink: 0 }} aria-hidden="true">
            {loading ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            ) : criticalAlerts.length > 0 ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
          </span>
          <div>
            <strong
              style={{
                fontSize: '13px',
                color:
                  loading
                    ? 'var(--text-secondary)'
                    : criticalAlerts.length > 0
                    ? 'var(--text-primary)'
                    : 'var(--success)',
              }}
            >
              {loading
                ? 'Carregando indicadores financeiros...'
                : criticalAlerts.length > 0
                ? `${criticalAlerts.length} alerta(s) financeiro(s) crítico(s)`
                : 'Caixa e vencimentos em dia'}
            </strong>
            <p
              style={{
                margin: 0,
                fontSize: '12px',
                color: 'var(--text-muted)',
              }}
            >
              {loading
                ? 'Consultando saldos, projeções e vencimentos...'
                : criticalAlerts.length > 0
                ? criticalAlerts.join(' • ')
                : 'Nenhum pagamento ou recebimento atrasado no sistema.'}
            </p>
          </div>
        </div>

        {!loading && (financialAlerts.totalCritical > 0 || financialAlerts.totalWarning > 0) && (
          <a
            href="#secao-alertas"
            className="btn btn-sm btn-secondary"
            style={{ fontSize: '12px' }}
          >
            Ver {financialAlerts.totalCritical + financialAlerts.totalWarning} alerta(s) ↓
          </a>
        )}
      </div>

      {/* ===================================================================== */}
      {/* PAINEL DE ALERTAS FINANCEIROS E AÇÕES RÁPIDAS (FASE 3D)               */}
      {/* ===================================================================== */}
      <div id="secao-alertas">
        <FinancialAlertsPanel alerts={financialAlerts} loading={loading} />
      </div>

      {/* ===================================================================== */}
      {/* BLOCOS CONSOLIDADOS POR MOEDA: PORTUGAL (EUR) & BRASIL (BRL)           */}
      {/* ===================================================================== */}
      <div className="grid-cols-2" style={{ alignItems: 'stretch' }}>
        {/* BLOCO PORTUGAL (EUR) */}
        <div
          id="secao-contas-eur"
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1.25rem',
          }}
        >
          <div className="block-header">
            <div className="block-header-left">
              <div>
                <h2 className="section-heading">Portugal</h2>
                <span className="metric-card-sub">Liquidez operacional em EUR</span>
              </div>
            </div>
            <span className="currency-badge">EUR</span>
          </div>

          {/* Cards de Métricas EUR */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
            {/* Disponível em Bancos/Caixa */}
            <div className="metric-card">
              <div className="metric-card-label">Caixa Bancário</div>
              <div className="metric-card-value">
                {loading ? '—' : formatMoney(consolidated?.EUR?.current_balance || 0, 'EUR')}
              </div>
              <div className="metric-card-sub">Disponível imediato</div>
            </div>

            {/* Saldo em Cartões de Crédito (SEPARADO do caixa bancário) */}
            <div className="metric-card">
              <div className="metric-card-label">Cartões de Crédito</div>
              <div className={`metric-card-value${
                (consolidated?.EUR?.credit_card_balance || 0) < 0 ? ' metric-card-value--warning' : ''
              }`}>
                {loading ? '—' : formatMoney(consolidated?.EUR?.credit_card_balance || 0, 'EUR')}
              </div>
              <div className="metric-card-sub">Faturas / uso de limite</div>
            </div>

            {/* Recebíveis Pendentes */}
            <div className="metric-card">
              <div className="metric-card-label">A Receber</div>
              <div className="metric-card-value metric-card-value--success">
                {loading ? '—' : `+${formatMoney(consolidated?.EUR?.total_pending_receivables || 0, 'EUR')}`}
              </div>
              {(consolidated?.EUR?.overdue_receivables || 0) > 0 && (
                <div className="metric-card-sub metric-card-sub--danger">
                  {formatMoney(consolidated?.EUR?.overdue_receivables || 0, 'EUR')} vencido
                </div>
              )}
            </div>

            {/* Pagáveis Pendentes */}
            <div className="metric-card">
              <div className="metric-card-label">A Pagar</div>
              <div className="metric-card-value metric-card-value--danger">
                {loading ? '—' : `-${formatMoney(consolidated?.EUR?.total_pending_payables || 0, 'EUR')}`}
              </div>
              {(consolidated?.EUR?.overdue_payables || 0) > 0 && (
                <div className="metric-card-sub metric-card-sub--danger">
                  {formatMoney(consolidated?.EUR?.overdue_payables || 0, 'EUR')} vencido
                </div>
              )}
            </div>

            {/* Saldo Projetado EUR */}
            <div className="metric-card">
              <div className="metric-card-label">Saldo Projetado</div>
              <div className={`metric-card-value${
                (consolidated?.EUR?.projected_balance || 0) >= 0 ? '' : ' metric-card-value--danger'
              }`}>
                {loading ? '—' : formatMoney(consolidated?.EUR?.projected_balance || 0, 'EUR')}
              </div>
              <div className="metric-card-sub">Caixa + Rec - Pag</div>
            </div>
          </div>

          {/* Tabela de Contas Ativas em EUR */}
          <div>
          <div className="account-sub">
              <span className="account-sub-label">Contas ativas ({eurAccounts.length})</span>
            </div>

            {loading ? (
              <div className="loading-state">
                <p>Carregando contas...</p>
              </div>
            ) : eurAccounts.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                Nenhuma conta em EUR ativa no momento.
              </div>
            ) : (
              <div className="table-responsive" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <table className="data-table data-table--compact">
                  <thead>
                    <tr>
                      <th>Conta</th>
                      <th>Tipo</th>
                      <th style={{ textAlign: 'right' }}>Saldo Atual</th>
                      <th style={{ textAlign: 'right' }}>A Receber</th>
                      <th style={{ textAlign: 'right' }}>A Pagar</th>
                      <th style={{ textAlign: 'right' }}>Saldo Projetado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eurAccounts.map((acc) => {
                      const hasBindings = acc.pending_receivables > 0 || acc.pending_payables > 0;
                      return (
                        <tr key={acc.account_id}>
                          <td>
                            <strong>{acc.account_name}</strong>
                          </td>
                          <td>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {ACCOUNT_TYPE_LABELS[acc.account_type] || acc.account_type}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatMoney(acc.current_balance, 'EUR')}
                          </td>
                          <td style={{ textAlign: 'right', color: acc.pending_receivables > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                            {acc.pending_receivables > 0 ? `+${formatMoney(acc.pending_receivables, 'EUR')}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', color: acc.pending_payables > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                            {acc.pending_payables > 0 ? `-${formatMoney(acc.pending_payables, 'EUR')}` : '—'}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 700,
                              color: acc.projected_balance < 0 ? 'var(--danger)' : 'var(--text-primary)',
                            }}
                          >
                            {formatMoney(acc.projected_balance, 'EUR')}
                            {!hasBindings && (
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', fontWeight: 400 }}>
                                (sem vínculo)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* BLOCO BRASIL (BRL) */}
        <div
          id="secao-contas-brl"
          className="card"
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}
        >
          <div className="block-header">
            <div className="block-header-left">
              <div>
                <h2 className="section-heading">Brasil</h2>
                <span className="metric-card-sub">Liquidez operacional em BRL</span>
              </div>
            </div>
            <span className="currency-badge">BRL</span>
          </div>

          {/* Cards de Métricas BRL */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
            {/* Disponível em Bancos/Caixa */}
            <div className="metric-card">
              <div className="metric-card-label">Caixa Bancário</div>
              <div className="metric-card-value">
                {loading ? '—' : formatMoney(consolidated?.BRL?.current_balance || 0, 'BRL')}
              </div>
              <div className="metric-card-sub">Disponível imediato</div>
            </div>

            {/* Saldo em Cartões de Crédito (SEPARADO) */}
            <div className="metric-card">
              <div className="metric-card-label">Cartões de Crédito</div>
              <div className={`metric-card-value${
                (consolidated?.BRL?.credit_card_balance || 0) < 0 ? ' metric-card-value--warning' : ''
              }`}>
                {loading ? '—' : formatMoney(consolidated?.BRL?.credit_card_balance || 0, 'BRL')}
              </div>
              <div className="metric-card-sub">Faturas / uso de limite</div>
            </div>

            {/* Recebíveis Pendentes */}
            <div className="metric-card">
              <div className="metric-card-label">A Receber</div>
              <div className="metric-card-value metric-card-value--success">
                {loading ? '—' : `+${formatMoney(consolidated?.BRL?.total_pending_receivables || 0, 'BRL')}`}
              </div>
              {(consolidated?.BRL?.overdue_receivables || 0) > 0 && (
                <div className="metric-card-sub metric-card-sub--danger">
                  {formatMoney(consolidated?.BRL?.overdue_receivables || 0, 'BRL')} vencido
                </div>
              )}
            </div>

            {/* Pagáveis Pendentes */}
            <div className="metric-card">
              <div className="metric-card-label">A Pagar</div>
              <div className="metric-card-value metric-card-value--danger">
                {loading ? '—' : `-${formatMoney(consolidated?.BRL?.total_pending_payables || 0, 'BRL')}`}
              </div>
              {(consolidated?.BRL?.overdue_payables || 0) > 0 && (
                <div className="metric-card-sub metric-card-sub--danger">
                  {formatMoney(consolidated?.BRL?.overdue_payables || 0, 'BRL')} vencido
                </div>
              )}
            </div>

            {/* Saldo Projetado BRL */}
            <div className="metric-card">
              <div className="metric-card-label">Saldo Projetado</div>
              <div className={`metric-card-value${
                (consolidated?.BRL?.projected_balance || 0) >= 0 ? '' : ' metric-card-value--danger'
              }`}>
                {loading ? '—' : formatMoney(consolidated?.BRL?.projected_balance || 0, 'BRL')}
              </div>
              <div className="metric-card-sub">Caixa + Rec - Pag</div>
            </div>
          </div>

          {/* Tabela de Contas Ativas em BRL */}
          <div>
            <div className="account-sub">
              <span className="account-sub-label">Contas ativas ({brlAccounts.length})</span>
            </div>

            {loading ? (
              <div className="loading-state">
                <p>Carregando contas...</p>
              </div>
            ) : brlAccounts.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                Nenhuma conta em BRL ativa no momento.
              </div>
            ) : (
              <div className="table-responsive" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <table className="data-table data-table--compact">
                  <thead>
                    <tr>
                      <th>Conta</th>
                      <th>Tipo</th>
                      <th style={{ textAlign: 'right' }}>Saldo Atual</th>
                      <th style={{ textAlign: 'right' }}>A Receber</th>
                      <th style={{ textAlign: 'right' }}>A Pagar</th>
                      <th style={{ textAlign: 'right' }}>Saldo Projetado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brlAccounts.map((acc) => {
                      const hasBindings = acc.pending_receivables > 0 || acc.pending_payables > 0;
                      return (
                        <tr key={acc.account_id}>
                          <td>
                            <strong>{acc.account_name}</strong>
                          </td>
                          <td>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {ACCOUNT_TYPE_LABELS[acc.account_type] || acc.account_type}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatMoney(acc.current_balance, 'BRL')}
                          </td>
                          <td style={{ textAlign: 'right', color: acc.pending_receivables > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                            {acc.pending_receivables > 0 ? `+${formatMoney(acc.pending_receivables, 'BRL')}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', color: acc.pending_payables > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                            {acc.pending_payables > 0 ? `-${formatMoney(acc.pending_payables, 'BRL')}` : '—'}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 700,
                              color: acc.projected_balance < 0 ? 'var(--danger)' : 'var(--text-primary)',
                            }}
                          >
                            {formatMoney(acc.projected_balance, 'BRL')}
                            {!hasBindings && (
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', fontWeight: 400 }}>
                                (sem vínculo)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* CALENDÁRIO SEMANAL DE VENCIMENTOS (FASE 3C)                           */}
      {/* ===================================================================== */}
      <WeeklyCashFlowCalendar refreshTrigger={refreshKey} />

      {/* ===================================================================== */}
      {/* SEÇÃO: COMPROMISSOS VENCIDOS / ATENÇÃO IMEDIATA                       */}
      {/* ===================================================================== */}
      <div id="secao-vencidos" className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: overdueCommitments.length > 0 ? 'var(--warning-soft)' : 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '16px' }}>
              {overdueCommitments.length > 0 ? '⚠️' : '📅'}
            </span>
            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              Compromissos vencidos pendentes ({overdueCommitments.length})
            </h3>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Data limite ultrapassada com saldo aberto
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Carregando pendências...
          </div>
        ) : overdueCommitments.length === 0 ? (
          <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Nenhum compromisso vencido. Todos os recebimentos e pagamentos estão em dia!
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vencimento</th>
                  <th>Tipo</th>
                  <th>Contraparte</th>
                  <th>Cotação / Ref</th>
                  <th>Conta Prevista</th>
                  <th style={{ textAlign: 'right' }}>Valor Pendente</th>
                  <th style={{ textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {overdueCommitments.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                        {item.expected_date || 'Sem data'}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: item.type === 'receivable' ? 'var(--success-soft)' : 'var(--danger-soft)',
                          color: item.type === 'receivable' ? 'var(--success)' : 'var(--danger)',
                          fontSize: '11px',
                        }}
                      >
                        {item.type === 'receivable' ? 'A Receber' : 'A Pagar'}
                      </span>
                    </td>
                    <td>
                      <strong>{item.counterparty_name}</strong>
                    </td>
                    <td>
                      {item.quotation_id ? (
                        <Link to={`/cotacoes/${item.quotation_id}/financeiro`} className="table-link-highlight">
                          <code>{item.quotation_reference || 'Ver cotação'}</code>
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {item.expected_account_name || 'Sem conta definida'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: item.type === 'receivable' ? 'var(--success)' : 'var(--danger)' }}>
                      {item.type === 'receivable' ? '+' : '-'}
                      {formatMoney(item.pending_amount, item.currency)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {item.quotation_id && (
                        <Link to={`/cotacoes/${item.quotation_id}/financeiro`} className="btn btn-sm btn-secondary">
                          Liquidador &rarr;
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* SEÇÃO: ATIVIDADE OPERACIONAL RECENTE (PACOTES E COTAÇÕES)             */}
      {/* ===================================================================== */}
      <div className="grid-cols-2" style={{ alignItems: 'flex-start' }}>
        {/* Pacotes Recentes */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Pacotes base ({packages.length})
            </h3>
            <Link to="/pacotes" style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: 500 }}>
              Ver catálogo &rarr;
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Carregando pacotes...
            </div>
          ) : sortedPackages.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Nenhum pacote cadastrado.
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Referência</th>
                      <th>Nome do pacote</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPackages.map((pkg) => (
                      <tr key={pkg.id}>
                        <td>
                          <Link to={`/pacotes/${pkg.id}`} className="table-link-highlight">
                            <code>{pkg.reference}</code>
                          </Link>
                        </td>
                        <td>
                          <Link to={`/pacotes/${pkg.id}`} className="table-link-title">
                            {pkg.name}
                          </Link>
                        </td>
                        <td>
                          <StatusBadge status={pkg.status} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Link to={`/pacotes/${pkg.id}`} className="btn btn-sm btn-secondary">
                            Ver
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sortedPackages.length > PAGE_SIZE && (
                <Pagination
                  currentPage={packagePage}
                  totalPages={totalPackagePages}
                  onPageChange={setPackagePage}
                  totalItems={sortedPackages.length}
                  pageSize={PAGE_SIZE}
                />
              )}
            </>
          )}
        </div>

        {/* Cotações Recentes */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Cotações recentes ({quotes.length})
            </h3>
            <Link to="/cotacoes" style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: 500 }}>
              Ver todas &rarr;
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Carregando cotações...
            </div>
          ) : sortedQuotes.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Nenhuma cotação registrada ainda.
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Referência</th>
                      <th>Cliente</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedQuotes.map((q) => (
                      <tr key={q.id}>
                        <td>
                          <Link to={`/cotacoes/${q.id}`} className="table-link-highlight">
                            <code>{q.reference}</code>
                          </Link>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>
                            {q.client_name || 'Sem cliente'}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={q.status} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Link to={`/cotacoes/${q.id}`} className="btn btn-sm btn-secondary">
                            Abrir
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sortedQuotes.length > PAGE_SIZE && (
                <Pagination
                  currentPage={quotePage}
                  totalPages={totalQuotePages}
                  onPageChange={setQuotePage}
                  totalItems={sortedQuotes.length}
                  pageSize={PAGE_SIZE}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
