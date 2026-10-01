import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { GroupedFinancialAlerts, FinancialAlert, Currency } from '../../types';

interface FinancialAlertsPanelProps {
  alerts: GroupedFinancialAlerts;
  loading?: boolean;
}

const SEVERITY_CONFIG = {
  critical: {
    label: 'Crítico',
    bgColor: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderColor: 'var(--danger)',
    icon: '🚨',
  },
  warning: {
    label: 'Atenção',
    bgColor: 'var(--warning-soft)',
    color: 'var(--warning)',
    borderColor: 'var(--warning)',
    icon: '⚠️',
  },
  info: {
    label: 'Informativo',
    bgColor: 'var(--accent-soft)',
    color: 'var(--accent-primary)',
    borderColor: 'var(--accent-primary)',
    icon: 'ℹ️',
  },
};

export const FinancialAlertsPanel: React.FC<FinancialAlertsPanelProps> = ({
  alerts,
  loading = false,
}) => {
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | Currency>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'critical' | 'warning'>('ALL');

  const filterAlertsList = (list: FinancialAlert[]) => {
    if (severityFilter === 'ALL') return list;
    return list.filter((a) => a.severity === severityFilter);
  };

  const currentScopeAlerts =
    currencyFilter === 'ALL'
      ? [...alerts.EUR, ...alerts.BRL]
      : currencyFilter === 'EUR'
      ? alerts.EUR
      : alerts.BRL;

  const currentCriticalCount = currentScopeAlerts.filter((a) => a.severity === 'critical').length;
  const currentWarningCount = currentScopeAlerts.filter((a) => a.severity === 'warning').length;

  const eurList = filterAlertsList(alerts.EUR);
  const brlList = filterAlertsList(alerts.BRL);
  const totalCount =
    (currencyFilter === 'ALL' || currencyFilter === 'EUR' ? eurList.length : 0) +
    (currencyFilter === 'ALL' || currencyFilter === 'BRL' ? brlList.length : 0);

  return (
    <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Cabeçalho do Painel */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '20px' }}>
            {alerts.totalCritical > 0 ? '🚨' : alerts.totalWarning > 0 ? '⚠️' : '🛡️'}
          </span>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Alertas financeiros e ações rápidas
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Detecção interna de pendências críticas, prazos de cartões e liquidez
            </span>
          </div>
        </div>

        {/* Controles de Filtro */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Filtro por Moeda */}
          <div
            style={{
              display: 'flex',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            {(['ALL', 'EUR', 'BRL'] as const).map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => setCurrencyFilter(curr)}
                className="btn btn-sm"
                style={{
                  backgroundColor: currencyFilter === curr ? 'var(--accent-primary)' : 'var(--bg-surface)',
                  color: currencyFilter === curr ? '#ffffff' : 'var(--text-secondary)',
                  borderRadius: 0,
                  border: 'none',
                  fontWeight: currencyFilter === curr ? 600 : 400,
                  fontSize: '11px',
                }}
              >
                {curr === 'ALL' ? 'Todas' : curr}
              </button>
            ))}
          </div>

          {/* Filtro por Severidade */}
          <div
            style={{
              display: 'flex',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setSeverityFilter('ALL')}
              className="btn btn-sm"
              style={{
                backgroundColor: severityFilter === 'ALL' ? 'var(--accent-primary)' : 'var(--bg-surface)',
                color: severityFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                borderRadius: 0,
                border: 'none',
                fontWeight: severityFilter === 'ALL' ? 600 : 400,
                fontSize: '11px',
              }}
            >
              Todos ({currentCriticalCount + currentWarningCount})
            </button>
            <button
              type="button"
              onClick={() => setSeverityFilter('critical')}
              className="btn btn-sm"
              style={{
                backgroundColor: severityFilter === 'critical' ? 'var(--danger)' : 'var(--bg-surface)',
                color: severityFilter === 'critical' ? '#ffffff' : 'var(--text-secondary)',
                borderRadius: 0,
                border: 'none',
                fontWeight: severityFilter === 'critical' ? 600 : 400,
                fontSize: '11px',
              }}
            >
              Críticos ({currentCriticalCount})
            </button>
            <button
              type="button"
              onClick={() => setSeverityFilter('warning')}
              className="btn btn-sm"
              style={{
                backgroundColor: severityFilter === 'warning' ? 'var(--warning)' : 'var(--bg-surface)',
                color: severityFilter === 'warning' ? '#ffffff' : 'var(--text-secondary)',
                borderRadius: 0,
                border: 'none',
                fontWeight: severityFilter === 'warning' ? 600 : 400,
                fontSize: '11px',
              }}
            >
              Atenção ({currentWarningCount})
            </button>

          </div>
        </div>
      </div>

      {/* Conteúdo: Agrupado por Moeda */}
      {loading ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          Analisando prazos, saldos e projeções financeiras...
        </div>
      ) : totalCount === 0 ? (
        <div
          style={{
            padding: '1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <span style={{ fontSize: '24px' }}>✅</span>
          <p style={{ margin: '0.4rem 0 0 0', fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
            Nenhum alerta financeiro pendente
          </p>
          <p style={{ margin: '0.15rem 0 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
            Todos os pagamentos, recebimentos, faturas e projeções de liquidez estão regulares.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* BLOCO EUR (PORTUGAL) */}
          {(currencyFilter === 'ALL' || currencyFilter === 'EUR') && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.5rem',
                  paddingBottom: '0.3rem',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span style={{ fontSize: '16px' }}>🇵🇹</span>
                  <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    Portugal / EUR ({eurList.length})
                  </strong>
                </div>
                <span className="badge" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-primary)', fontSize: '10px' }}>
                  EUR
                </span>
              </div>

              {eurList.length === 0 ? (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    fontStyle: 'italic',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  Nenhum alerta ativo em EUR.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {eurList.map((alert) => (
                    <AlertItemCard key={alert.id} alert={alert} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* BLOCO BRL (BRASIL) */}
          {(currencyFilter === 'ALL' || currencyFilter === 'BRL') && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.5rem',
                  paddingBottom: '0.3rem',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span style={{ fontSize: '16px' }}>🇧🇷</span>
                  <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    Brasil / BRL ({brlList.length})
                  </strong>
                </div>
                <span className="badge" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-primary)', fontSize: '10px' }}>
                  BRL
                </span>
              </div>

              {brlList.length === 0 ? (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    fontStyle: 'italic',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  Nenhum alerta ativo em BRL.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {brlList.map((alert) => (
                    <AlertItemCard key={alert.id} alert={alert} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface AlertItemCardProps {
  alert: FinancialAlert;
}

const AlertItemCard: React.FC<AlertItemCardProps> = ({ alert }) => {
  const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: 'var(--bg-surface-elevated)',
        borderLeft: `4px solid ${config.borderColor}`,
        borderTop: '1px solid var(--border-subtle)',
        borderRight: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', flex: 1, minWidth: '260px' }}>
        <span style={{ fontSize: '16px', marginTop: '2px' }}>{config.icon}</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span
              className="badge"
              style={{
                backgroundColor: config.bgColor,
                color: config.color,
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              {config.label}
            </span>

            <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
              {alert.title}
            </strong>

            {alert.quotation_reference && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                ({alert.quotation_reference})
              </span>
            )}
          </div>

          <p style={{ margin: '0.2rem 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            {alert.message}
          </p>
        </div>
      </div>

      {/* Ação Rápida */}
      {alert.action && (
        <div>
          {alert.action.url.startsWith('/') ? (
            <Link
              to={alert.action.url}
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
            >
              {alert.action.label} &rarr;
            </Link>
          ) : (
            <a
              href={alert.action.url}
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
            >
              {alert.action.label} &rarr;
            </a>
          )}
        </div>
      )}
    </div>
  );
};
