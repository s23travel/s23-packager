import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { packagesService } from '../../services/packagesService';
import { quotationsService } from '../../services/quotationsService';
import { Package } from '../../types';
import { StatusBadge } from '../../components/common/Badge';
import { FeedbackBanner } from '../../components/common/FeedbackBanner';

export const PackagesListPage: React.FC = () => {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<Package[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const data = await packagesService.listPackages();
      setPackages(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Falha ao carregar pacotes.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const handleCloneToQuotation = async (pkg: Package) => {
    try {
      setCloningId(pkg.id);
      setFeedback(null);
      const newQuote = await quotationsService.createQuotationFromPackage(pkg.id);
      navigate(`/cotacoes/${newQuote.id}/editar`, {
        state: { message: `Cotação ${newQuote.reference} criada com sucesso a partir de "${pkg.name}".` },
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao criar cotação: ${err.message}` });
      setCloningId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o pacote "${name}"?`)) return;
    try {
      await packagesService.deletePackage(id);
      setFeedback({ type: 'success', message: `Pacote "${name}" excluído com sucesso.` });
      setPackages((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao excluir pacote: ${err.message}` });
    }
  };

  const filteredPackages = useMemo(() => {
    if (!searchTerm.trim()) return packages;
    const term = searchTerm.toLowerCase();
    return packages.filter((pkg) => {
      const name = pkg.name?.toLowerCase() || '';
      const ref = pkg.reference?.toLowerCase() || '';
      const curr = pkg.base_currency?.toLowerCase() || '';
      const hotel = pkg.data?.lodging?.[0]?.name?.toLowerCase() || '';
      const dest = pkg.data?.lodging?.[0]?.destination?.toLowerCase() || '';
      return name.includes(term) || ref.includes(term) || curr.includes(term) || dest.includes(term) || hotel.includes(term);
    });
  }, [packages, searchTerm]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pacotes de viagem</h1>
          <p className="page-subtitle">
            Catálogo operacional de pacotes base para geração de cotações personalizadas.
          </p>
        </div>
        <Link to="/pacotes/novo" className="btn btn-primary">
          + Novo Pacote
        </Link>
      </div>

      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Carregando catálogo de pacotes...</p>
        </div>
      ) : packages.length === 0 ? (
        <div className="placeholder-view">
          <h3>Nenhum pacote cadastrado</h3>
          <p>Cadastre o primeiro pacote base para começar a emitir cotações personalizadas.</p>
          <Link to="/pacotes/novo" className="btn btn-primary">
            Cadastrar primeiro pacote
          </Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Barra de Pesquisa e Filtros */}
          <div className="table-toolbar">
            <div className="search-input-wrapper">
              <span className="search-icon">⚲</span>
              <input
                type="text"
                className="search-input"
                placeholder="Buscar por nome, ref, destino..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Mostrando <strong>{filteredPackages.length}</strong> de {packages.length} pacote(s)
            </div>
          </div>

          {filteredPackages.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Nenhum pacote encontrado para "<strong>{searchTerm}</strong>".
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Referência</th>
                    <th>Nome do pacote</th>
                    <th>Destino e duração</th>
                    <th>Status</th>
                    <th>Moeda</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPackages.map((pkg) => {
                    const destination = pkg.data?.lodging?.[0]?.destination || pkg.data?.lodging?.[0]?.name || '—';
                    const duration = pkg.data?.dates?.durationDays ? `${pkg.data.dates.durationDays} dias` : null;

                    return (
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
                        <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                          <span>{destination}</span>
                          {duration && <span style={{ color: 'var(--text-muted)' }}> • {duration}</span>}
                        </td>
                        <td>
                          <StatusBadge status={pkg.status} />
                        </td>
                        <td>
                          <span className="badge badge-neutral">{pkg.base_currency}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="btn btn-sm btn-action-primary"
                              onClick={() => handleCloneToQuotation(pkg)}
                              disabled={cloningId === pkg.id}
                              title="Emitir nova cotação a partir deste pacote"
                            >
                              {cloningId === pkg.id ? 'Criando...' : 'Nova Cotação'}
                            </button>
                            <Link to={`/pacotes/${pkg.id}`} className="btn btn-sm btn-secondary">
                              Ver
                            </Link>
                            <Link to={`/pacotes/${pkg.id}/editar`} className="btn btn-sm btn-secondary">
                              Editar
                            </Link>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger-outline"
                              onClick={() => handleDelete(pkg.id, pkg.name)}
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
