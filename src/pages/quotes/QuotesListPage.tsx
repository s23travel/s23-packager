import React, { useEffect, useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { quotationsService } from '../../services/quotationsService';
import { Quotation } from '../../types';
import { StatusBadge } from '../../components/common/Badge';
import { FeedbackBanner } from '../../components/common/FeedbackBanner';

export const QuotesListPage: React.FC = () => {
  const location = useLocation();
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    (location.state as any)?.message
      ? { type: 'success', message: (location.state as any).message }
      : null
  );

  const loadQuotes = async () => {
    try {
      setLoading(true);
      const data = await quotationsService.listQuotations();
      setQuotes(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao listar cotações.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotes();
  }, []);

  const handleDelete = async (id: string, reference: string) => {
    if (!window.confirm(`Deseja realmente excluir a cotação ${reference}?`)) return;
    try {
      await quotationsService.deleteQuotation(id);
      setFeedback({ type: 'success', message: `Cotação ${reference} excluída com sucesso.` });
      setQuotes((prev) => prev.filter((q) => q.id !== id));
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao excluir cotação: ${err.message}` });
    }
  };

  const filteredQuotes = useMemo(() => {
    if (!searchTerm.trim()) return quotes;
    const term = searchTerm.toLowerCase();
    return quotes.filter((q) => {
      const client = q.client_name?.toLowerCase() || '';
      const ref = q.reference?.toLowerCase() || '';
      const origin = (q.origin_package_name || q.data?.originPackageName || '')?.toLowerCase();
      const curr = q.currency?.toLowerCase() || '';
      const dest = (
        q.data?.destination ||
        q.data?.lodging?.find((l) => l.destination)?.destination ||
        q.data?.lodging?.[0]?.destination ||
        q.data?.lodging?.[0]?.name ||
        ''
      )?.toLowerCase();
      return (
        client.includes(term) ||
        ref.includes(term) ||
        origin.includes(term) ||
        curr.includes(term) ||
        dest.includes(term)
      );
    });
  }, [quotes, searchTerm]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Central de cotações</h1>
          <p className="page-subtitle">
            Cotações comerciais personalizadas derivadas de pacotes ou elaboradas de forma avulsa.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <Link to="/pacotes" className="btn btn-secondary">
            Ver Catálogo de Pacotes
          </Link>
          <Link to="/cotacoes/novo" className="btn btn-primary">
            + Nova Cotação
          </Link>
        </div>
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
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Carregando cotações...</p>
        </div>
      ) : quotes.length === 0 ? (
        <div className="placeholder-view">
          <h3>Nenhuma cotação gerada</h3>
          <p>Você pode emitir uma cotação avulsa ou clonar diretamente a partir de um pacote base do catálogo.</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem' }}>
            <Link to="/pacotes" className="btn btn-primary">
              Escolher pacote para cotar
            </Link>
            <Link to="/cotacoes/novo" className="btn btn-secondary">
              Criar cotação avulsa
            </Link>
          </div>
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
                placeholder="Buscar por cliente, ref, origem..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Mostrando <strong>{filteredQuotes.length}</strong> de {quotes.length} cotação(ões)
            </div>
          </div>

          {filteredQuotes.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Nenhuma cotação encontrada para "<strong>{searchTerm}</strong>".
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Referência</th>
                    <th>Cliente</th>
                    <th>Destino / Cidade</th>
                    <th>Origem</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Data</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotes.map((q) => {
                    const originName = q.origin_package_name || q.data?.originPackageName;
                    const destination =
                      q.data?.destination ||
                      q.data?.lodging?.find((l) => l.destination)?.destination ||
                      q.data?.lodging?.[0]?.destination ||
                      q.data?.lodging?.[0]?.name ||
                      '—';
                    const salePrice = q.data?.financials?.salePrice ?? q.data?.financials?.priceTotal?.amount;
                    const formattedPrice =
                      typeof salePrice === 'number' && salePrice > 0
                        ? `${q.currency} ${salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : '—';

                    return (
                      <tr key={q.id}>
                        <td>
                          <Link to={`/cotacoes/${q.id}`} className="table-link-highlight">
                            <code>{q.reference}</code>
                          </Link>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500, color: q.client_name ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {q.client_name || 'Sem cliente definido'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                          {destination}
                        </td>
                        <td>
                          {q.package_id ? (
                            <Link to={`/pacotes/${q.package_id}`} className="table-link-secondary" title="Ver pacote de origem">
                              {originName || 'Pacote Base'}
                            </Link>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Avulsa</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                          {formattedPrice}
                        </td>
                        <td>
                          <StatusBadge status={q.status} />
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                          {new Date(q.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="table-actions">
                            <Link to={`/cotacoes/${q.id}`} className="btn btn-sm btn-secondary">
                              Ver
                            </Link>
                            <Link to={`/cotacoes/${q.id}/editar`} className="btn btn-sm btn-secondary">
                              Editar
                            </Link>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger-outline"
                              onClick={() => handleDelete(q.id, q.reference)}
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
