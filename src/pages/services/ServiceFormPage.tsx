import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  FavoriteServiceType,
  FAVORITE_SERVICE_TYPE_LABELS,
} from '../../types';
import { favoriteServicesService } from '../../services/favoriteServicesService';
import { FeedbackBanner } from '../../components/common/FeedbackBanner';

const SERVICE_TYPES = Object.entries(FAVORITE_SERVICE_TYPE_LABELS) as [
  FavoriteServiceType,
  string
][];

export const ServiceFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [type, setType] = useState<FavoriteServiceType>('hotel');
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadService = async () => {
      try {
        setLoading(true);
        const service = await favoriteServicesService.getServiceById(id);
        if (!service) {
          setFeedback({ type: 'error', message: 'Serviço não encontrado.' });
          return;
        }
        setType(service.type);
        setName(service.name);
        setRegion(service.region);
        setCountry(service.country);
        setCity(service.city || '');
        setNotes(service.notes || '');
        setActive(service.active);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar serviço.';
        setFeedback({ type: 'error', message: msg });
      } finally {
        setLoading(false);
      }
    };

    loadService();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'O nome do serviço é obrigatório.' });
      return;
    }
    if (!region.trim()) {
      setFeedback({ type: 'error', message: 'A região é obrigatória.' });
      return;
    }
    if (!country.trim()) {
      setFeedback({ type: 'error', message: 'O país é obrigatório.' });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);

      const input = {
        type,
        name: name.trim(),
        region: region.trim(),
        country: country.trim(),
        city: city.trim() || undefined,
        notes: notes.trim() || undefined,
        active,
      };

      if (isEditing && id) {
        await favoriteServicesService.updateService(id, input);
        navigate('/servicos', {
          state: { message: `Serviço "${name.trim()}" atualizado com sucesso.` },
        });
      } else {
        const created = await favoriteServicesService.createService(input);
        navigate('/servicos', {
          state: { message: `Serviço "${created.name}" cadastrado com sucesso.` },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido.';
      setFeedback({ type: 'error', message: `Erro ao salvar: ${msg}` });
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Carregando dados do serviço...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isEditing ? 'Editar Serviço' : 'Novo Serviço'}
          </h1>
          <p className="page-subtitle">
            {isEditing
              ? 'Atualize os dados do serviço no catálogo.'
              : 'Adicione um serviço ao catálogo para reutilização em pacotes.'}
          </p>
        </div>
        <Link to="/servicos" className="btn btn-secondary">
          Cancelar
        </Link>
      </div>

      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      <form onSubmit={handleSubmit} className="form-layout">
        <div className="card form-card">
          <h3 className="form-section-title">Dados do Serviço</h3>

          <div className="form-grid-3">
            {/* Tipo */}
            <div className="form-group">
              <label className="form-label" htmlFor="service-type">
                Tipo *
              </label>
              <select
                id="service-type"
                className="form-select"
                value={type}
                onChange={(e) => setType(e.target.value as FavoriteServiceType)}
                required
              >
                {SERVICE_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Nome */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label" htmlFor="service-name">
                Nome *
              </label>
              <input
                id="service-name"
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Four Seasons Safari Lodge"
                required
              />
            </div>
          </div>

          <div className="form-grid-3" style={{ marginTop: '1rem' }}>
            {/* Região */}
            <div className="form-group">
              <label className="form-label" htmlFor="service-region">
                Região *
              </label>
              <input
                id="service-region"
                type="text"
                className="form-input"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Ex: Serengeti"
                required
              />
            </div>

            {/* País */}
            <div className="form-group">
              <label className="form-label" htmlFor="service-country">
                País *
              </label>
              <input
                id="service-country"
                type="text"
                className="form-input"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Ex: Tanzânia"
                required
              />
            </div>

            {/* Cidade */}
            <div className="form-group">
              <label className="form-label" htmlFor="service-city">
                Cidade
              </label>
              <input
                id="service-city"
                type="text"
                className="form-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: Arusha"
              />
            </div>
          </div>

          {/* Observações */}
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label" htmlFor="service-notes">
              Observações
            </label>
            <textarea
              id="service-notes"
              rows={3}
              className="form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas opcionais sobre este serviço..."
            />
          </div>

          {/* Toggle Ativo/Inativo — só visível na edição */}
          {isEditing && (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label
                className="form-label"
                htmlFor="service-active"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
              >
                <input
                  id="service-active"
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                />
                <span>Serviço ativo</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>
                  (serviços inativos não aparecem nas sugestões de autocomplete)
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="form-actions">
          <Link to="/servicos" className="btn btn-secondary">
            Cancelar
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving
              ? 'Salvando...'
              : isEditing
              ? 'Salvar alterações'
              : 'Salvar serviço'}
          </button>
        </div>
      </form>
    </div>
  );
};
