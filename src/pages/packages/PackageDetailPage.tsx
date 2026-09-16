import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { packagesService } from '../../services/packagesService';
import { quotationsService } from '../../services/quotationsService';
import { Package, PackageStatus, ServiceItem } from '../../types';
import { StatusBadge } from '../../components/common/Badge';
import { FeedbackBanner } from '../../components/common/FeedbackBanner';
import { FinancialEditor } from '../../components/finance/FinancialEditor';
import { AIContentGenerator } from '../../components/ai/AIContentGenerator';
import { ServicesDetailView } from '../../components/common/ServicesDetailView';
import { isLegacyPackageData, normalizeLegacyToNewStructure, serviceItemToCostComponent } from '../../services/legacyAdapterService';

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
        state: { message: `Cotação ${newQuote.reference} criada com sucesso a partir de "${pkg.name}".` },
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao criar cotação: ${err.message}` });
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

  const rawData = pkg.data || {};

  // Normalização transparente de legados vs. novos dados
  let services: ServiceItem[] = [];
  let destination = rawData.destination || '';

  if (Array.isArray(rawData.services) && rawData.services.length > 0) {
    services = rawData.services;
  } else if (isLegacyPackageData(rawData) || !Array.isArray(rawData.services)) {
    const normalized = normalizeLegacyToNewStructure(rawData);
    services = normalized.services || [];
    if (!destination && normalized.destination) {
      destination = normalized.destination;
    }
  }

  const costComponents = rawData.financials?.components?.length
    ? rawData.financials.components
    : services.map(serviceItemToCostComponent);

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
            {cloning ? 'Criando cotação...' : 'Nova cotação a partir do pacote'}
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

      {/* Painel de Dados Principais e Destino */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <h3 className="card-title">Datas, Passageiros e Destino</h3>
        <div className="detail-rows">
          <div className="detail-row">
            <span className="detail-label">Destino Principal:</span>
            <span className="detail-value" style={{ fontWeight: 600 }}>
              {destination || 'Não especificado'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Datas:</span>
            <span className="detail-value">
              {rawData.dates?.startDate ? `${rawData.dates.startDate} até ${rawData.dates.endDate || '—'}` : 'Datas flexíveis / A definir'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Duração:</span>
            <span className="detail-value">
              {rawData.dates?.durationDays
                ? `${rawData.dates.durationDays} dias (${rawData.dates.durationNights ?? Math.max(0, rawData.dates.durationDays - 1)} noites)`
                : '—'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Configuração de Passageiros:</span>
            <span className="detail-value">
              {rawData.passengers ? `${rawData.passengers.adults || 2} Adultos, ${rawData.passengers.children || 0} Crianças` : '2 Adultos'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Operador / Fornecedor:</span>
            <span className="detail-value">{rawData.supplier || 'Não especificado'}</span>
          </div>
        </div>
      </div>

      {/* Serviços e Itinerário do Pacote (Tabela Única Consolidada) */}
      <div style={{ marginTop: '1.25rem' }}>
        <ServicesDetailView
          title="Serviços e Itinerário do Pacote"
          services={services}
          currency={pkg.base_currency}
          emptyMessage="Nenhum serviço cadastrado neste pacote."
        />
      </div>

      {rawData.additionalInfo && (
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <h3 className="card-title">Informações Adicionais</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
            {rawData.additionalInfo}
          </p>
        </div>
      )}

      {/* Seção Financeiro (Motor Financeiro - Fase 4) */}
      <div style={{ marginTop: '1.5rem' }}>
        <FinancialEditor
          currency={pkg.base_currency}
          components={costComponents}
          onChangeComponents={() => {}}
          salePrice={
            typeof rawData.financials?.salePrice === 'number'
              ? rawData.financials.salePrice
              : rawData.financials?.priceTotal?.amount || 0
          }
          onChangeSalePrice={() => {}}
          passengers={rawData.passengers}
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

