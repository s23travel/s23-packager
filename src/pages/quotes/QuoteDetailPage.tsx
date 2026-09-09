import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { quotationsService } from '../../services/quotationsService';
import { Quotation, QuotationStatus } from '../../types';
import { StatusBadge } from '../../components/common/Badge';
import { FeedbackBanner } from '../../components/common/FeedbackBanner';
import { FinancialEditor } from '../../components/finance/FinancialEditor';
import { WhatsAppMessagePreview } from '../../components/whatsapp/WhatsAppMessagePreview';
import { AIContentGenerator } from '../../components/ai/AIContentGenerator';

export const QuoteDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [quote, setQuote] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    (location.state as any)?.message
      ? { type: 'success', message: (location.state as any).message }
      : null
  );

  const loadQuote = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await quotationsService.getQuotationById(id);
      setQuote(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao carregar cotação.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuote();
  }, [id]);

  const handleStatusChange = async (newStatus: QuotationStatus) => {
    if (!quote) return;
    try {
      setUpdatingStatus(true);
      const updated = await quotationsService.updateQuotation(quote.id, { status: newStatus });
      setQuote(updated);
      setFeedback({ type: 'success', message: `Status da cotação atualizado para "${newStatus}".` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao atualizar status: ${err.message}` });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!quote) return;
    if (!window.confirm(`Deseja excluir a cotação ${quote.reference}?`)) return;

    try {
      await quotationsService.deleteQuotation(quote.id);
      navigate('/cotacoes', {
        state: { message: `Cotação ${quote.reference} excluída com sucesso.` },
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao excluir: ${err.message}` });
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Carregando detalhes da cotação...</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="placeholder-view">
        <h3>Cotação não encontrada</h3>
        <p>A cotação solicitada não existe ou foi excluída.</p>
        <Link to="/cotacoes" className="btn btn-primary">
          Voltar para Cotações
        </Link>
      </div>
    );
  }

  const d = quote.data || {};

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <span className="badge badge-neutral"><code>{quote.reference}</code></span>
            <StatusBadge status={quote.status} />
          </div>
          <h1 className="page-title">
            {quote.client_name ? `Cotação para ${quote.client_name}` : `Cotação ${quote.reference}`}
          </h1>
          <p className="page-subtitle">
            Moeda: <strong>{quote.currency}</strong> • Criada em {new Date(quote.created_at).toLocaleDateString('pt-BR')} • Atualizada em {new Date(quote.updated_at).toLocaleDateString('pt-BR')}
          </p>
        </div>

        <div className="header-actions">
          <Link to={`/cotacoes/${quote.id}/editar`} className="btn btn-primary">
            Editar Cotação
          </Link>
          <button type="button" className="btn btn-danger-outline" onClick={handleDelete}>
            Excluir
          </button>
        </div>
      </div>

      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {/* Aviso de Origem Discreto */}
      {quote.package_id && (
        <div className="notice-banner" style={{ marginBottom: '1.25rem' }}>
          <span>📦</span>
          <span style={{ flex: 1 }}>
            Cotação vinculada ao pacote <strong>{quote.origin_package_name || d.originPackageName || 'Base'}</strong>. Os dados estão preservados para esta proposta.
          </span>
          <Link to={`/pacotes/${quote.package_id}`} className="btn btn-sm btn-secondary" target="_blank">
            Ver Pacote Base ↗
          </Link>
        </div>
      )}

      {/* Barra de Status Rápida */}
      <div className="card quick-status-bar">
        <span>Alterar Status Comercial:</span>
        <div className="btn-group">
          {(['draft', 'sent', 'accepted', 'rejected', 'archived'] as QuotationStatus[]).map((st) => (
            <button
              key={st}
              type="button"
              className={`btn btn-sm ${quote.status === st ? 'btn-primary' : 'btn-secondary'}`}
              disabled={updatingStatus || quote.status === st}
              onClick={() => handleStatusChange(st)}
            >
              {st === 'draft'
                ? 'Rascunho'
                : st === 'sent'
                ? 'Enviada'
                : st === 'accepted'
                ? 'Aprovada'
                : st === 'rejected'
                ? 'Rejeitada'
                : 'Arquivada'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-cols-2" style={{ marginTop: '1.25rem' }}>
        {/* Painel Esquerdo: Logística e Cliente */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 className="card-title">Dados do Cliente & Logística</h3>
            <div className="detail-rows">
              <div className="detail-row">
                <span className="detail-label">Cliente / Solicitante:</span>
                <span className="detail-value" style={{ fontWeight: 600 }}>
                  {quote.client_name || 'Não informado'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Período da Viagem:</span>
                <span className="detail-value">
                  {d.dates?.startDate ? `${d.dates.startDate} até ${d.dates.endDate || '—'}` : 'A definir'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Passageiros:</span>
                <span className="detail-value">
                  {d.passengers ? `${d.passengers.adults || 2} Adultos, ${d.passengers.children || 0} Crianças` : '2 Adultos'}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Transportes</h3>
            <div className="detail-rows">
              <div className="detail-row">
                <span className="detail-label">Ida:</span>
                <span className="detail-value">{d.outboundTransport?.route || 'Não incluído'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Volta:</span>
                <span className="detail-value">{d.inboundTransport?.route || 'Não incluído'}</span>
              </div>
            </div>
          </div>

          {d.customNotes && (
            <div className="card">
              <h3 className="card-title">Notas da Proposta para o Cliente</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {d.customNotes}
              </p>
            </div>
          )}
        </div>

        {/* Painel Direito: Hospedagem */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 className="card-title">Hospedagem</h3>
            {d.lodging && d.lodging.length > 0 ? (
              <div className="detail-rows">
                {d.lodging.map((h, idx) => (
                  <div key={idx} className="detail-item-box">
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{h.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {h.destination} • {h.mealPlan || 'Regime padrão'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum hotel configurado.</p>
            )}
          </div>
        </div>
      </div>

      {/* Seção Financeiro (Motor Financeiro - Fase 4) */}
      <div style={{ marginTop: '1.5rem' }}>
        <FinancialEditor
          currency={quote.currency}
          components={d.financials?.components || []}
          onChangeComponents={() => {}}
          salePrice={
            typeof d.financials?.salePrice === 'number'
              ? d.financials.salePrice
              : d.financials?.priceTotal?.amount || 0
          }
          onChangeSalePrice={() => {}}
          exchangeRate={quote.exchange_rate ?? d.financials?.exchangeRateUsed ?? null}
          exchangeRateDate={quote.exchange_rate_date ?? null}
          passengers={d.passengers}
          readOnly={true}
        />
      </div>

      {/* Seção WhatsApp (Fase 5) */}
      <div style={{ marginTop: '1.5rem' }}>
        <WhatsAppMessagePreview quotation={quote} />
      </div>

      {/* Seção Conteúdo para Website (IA - Fase 6A) */}
      <div style={{ marginTop: '1.5rem' }}>
        <AIContentGenerator source={{ quotation: quote }} />
      </div>
    </div>
  );
};
