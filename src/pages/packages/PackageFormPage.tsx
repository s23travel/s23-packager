import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { packagesService } from '../../services/packagesService';
import {
  Currency,
  PackageStatus,
  PackageData,
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
  savePackageDraft,
  getPackageDraft,
  clearPackageDraft,
} from '../../services/packageDraftService';
import {
  calculateFinancialSummaryFromServices,
  createDefaultServiceItem,
  generateServiceId,
  isLegacyPackageData,
  normalizeLegacyToNewStructure,
} from '../../services/legacyAdapterService';

export const PackageFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = Boolean(id);

  // Seção 1: Dados Principais
  const [reference, setReference] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<PackageStatus>('draft');
  const [baseCurrency, setBaseCurrency] = useState<Currency>('EUR');
  const [supplier, setSupplier] = useState('');

  // Seção 2: Datas, Passageiros e Destino
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationDays, setDurationDays] = useState<number | ''>(0);
  const [durationNights, setDurationNights] = useState<number | ''>(0);
  const [adults, setAdults] = useState<number | ''>(2);
  const [children, setChildren] = useState<number | ''>(0);
  const [destination, setDestination] = useState('');

  // Seção 3: Financeiro (Lista Única de Serviços e Preço de Venda)
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState('');

  // Metadados legados preservados sem perda
  const [legacyExtraData, setLegacyExtraData] = useState<Record<string, unknown>>({});

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
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

  // Carregamento de Pacote existente ou Rascunho / Inicialização de Novo Pacote
  useEffect(() => {
    if (!id) {
      // 1. Tenta restaurar rascunho anterior de sessionStorage
      const draft = getPackageDraft();
      if (draft) {
        setReference(draft.reference || '');
        setName(draft.name || '');
        setStatus(draft.status || 'draft');
        setBaseCurrency(draft.baseCurrency || 'EUR');
        setSupplier(draft.supplier || '');
        setAdditionalInfo(draft.additionalInfo || '');
        setStartDate(draft.startDate || '');
        setEndDate(draft.endDate || '');
        setDurationDays(draft.durationDays);
        setDurationNights(draft.durationNights);
        setAdults(draft.adults);
        setChildren(draft.children);
        setSalePrice(draft.salePrice || 0);

        // Se o draft já tem services, usa diretamente
        if (Array.isArray(draft.services)) {
          setDestination(draft.destination || '');
          setServices(draft.services);
        } else {
          // Se for draft antigo (formato legado de transporte/hotel), normaliza com o adapter
          const legacyDraftData: PackageData = {
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
              ? { components: draft.costComponents, currency: draft.baseCurrency, salePrice: draft.salePrice } as any
              : undefined,
          };
          const normalized = normalizeLegacyToNewStructure(legacyDraftData);
          setDestination(normalized.destination || draft.hotelDestination || '');
          setServices(normalized.services);
        }
      } else {
        // Sugestão sequencial inteligente para novos pacotes base
        packagesService
          .getNextReference()
          .then((nextRef) => {
            setReference(nextRef);
          })
          .catch((err) => {
            console.error('Erro ao sugerir referência de pacote:', err);
            setReference(`PK-${new Date().getFullYear()}-001`);
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
          currency: baseCurrency,
          amount: 0,
          quantity: 1,
          destination: created.type === 'hotel' ? hotelDest : undefined,
          mealPlan: created.type === 'hotel' ? 'Café da manhã (BB)' : undefined,
          notes: created.notes || undefined,
        };

        setServices((prev) => [...prev, createdItem]);

        // Se o destino principal do pacote estiver vazio e o hotel tiver cidade/país, preenche
        if (created.type === 'hotel' && hotelDest) {
          setDestination((curr) => curr || hotelDest);
        }
      }

      if (navState?.message) {
        setFeedback({ type: 'success', message: navState.message });
      }

      return;
    }

    // Modo Edição: Carregar pacote existente do banco
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

        const rawData = pkg.data || {};
        setSupplier(rawData.supplier || '');
        setAdditionalInfo(rawData.additionalInfo || '');

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
        }

        if (rawData.financials) {
          if (typeof rawData.financials.salePrice === 'number') {
            setSalePrice(rawData.financials.salePrice);
          } else if (rawData.financials.priceTotal?.amount) {
            setSalePrice(rawData.financials.priceTotal.amount);
          }
          if (rawData.financials.exchangeRateUsed) {
            setExchangeRate(rawData.financials.exchangeRateUsed);
          }
        }

        // DETECÇÃO DE DADOS LEGADOS vs. NOVA ESTRUTURA
        if (isLegacyPackageData(rawData) || !Array.isArray(rawData.services)) {
          // Pacote no formato legado: normaliza em memória através do adapter determinístico
          const normalized = normalizeLegacyToNewStructure(rawData);
          setDestination(normalized.destination || rawData.destination || '');
          setServices(normalized.services || []);

          // Preserva campos legados que possam existir
          setLegacyExtraData({
            localTaxNotes: normalized.localTaxNotes,
            paymentConditions: normalized.paymentConditions,
            transferService: normalized.transferService,
            extraServicesNotes: normalized.extraServicesNotes,
            customNotes: normalized.customNotes,
          });
        } else {
          // Pacote já na nova estrutura
          setDestination(rawData.destination || '');
          setServices(rawData.services || []);
          setLegacyExtraData({
            localTaxNotes: rawData.localTaxNotes,
            paymentConditions: rawData.paymentConditions,
            transferService: rawData.transferService,
            extraServicesNotes: rawData.extraServicesNotes,
            customNotes: rawData.customNotes,
          });
        }
      } catch (err: any) {
        setFeedback({
          type: 'error',
          message: err.message || 'Erro ao carregar dados do pacote.',
        });
      } finally {
        setLoading(false);
      }
    };

    loadPackage();
  }, [id, location.state]);

  // Callback para navegar e cadastrar serviço no catálogo (favorite_services)
  const handleAddNewServiceFromEditor = useCallback(
    (serviceType: FavoriteServiceType = 'hotel', currentQuery: string = '') => {
      savePackageDraft({
        reference,
        name,
        status,
        baseCurrency,
        supplier,
        additionalInfo,
        startDate,
        endDate,
        durationDays,
        durationNights,
        adults,
        children,
        destination,
        services,
        salePrice,
      });

      navigate('/servicos/novo', {
        state: {
          returnTo: isEditing ? `/pacotes/${id}/editar` : '/pacotes/novo',
          serviceType,
          initialName: currentQuery,
        },
      });
    },
    [
      reference,
      name,
      status,
      baseCurrency,
      supplier,
      additionalInfo,
      startDate,
      endDate,
      durationDays,
      durationNights,
      adults,
      children,
      destination,
      services,
      salePrice,
      isEditing,
      id,
      navigate,
    ]
  );

  // Importação estruturada por imagem via IA multimodal (Fase 5)
  const handleImportData = (data: ImportedPackageData) => {
    if (data.packageName && !name) {
      setName(data.packageName);
    }
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
        const outItem = createDefaultServiceItem('outbound_transport', baseCurrency);
        outItem.description = parts.join(' | ');
        outItem.carrier = data.outbound.company || undefined;
        outItem.departureTime = data.outbound.departureTime || undefined;
        outItem.arrivalTime = data.outbound.arrivalTime || undefined;
        importedServices.push(outItem);
      }

      if (data.inbound?.route) {
        const parts = [data.inbound.route, data.inbound.company, data.inbound.flight].filter(Boolean);
        const inItem = createDefaultServiceItem('inbound_transport', baseCurrency);
        inItem.description = parts.join(' | ');
        inItem.carrier = data.inbound.company || undefined;
        inItem.departureTime = data.inbound.departureTime || undefined;
        inItem.arrivalTime = data.inbound.arrivalTime || undefined;
        importedServices.push(inItem);
      }

      if (data.lodging?.name) {
        const hotelItem = createDefaultServiceItem('accommodation', baseCurrency);
        hotelItem.description = data.lodging.name;
        hotelItem.destination = data.destination || undefined;
        if (data.lodging.mealPlan) {
          hotelItem.mealPlan = normalizeMealPlan(data.lodging.mealPlan);
        }
        importedServices.push(hotelItem);
      }

      if (data.additionalServices && data.additionalServices.length > 0) {
        data.additionalServices.forEach((srv) => {
          const extraItem = createDefaultServiceItem('additional', baseCurrency);
          extraItem.description = srv.name + (srv.description ? ` (${srv.description})` : '');
          extraItem.amount = srv.amount || 0;
          extraItem.currency = (srv.currency === 'BRL' || srv.currency === 'EUR' ? srv.currency : baseCurrency);
          extraItem.notes = srv.date ? `Data: ${srv.date}` : undefined;
          importedServices.push(extraItem);
        });
      }

      if (importedServices.length > 0) {
        setServices((prev) => [...prev, ...importedServices]);
      }
    }

    if (data.currency === 'BRL' || data.currency === 'EUR') {
      setBaseCurrency(data.currency);
    } else if (data.financial?.currency === 'BRL' || data.financial?.currency === 'EUR') {
      setBaseCurrency(data.financial.currency);
    }

    const salePriceVal = data.salePrice ?? data.financial?.total;
    if (salePriceVal !== null && salePriceVal !== undefined && salePriceVal > 0) {
      setSalePrice(salePriceVal);
    }

    setFeedback({
      type: 'success',
      message: 'Dados importados com sucesso para a lista de serviços! Revise os valores antes de salvar.',
    });
  };

  const handleCancel = () => {
    clearPackageDraft();
    navigate(isEditing && id ? `/pacotes/${id}` : '/pacotes');
  };

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

      const isAvailable = await packagesService.isReferenceAvailable(reference.trim(), id);
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
        targetCurrency: baseCurrency,
        exchangeRate,
        passengers: {
          adults: Number(adults) || 2,
          children: Number(children) || 0,
          infants: 0,
        },
      });

      // Estrutura final do PackageData (Fase 2: Nova Estrutura Unificada de Serviços)
      // Não cria estruturas operacionais legadas (outboundTransport, inboundTransport, lodging)
      const packageData: PackageData = {
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
          infants: 0,
        },
        financials: calculatedFinancials,
        supplier: supplier.trim() || undefined,
        additionalInfo: additionalInfo.trim() || undefined,
        // Preserva rigorosamente campos legados sem descartar nada
        localTaxNotes: legacyExtraData.localTaxNotes as string | undefined,
        paymentConditions: legacyExtraData.paymentConditions as string | undefined,
        customNotes: legacyExtraData.customNotes as string | undefined,
        transferService: legacyExtraData.transferService as string | undefined,
        extraServicesNotes: legacyExtraData.extraServicesNotes as string | undefined,
      };

      if (isEditing && id) {
        await packagesService.updatePackage(id, {
          reference,
          name,
          status,
          base_currency: baseCurrency,
          data: packageData,
        });
        clearPackageDraft();
        navigate(`/pacotes/${id}`, {
          state: { message: 'Pacote atualizado com sucesso na nova estrutura de serviços!' },
        });
      } else {
        const created = await packagesService.createPackage({
          reference,
          name,
          status,
          base_currency: baseCurrency,
          data: packageData,
        });
        clearPackageDraft();
        navigate(`/pacotes/${created.id}`, {
          state: { message: 'Pacote base cadastrado com sucesso!' },
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao salvar pacote: ${err.message}` });
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
            Configure o destino, datas e a lista unificada de serviços e custos do pacote.
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
        targetType="package"
      />

      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      <form onSubmit={handleSubmit} className="form-layout">
        {/* SEÇÃO 1: Dados Principais */}
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

        {/* SEÇÃO 2: Datas, Passageiros e Destino */}
        <div className="card form-card">
          <h3 className="form-section-title">2. Datas, Passageiros e Destino</h3>

          <div className="form-grid-2" style={{ marginBottom: '1rem' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label" htmlFor="destination">
                Destino Principal da Viagem *
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
                Destino principal ou cidades-chave do pacote. Cada hospedagem pode ter seu destino específico na Seção Financeiro.
              </span>
            </div>
          </div>

          <div className="form-grid-5">
            <div className="form-group">
              <label className="form-label" htmlFor="startDate">
                Data de Início
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
                Qtd. Pessoas
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
          </div>
        </div>

        {/* SEÇÃO 3: Financeiro (Lista Única de Serviços e Resumo Financeiro) */}
        <div className="card form-card">
          <h3 className="form-section-title">3. Financeiro ({baseCurrency})</h3>
          <PackageServicesEditor
            services={services}
            onChangeServices={setServices}
            baseCurrency={baseCurrency}
            salePrice={salePrice}
            onChangeSalePrice={setSalePrice}
            exchangeRate={exchangeRate}
            onChangeExchangeRate={setExchangeRate}
            passengers={{
              adults: Number(adults) || 2,
              children: Number(children) || 0,
              infants: 0,
            }}
            defaultDestination={destination}
            onAddNewService={handleAddNewServiceFromEditor}
          />

          <div className="form-group" style={{ marginTop: '1.25rem' }}>
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
          <button type="button" onClick={handleCancel} className="btn btn-secondary">
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Pacote Base'}
          </button>
        </div>
      </form>
    </div>
  );
};
