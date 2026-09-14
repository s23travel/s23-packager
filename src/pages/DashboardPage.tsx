import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { packagesService } from '../services/packagesService';
import { quotationsService } from '../services/quotationsService';
import { Package, Quotation } from '../types';
import { StatusBadge } from '../components/common/Badge';
import { Pagination } from '../components/common/Pagination';

const PAGE_SIZE = 8;

export const DashboardPage: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  // Paginação independente para cada lista
  const [packagePage, setPackagePage] = useState(1);
  const [quotePage, setQuotePage] = useState(1);

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

  // Manter estritamente a ordenação atual da Home (data de criação decrescente)
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

  // Regra 8: em caso de atualização dos dados, garantir que a página atual permaneça válida
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Topo / Page Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Visão geral</h1>
          <p className="page-subtitle">
            Gerencie pacotes e cotações da S23 em um só lugar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <Link to="/pacotes/novo" className="btn btn-secondary">
            + Novo Pacote
          </Link>
          <Link to="/cotacoes/novo" className="btn btn-primary">
            + Nova Cotação
          </Link>
        </div>
      </div>

      {/* Grid de Indicadores Principais (KPIs continuam representando o total real) */}
      <div className="grid-cols-2">
        <div className="kpi-card">
          <div>
            <div className="kpi-header">
              <span className="kpi-label">Catálogo de pacotes</span>
            </div>
            <div className="kpi-value">
              {loading ? '—' : packages.length}
            </div>
            <p className="kpi-subtitle">
              {loading
                ? 'Carregando...'
                : `${activePackagesCount} ativo(s) • ${packages.length - activePackagesCount} em rascunho`}
            </p>
          </div>
          <div className="kpi-footer">
            <Link to="/pacotes" className="table-link-title" style={{ fontSize: '13px' }}>
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
              <span className="kpi-label">Cotações emitidas</span>
            </div>
            <div className="kpi-value">
              {loading ? '—' : quotes.length}
            </div>
            <p className="kpi-subtitle">
              {loading
                ? 'Carregando...'
                : 'Total de propostas geradas no sistema'}
            </p>
          </div>
          <div className="kpi-footer">
            <Link to="/cotacoes" className="table-link-title" style={{ fontSize: '13px' }}>
              Ver todas as cotações &rarr;
            </Link>
            <Link to="/cotacoes/novo" className="btn btn-sm btn-action-primary">
              + Nova Cotação
            </Link>
          </div>
        </div>
      </div>

      {/* Seções de Atividade Recente com Paginação Independente */}
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
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Pacotes base
            </h3>
            <Link to="/pacotes" style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: 500 }}>
              Ver catálogo
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
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Cotações recentes
            </h3>
            <Link to="/cotacoes" style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: 500 }}>
              Ver todas
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

