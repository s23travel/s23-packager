import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { quotationsService } from '../../services/quotationsService';
import { Quotation } from '../../types';
import { StatusBadge } from '../../components/common/Badge';
import { FeedbackBanner } from '../../components/common/FeedbackBanner';

export const QuotesListPage: React.FC = () => {
  const location = useLocation();
  const [quotes, setQuotes] = useState<Quotation[]>([]);
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Central de Cotações</h1>
          <p className="page-subtitle">
            Cotações geradas a partir de pacotes (snapshots independentes) ou emitidas avulsas.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/pacotes" className="btn btn-secondary">
            Ver Catálogo de Pacotes
          </Link>
          <Link to="/cotacoes/novo" className="btn btn-primary">
            + Nova Cotação Avulsa
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
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>Carregando cotações...</p>
        </div>
      ) : quotes.length === 0 ? (
        <div className="placeholder-view">
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
          <h3>Nenhuma cotação gerada</h3>
          <p>Você pode criar uma cotação avulsa ou clonar diretamente a partir de um pacote base.</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <Link to="/pacotes" className="btn btn-primary">
              Escolher Pacote para Cotar
            </Link>
            <Link to="/cotacoes/novo" className="btn btn-secondary">
              Criar Cotação Avulsa
            </Link>
          </div>
        </div>
      ) : (
        <div className="table-responsive card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Referência</th>
                <th>Cliente</th>
                <th>Pacote de Origem</th>
                <th>Status</th>
                <th>Moeda</th>
                <th>Data</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td>
                    <Link to={`/cotacoes/${q.id}`} className="table-link-highlight">
                      <code>{q.reference}</code>
                    </Link>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: q.client_name ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {q.client_name || 'Sem cliente definido'}
                    </span>
                  </td>
                  <td>
                    {q.package_id ? (
                      <Link to={`/pacotes/${q.package_id}`} className="table-link-secondary" title="Ver pacote original">
                        📦 {q.origin_package_name || 'Pacote Base'}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Avulsa / Direta</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={q.status} />
                  </td>
                  <td>
                    <span className="badge badge-neutral">{q.currency}</span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
