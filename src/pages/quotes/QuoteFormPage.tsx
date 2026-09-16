import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { quotationsService } from '../../services/quotationsService';
import {
  Currency,
  QuotationStatus,
  QuotationData,
  FavoriteService,
  FavoriteServiceType,
  ImportedPackageData,
  ServiceItem,
  normalizeMealPlan,
} from '../../types';
import { FeedbackBanner } from '../../components/common/FeedbackBanner';
import { PackageServicesEditor } from '../../components/packages/PackageServicesEditor';
import { ImageImportModal } from '../../components/import/ImageImportModal';
import {
  saveQuoteDraft,
  getQuoteDraft,
  clearQuoteDraft,
} from '../../services/quoteDraftService';
import {
  calculateFinancialSummaryFromServices,
  createDefaultServiceItem,
  generateServiceId,
  isLegacyPackageData,
  normalizeLegacyToNewStructure,
} from '../../services/legacyAdapterService';

export const QuoteFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = Boolean(id);

  // SEÇÃO 1: Dados da Cotação / Identificação Comercial
  const [reference, setReference] = useState('');
  const [clientName, setClientName] = useState('');
  const [status, setStatus] = useState<QuotationStatus>('draft');
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [exchangeRate, setExchangeRate] = useState<string>('');
  const [exchangeRateDate, setExchangeRateDate] = useState<string>('');
  const [originPackageId, setOriginPackageId] = useState<string | null>(null);
  const [originPackageName, setOriginPackageName] = useState<string>('');

  // SEÇÃO 2: Datas, Passageiros e Destino
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationDays, setDurationDays] = useState<number | ''>(0);
  const [durationNights, setDurationNights] = useState<number | ''>(0);
  const [adults, setAdults] = useState<number | ''>(2);
  const [children, setChildren] = useState<number | ''>(0);
  const [infants, setInfants] = useState<number | ''>(0);

  // SEÇÃO 3: Serviços e Financeiro (Lista Única de Serviços e Preço de Venda)
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [paymentConditions, setPaymentConditions] = useState('');
  const [localTaxNotes, setLocalTaxNotes] = useState('');
  const [extraServicesNotes, setExtraServicesNotes] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [transferService, setTransferService] = useState('');

  // Metadados legados preservados sem perda
  const [legacyExtraData, setLegacyExtraData] = useState<Record<string, unknown>>({});

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    (location.state as any)?.message
      ? { type: 'success', message: (location.state as any).message }
      : null
  );
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Cálculo automático de Duração (Dias) e Duração (Noites)
  useEffect(() => {
    if (startDate && endDate) {
      if (endDate < startDate) {
        setEndDate(startDate);
        return;
      }
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const diffMs = end.getTime() - start.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
          setDurationDays(diffDays + 1);
          setDurationNights(diffDays);
        }
      }
    }
  }, [startDate, endDate]);

  // Carregamento de Cotação existente ou Rascunho / Inicialização de Nova Cotação
  useEffect(() => {
    if (!id) {
      // 1. Tenta restaurar rascunho anterior de sessionStorage
      const draft = getQuoteDraft();
      if (draft) {
        setReference(draft.reference || '');
        setClientName(draft.clientName || '');
        setStatus(draft.status || 'draft');
        setCurrency(draft.currency || 'EUR');
        setExchangeRate(draft.exchangeRate || '');
        setExchangeRateDate(draft.exchangeRateDate || '');
        setOriginPackageId(draft.originPackageId || null);
        setOriginPackageName(draft.originPackageName || '');
        setStartDate(draft.startDate || '');
        setEndDate(draft.endDate || '');
        setDurationDays(draft.durationDays);
        setDurationNights(draft.durationNights);
        setAdults(draft.adults);
        setChildren(draft.children);
        setInfants(draft.infants);
        setSalePrice(draft.salePrice || 0);
        setPaymentConditions(draft.paymentConditions || '');
        setLocalTaxNotes(draft.localTaxNotes || '');
        setExtraServicesNotes(draft.extraServicesNotes || '');
        setCustomNotes(draft.customNotes || '');
        setTransferService(draft.transferService || '');

        if (Array.isArray(draft.services)) {
          setDestination(draft.destination || '');
          setServices(draft.services);
        } else {
          // Se for draft em formato legado, normaliza
          const legacyDraftData: QuotationData = {
            outboundTransport: draft.outboundRoute
              ? { type: 'flight', route: draft.outboundRoute, carrier: draft.outboundCarrier }
              : undefined,
            inboundTransport: draft.inboundRoute
              ? { type: 'flight', route: draft.inboundRoute, carrier: draft.inboundCarrier }
              : undefined,
            lodging: draft.hotelName
              ? [{ id: 'hotel-draft', name: draft.hotelName, destination: draft.hotelDestination || '', mealPlan: draft.hotelMealPlan }]
              : [],
            financials: draft.costComponents
              ? { components: draft.costComponents, currency: draft.currency, salePrice: draft.salePrice } as any
              : undefined,
          };
          const normalized = normalizeLegacyToNewStructure(legacyDraftData);
          setDestination(normalized.destination || draft.hotelDestination || '');
          setServices(normalized.services);
        }
      } else {
        // Sugestão sequencial inteligente para novas cotações
        quotationsService
          .getNextReference()
          .then((nextRef) => {
            setReference(nextRef);
          })
          .catch((err) => {
            console.error('Erro ao sugerir referência de cotação:', err);
            setReference(`COT-${new Date().getFullYear()}-001`);
          });
      }

      // 2. Se retornou de /servicos/novo com um serviço recém-criado, copia como snapshot independente
      const navState = location.state as {
        createdService?: FavoriteService;
        message?: string;
      } | null;

      if (navState?.createdService) {
        const created = navState.createdService;
        const sType =
          created.type === 'hotel'
            ? 'accommodation'
            : created.type === 'transfer'
            ? 'transfer'
            : created.type === 'insurance'
            ? 'insurance'
            : created.type === 'airline'
            ? 'outbound_transport'
            : 'additional';

        const hotelDest = [created.city, created.country].filter(Boolean).join(', ');

        const createdItem: ServiceItem = {
          id: generateServiceId(),
          type: sType,
          description: created.name,
          currency: currency,
          amount: 0,
          quantity: 1,
          destination: created.type === 'hotel' ? hotelDest : undefined,
          mealPlan: created.type === 'hotel' ? 'Café da manhã (BB)' : undefined,
          notes: created.notes || undefined,
        };

        setServices((prev) => [...prev, createdItem]);

        if (created.type === 'hotel' && hotelDest) {
          setDestination((curr) => curr || hotelDest);
        }
      }

      if (navState?.message) {
        setFeedback({ type: 'success', message: navState.message });
      }

      return;
    }

    // Modo Edição: Carregar cotação existente do banco
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

        const rawData = quote.data || {};
        setCustomNotes(rawData.customNotes || '');
        setPaymentConditions(rawData.paymentConditions || '');
        setLocalTaxNotes(rawData.localTaxNotes || '');
        setExtraServicesNotes(rawData.extraServicesNotes || '');
        setTransferService(rawData.transferService || '');

        if (rawData.dates) {
          setStartDate(rawData.dates.startDate || '');
          setEndDate(rawData.dates.endDate || '');
          setDurationDays(rawData.dates.durationDays ?? 0);
          setDurationNights(
            rawData.dates.durationNights ??
              (rawData.dates.durationDays ? Math.max(0, rawData.dates.durationDays - 1) : 0)
          );
        }

        if (rawData.passengers) {
          setAdults(rawData.passengers.adults ?? 2);
          setChildren(rawData.passengers.children ?? 0);
          setInfants(rawData.passengers.infants ?? 0);
        }

        if (rawData.financials) {
          if (typeof rawData.financials.salePrice === 'number') {
            setSalePrice(rawData.financials.salePrice);
          } else if (rawData.financials.priceTotal?.amount) {
            setSalePrice(rawData.financials.priceTotal.amount);
          }
          if (rawData.financials.exchangeRateUsed && !quote.exchange_rate) {
            setExchangeRate(String(rawData.financials.exchangeRateUsed));
          }
        }

        // DETECÇÃO DE DADOS LEGADOS vs. NOVA ESTRUTURA
        if (isLegacyPackageData(rawData) || !Array.isArray(rawData.services)) {
          // Cotação no formato legado: normaliza em memória através do adapter determinístico
          const normalized = normalizeLegacyToNewStructure(rawData);
          setDestination(normalized.destination || rawData.destination || '');
          setServices(normalized.services || []);

          setLegacyExtraData({
            localTaxNotes: normalized.localTaxNotes,
            paymentConditions: normalized.paymentConditions,
            transferService: normalized.transferService,
            extraServicesNotes: normalized.extraServicesNotes,
            customNotes: normalized.customNotes,
            supplier: normalized.supplier,
          });
        } else {
          // Cotação já na nova estrutura de serviços
          setDestination(rawData.destination || '');
          setServices(rawData.services || []);
          setLegacyExtraData({
            localTaxNotes: rawData.localTaxNotes,
            paymentConditions: rawData.paymentConditions,
            transferService: rawData.transferService,
            extraServicesNotes: rawData.extraServicesNotes,
            customNotes: rawData.customNotes,
            supplier: rawData.supplier,
          });
        }
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'Erro ao carregar cotação.' });
      } finally {
        setLoading(false);
      }
    };

    loadQuote();
  }, [id, location.state]);

  // Callback para navegar e cadastrar serviço no catálogo (favorite_services)
  const handleAddNewServiceFromEditor = useCallback(
    (serviceType: FavoriteServiceType = 'hotel', currentQuery: string = '') => {
      saveQuoteDraft({
        reference,
        clientName,
        status,
        currency,
        exchangeRate,
        exchangeRateDate,
        originPackageId,
        originPackageName,
        customNotes,
        startDate,
        endDate,
        durationDays,
        durationNights,
        adults,
        children,
        infants,
        destination,
        services,
        salePrice,
        paymentConditions,
        localTaxNotes,
        extraServicesNotes,
        transferService,
      });

      navigate('/servicos/novo', {
        state: {
          returnTo: isEditing ? `/cotacoes/${id}/editar` : '/cotacoes/novo',
          serviceType,
          initialName: currentQuery,
        },
      });
    },
    [
      reference,
      clientName,
      status,
      currency,
      exchangeRate,
      exchangeRateDate,
      originPackageId,
      originPackageName,
      customNotes,
      startDate,
      endDate,
      durationDays,
      durationNights,
      adults,
      children,
      infants,
      destination,
      services,
      salePrice,
      paymentConditions,
      localTaxNotes,
      extraServicesNotes,
      transferService,
      isEditing,
      id,
      navigate,
    ]
  );

  // Importação estruturada por imagem via IA multimodal (Fase 5)
  const handleImportData = (data: ImportedPackageData) => {
    if (data.dates?.start) {
      setStartDate(data.dates.start);
    }
    if (data.dates?.end) {
      setEndDate(data.dates.end);
    }
    if (data.passengers?.adults !== null && data.passengers?.adults !== undefined) {
      setAdults(data.passengers.adults);
    }
    if (data.passengers?.children && data.passengers.children.length > 0) {
      setChildren(data.passengers.children.length);
    }

    // Destino Comercial
    if (data.destination && !destination) {
      setDestination(data.destination);
    } else {
      const hotelDest = [data.lodging?.city, data.lodging?.country].filter(Boolean).join(', ');
      if (hotelDest && !destination) {
        setDestination(hotelDest);
      }
    }

    // Aplica services[] diretamente da importação
    if (Array.isArray(data.services) && data.services.length > 0) {
      setServices((prev) => [...prev, ...data.services]);
    } else {
      // Fallback legado se services não vier preenchido
      const importedServices: ServiceItem[] = [];

      if (data.outbound?.route) {
        const parts = [data.outbound.route, data.outbound.company, data.outbound.flight].filter(Boolean);
        const outItem = createDefaultServiceItem('outbound_transport', currency);
        outItem.description = parts.join(' | ');
        outItem.carrier = data.outbound.company || undefined;
        outItem.departureTime = data.outbound.departureTime || undefined;
        outItem.arrivalTime = data.outbound.arrivalTime || undefined;
        importedServices.push(outItem);
      }

      if (data.inbound?.route) {
        const parts = [data.inbound.route, data.inbound.company, data.inbound.flight].filter(Boolean);
        const inItem = createDefaultServiceItem('inbound_transport', currency);
        inItem.description = parts.join(' | ');
        inItem.carrier = data.inbound.company || undefined;
        inItem.departureTime = data.inbound.departureTime || undefined;
        inItem.arrivalTime = data.inbound.arrivalTime || undefined;
        importedServices.push(inItem);
      }

      if (data.lodging?.name) {
        const hotelItem = createDefaultServiceItem('accommodation', currency);
        hotelItem.description = data.lodging.name;
        hotelItem.destination = data.destination || undefined;
        if (data.lodging.mealPlan) {
          hotelItem.mealPlan = normalizeMealPlan(data.lodging.mealPlan);
        }
        importedServices.push(hotelItem);
      }

      if (data.additionalServices && data.additionalServices.length > 0) {
        data.additionalServices.forEach((srv) => {
          const extraItem = createDefaultServiceItem('additional', currency);
          extraItem.description = srv.name + (srv.description ? ` (${srv.description})` : '');
          extraItem.amount = srv.amount || 0;
          extraItem.currency = srv.currency === 'BRL' || srv.currency === 'EUR' ? srv.currency : currency;
          extraItem.notes = srv.date ? `Data: ${srv.date}` : undefined;
          importedServices.push(extraItem);
        });
      }

      if (importedServices.length > 0) {
        setServices((prev) => [...prev, ...importedServices]);
      }
    }

    if (data.currency === 'BRL' || data.currency === 'EUR') {
      setCurrency(data.currency);
    } else if (data.financial?.currency === 'BRL' || data.financial?.currency === 'EUR') {
      setCurrency(data.financial.currency);
    }

    const salePriceVal = data.salePrice ?? data.financial?.total;
    if (salePriceVal !== null && salePriceVal !== undefined && salePriceVal > 0) {
      setSalePrice(salePriceVal);
    }

    setFeedback({
      type: 'success',
      message: 'Dados importados com sucesso para a lista de serviços da cotação! Revise os valores antes de salvar.',
    });
  };

  const handleCancel = () => {
    clearQuoteDraft();
    navigate(isEditing && id ? `/cotacoes/${id}` : '/cotacoes');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reference.trim()) {
      setFeedback({ type: 'error', message: 'A referência da cotação é obrigatória.' });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);

      const isAvailable = await quotationsService.isReferenceAvailable(reference.trim(), id);
      if (!isAvailable) {
        setFeedback({
          type: 'error',
          message: 'Esta referência já está em uso. Informe outra referência.',
        });
        setSaving(false);
        return;
      }

      // Consolidação financeira a partir da lista unificada services[]
      const calculatedFinancials = calculateFinancialSummaryFromServices({
        services,
        salePrice: Number(salePrice) || 0,
        targetCurrency: currency,
        exchangeRate: exchangeRate ? parseFloat(exchangeRate) : null,
        passengers: {
          adults: Number(adults) || 2,
          children: Number(children) || 0,
          infants: Number(infants) || 0,
        },
      });

      // Estrutura final de QuotationData (Fase 3: Nova Estrutura Unificada de Serviços)
      // Não cria estruturas operacionais legadas (outboundTransport, inboundTransport, lodging)
      const quotationData: QuotationData = {
        destination: destination.trim(),
        services,
        dates: {
          startDate,
          endDate,
          durationDays: Number(durationDays) || undefined,
          durationNights: Number(durationNights) ?? undefined,
        },
        passengers: {
          adults: Number(adults) || 2,
          children: Number(children) || 0,
          infants: Number(infants) || 0,
        },
        financials: calculatedFinancials,
        customNotes: customNotes.trim() || undefined,
        originPackageName: originPackageName || undefined,
        transferService: transferService.trim() || undefined,
        paymentConditions: paymentConditions.trim() || undefined,
        localTaxNotes: localTaxNotes.trim() || undefined,
        extraServicesNotes: extraServicesNotes.trim() || undefined,
        supplier: legacyExtraData.supplier as string | undefined,
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
        clearQuoteDraft();
        navigate(`/cotacoes/${id}`, {
          state: { message: 'Cotação atualizada com sucesso na nova estrutura de serviços!' },
        });
      } else {
        const created = await quotationsService.createQuotation({
          package_id: originPackageId || null,
          reference,
          client_name: clientName || null,
          status,
          currency,
          exchange_rate: exchangeRate ? Number(exchangeRate) : null,
          exchange_rate_date: exchangeRateDate || null,
          data: quotationData,
        });
        clearQuoteDraft();
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
              'Cotação personalizada com lista unificada de serviços e financeiro derivado.'
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="btn btn-secondary"
            title="Importar dados de imagem de orçamento/cotação"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span>📷</span> Importar arquivo
          </button>
          <button type="button" onClick={handleCancel} className="btn btn-secondary">
            Cancelar
          </button>
        </div>
      </div>

      <ImageImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportData}
        targetType="quote"
      />

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
        {/* SEÇÃO 1: Identificação Comercial */}
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
                placeholder="Ex: COT-2026-001"
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
                <option value="EUR">EUR (€) - Euro</option>
                <option value="BRL">BRL (R$) - Real Brasileiro</option>
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

        {/* SEÇÃO 2: Datas, Passageiros e Destino */}
        <div className="card form-card">
          <h3 className="form-section-title">2. Datas, Passageiros e Destino</h3>

          <div className="form-grid-2" style={{ marginBottom: '1rem' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label" htmlFor="destination">
                Destino Principal da Cotação *
              </label>
              <input
                id="destination"
                type="text"
                className="form-input"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Ex: Paris, Milão, Tanzânia ou Paris / Bruxelas"
                required
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                Destino comercial da cotação. Cada hospedagem pode ter seu destino específico na lista de serviços.
              </span>
            </div>
          </div>

          <div className="form-grid-5">
            <div className="form-group">
              <label className="form-label" htmlFor="startDate">
                Data de Partida
              </label>
              <input
                id="startDate"
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setStartDate(newStart);
                  if (endDate && newStart && endDate < newStart) {
                    setEndDate(newStart);
                  }
                }}
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
                min={startDate || undefined}
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
                min="0"
                className="form-input"
                value={durationDays}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setDurationDays('');
                    setDurationNights('');
                    return;
                  }
                  const val = parseInt(raw, 10);
                  if (!isNaN(val)) {
                    setDurationDays(val);
                    setDurationNights(Math.max(0, val - 1));
                  }
                }}
                onBlur={() => {
                  if (durationDays === '' || (typeof durationDays === 'number' && durationDays < 0)) {
                    setDurationDays(0);
                    setDurationNights(0);
                  }
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="durationNights">
                Duração (Noites)
              </label>
              <input
                id="durationNights"
                type="number"
                min="0"
                className="form-input"
                value={durationNights}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setDurationNights('');
                    return;
                  }
                  const val = parseInt(raw, 10);
                  if (!isNaN(val)) {
                    setDurationNights(val);
                  }
                }}
                onBlur={() => {
                  if (durationNights === '' || (typeof durationNights === 'number' && durationNights < 0)) {
                    setDurationNights(0);
                  }
                }}
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
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setAdults('');
                    return;
                  }
                  const val = parseInt(raw, 10);
                  if (!isNaN(val)) {
                    setAdults(val);
                  }
                }}
                onBlur={() => {
                  if (adults === '' || (typeof adults === 'number' && adults < 1)) {
                    setAdults(1);
                  }
                }}
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
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setChildren('');
                    return;
                  }
                  const val = parseInt(raw, 10);
                  if (!isNaN(val)) {
                    setChildren(val);
                  }
                }}
                onBlur={() => {
                  if (children === '' || (typeof children === 'number' && children < 0)) {
                    setChildren(0);
                  }
                }}
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
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setInfants('');
                    return;
                  }
                  const val = parseInt(raw, 10);
                  if (!isNaN(val)) {
                    setInfants(val);
                  }
                }}
                onBlur={() => {
                  if (infants === '' || (typeof infants === 'number' && infants < 0)) {
                    setInfants(0);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* SEÇÃO 3: Serviços e Financeiro */}
        <div className="card form-card">
          <h3 className="form-section-title">3. Serviços e Financeiro ({currency})</h3>
          <PackageServicesEditor
            services={services}
            onChangeServices={setServices}
            baseCurrency={currency}
            salePrice={salePrice}
            onChangeSalePrice={setSalePrice}
            exchangeRate={exchangeRate ? parseFloat(exchangeRate) : null}
            onChangeExchangeRate={(rate) => setExchangeRate(rate !== null ? String(rate) : '')}
            passengers={{
              adults: Number(adults) || 2,
              children: Number(children) || 0,
              infants: Number(infants) || 0,
            }}
            defaultDestination={destination}
            onAddNewService={handleAddNewServiceFromEditor}
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
          <button type="button" onClick={handleCancel} className="btn btn-secondary">
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : isEditing ? 'Salvar Cotação' : 'Criar Cotação'}
          </button>
        </div>
      </form>
    </div>
  );
};
