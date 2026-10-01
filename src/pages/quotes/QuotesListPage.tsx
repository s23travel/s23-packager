import React, { useEffect, useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { quotationsService } from '../../services/quotationsService';
import { Quotation } from '../../types';
import { StatusBadge } from '../../components/common/Badge';
import { FeedbackBanner } from '../../components/common/FeedbackBanner';

export const QuotesListPage: React.FC = () => {
  const location = useLocation();
  const [filterMode, setFilterMode] = useState<'active' | 'archived'>('active');
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(
    (location.state as any)?.message
      ? { type: 'success', message: (location.state as any).message }
      : null
  );

  const loadQuotes = async (mode: 'active' | 'archived' = filterMode) => {
    try {
      setLoading(true);
      // Garantia de que archived_at IS NULL é o padrão para listas ativas
      const data =
        mode === 'archived'
          ? await quotationsService.listQuotations({ archivedOnly: true })
          : await quotationsService.listQuotations();
      setQuotes(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao listar cotações.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotes(filterMode);
  }, [filterMode]);

  const handleArchive = async (quote: Quotation) => {
    if (quote.financial_operation_status === 'active') {
      setFeedback({
        type: 'error',
        message: `A cotação ${quote.reference} possui operação financeira ativa e não pode ser arquivada. É necessário cancelar a operação no financeiro antes de arquivar.`,
      });
      return;
    }

    if (
      !window.confirm(
        `Deseja arquivar a cotação ${quote.reference}? Ela deixará de ser exibida nas listas normais e operacionais, mantendo intactos todos os dados e o histórico financeiro.`
      )
    ) {
      return;
    }

    try {
      setActionInProgress(quote.id);
      await quotationsService.archiveQuotation(quote.id);
      setFeedback({
        type: 'success',
        message: `Cotação ${quote.reference} arquivada com sucesso. O histórico financeiro permanece intacto.`,
      });
      setQuotes((prev) => prev.filter((q) => q.id !== quote.id));
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao arquivar cotação: ${err.message}` });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUnarchive = async (quote: Quotation) => {
    try {
      setActionInProgress(quote.id);
      await quotationsService.unarchiveQuotation(quote.id);
      setFeedback({
        type: 'success',
        message: `Cotação ${quote.reference} restaurada para a lista ativa com sucesso.`,
      });
      setQuotes((prev) => prev.filter((q) => q.id !== quote.id));
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao desarquivar cotação: ${err.message}` });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (quote: Quotation) => {
    if (quote.has_financial_operation) {
      if (quote.financial_operation_status === 'cancelled') {
        setFeedback({
          type: 'info',
          message: `A cotação ${quote.reference} possui operação financeira vinculada ao histórico contábil e não pode ser excluída fisicamente. Utilize a opção de arquivamento.`,
        });
      } else {
        setFeedback({
          type: 'info',
          message: `A cotação ${quote.reference} possui operação financeira ativa vinculada e não pode ser excluída para preservar o histórico financeiro.`,
        });
      }
      return;
    }

    if (!window.confirm(`Deseja realmente excluir fisicamente a cotação ${quote.reference}?`)) return;
    try {
      setActionInProgress(quote.id);
      await quotationsService.deleteQuotation(quote.id);
      setFeedback({ type: 'success', message: `Cotação ${quote.reference} excluída com sucesso.` });
      setQuotes((prev) => prev.filter((q) => q.id !== quote.id));
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao excluir cotação: ${err.message}` });
    } finally {
      setActionInProgress(null);
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

      {/* Abas de Navegação Ativas vs. Arquivadas */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          type="button"
          className={`btn btn-sm ${filterMode === 'active' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterMode('active')}
        >
          Cotações Ativas
        </button>
        <button
          type="button"
          className={`btn btn-sm ${filterMode === 'archived' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterMode('archived')}
        >
          Arquivadas
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Carregando cotações...</p>
        </div>
      ) : quotes.length === 0 ? (
        <div className="placeholder-view">
          <h3>{filterMode === 'archived' ? 'Nenhuma cotação arquivada' : 'Nenhuma cotação gerada'}</h3>
          <p>
            {filterMode === 'archived'
              ? 'Cotações arquivadas com operações financeiras canceladas ou descontinuadas aparecerão aqui.'
              : 'Você pode emitir uma cotação avulsa ou clonar diretamente a partir de um pacote base do catálogo.'}
          </p>
          {filterMode === 'active' && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem' }}>
              <Link to="/pacotes" className="btn btn-primary">
                Escolher pacote para cotar
              </Link>
              <Link to="/cotacoes/novo" className="btn btn-secondary">
                Criar cotação avulsa
              </Link>
            </div>
          )}
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
              Mostrando <strong>{filteredQuotes.length}</strong> de {quotes.length} cotação(ões) {filterMode === 'archived' ? 'arquivada(s)' : 'ativa(s)'}
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
                          {q.archived_at && (
                            <span
                              style={{
                                display: 'inline-block',
                                marginLeft: '0.4rem',
                                fontSize: '10px',
                                textTransform: 'uppercase',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                backgroundColor: 'var(--bg-tertiary, #e2e8f0)',
                                color: 'var(--text-muted, #64748b)',
                              }}
                            >
                              Arquivada
                            </span>
                          )}
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

                            {/* Se arquivada: oferece Desarquivar, e NUNCA oferece exclusão física se houver operação financeira */}
                            {q.archived_at ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => handleUnarchive(q)}
                                  disabled={actionInProgress === q.id}
                                  title="Restaurar cotação para as listas normais ativas"
                                >
                                  Desarquivar
                                </button>
                                {!q.has_financial_operation && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-danger-outline"
                                    onClick={() => handleDelete(q)}
                                    disabled={actionInProgress === q.id}
                                    title="Excluir cotação sem operação financeira"
                                  >
                                    Excluir
                                  </button>
                                )}
                              </>
                            ) : (
                              /* Se ativa: */
                              <>
                                {q.has_financial_operation ? (
                                  q.financial_operation_status === 'cancelled' ? (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-secondary"
                                      onClick={() => handleArchive(q)}
                                      disabled={actionInProgress === q.id}
                                      title="A operação financeira vinculada foi cancelada. Arquive para ocultar a cotação sem perder histórico."
                                    >
                                      Arquivar
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-danger-outline"
                                      onClick={() => handleDelete(q)}
                                      title="Esta cotação possui operação financeira vinculada e precisa permanecer cadastrada para preservar o histórico financeiro."
                                      style={{ opacity: 0.6, cursor: 'not-allowed' }}
                                    >
                                      Excluir
                                    </button>
                                  )
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-secondary"
                                      onClick={() => handleArchive(q)}
                                      disabled={actionInProgress === q.id}
                                      title="Arquivar cotação"
                                    >
                                      Arquivar
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-danger-outline"
                                      onClick={() => handleDelete(q)}
                                      disabled={actionInProgress === q.id}
                                      title="Excluir cotação"
                                    >
                                      Excluir
                                    </button>
                                  </>
                                )}
                              </>
                            )}
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
