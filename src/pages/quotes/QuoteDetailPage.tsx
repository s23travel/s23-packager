import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { quotationsService } from '../../services/quotationsService';
import { Quotation, QuotationStatus, ServiceItem } from '../../types';
import { StatusBadge } from '../../components/common/Badge';
import { FeedbackBanner } from '../../components/common/FeedbackBanner';
import { FinancialEditor } from '../../components/finance/FinancialEditor';
import { WhatsAppMessagePreview } from '../../components/whatsapp/WhatsAppMessagePreview';
import { ServicesDetailView } from '../../components/common/ServicesDetailView';
import { isLegacyPackageData, normalizeLegacyToNewStructure, serviceItemToCostComponent } from '../../services/legacyAdapterService';

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

  const rawData = quote.data || {};

  // Normalização transparente de legados vs. novos dados
  let services: ServiceItem[] = [];
  let destination = rawData.destination || '';
  let paymentConditions = rawData.paymentConditions || '';
  let localTaxNotes = rawData.localTaxNotes || '';
  let extraServicesNotes = rawData.extraServicesNotes || '';
  let customNotes = rawData.customNotes || '';

  if (Array.isArray(rawData.services) && rawData.services.length > 0) {
    services = rawData.services;
  } else if (isLegacyPackageData(rawData) || !Array.isArray(rawData.services)) {
    const normalized = normalizeLegacyToNewStructure(rawData);
    services = normalized.services || [];
    if (!destination && normalized.destination) {
      destination = normalized.destination;
    }
    if (!paymentConditions && normalized.paymentConditions) paymentConditions = normalized.paymentConditions;
    if (!localTaxNotes && normalized.localTaxNotes) localTaxNotes = normalized.localTaxNotes;
    if (!extraServicesNotes && normalized.extraServicesNotes) extraServicesNotes = normalized.extraServicesNotes;
    if (!customNotes && normalized.customNotes) customNotes = normalized.customNotes;
  }

  const costComponents = rawData.financials?.components?.length
    ? rawData.financials.components
    : services.map(serviceItemToCostComponent);

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
          <span style={{ flex: 1 }}>
            Cotação vinculada ao pacote <strong>{quote.origin_package_name || rawData.originPackageName || 'Base'}</strong>. Os dados estão preservados para esta proposta.
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

      {/* Painel de Identificação e Logística */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <h3 className="card-title">Dados do Cliente, Destino & Logística</h3>
        <div className="detail-rows">
          <div className="detail-row">
            <span className="detail-label">Cliente / Solicitante:</span>
            <span className="detail-value" style={{ fontWeight: 600 }}>
              {quote.client_name || 'Não informado'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Destino Principal:</span>
            <span className="detail-value" style={{ fontWeight: 600 }}>
              {destination || 'Não especificado'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Período da Viagem:</span>
            <span className="detail-value">
              {rawData.dates?.startDate ? `${rawData.dates.startDate} até ${rawData.dates.endDate || '—'}` : 'A definir'}
              {rawData.dates?.durationDays
                ? ` (${rawData.dates.durationDays} dias, ${rawData.dates.durationNights ?? Math.max(0, rawData.dates.durationDays - 1)} noites)`
                : ''}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Passageiros:</span>
            <span className="detail-value">
              {rawData.passengers
                ? `${rawData.passengers.adults || 2} Adultos, ${rawData.passengers.children || 0} Crianças${rawData.passengers.infants ? `, ${rawData.passengers.infants} Bebês` : ''}`
                : '2 Adultos'}
            </span>
          </div>
        </div>
      </div>

      {/* Serviços e Itinerário da Cotação (Tabela Única Consolidada) */}
      <div style={{ marginTop: '1.25rem' }}>
        <ServicesDetailView
          title="Serviços e Itinerário da Cotação"
          services={services}
          currency={quote.currency}
          emptyMessage="Nenhum serviço cadastrado nesta cotação."
        />
      </div>

      {/* Condições Comerciais e Observações */}
      {(paymentConditions || localTaxNotes || extraServicesNotes || customNotes) && (
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <h3 className="card-title">Condições Comerciais e Observações</h3>
          <div className="detail-rows">
            {paymentConditions && (
              <div className="detail-row">
                <span className="detail-label">Condição de Pagamento:</span>
                <span className="detail-value">{paymentConditions}</span>
              </div>
            )}
            {localTaxNotes && (
              <div className="detail-row">
                <span className="detail-label">Taxa Local na Hospedagem:</span>
                <span className="detail-value">{localTaxNotes}</span>
              </div>
            )}
            {extraServicesNotes && (
              <div className="detail-row">
                <span className="detail-label">Serviços Extras / Opcionais:</span>
                <span className="detail-value">{extraServicesNotes}</span>
              </div>
            )}
            {customNotes && (
              <div className="detail-row">
                <span className="detail-label">Observações da Proposta:</span>
                <span className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{customNotes}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seção Financeiro (Motor Financeiro - Fase 4) */}
      <div style={{ marginTop: '1.5rem' }}>
        <FinancialEditor
          currency={quote.currency}
          components={costComponents}
          onChangeComponents={() => {}}
          salePrice={
            typeof rawData.financials?.salePrice === 'number'
              ? rawData.financials.salePrice
              : rawData.financials?.priceTotal?.amount || 0
          }
          onChangeSalePrice={() => {}}
          exchangeRate={quote.exchange_rate ?? rawData.financials?.exchangeRateUsed ?? null}
          exchangeRateDate={quote.exchange_rate_date ?? null}
          passengers={rawData.passengers}
          readOnly={true}
        />
      </div>

      {/* Seção WhatsApp (Fase 5) */}
      <div style={{ marginTop: '1.5rem' }}>
        <WhatsAppMessagePreview quotation={quote} />
      </div>
    </div>
  );
};

