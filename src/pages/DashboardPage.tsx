import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { packagesService } from '../services/packagesService';
import { quotationsService } from '../services/quotationsService';
import { Package, Quotation } from '../types';
import { StatusBadge } from '../components/common/Badge';

export const DashboardPage: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [pkgs, qts] = await Promise.all([
          packagesService.listPackages(),
          quotationsService.listQuotations(),
        ]);
        setPackages(pkgs);
        setQuotes(qts);
      } catch (e) {
        console.error('Erro ao carregar dados do dashboard:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const activePackagesCount = packages.filter((p) => p.status === 'active').length;
  const recentQuotes = [...quotes]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const recentPackages = [...packages]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Topo / Page Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Visão geral</h1>
          <p className="page-subtitle">
            Gerencie pacotes e cotações da S23 em um só lugar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/pacotes/novo" className="btn btn-secondary">
            + Novo Pacote
          </Link>
          <Link to="/cotacoes/novo" className="btn btn-primary">
            + Nova Cotação
          </Link>
        </div>
      </div>

      {/* Grid de Indicadores Principais */}
      <div className="grid-cols-2">
        <div className="kpi-card">
          <div>
            <div className="kpi-header">
              <span className="kpi-label">Catálogo de Pacotes</span>
              <div className="kpi-icon">📦</div>
            </div>
            <div className="kpi-value">
              {loading ? '—' : packages.length}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {loading
                ? 'Carregando catálogo...'
                : `${activePackagesCount} ativo(s) • ${packages.length - activePackagesCount} em rascunho`}
            </p>
          </div>
          <div className="kpi-footer">
            <Link to="/pacotes" className="table-link-title" style={{ fontSize: '0.85rem' }}>
              Ver todos os pacotes &rarr;
            </Link>
            <Link to="/pacotes/novo" className="btn btn-sm btn-secondary">
              + Cadastrar
            </Link>
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-header">
              <span className="kpi-label">Cotações Emitidas</span>
              <div className="kpi-icon">📋</div>
            </div>
            <div className="kpi-value">
              {loading ? '—' : quotes.length}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {loading
                ? 'Carregando cotações...'
                : `Total de propostas geradas no sistema`}
            </p>
          </div>
          <div className="kpi-footer">
            <Link to="/cotacoes" className="table-link-title" style={{ fontSize: '0.85rem' }}>
              Ver todas as cotações &rarr;
            </Link>
            <Link to="/cotacoes/novo" className="btn btn-sm btn-action-primary">
              + Nova Cotação
            </Link>
          </div>
        </div>
      </div>

      {/* Seções de Atividade Recente */}
      <div className="grid-cols-2" style={{ alignItems: 'flex-start' }}>
        {/* Cotações Recentes */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Cotações Recentes
              </h3>
            </div>
            <Link to="/cotacoes" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 500 }}>
              Ver todas
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Carregando cotações recentes...
            </div>
          ) : recentQuotes.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhuma cotação registrada ainda.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Cliente</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {recentQuotes.map((q) => (
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
          )}
        </div>

        {/* Pacotes Recentes */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Pacotes Base
              </h3>
            </div>
            <Link to="/pacotes" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 500 }}>
              Ver catálogo
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Carregando pacotes...
            </div>
          ) : recentPackages.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhum pacote cadastrado.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Nome do Pacote</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPackages.map((pkg) => (
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
          )}
        </div>
      </div>
    </div>
  );
};
