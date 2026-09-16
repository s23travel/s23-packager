import React, { useMemo, useState } from 'react';
import {
  Currency,
  FavoriteService,
  FavoriteServiceType,
  MEAL_PLAN_OPTIONS,
  PassengerConfig,
  ServiceItem,
  ServiceType,
  SERVICE_TYPE_LABELS,
} from '../../types';
import {
  calculateFinancialSummaryFromServices,
  createDefaultServiceItem,
} from '../../services/legacyAdapterService';
import {
  calculateSuggestedSalePrice,
  DEFAULT_PROFIT_MARGIN_PERCENT,
  formatMoney,
  formatPercent,
  roundMoney,
} from '../../services/financeService';
import { ServiceAutocomplete } from '../common/ServiceAutocomplete';

interface PackageServicesEditorProps {
  services: ServiceItem[];
  onChangeServices: (services: ServiceItem[]) => void;
  baseCurrency: Currency;
  salePrice: number;
  onChangeSalePrice: (val: number) => void;
  exchangeRate?: number | null;
  onChangeExchangeRate?: (rate: number | null) => void;
  passengers?: PassengerConfig | null;
  defaultDestination?: string;
  onAddNewService?: (serviceType: FavoriteServiceType, query: string) => void;
  readOnly?: boolean;
}

const SERVICE_TYPE_ICONS: Record<ServiceType, string> = {
  outbound_transport: '🛫',
  inbound_transport:  '🛬',
  accommodation:      '🏨',
  transfer:           '🚐',
  insurance:          '🛡️',
  additional:         '🎫',
  taxes:              '🏛️',
  other:              '📦',
};

const SERVICE_TYPE_BADGE_CLASSES: Record<ServiceType, string> = {
  outbound_transport: 'badge-info',
  inbound_transport:  'badge-info',
  accommodation:      'badge-primary',
  transfer:           'badge-neutral',
  insurance:          'badge-success',
  additional:         'badge-warning',
  taxes:              'badge-danger',
  other:              'badge-neutral',
};

export const PackageServicesEditor: React.FC<PackageServicesEditorProps> = ({
  services,
  onChangeServices,
  baseCurrency,
  salePrice,
  onChangeSalePrice,
  exchangeRate,
  onChangeExchangeRate,
  passengers,
  defaultDestination,
  onAddNewService,
  readOnly = false,
}) => {
  const [selectedTypeToAdd, setSelectedTypeToAdd] = useState<ServiceType>('accommodation');
  const [isManualSalePrice, setIsManualSalePrice] = useState(false);

  // Consolidação financeira determinística derivada unicamente de services[]
  const summary = useMemo(() => {
    return calculateFinancialSummaryFromServices({
      services,
      salePrice,
      targetCurrency: baseCurrency,
      exchangeRate,
      passengers,
    });
  }, [services, salePrice, baseCurrency, exchangeRate, passengers]);

  // Se o preço de venda não foi manual e temos custos, atualiza automaticamente com margem de 12%
  React.useEffect(() => {
    if (!isManualSalePrice && summary.totalCost > 0 && salePrice === 0) {
      const suggested = calculateSuggestedSalePrice(summary.totalCost, DEFAULT_PROFIT_MARGIN_PERCENT);
      onChangeSalePrice(suggested);
    }
  }, [summary.totalCost, isManualSalePrice, salePrice, onChangeSalePrice]);

  const handleAddService = (type: ServiceType) => {
    const newItem = createDefaultServiceItem(type, baseCurrency, defaultDestination);
    onChangeServices([...services, newItem]);
  };

  const handleUpdateService = (index: number, updates: Partial<ServiceItem>) => {
    const next = [...services];
    next[index] = { ...next[index], ...updates };
    onChangeServices(next);
  };

  const handleRemoveService = (index: number) => {
    const next = services.filter((_, i) => i !== index);
    onChangeServices(next);
  };

  const handleResetToAutoPrice = () => {
    setIsManualSalePrice(false);
    const suggested = calculateSuggestedSalePrice(summary.totalCost, DEFAULT_PROFIT_MARGIN_PERCENT);
    onChangeSalePrice(suggested);
  };

  const handleManualSalePriceChange = (newVal: number) => {
    setIsManualSalePrice(true);
    onChangeSalePrice(newVal);
  };

  const payingPassengers = (passengers?.adults || 0) + (passengers?.children || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Barra de Ações: Adicionar Serviço */}
      {!readOnly && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Adicionar Serviço:
            </span>
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '180px', fontSize: '13px', padding: '0.35rem 0.6rem' }}
              value={selectedTypeToAdd}
              onChange={(e) => setSelectedTypeToAdd(e.target.value as ServiceType)}
            >
              {(Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((type) => (
                <option key={type} value={type}>
                  {SERVICE_TYPE_ICONS[type]} {SERVICE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => handleAddService(selectedTypeToAdd)}
            >
              + Adicionar
            </button>
          </div>

          {/* Atalhos Rápidos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => handleAddService('outbound_transport')}
              title="Adicionar Transporte de ida"
            >
              🛫 Ida
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => handleAddService('inbound_transport')}
              title="Adicionar Transporte de volta"
            >
              🛬 Volta
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => handleAddService('accommodation')}
              title="Adicionar Hospedagem"
            >
              🏨 Hotel
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => handleAddService('transfer')}
              title="Adicionar Transfer"
            >
              🚐 Transfer
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => handleAddService('insurance')}
              title="Adicionar Seguro-viagem"
            >
              🛡️ Seguro
            </button>
          </div>
        </div>
      )}

      {/* Lista de Serviços */}
      {services.length === 0 ? (
        <div
          style={{
            padding: '2.5rem',
            textAlign: 'center',
            border: '2px dashed var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)',
          }}
        >
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '1rem' }}>
            Nenhum serviço adicionado ainda. Escolha um tipo acima ou use os atalhos rápidos para incluir voos, hospedagem e passeios.
          </p>
          {!readOnly && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleAddService('outbound_transport')}
              >
                🛫 Adicionar Transporte de Ida
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleAddService('accommodation')}
              >
                🏨 Adicionar Hospedagem
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleAddService('inbound_transport')}
              >
                🛬 Adicionar Transporte de Volta
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {services.map((item, idx) => {
            const subtotal = roundMoney((item.amount || 0) * (item.quantity || 1));
            const icon = SERVICE_TYPE_ICONS[item.type] || '📦';
            const label = SERVICE_TYPE_LABELS[item.type] || 'Serviço';
            const badgeClass = SERVICE_TYPE_BADGE_CLASSES[item.type] || 'badge-neutral';

            return (
              <div
                key={item.id || idx}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                {/* Header do Item: Tipo, Identificador e Ação */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '0.5rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`badge ${badgeClass}`} style={{ fontSize: '12px', fontWeight: 600 }}>
                      {icon} {label}
                    </span>
                    {item.destination && item.type === 'accommodation' && (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        📍 {item.destination}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Subtotal: {formatMoney(subtotal, item.currency)}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger-outline"
                        onClick={() => handleRemoveService(idx)}
                        title="Remover serviço"
                        style={{ padding: '2px 8px', fontSize: '12px' }}
                      >
                        ✕ Remover
                      </button>
                    )}
                  </div>
                </div>

                {/* Linha 1: Descrição e Campos Específicos do Tipo */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      item.type === 'accommodation'
                        ? 'repeat(auto-fit, minmax(220px, 1fr))'
                        : item.type === 'outbound_transport' || item.type === 'inbound_transport'
                        ? '2fr 1fr 1fr'
                        : '1fr',
                    gap: '0.75rem',
                  }}
                >
                  {/* Descrição Principal */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '12px', marginBottom: '3px' }}>
                      {item.type === 'accommodation'
                        ? 'Nome do Hotel / Acomodação *'
                        : item.type === 'outbound_transport'
                        ? 'Rota / Cia Aérea de Ida *'
                        : item.type === 'inbound_transport'
                        ? 'Rota / Cia Aérea de Volta *'
                        : item.type === 'transfer'
                        ? 'Descrição do Transfer *'
                        : item.type === 'insurance'
                        ? 'Descrição do Seguro *'
                        : 'Descrição do Serviço *'}
                    </label>

                    {item.type === 'accommodation' && !readOnly ? (
                      <ServiceAutocomplete
                        id={`hotel-${item.id}`}
                        value={item.description}
                        onChange={(val) => handleUpdateService(idx, { description: val })}
                        onSelect={(srv: FavoriteService) => {
                          const dest = [srv.city, srv.country].filter(Boolean).join(', ');
                          handleUpdateService(idx, {
                            description: srv.name,
                            destination: dest || item.destination,
                          });
                        }}
                        onAddNewService={(query) => {
                          if (onAddNewService) onAddNewService('hotel', query);
                        }}
                        serviceType="hotel"
                        placeholder="Ex: Four Seasons Resort"
                      />
                    ) : (
                      <input
                        type="text"
                        className="form-input"
                        value={item.description}
                        disabled={readOnly}
                        onChange={(e) => handleUpdateService(idx, { description: e.target.value })}
                        placeholder={
                          item.type === 'outbound_transport'
                            ? 'Ex: LIS → CDG (Air France AF-1024)'
                            : item.type === 'inbound_transport'
                            ? 'Ex: CDG → LIS (Air France AF-1025)'
                            : item.type === 'transfer'
                            ? 'Ex: Aeroporto → Hotel (Privativo)'
                            : item.type === 'insurance'
                            ? 'Ex: Seguro-viagem Internacional (Mawdy / IATI)'
                            : item.type === 'taxes'
                            ? 'Ex: Taxa turística municipal de Paris'
                            : 'Ex: Passeio de barco / Ingresso museu'
                        }
                      />
                    )}
                  </div>

                  {/* Campos Específicos: Transporte (Horários) */}
                  {(item.type === 'outbound_transport' || item.type === 'inbound_transport') && (
                    <>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px', marginBottom: '3px' }}>
                          Horário de Partida
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={item.departureTime || ''}
                          disabled={readOnly}
                          onChange={(e) => handleUpdateService(idx, { departureTime: e.target.value })}
                          placeholder="Ex: 06:15"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px', marginBottom: '3px' }}>
                          Horário de Chegada
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={item.arrivalTime || ''}
                          disabled={readOnly}
                          onChange={(e) => handleUpdateService(idx, { arrivalTime: e.target.value })}
                          placeholder="Ex: 09:25"
                        />
                      </div>
                    </>
                  )}

                  {/* Campos Específicos: Hospedagem (Destino e Regime) */}
                  {item.type === 'accommodation' && (
                    <>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px', marginBottom: '3px' }}>
                          Destino Específico do Hotel
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={item.destination || ''}
                          disabled={readOnly}
                          onChange={(e) => handleUpdateService(idx, { destination: e.target.value })}
                          placeholder="Ex: Paris, França"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px', marginBottom: '3px' }}>
                          Regime de Acomodação
                        </label>
                        <select
                          className="form-select"
                          value={item.mealPlan || 'Café da manhã (BB)'}
                          disabled={readOnly}
                          onChange={(e) => handleUpdateService(idx, { mealPlan: e.target.value })}
                        >
                          {MEAL_PLAN_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* Linha 2: Informações Financeiras e Observação */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 100px 90px 1fr',
                    gap: '0.75rem',
                    alignItems: 'center',
                  }}
                >
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '2px' }}>
                      Custo Unitário
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      style={{ textAlign: 'right' }}
                      value={item.amount === 0 ? '' : item.amount}
                      disabled={readOnly}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        handleUpdateService(idx, { amount: isNaN(val) ? 0 : val });
                      }}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '2px' }}>
                      Moeda
                    </label>
                    <select
                      className="form-select"
                      value={item.currency || baseCurrency}
                      disabled={readOnly}
                      onChange={(e) => handleUpdateService(idx, { currency: e.target.value as Currency })}
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="BRL">BRL (R$)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '2px' }}>
                      Qtd.
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      style={{ textAlign: 'center' }}
                      value={item.quantity || 1}
                      disabled={readOnly}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        handleUpdateService(idx, { quantity: isNaN(val) || val < 1 ? 1 : val });
                      }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '2px' }}>
                      Observação opcional...
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={item.notes || ''}
                      disabled={readOnly}
                      onChange={(e) => handleUpdateService(idx, { notes: e.target.value })}
                      placeholder="Ex: Bagagem despachada inclusa, quarto standard, cancelamento gratuito..."
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Painel Consolidado: Resumo Financeiro Determinístico */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '0.75rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Resumo Financeiro
              </h3>
              <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                Fonte única: services[]
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Valores calculados em {baseCurrency}. Divisor comercial: {payingPassengers || 1} passageiro(s) pagante(s).
            </p>
          </div>

          {/* Campo Comercial: Preço de Venda */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              background: 'var(--bg-surface-elevated)',
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Preço de Venda ({baseCurrency}):
              </label>
              {!readOnly && (
                isManualSalePrice ? (
                  <button
                    type="button"
                    onClick={handleResetToAutoPrice}
                    className="badge"
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      border: '1px solid rgba(234, 179, 8, 0.4)',
                      background: 'rgba(234, 179, 8, 0.12)',
                      color: '#eab308',
                      borderRadius: '4px',
                    }}
                    title="Preço editado manualmente. Clique para voltar ao cálculo automático: custos + 12% margem"
                  >
                    ↺ Manual (redefinir 12%)
                  </button>
                ) : (
                  <span
                    className="badge"
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      background: 'rgba(59, 130, 246, 0.12)',
                      color: 'var(--accent-primary)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '4px',
                    }}
                    title="Calculado automaticamente: custos + 12% de margem"
                  >
                    Auto (+12%)
                  </span>
                )
              )}
            </div>

            {readOnly ? (
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatMoney(salePrice, baseCurrency)}
              </span>
            ) : (
              <input
                type="number"
                step="0.01"
                min="0"
                value={salePrice === 0 ? '' : salePrice}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  handleManualSalePriceChange(isNaN(val) ? 0 : val);
                }}
                placeholder="0.00"
                className="form-input"
                style={{ width: '110px', textAlign: 'right', fontWeight: 600, fontSize: '14px' }}
              />
            )}
          </div>
        </div>

        {/* Câmbio Manual caso haja moedas divergentes */}
        {summary.exchangeRateUsed !== undefined && summary.conversionError && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              background: 'var(--warning-soft)',
              border: '1px solid var(--warning)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              color: 'var(--warning)',
            }}
          >
            ⚠️ {summary.conversionError}
            {onChangeExchangeRate && !readOnly && (
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label>Informe a taxa de câmbio (1 EUR = X BRL):</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  className="form-input"
                  style={{ width: '100px' }}
                  value={exchangeRate || ''}
                  onChange={(e) => {
                    const r = parseFloat(e.target.value);
                    onChangeExchangeRate(isNaN(r) ? null : r);
                  }}
                  placeholder="Ex: 6.20"
                />
              </div>
            )}
          </div>
        )}

        {/* 6 KPIs Calculados */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Custo total */}
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.65rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                <span>Custo total</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>auto</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {formatMoney(summary.totalCost, baseCurrency)}
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {services.length} serviço(s)
            </span>
          </div>

          {/* Impostos e taxas */}
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.65rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                <span>Impostos/taxas</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>auto</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {formatMoney(summary.taxesAndFeesTotal, baseCurrency)}
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Subtotal de taxas
            </span>
          </div>

          {/* Preço de venda */}
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid rgba(0, 102, 255, 0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.65rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 500 }}>
                <span>Preço de venda</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent-primary)', marginTop: '0.25rem' }}>
                {formatMoney(salePrice, baseCurrency)}
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Total comercial
            </span>
          </div>

          {/* Preço por pessoa */}
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.65rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                <span>Preço / pessoa</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>auto</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {formatMoney(summary.pricePerPerson, baseCurrency)}
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Por pagante ({payingPassengers || 1})
            </span>
          </div>

          {/* Lucro bruto */}
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.65rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                <span>Lucro bruto</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>auto</span>
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: summary.profit >= 0 ? 'var(--success)' : 'var(--danger)',
                  marginTop: '0.25rem',
                }}
              >
                {formatMoney(summary.profit, baseCurrency)}
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Venda - Custo
            </span>
          </div>

          {/* Margem percentual */}
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.65rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                <span>Margem</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>auto</span>
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: summary.profitPercent >= 0 ? 'var(--success)' : 'var(--danger)',
                  marginTop: '0.25rem',
                }}
              >
                {formatPercent(summary.profitPercent)}
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Sobre venda
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
