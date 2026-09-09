import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { packagesService } from '../../services/packagesService';
import { Currency, PackageStatus, PackageData } from '../../types';
import { FeedbackBanner } from '../../components/common/FeedbackBanner';

export const PackageFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [reference, setReference] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<PackageStatus>('draft');
  const [baseCurrency, setBaseCurrency] = useState<Currency>('EUR');
  const [supplier, setSupplier] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');

  // Datas e passageiros
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationDays, setDurationDays] = useState<number>(7);
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);

  // Transportes
  const [outboundRoute, setOutboundRoute] = useState('');
  const [outboundCarrier, setOutboundCarrier] = useState('');
  const [inboundRoute, setInboundRoute] = useState('');
  const [inboundCarrier, setInboundCarrier] = useState('');

  // Hospedagem básica
  const [hotelName, setHotelName] = useState('');
  const [hotelDestination, setHotelDestination] = useState('');
  const [hotelMealPlan, setHotelMealPlan] = useState('Café da Manhã');

  // Valores previstos
  const [priceTotal, setPriceTotal] = useState<string>('');
  const [pricePerPerson, setPricePerPerson] = useState<string>('');

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!id) {
      // Sugestão de referência padrão para novos pacotes
      const rand = Math.floor(100 + Math.random() * 900);
      setReference(`PK-${new Date().getFullYear()}-${rand}`);
      return;
    }

    const loadPackage = async () => {
      try {
        setLoading(true);
        const pkg = await packagesService.getPackageById(id);
        if (!pkg) {
          setFeedback({ type: 'error', message: 'Pacote não encontrado.' });
          return;
        }

        setReference(pkg.reference);
        setName(pkg.name);
        setStatus(pkg.status);
        setBaseCurrency(pkg.base_currency);

        const d = pkg.data || {};
        setSupplier(d.supplier || '');
        setAdditionalInfo(d.additionalInfo || '');

        if (d.dates) {
          setStartDate(d.dates.startDate || '');
          setEndDate(d.dates.endDate || '');
          setDurationDays(d.dates.durationDays || 7);
        }

        if (d.passengers) {
          setAdults(d.passengers.adults ?? 2);
          setChildren(d.passengers.children ?? 0);
        }

        if (d.outboundTransport) {
          setOutboundRoute(d.outboundTransport.route || '');
          setOutboundCarrier(d.outboundTransport.carrier || '');
        }

        if (d.inboundTransport) {
          setInboundRoute(d.inboundTransport.route || '');
          setInboundCarrier(d.inboundTransport.carrier || '');
        }

        if (d.lodging && d.lodging.length > 0) {
          setHotelName(d.lodging[0].name || '');
          setHotelDestination(d.lodging[0].destination || '');
          setHotelMealPlan(d.lodging[0].mealPlan || 'Café da Manhã');
        }

        if (d.financials) {
          if (d.financials.priceTotal) setPriceTotal(String(d.financials.priceTotal.amount));
          if (d.financials.pricePerPerson) setPricePerPerson(String(d.financials.pricePerPerson.amount));
        }
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'Erro ao carregar dados do pacote.' });
      } finally {
        setLoading(false);
      }
    };

    loadPackage();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reference.trim()) {
      setFeedback({ type: 'error', message: 'A referência do pacote é obrigatória.' });
      return;
    }
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'O nome do pacote é obrigatório.' });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);

      const packageData: PackageData = {
        supplier: supplier.trim() || undefined,
        additionalInfo: additionalInfo.trim() || undefined,
        passengers: {
          adults: Number(adults) || 2,
          children: Number(children) || 0,
          infants: 0,
        },
        dates: {
          startDate,
          endDate,
          durationDays: Number(durationDays) || undefined,
        },
        outboundTransport: outboundRoute.trim()
          ? {
              type: 'flight',
              route: outboundRoute.trim(),
              carrier: outboundCarrier.trim() || undefined,
            }
          : undefined,
        inboundTransport: inboundRoute.trim()
          ? {
              type: 'flight',
              route: inboundRoute.trim(),
              carrier: inboundCarrier.trim() || undefined,
            }
          : undefined,
        lodging: hotelName.trim()
          ? [
              {
                id: 'hotel-1',
                name: hotelName.trim(),
                destination: hotelDestination.trim(),
                mealPlan: hotelMealPlan.trim(),
              },
            ]
          : [],
        financials: {
          priceTotal: priceTotal ? { amount: Number(priceTotal), currency: baseCurrency } : undefined,
          pricePerPerson: pricePerPerson ? { amount: Number(pricePerPerson), currency: baseCurrency } : undefined,
        },
      };

      if (isEditing && id) {
        await packagesService.updatePackage(id, {
          reference,
          name,
          status,
          base_currency: baseCurrency,
          data: packageData,
        });
        navigate(`/pacotes/${id}`, {
          state: { message: 'Pacote atualizado com sucesso.' },
        });
      } else {
        const created = await packagesService.createPackage({
          reference,
          name,
          status,
          base_currency: baseCurrency,
          data: packageData,
        });
        navigate(`/pacotes/${created.id}`, {
          state: { message: 'Pacote cadastrado com sucesso!' },
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao salvar: ${err.message}` });
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Carregando dados do pacote...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEditing ? 'Editar Pacote Base' : 'Novo Pacote Base'}</h1>
          <p className="page-subtitle">
            Configure as bases operacionais, transportes, hotelaria e valores de referência.
          </p>
        </div>
        <Link to="/pacotes" className="btn btn-secondary">
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
        {/* Seção 1: Dados Gerais */}
        <div className="card form-card">
          <h3 className="form-section-title">1. Dados Principais</h3>
          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label" htmlFor="reference">
                Referência do Pacote *
              </label>
              <input
                id="reference"
                type="text"
                className="form-input"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ex: PK-2026-001"
                required
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label" htmlFor="name">
                Nome Comercial do Pacote *
              </label>
              <input
                id="name"
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Safari Serengeti & Praias de Zanzibar 10D"
                required
              />
            </div>
          </div>

          <div className="form-grid-3" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="status">
                Status Operacional
              </label>
              <select
                id="status"
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as PackageStatus)}
              >
                <option value="draft">Rascunho (Draft)</option>
                <option value="active">Ativo no Catálogo</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="baseCurrency">
                Moeda Base
              </label>
              <select
                id="baseCurrency"
                className="form-select"
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value as Currency)}
              >
                <option value="EUR">EUR (€) - Euro</option>
                <option value="BRL">BRL (R$) - Real Brasileiro</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="supplier">
                Fornecedor / Operador Local
              </label>
              <input
                id="supplier"
                type="text"
                className="form-input"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ex: Sense of Africa / Abreu"
              />
            </div>
          </div>
        </div>

        {/* Seção 2: Datas & Passageiros */}
        <div className="card form-card">
          <h3 className="form-section-title">2. Datas e Passageiros Padrão</h3>
          <div className="form-grid-4">
            <div className="form-group">
              <label className="form-label" htmlFor="startDate">
                Data Prevista de Início
              </label>
              <input
                id="startDate"
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="endDate">
                Data Prevista de Retorno
              </label>
              <input
                id="endDate"
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="durationDays">
                Duração (Dias)
              </label>
              <input
                id="durationDays"
                type="number"
                min="1"
                className="form-input"
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="adults">
                Qtd. Adultos
              </label>
              <input
                id="adults"
                type="number"
                min="1"
                className="form-input"
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Seção 3: Transportes e Hotelaria Base */}
        <div className="card form-card">
          <h3 className="form-section-title">3. Transporte e Hospedagem Base</h3>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="outboundRoute">
                Transporte de Ida (Rota / Cia)
              </label>
              <input
                id="outboundRoute"
                type="text"
                className="form-input"
                value={outboundRoute}
                onChange={(e) => setOutboundRoute(e.target.value)}
                placeholder="Ex: LIS → JRO (Qatar Airways / Voo QR-142)"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="inboundRoute">
                Transporte de Volta (Rota / Cia)
              </label>
              <input
                id="inboundRoute"
                type="text"
                className="form-input"
                value={inboundRoute}
                onChange={(e) => setInboundRoute(e.target.value)}
                placeholder="Ex: ZNZ → LIS (Qatar Airways / Voo QR-143)"
              />
            </div>
          </div>

          <div className="form-grid-3" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="hotelName">
                Hospedagem Principal
              </label>
              <input
                id="hotelName"
                type="text"
                className="form-input"
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
                placeholder="Ex: Four Seasons Safari Lodge"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="hotelDestination">
                Destino / Cidade
              </label>
              <input
                id="hotelDestination"
                type="text"
                className="form-input"
                value={hotelDestination}
                onChange={(e) => setHotelDestination(e.target.value)}
                placeholder="Ex: Serengeti, Tanzânia"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="hotelMealPlan">
                Regime de Alimentação
              </label>
              <input
                id="hotelMealPlan"
                type="text"
                className="form-input"
                value={hotelMealPlan}
                onChange={(e) => setHotelMealPlan(e.target.value)}
                placeholder="Ex: Pensão Completa / All Inclusive"
              />
            </div>
          </div>
        </div>

        {/* Seção 4: Valores e Notas */}
        <div className="card form-card">
          <h3 className="form-section-title">4. Valores de Referência ({baseCurrency}) e Observações</h3>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="priceTotal">
                Preço Base Total ({baseCurrency})
              </label>
              <input
                id="priceTotal"
                type="number"
                step="0.01"
                className="form-input"
                value={priceTotal}
                onChange={(e) => setPriceTotal(e.target.value)}
                placeholder="Ex: 4850.00"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pricePerPerson">
                Preço Base por Pessoa ({baseCurrency})
              </label>
              <input
                id="pricePerPerson"
                type="number"
                step="0.01"
                className="form-input"
                value={pricePerPerson}
                onChange={(e) => setPricePerPerson(e.target.value)}
                placeholder="Ex: 2425.00"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label" htmlFor="additionalInfo">
              Informações Adicionais / Notas Operacionais
            </label>
            <textarea
              id="additionalInfo"
              rows={3}
              className="form-textarea"
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="Detalhes sobre franquia de bagagem, documentação exigida, seguro ou inclusões específicas..."
            />
          </div>
        </div>

        <div className="form-actions">
          <Link to="/pacotes" className="btn btn-secondary">
            Cancelar
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Pacote Base'}
          </button>
        </div>
      </form>
    </div>
  );
};
