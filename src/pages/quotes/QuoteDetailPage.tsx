import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { quotationsService } from '../../services/quotationsService';
import { financialService } from '../../services/financialService';
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
  const [financialOp, setFinancialOp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [hasFinancialOperation, setHasFinancialOperation] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(
    (location.state as any)?.message
      ? {
          type: (location.state as any)?.type === 'error' ? 'error' : 'success',
          message: (location.state as any).message,
        }
      : null
  );

  const loadQuote = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await quotationsService.getQuotationById(id);
      setQuote(data);
      if (data) {
        const op = await financialService.getOperationByQuotationId(data.id);
        setFinancialOp(op);
        setHasFinancialOperation(Boolean(op));
      }
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
      if (newStatus === 'accepted') {
        const existingOp = await financialService.getOperationByQuotationId(quote.id);
        if (existingOp) {
          setFinancialOp(existingOp);
          setHasFinancialOperation(true);
          setFeedback({ type: 'success', message: 'Cotação aprovada. Financeiro preparado.' });
          return;
        }
        await financialService.approveQuotationAndCreateOperation(quote.id);
        const updated = await quotationsService.getQuotationById(quote.id);
        if (updated) setQuote(updated);
        const newOp = await financialService.getOperationByQuotationId(quote.id);
        setFinancialOp(newOp);
        setHasFinancialOperation(true);
        setFeedback({ type: 'success', message: 'Cotação aprovada. Financeiro preparado.' });
      } else {
        const updated = await quotationsService.updateQuotation(quote.id, { status: newStatus });
        setQuote(updated);
        setFeedback({ type: 'success', message: `Status da cotação atualizado para "${newStatus}".` });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao atualizar status da cotação.' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleArchive = async () => {
    if (!quote) return;
    if (financialOp && financialOp.status === 'active') {
      setFeedback({
        type: 'error',
        message:
          'Não é permitido arquivar uma cotação com operação financeira ativa. Cancele primeiro a operação no módulo financeiro.',
      });
      return;
    }

    if (
      !window.confirm(
        `Deseja arquivar a cotação ${quote.reference}? Ela deixará de ser exibida nas listas normais e operacionais, mas todo o histórico financeiro e seus dados serão preservados.`
      )
    ) {
      return;
    }

    try {
      setUpdatingStatus(true);
      const updated = await quotationsService.archiveQuotation(quote.id);
      setQuote(updated);
      setFeedback({
        type: 'success',
        message: 'Cotação arquivada com sucesso. O histórico financeiro permanece intacto.',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao arquivar: ${err.message}` });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleUnarchive = async () => {
    if (!quote) return;
    try {
      setUpdatingStatus(true);
      const updated = await quotationsService.unarchiveQuotation(quote.id);
      setQuote(updated);
      setFeedback({
        type: 'success',
        message: 'Cotação restaurada com sucesso para as listas operacionais normais.',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao desarquivar: ${err.message}` });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!quote) return;
    if (quote.archived_at) {
      setFeedback({
        type: 'info',
        message: 'Esta cotação está arquivada para preservar o histórico e não permite exclusão física.',
      });
      return;
    }
    if (hasFinancialOperation) {
      if (financialOp?.status === 'cancelled') {
        setFeedback({
          type: 'info',
          message: `A cotação ${quote.reference} possui histórico financeiro cancelado e não pode ser excluída fisicamente. Utilize a opção de arquivamento.`,
        });
      } else {
        setFeedback({
          type: 'info',
          message: `A cotação ${quote.reference} possui operação financeira ativa vinculada e não pode ser excluída para preservar o histórico financeiro.`,
        });
      }
      return;
    }
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
  let origin = rawData.origin || '';
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
    if (!origin && normalized.origin) {
      origin = normalized.origin;
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
            {quote.archived_at && (
              <span
                className="badge"
                style={{
                  backgroundColor: 'var(--bg-tertiary, #e2e8f0)',
                  color: 'var(--text-muted, #475569)',
                  fontWeight: 600,
                }}
              >
                ARQUIVADA
              </span>
            )}
          </div>
          <h1 className="page-title">
            {quote.client_name ? `Cotação para ${quote.client_name}` : `Cotação ${quote.reference}`}
          </h1>
          <p className="page-subtitle">
            Moeda: <strong>{quote.currency}</strong> • Criada em {new Date(quote.created_at).toLocaleDateString('pt-BR')} • Atualizada em {new Date(quote.updated_at).toLocaleDateString('pt-BR')}
          </p>
        </div>

        <div className="header-actions">
          {hasFinancialOperation && (
            <Link to={`/cotacoes/${quote.id}/financeiro`} className="btn btn-secondary">
              Financeiro
            </Link>
          )}
          <Link to={`/cotacoes/${quote.id}/editar`} className="btn btn-primary">
            Editar Cotação
          </Link>

          {/* Se a cotação estiver arquivada: NÃO oferece exclusão física */}
          {quote.archived_at ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleUnarchive}
              disabled={updatingStatus}
              title="Restaurar cotação para as listas normais ativas"
            >
              Desarquivar
            </button>
          ) : (
            /* Se a cotação estiver ativa: */
            <>
              {hasFinancialOperation ? (
                financialOp?.status === 'cancelled' ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleArchive}
                    disabled={updatingStatus}
                    title="A operação financeira vinculada está cancelada. Arquive para ocultar a cotação sem perder histórico contábil."
                  >
                    Arquivar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-danger-outline"
                    onClick={handleDelete}
                    title="Esta cotação possui operação financeira ativa vinculada e não pode ser excluída para preservar o histórico financeiro."
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  >
                    Excluir
                  </button>
                )
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleArchive}
                    disabled={updatingStatus}
                    title="Arquivar cotação"
                  >
                    Arquivar
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger-outline"
                    onClick={handleDelete}
                    title="Excluir cotação"
                  >
                    Excluir
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {/* Banner de Cotação Arquivada */}
      {quote.archived_at && (
        <div
          className="card"
          style={{
            backgroundColor: 'var(--bg-tertiary, #f8fafc)',
            borderLeft: '4px solid #64748b',
            marginBottom: '1.25rem',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
              📦 Cotação Arquivada
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
              Esta cotação foi arquivada em {new Date(quote.archived_at).toLocaleString('pt-BR')}.
              Ela não é exibida nas listas normais e operacionais. Seu histórico, proposta e operação financeira associados permanecem 100% preservados.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={handleUnarchive}
            disabled={updatingStatus}
            title="Restaurar cotação para as listas normais ativas"
          >
            Desarquivar
          </button>
        </div>
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
        <span>Status Comercial:</span>
        <div className="btn-group">
          {(hasFinancialOperation || quote.status === 'accepted'
            ? (['accepted'] as QuotationStatus[])
            : (['draft', 'sent', 'accepted', 'rejected', 'archived'] as QuotationStatus[])
          ).map((st) => (
            <button
              key={st}
              type="button"
              className={`btn btn-sm ${quote.status === st ? 'btn-primary' : 'btn-secondary'}`}
              disabled={updatingStatus || quote.status === st || Boolean(quote.archived_at)}
              title={quote.archived_at ? 'Cotação arquivada. Desarquive para alterar o status.' : undefined}
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
          {origin && (
            <div className="detail-row">
              <span className="detail-label">Origem:</span>
              <span className="detail-value" style={{ fontWeight: 600 }}>
                {origin}
              </span>
            </div>
          )}
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

