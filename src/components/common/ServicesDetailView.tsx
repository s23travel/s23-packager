import React from 'react';
import { Currency, ServiceItem, ServiceType, SERVICE_TYPE_LABELS } from '../../types';
import { formatMoney, roundMoney } from '../../services/financeService';

interface ServicesDetailViewProps {
  services: ServiceItem[];
  currency?: Currency;
  emptyMessage?: string;
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

const SERVICE_TYPE_ORDER: ServiceType[] = [
  'outbound_transport',
  'inbound_transport',
  'accommodation',
  'transfer',
  'insurance',
  'additional',
  'taxes',
  'other',
];

export const ServicesDetailView: React.FC<ServicesDetailViewProps> = ({
  services = [],
  currency = 'EUR',
  emptyMessage = 'Nenhum serviço cadastrado.',
}) => {
  if (!services || services.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: '1.5rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  // Agrupa os serviços por ServiceType mantendo a ordem semântica
  const grouped: Partial<Record<ServiceType, ServiceItem[]>> = {};
  for (const type of SERVICE_TYPE_ORDER) {
    const items = services.filter((s) => s.type === type);
    if (items.length > 0) {
      grouped[type] = items;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {SERVICE_TYPE_ORDER.map((type) => {
        const items = grouped[type];
        if (!items || items.length === 0) return null;

        const icon = SERVICE_TYPE_ICONS[type] || '📦';
        const label = SERVICE_TYPE_LABELS[type] || 'Serviço';

        return (
          <div key={type} className="card" style={{ padding: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '0.6rem',
                marginBottom: '0.85rem',
              }}
            >
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  margin: 0,
                }}
              >
                <span>{icon}</span> {label}
              </h3>
              <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                {items.length} {items.length === 1 ? 'item' : 'itens'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {items.map((item, idx) => {
                const itemCurrency = item.currency || currency;
                const subtotal = roundMoney((item.amount || 0) * (item.quantity || 1));

                return (
                  <div
                    key={item.id || idx}
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                    }}
                  >
                    {/* Linha Principal: Descrição e Subtotal */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                        {item.description || 'Serviço sem descrição'}
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                        {item.amount > 0 ? (
                          <span>
                            {formatMoney(subtotal, itemCurrency)}
                            {item.quantity > 1 && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px' }}>
                                ({item.quantity}x {formatMoney(item.amount, itemCurrency)})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Incluso / Sem custo</span>
                        )}
                      </div>
                    </div>

                    {/* Metadados Específicos do Tipo */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {/* Companhia aérea */}
                      {item.carrier && (
                        <span>
                          <strong>Cia:</strong> {item.carrier}
                        </span>
                      )}

                      {/* Horários de Voo */}
                      {(item.departureTime || item.arrivalTime) && (
                        <span>
                          ⏰ <strong>Horários:</strong>{' '}
                          {item.departureTime && item.arrivalTime
                            ? `${item.departureTime} → ${item.arrivalTime}`
                            : item.departureTime
                            ? `Partida ${item.departureTime}`
                            : `Chegada ${item.arrivalTime}`}
                        </span>
                      )}

                      {/* Destino do Hotel */}
                      {item.destination && (
                        <span>
                          📍 <strong>Destino:</strong> {item.destination}
                        </span>
                      )}

                      {/* Regime de Acomodação */}
                      {item.mealPlan && (
                        <span>
                          🍽️ <strong>Regime:</strong> {item.mealPlan}
                        </span>
                      )}
                    </div>

                    {/* Observações */}
                    {item.notes && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          marginTop: '2px',
                          fontStyle: 'italic',
                        }}
                      >
                        Nota: {item.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
