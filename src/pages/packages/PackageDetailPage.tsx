import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { packagesService } from '../../services/packagesService';
import { quotationsService } from '../../services/quotationsService';
import { Package, PackageStatus } from '../../types';
import { StatusBadge } from '../../components/common/Badge';
import { FeedbackBanner } from '../../components/common/FeedbackBanner';
import { FinancialEditor } from '../../components/finance/FinancialEditor';
import { AIContentGenerator } from '../../components/ai/AIContentGenerator';

export const PackageDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [pkg, setPkg] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    (location.state as any)?.message
      ? { type: 'success', message: (location.state as any).message }
      : null
  );

  const loadPackage = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await packagesService.getPackageById(id);
      setPkg(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao carregar pacote.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackage();
  }, [id]);

  const handleCloneToQuotation = async () => {
    if (!pkg) return;
    try {
      setCloning(true);
      setFeedback(null);
      const newQuote = await quotationsService.createQuotationFromPackage(pkg.id);
      navigate(`/cotacoes/${newQuote.id}/editar`, {
        state: { message: `Cotação ${newQuote.reference} criada via snapshot independente a partir de "${pkg.name}".` },
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao clonar cotação: ${err.message}` });
      setCloning(false);
    }
  };

  const handleStatusChange = async (newStatus: PackageStatus) => {
    if (!pkg) return;
    try {
      setUpdatingStatus(true);
      const updated = await packagesService.updatePackage(pkg.id, { status: newStatus });
      setPkg(updated);
      setFeedback({ type: 'success', message: `Status alterado para "${newStatus}".` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao alterar status: ${err.message}` });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!pkg) return;
    if (!window.confirm(`Deseja realmente excluir o pacote "${pkg.name}"?`)) return;

    try {
      await packagesService.deletePackage(pkg.id);
      navigate('/pacotes', {
        state: { message: `Pacote "${pkg.name}" excluído.` },
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao excluir pacote: ${err.message}` });
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Carregando detalhes do pacote...</p>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="placeholder-view">
        <h3>Pacote não encontrado</h3>
        <p>O pacote solicitado não existe ou foi excluído.</p>
        <Link to="/pacotes" className="btn btn-primary">
          Voltar para Pacotes
        </Link>
      </div>
    );
  }

  const d = pkg.data || {};

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <span className="badge badge-neutral"><code>{pkg.reference}</code></span>
            <StatusBadge status={pkg.status} />
          </div>
          <h1 className="page-title">{pkg.name}</h1>
          <p className="page-subtitle">
            Moeda Base: <strong>{pkg.base_currency}</strong> • Criado em {new Date(pkg.created_at).toLocaleDateString('pt-BR')} • Atualizado em {new Date(pkg.updated_at).toLocaleDateString('pt-BR')}
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn btn-action-primary"
            onClick={handleCloneToQuotation}
            disabled={cloning}
          >
            {cloning ? 'Gerando Snapshot...' : '⚡ Nova Cotação a partir deste Pacote'}
          </button>
          <Link to={`/pacotes/${pkg.id}/editar`} className="btn btn-secondary">
            Editar
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

      {/* Barra de Status Rápida */}
      <div className="card quick-status-bar">
        <span>Alterar Status Rápido:</span>
        <div className="btn-group">
          {(['draft', 'active', 'archived'] as PackageStatus[]).map((st) => (
            <button
              key={st}
              type="button"
              className={`btn btn-sm ${pkg.status === st ? 'btn-primary' : 'btn-secondary'}`}
              disabled={updatingStatus || pkg.status === st}
              onClick={() => handleStatusChange(st)}
            >
              {st === 'draft' ? 'Rascunho' : st === 'active' ? 'Ativo' : 'Arquivado'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-cols-2" style={{ marginTop: '1.25rem' }}>
        {/* Painel Esquerdo: Logística e Itinerário */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 className="card-title">Datas & Passageiros</h3>
            <div className="detail-rows">
              <div className="detail-row">
                <span className="detail-label">Datas Previstas:</span>
                <span className="detail-value">
                  {d.dates?.startDate ? `${d.dates.startDate} até ${d.dates.endDate || '—'}` : 'Datas flexíveis / A definir'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Duração:</span>
                <span className="detail-value">
                  {d.dates?.durationDays ? `${d.dates.durationDays} dias` : '—'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Configuração de Passageiros:</span>
                <span className="detail-value">
                  {d.passengers ? `${d.passengers.adults || 2} Adultos, ${d.passengers.children || 0} Crianças` : '2 Adultos'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Operador / Fornecedor:</span>
                <span className="detail-value">{d.supplier || 'Não especificado'}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Transporte de Ida e Volta</h3>
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
        </div>

        {/* Painel Direito: Hospedagem e Valores */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 className="card-title">Hospedagem Base</h3>
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

          {d.additionalInfo && (
            <div className="card">
              <h3 className="card-title">Informações Adicionais</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {d.additionalInfo}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Seção Financeiro (Motor Financeiro - Fase 4) */}
      <div style={{ marginTop: '1.5rem' }}>
        <FinancialEditor
          currency={pkg.base_currency}
          components={d.financials?.components || []}
          onChangeComponents={() => {}}
          salePrice={
            typeof d.financials?.salePrice === 'number'
              ? d.financials.salePrice
              : d.financials?.priceTotal?.amount || 0
          }
          onChangeSalePrice={() => {}}
          passengers={d.passengers}
          readOnly={true}
        />
      </div>

      {/* Seção Conteúdo para Website (IA - Fase 6A) */}
      <div style={{ marginTop: '1.5rem' }}>
        <AIContentGenerator source={{ package: pkg }} />
      </div>
    </div>
  );
};
