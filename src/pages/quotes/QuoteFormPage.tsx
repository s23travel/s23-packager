import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { quotationsService } from '../../services/quotationsService';
import { Currency, QuotationStatus, QuotationData, CostComponent } from '../../types';
import { FeedbackBanner } from '../../components/common/FeedbackBanner';
import { FinancialEditor } from '../../components/finance/FinancialEditor';
import { calculateFinancialSummary } from '../../services/financeService';

export const QuoteFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = Boolean(id);

  const [reference, setReference] = useState('');
  const [clientName, setClientName] = useState('');
  const [status, setStatus] = useState<QuotationStatus>('draft');
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [exchangeRate, setExchangeRate] = useState<string>('');
  const [exchangeRateDate, setExchangeRateDate] = useState<string>('');

  const [originPackageId, setOriginPackageId] = useState<string | null>(null);
  const [originPackageName, setOriginPackageName] = useState<string>('');
  const [customNotes, setCustomNotes] = useState('');

  // Datas e passageiros
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationDays, setDurationDays] = useState<number>(7);
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [infants, setInfants] = useState<number>(0);

  // Transportes
  const [outboundRoute, setOutboundRoute] = useState('');
  const [outboundCarrier, setOutboundCarrier] = useState('');
  const [outboundDepartureTime, setOutboundDepartureTime] = useState('');
  const [outboundArrivalTime, setOutboundArrivalTime] = useState('');
  const [inboundRoute, setInboundRoute] = useState('');
  const [inboundCarrier, setInboundCarrier] = useState('');
  const [inboundDepartureTime, setInboundDepartureTime] = useState('');
  const [inboundArrivalTime, setInboundArrivalTime] = useState('');
  const [transferService, setTransferService] = useState('');

  // Hotelaria
  const [hotelName, setHotelName] = useState('');
  const [hotelDestination, setHotelDestination] = useState('');
  const [hotelMealPlan, setHotelMealPlan] = useState('');

  // Condições comerciais WhatsApp
  const [paymentConditions, setPaymentConditions] = useState('');
  const [localTaxNotes, setLocalTaxNotes] = useState('');
  const [extraServicesNotes, setExtraServicesNotes] = useState('');

  // Componentes e valores financeiros (Fase 4)
  const [costComponents, setCostComponents] = useState<CostComponent[]>([]);
  const [salePrice, setSalePrice] = useState<number>(0);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    (location.state as any)?.message
      ? { type: 'success', message: (location.state as any).message }
      : null
  );

  useEffect(() => {
    if (!id) {
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      setReference(`COT-${year}-${rand}`);
      return;
    }

    const loadQuote = async () => {
      try {
        setLoading(true);
        const quote = await quotationsService.getQuotationById(id);
        if (!quote) {
          setFeedback({ type: 'error', message: 'Cotação não encontrada.' });
          return;
        }

        setReference(quote.reference);
        setClientName(quote.client_name || '');
        setStatus(quote.status);
        setCurrency(quote.currency);
        setExchangeRate(quote.exchange_rate ? String(quote.exchange_rate) : '');
        setExchangeRateDate(quote.exchange_rate_date || '');
        setOriginPackageId(quote.package_id);
        setOriginPackageName(quote.origin_package_name || quote.data?.originPackageName || '');

        const d = quote.data || {};
        setCustomNotes(d.customNotes || '');

        if (d.dates) {
          setStartDate(d.dates.startDate || '');
          setEndDate(d.dates.endDate || '');
          setDurationDays(d.dates.durationDays || 7);
        }

        if (d.passengers) {
          setAdults(d.passengers.adults ?? 2);
          setChildren(d.passengers.children ?? 0);
          setInfants(d.passengers.infants ?? 0);
        }

        if (d.outboundTransport) {
          setOutboundRoute(d.outboundTransport.route || '');
          setOutboundCarrier(d.outboundTransport.carrier || '');
          setOutboundDepartureTime(d.outboundTransport.departureTime || '');
          setOutboundArrivalTime(d.outboundTransport.arrivalTime || '');
        }

        if (d.inboundTransport) {
          setInboundRoute(d.inboundTransport.route || '');
          setInboundCarrier(d.inboundTransport.carrier || '');
          setInboundDepartureTime(d.inboundTransport.departureTime || '');
          setInboundArrivalTime(d.inboundTransport.arrivalTime || '');
        }

        setTransferService(d.transferService || '');
        setPaymentConditions(d.paymentConditions || '');
        setLocalTaxNotes(d.localTaxNotes || '');
        setExtraServicesNotes(d.extraServicesNotes || '');

        if (d.lodging && d.lodging.length > 0) {
          setHotelName(d.lodging[0].name || '');
          setHotelDestination(d.lodging[0].destination || '');
          setHotelMealPlan(d.lodging[0].mealPlan || '');
        }

        if (d.financials) {
          if (Array.isArray(d.financials.components)) {
            setCostComponents(d.financials.components);
          }
          if (typeof d.financials.salePrice === 'number') {
            setSalePrice(d.financials.salePrice);
          } else if (d.financials.priceTotal?.amount) {
            setSalePrice(d.financials.priceTotal.amount);
          }
        }
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'Erro ao carregar cotação.' });
      } finally {
        setLoading(false);
      }
    };

    loadQuote();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reference.trim()) {
      setFeedback({ type: 'error', message: 'A referência da cotação é obrigatória.' });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);

      const quotationData: QuotationData = {
        customNotes: customNotes.trim() || undefined,
        originPackageName: originPackageName || undefined,
        transferService: transferService.trim() || undefined,
        paymentConditions: paymentConditions.trim() || undefined,
        localTaxNotes: localTaxNotes.trim() || undefined,
        extraServicesNotes: extraServicesNotes.trim() || undefined,
        passengers: {
          adults: Number(adults) || 2,
          children: Number(children) || 0,
          infants: Number(infants) || 0,
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
              departureTime: outboundDepartureTime.trim() || undefined,
              arrivalTime: outboundArrivalTime.trim() || undefined,
            }
          : undefined,
        inboundTransport: inboundRoute.trim()
          ? {
              type: 'flight',
              route: inboundRoute.trim(),
              carrier: inboundCarrier.trim() || undefined,
              departureTime: inboundDepartureTime.trim() || undefined,
              arrivalTime: inboundArrivalTime.trim() || undefined,
            }
          : undefined,
        lodging: hotelName.trim()
          ? [
              {
                id: 'hotel-quote-1',
                name: hotelName.trim(),
                destination: hotelDestination.trim(),
                mealPlan: hotelMealPlan.trim(),
              },
            ]
          : [],
        financials: calculateFinancialSummary({
          components: costComponents,
          salePrice: Number(salePrice) || 0,
          targetCurrency: currency,
          exchangeRate: exchangeRate ? Number(exchangeRate) : null,
          passengers: {
            adults: Number(adults) || 2,
            children: Number(children) || 0,
            infants: Number(infants) || 0,
          },
        }),
      };

      if (isEditing && id) {
        await quotationsService.updateQuotation(id, {
          reference,
          client_name: clientName || null,
          status,
          currency,
          exchange_rate: exchangeRate ? Number(exchangeRate) : null,
          exchange_rate_date: exchangeRateDate || null,
          data: quotationData,
        });
        navigate(`/cotacoes/${id}`, {
          state: { message: 'Cotação atualizada com sucesso!' },
        });
      } else {
        const created = await quotationsService.createQuotation({
          reference,
          client_name: clientName || null,
          status,
          currency,
          exchange_rate: exchangeRate ? Number(exchangeRate) : null,
          exchange_rate_date: exchangeRateDate || null,
          data: quotationData,
        });
        navigate(`/cotacoes/${created.id}`, {
          state: { message: 'Cotação criada com sucesso!' },
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao salvar cotação: ${err.message}` });
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Carregando dados da cotação...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEditing ? `Editar Cotação ${reference}` : 'Nova Cotação Avulsa'}</h1>
          <p className="page-subtitle">
            {originPackageName ? (
              <span>
                Snapshot independente originado do pacote: <strong>{originPackageName}</strong>
              </span>
            ) : (
              'Cotação personalizada direta para cliente.'
            )}
          </p>
        </div>
        <Link to="/cotacoes" className="btn btn-secondary">
          Voltar para Cotações
        </Link>
      </div>

      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {originPackageId && (
        <div className="info-banner" style={{ marginBottom: '1.5rem' }}>
          <div className="info-banner-text">
            <h4>📸 Snapshot Independente Ativo</h4>
            <p>
              Esta cotação possui uma cópia autônoma dos dados do pacote original (<code>{originPackageName}</code>).
              Qualquer alteração feita aqui não afetará o pacote base, e alterações futuras no pacote não modificarão esta cotação.
            </p>
          </div>
          <Link to={`/pacotes/${originPackageId}`} className="btn btn-sm btn-secondary" target="_blank">
            Ver Pacote de Origem ↗
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-layout">
        {/* Seção 1: Cliente e Identificação */}
        <div className="card form-card">
          <h3 className="form-section-title">1. Identificação Comercial</h3>
          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label" htmlFor="reference">
                Referência da Cotação *
              </label>
              <input
                id="reference"
                type="text"
                className="form-input"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label" htmlFor="clientName">
                Nome do Cliente / Solicitante
              </label>
              <input
                id="clientName"
                type="text"
                className="form-input"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Dra. Mariana Costa ou Família Silveira"
              />
            </div>
          </div>

          <div className="form-grid-4" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="status">
                Status da Cotação
              </label>
              <select
                id="status"
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as QuotationStatus)}
              >
                <option value="draft">Rascunho (Draft)</option>
                <option value="sent">Enviada ao Cliente</option>
                <option value="accepted">Aceita / Aprovada</option>
                <option value="rejected">Rejeitada / Expirada</option>
                <option value="archived">Arquivada</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="currency">
                Moeda da Cotação
              </label>
              <select
                id="currency"
                className="form-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                <option value="EUR">EUR (€)</option>
                <option value="BRL">BRL (R$)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="exchangeRate">
                Taxa de Câmbio (Manual)
              </label>
              <input
                id="exchangeRate"
                type="number"
                step="0.0001"
                className="form-input"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                placeholder="Ex: 6.1500"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="exchangeRateDate">
                Data do Câmbio
              </label>
              <input
                id="exchangeRateDate"
                type="date"
                className="form-input"
                value={exchangeRateDate}
                onChange={(e) => setExchangeRateDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Seção 2: Datas & Passageiros do Snapshot */}
        <div className="card form-card">
          <h3 className="form-section-title">2. Datas e Passageiros da Cotação</h3>
          <div className="form-grid-4">
            <div className="form-group">
              <label className="form-label" htmlFor="startDate">
                Data de Partida
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
                Data de Retorno
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
                Adultos
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

            <div className="form-group">
              <label className="form-label" htmlFor="children">
                Crianças
              </label>
              <input
                id="children"
                type="number"
                min="0"
                className="form-input"
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="infants">
                Bebés (0-2 anos)
              </label>
              <input
                id="infants"
                type="number"
                min="0"
                className="form-input"
                value={infants}
                onChange={(e) => setInfants(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Seção 3: Transporte e Hotelaria */}
        <div className="card form-card">
          <h3 className="form-section-title">3. Transporte, Transfer e Hospedagem (Snapshot)</h3>
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
                placeholder="Ex: Porto → Maiorca (Ryanair)"
              />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input
                  type="text"
                  placeholder="Horário Partida (ex: 08:30)"
                  className="form-input text-xs"
                  value={outboundDepartureTime}
                  onChange={(e) => setOutboundDepartureTime(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Horário Chegada (ex: 11:45)"
                  className="form-input text-xs"
                  value={outboundArrivalTime}
                  onChange={(e) => setOutboundArrivalTime(e.target.value)}
                />
              </div>
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
                placeholder="Ex: Maiorca → Porto (Ryanair)"
              />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input
                  type="text"
                  placeholder="Horário Partida (ex: 18:20)"
                  className="form-input text-xs"
                  value={inboundDepartureTime}
                  onChange={(e) => setInboundDepartureTime(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Horário Chegada (ex: 19:40)"
                  className="form-input text-xs"
                  value={inboundArrivalTime}
                  onChange={(e) => setInboundArrivalTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label" htmlFor="transferService">
              Serviço de Transfer (se aplicável)
            </label>
            <input
              id="transferService"
              type="text"
              className="form-input"
              value={transferService}
              onChange={(e) => setTransferService(e.target.value)}
              placeholder="Ex: Transfer privativo aeroporto / hotel / aeroporto incluído"
            />
          </div>

          <div className="form-grid-3" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="hotelName">
                Hospedagem
              </label>
              <input
                id="hotelName"
                type="text"
                className="form-input"
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
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
              />
            </div>
          </div>
        </div>

        {/* Seção 4: Financeiro */}
        <div className="card form-card">
          <h3 className="form-section-title">4. Financeiro ({currency})</h3>
          <FinancialEditor
            currency={currency}
            components={costComponents}
            onChangeComponents={setCostComponents}
            salePrice={salePrice}
            onChangeSalePrice={setSalePrice}
            exchangeRate={exchangeRate ? parseFloat(exchangeRate) : null}
            onChangeExchangeRate={(rate) => setExchangeRate(rate !== null ? String(rate) : '')}
            exchangeRateDate={exchangeRateDate}
            onChangeExchangeRateDate={setExchangeRateDate}
            passengers={{
              adults: Number(adults) || 2,
              children: Number(children) || 0,
              infants: Number(infants) || 0,
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ marginTop: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="paymentConditions">
                Condição de Pagamento (Entrada / Saldo)
              </label>
              <input
                id="paymentConditions"
                type="text"
                className="form-input"
                value={paymentConditions}
                onChange={(e) => setPaymentConditions(e.target.value)}
                placeholder="Ex: 30% sinal + saldo até 20 dias antes"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="localTaxNotes">
                Taxa Local na Hospedagem (se aplicável)
              </label>
              <input
                id="localTaxNotes"
                type="text"
                className="form-input"
                value={localTaxNotes}
                onChange={(e) => setLocalTaxNotes(e.target.value)}
                placeholder="Ex: 3,30€ p/ pessoa/noite no hotel"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="extraServicesNotes">
                Serviços Extras / Opcionais (se aplicável)
              </label>
              <input
                id="extraServicesNotes"
                type="text"
                className="form-input"
                value={extraServicesNotes}
                onChange={(e) => setExtraServicesNotes(e.target.value)}
                placeholder="Ex: Seguro viagem cancelamento + bagagem"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label" htmlFor="customNotes">
              Observações Comerciais para o Cliente / Condições da Cotação
            </label>
            <textarea
              id="customNotes"
              rows={3}
              className="form-textarea"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="Ex: Valores sujeitos a confirmação de disponibilidade tarifária aérea..."
            />
          </div>
        </div>

        <div className="form-actions">
          <Link to="/cotacoes" className="btn btn-secondary">
            Cancelar
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : isEditing ? 'Salvar Cotação' : 'Criar Cotação'}
          </button>
        </div>
      </form>
    </div>
  );
};
