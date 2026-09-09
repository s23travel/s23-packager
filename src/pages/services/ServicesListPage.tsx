import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FavoriteService,
  FavoriteServiceType,
  FAVORITE_SERVICE_TYPE_LABELS,
} from '../../types';
import { favoriteServicesService, ListServicesFilters } from '../../services/favoriteServicesService';
import { FeedbackBanner } from '../../components/common/FeedbackBanner';

type StatusFilter = 'all' | 'active' | 'inactive';

const TYPE_FILTER_OPTIONS: { value: FavoriteServiceType | 'all'; label: string }[] = [
  { value: 'all',        label: 'Todos' },
  { value: 'hotel',      label: 'Hotéis' },
  { value: 'airline',    label: 'Companhias aéreas' },
  { value: 'transfer',   label: 'Transfers' },
  { value: 'tour',       label: 'Passeios / Excursões' },
  { value: 'insurance',  label: 'Seguros' },
  { value: 'car_rental', label: 'Aluguer de carros' },
  { value: 'additional', label: 'Serviços adicionais' },
  { value: 'other',      label: 'Outros' },
];

interface DeactivateModalProps {
  service: FavoriteService;
  onConfirm: () => void;
  onCancel: () => void;
  processing?: boolean;
}

const DeactivateModal: React.FC<DeactivateModalProps> = ({ service, onConfirm, onCancel, processing }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="deactivate-title"
  >
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '1.5rem',
        maxWidth: '420px',
        width: '100%',
        boxShadow: '0 8px 32px var(--shadow)',
      }}
    >
      <h3
        id="deactivate-title"
        style={{
          margin: '0 0 0.5rem 0',
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}
      >
        Desativar serviço?
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
        <strong style={{ color: 'var(--text-primary)' }}>{service.name}</strong> deixará de aparecer
        nas sugestões para novos pacotes. Os pacotes já existentes não serão alterados.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={processing}>
          Cancelar
        </button>
        <button type="button" className="btn btn-danger-outline" onClick={onConfirm} disabled={processing}>
          {processing ? 'Desativando...' : 'Desativar'}
        </button>
      </div>
    </div>
  </div>
);

interface DeleteModalProps {
  service: FavoriteService;
  onConfirm: () => void;
  onCancel: () => void;
  processing: boolean;
}

const DeleteModal: React.FC<DeleteModalProps> = ({ service, onConfirm, onCancel, processing }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-title"
  >
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '1.5rem',
        maxWidth: '440px',
        width: '100%',
        boxShadow: '0 8px 32px var(--shadow)',
      }}
    >
      <h3
        id="delete-title"
        style={{
          margin: '0 0 0.5rem 0',
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}
      >
        Excluir serviço?
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>
        Você está prestes a excluir permanentemente &apos;{service.name}&apos; do catálogo de Serviços.
      </p>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 1.25rem 0' }}>
        Esta ação não altera Pacotes ou Cotações que já utilizam este serviço.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={processing}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-danger-outline"
          onClick={onConfirm}
          disabled={processing}
        >
          {processing ? 'Excluindo...' : 'Excluir serviço'}
        </button>
      </div>
    </div>
  </div>
);

export const ServicesListPage: React.FC = () => {
  const [services, setServices] = useState<FavoriteService[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<FavoriteServiceType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deactivatingService, setDeactivatingService] = useState<FavoriteService | null>(null);
  const [deletingService, setDeletingService] = useState<FavoriteService | null>(null);
  const [processing, setProcessing] = useState(false);

  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      const filters: ListServicesFilters = {};
      const data = await favoriteServicesService.listServices(filters);
      setServices(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar serviços.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const handleDeactivate = async (service: FavoriteService) => {
    if (processing) return;
    try {
      setProcessing(true);
      await favoriteServicesService.deactivateService(service.id);
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, active: false } : s))
      );
      setFeedback({
        type: 'success',
        message: `Serviço "${service.name}" desativado. Os pacotes existentes não foram alterados.`,
      });
      setDeactivatingService(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao desativar serviço.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setProcessing(false);
    }
  };

  const handleActivate = async (service: FavoriteService) => {
    if (processing) return;
    try {
      setProcessing(true);
      await favoriteServicesService.activateService(service.id);
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, active: true } : s))
      );
      setFeedback({
        type: 'success',
        message: `Serviço "${service.name}" ativado com sucesso.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao ativar serviço.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (service: FavoriteService) => {
    if (processing) return;
    try {
      setProcessing(true);
      await favoriteServicesService.deleteService(service.id);
      setServices((prev) => prev.filter((s) => s.id !== service.id));
      setFeedback({
        type: 'success',
        message: 'Serviço excluído com sucesso.',
      });
      setDeletingService(null);
    } catch {
      setFeedback({
        type: 'error',
        message: 'Não foi possível excluir o serviço. Tente novamente.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      // Filtro por tipo
      if (typeFilter !== 'all' && s.type !== typeFilter) return false;

      // Filtro por status
      if (statusFilter === 'active' && !s.active) return false;
      if (statusFilter === 'inactive' && s.active) return false;

      // Pesquisa textual
      if (searchTerm.trim().length > 0) {
        const term = searchTerm.trim().toLowerCase();
        const inName    = s.name.toLowerCase().includes(term);
        const inCountry = s.country.toLowerCase().includes(term);
        const inCity    = (s.city || '').toLowerCase().includes(term);
        const inType    = FAVORITE_SERVICE_TYPE_LABELS[s.type].toLowerCase().includes(term);
        if (!inName && !inCountry && !inCity && !inType) return false;
      }

      return true;
    });
  }, [services, typeFilter, statusFilter, searchTerm]);

  const isEmpty = !loading && services.length === 0;
  const noResults = !loading && services.length > 0 && filteredServices.length === 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Serviços</h1>
          <p className="page-subtitle">
            Gerencie os serviços utilizados com frequência nos seus pacotes.
          </p>
        </div>
        <Link to="/servicos/novo" className="btn btn-primary">
          + Novo Serviço
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
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Carregando catálogo de serviços...
          </p>
        </div>
      ) : isEmpty ? (
        <div className="placeholder-view">
          <h3>Nenhum serviço cadastrado</h3>
          <p>Cadastre serviços utilizados com frequência para acelerar o preenchimento de novos pacotes.</p>
          <Link to="/servicos/novo" className="btn btn-primary">
            Cadastrar primeiro serviço
          </Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Toolbar: pesquisa + filtros */}
          <div className="table-toolbar" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <div className="search-input-wrapper" style={{ flex: '1 1 200px', minWidth: 0 }}>
              <span className="search-icon">⚲</span>
              <input
                id="services-search"
                type="text"
                className="search-input"
                placeholder="Pesquisar serviços..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                id="services-type-filter"
                className="form-select"
                style={{ fontSize: '12px', padding: '5px 10px', height: '32px', minWidth: '160px' }}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as FavoriteServiceType | 'all')}
              >
                {TYPE_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                id="services-status-filter"
                className="form-select"
                style={{ fontSize: '12px', padding: '5px 10px', height: '32px', minWidth: '110px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>

              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                <strong>{filteredServices.length}</strong> de {services.length}
              </div>
            </div>
          </div>

          {noResults ? (
            <div
              style={{
                padding: '2.5rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}
            >
              Nenhum serviço encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Serviço</th>
                    <th>Tipo</th>
                    <th>País</th>
                    <th>Cidade</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((service) => (
                    <tr key={service.id}>
                      <td>
                        <Link
                          to={`/servicos/${service.id}/editar`}
                          className="table-link-title"
                        >
                          {service.name}
                        </Link>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {FAVORITE_SERVICE_TYPE_LABELS[service.type]}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {service.country}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {service.city || '—'}
                      </td>
                      <td>
                        <span
                          className={`badge ${service.active ? 'badge-success' : 'badge-muted'}`}
                        >
                          {service.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-actions">
                          <Link
                            to={`/servicos/${service.id}/editar`}
                            className="btn btn-sm btn-secondary"
                          >
                            Editar
                          </Link>
                          {service.active ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => setDeactivatingService(service)}
                              disabled={processing}
                              title="Desativar serviço"
                            >
                              Desativar
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => handleActivate(service)}
                              disabled={processing}
                              title="Ativar serviço"
                            >
                              Ativar
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-danger-outline"
                            onClick={() => setDeletingService(service)}
                            disabled={processing}
                            title="Excluir serviço"
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
      )}

      {deactivatingService && (
        <DeactivateModal
          service={deactivatingService}
          onConfirm={() => handleDeactivate(deactivatingService)}
          onCancel={() => setDeactivatingService(null)}
          processing={processing}
        />
      )}

      {deletingService && (
        <DeleteModal
          service={deletingService}
          onConfirm={() => handleDelete(deletingService)}
          onCancel={() => setDeletingService(null)}
          processing={processing}
        />
      )}
    </div>
  );
};
