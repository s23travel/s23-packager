import React from 'react';
import { Currency, ServiceItem, ServiceType, SERVICE_TYPE_LABELS } from '../../types';
import { formatMoney, roundMoney } from '../../services/financeService';

interface ServicesDetailViewProps {
  services: ServiceItem[];
  currency?: Currency;
  emptyMessage?: string;
  title?: string;
}

interface ServiceMeta {
  label: string;
  icon: string;
}

const SERVICE_TYPE_META: Record<ServiceType, ServiceMeta> = {
  outbound_transport: { label: 'Ida', icon: '🛫' },
  inbound_transport:  { label: 'Volta', icon: '🛬' },
  accommodation:      { label: 'Hotel', icon: '🏨' },
  transfer:           { label: 'Transfer', icon: '🚐' },
  insurance:          { label: 'Seguro', icon: '🛡️' },
  additional:         { label: 'Extra', icon: '🎫' },
  taxes:              { label: 'Taxa', icon: '🏛️' },
  other:              { label: 'Outro', icon: '📦' },
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

function getServiceRowData(item: ServiceItem) {
  const isTransport = item.type === 'outbound_transport' || item.type === 'inbound_transport';

  // 1. Nome/Provedor em destaque na coluna Serviço
  let serviceTitle = '';
  if (isTransport) {
    serviceTitle = item.carrier?.trim() || item.description?.trim() || SERVICE_TYPE_LABELS[item.type];
  } else if (item.type === 'accommodation') {
    serviceTitle = item.description?.trim() || 'Hospedagem';
  } else {
    serviceTitle = item.description?.trim() || SERVICE_TYPE_LABELS[item.type] || 'Serviço';
  }

  // 2. Detalhes operacionais e itinerário
  let detailsMain: string | null = null;
  let notesExtra: string | null = item.notes?.trim() || null;

  if (isTransport) {
    // Se carrier foi usado como título, description representa a rota (evita duplicar)
    const hasDistinctRoute =
      Boolean(item.carrier?.trim()) &&
      Boolean(item.description?.trim()) &&
      item.description?.trim().toLowerCase() !== item.carrier?.trim().toLowerCase();

    const route = hasDistinctRoute ? item.description?.trim() : null;

    // Horários de voo/trajeto
    let schedule: string | null = null;
    if (item.departureTime && item.arrivalTime) {
      schedule = `${item.departureTime} → ${item.arrivalTime}`;
    } else if (item.departureTime) {
      schedule = `Partida ${item.departureTime}`;
    } else if (item.arrivalTime) {
      schedule = `Chegada ${item.arrivalTime}`;
    }

    const parts = [route, schedule].filter(Boolean);
    detailsMain = parts.length > 0 ? parts.join(' · ') : null;
  } else if (item.type === 'accommodation') {
    const parts = [item.destination?.trim(), item.mealPlan?.trim()].filter(Boolean);
    detailsMain = parts.length > 0 ? parts.join(' · ') : null;
  } else {
    // Para transfer, insurance, additional, taxes, other
    detailsMain = notesExtra;
    notesExtra = null;
  }

  // Se não houver detalhe principal mas houver nota secundária, promove a nota
  if (!detailsMain && notesExtra) {
    detailsMain = notesExtra;
    notesExtra = null;
  }

  return { serviceTitle, detailsMain, notesExtra };
}

export const ServicesDetailView: React.FC<ServicesDetailViewProps> = ({
  services = [],
  currency = 'EUR',
  emptyMessage = 'Nenhum serviço cadastrado.',
  title = 'Serviços e Itinerário do Pacote',
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

  // Ordena os serviços mantendo a sequência semântica (Ida -> Volta -> Hotel -> etc.)
  const sortedServices = [...services].sort((a, b) => {
    const indexA = SERVICE_TYPE_ORDER.indexOf(a.type);
    const indexB = SERVICE_TYPE_ORDER.indexOf(b.type);
    const orderA = indexA === -1 ? 99 : indexA;
    const orderB = indexB === -1 ? 99 : indexB;
    return orderA - orderB;
  });

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Cabeçalho Compacto Operacional */}
      <div
        style={{
          padding: '0.75rem 1rem',
          background: 'var(--bg-surface-elevated)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          {title}
        </h3>
        <span className="badge badge-neutral" style={{ fontSize: '11px', fontWeight: 500 }}>
          {services.length} {services.length === 1 ? 'serviço' : 'serviços'}
        </span>
      </div>

      {/* Tabela Única Consolidada: Operacional + Custos */}
      <div className="table-responsive">
        <table className="data-table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th style={{ width: '105px', padding: '0.5rem 0.75rem' }}>Tipo</th>
              <th style={{ width: '180px', padding: '0.5rem 0.75rem' }}>Serviço</th>
              <th style={{ padding: '0.5rem 0.75rem' }}>Detalhes / Itinerário</th>
              <th style={{ width: '60px', textAlign: 'center', padding: '0.5rem 0.75rem' }}>Qtd.</th>
              <th style={{ width: '70px', textAlign: 'center', padding: '0.5rem 0.75rem' }}>Moeda</th>
              <th style={{ width: '110px', textAlign: 'right', padding: '0.5rem 0.75rem' }}>Valor unit.</th>
              <th style={{ width: '115px', textAlign: 'right', padding: '0.5rem 0.75rem' }}>Custo</th>
            </tr>
          </thead>
          <tbody>
            {sortedServices.map((item, idx) => {
              const meta = SERVICE_TYPE_META[item.type] || { label: 'Outro', icon: '📦' };
              const { serviceTitle, detailsMain, notesExtra } = getServiceRowData(item);
              const itemCurrency = item.currency || currency;
              const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
              const subtotal = roundMoney((item.amount || 0) * qty);

              return (
                <tr key={item.id || idx}>
                  {/* Tipo */}
                  <td style={{ padding: '0.55rem 0.75rem', whiteSpace: 'nowrap', verticalAlign: 'middle', width: '105px' }}>
                    <span
                      className="badge badge-neutral"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '11px',
                        fontWeight: 500,
                        padding: '2px 7px',
                      }}
                    >
                      <span role="img" aria-label={meta.label}>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </span>
                  </td>

                  {/* Serviço / Provedor */}
                  <td style={{ padding: '0.55rem 0.75rem', verticalAlign: 'middle', width: '180px' }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        lineHeight: '18px',
                      }}
                    >
                      {serviceTitle}
                    </div>
                  </td>

                  {/* Detalhes / Itinerário */}
                  <td style={{ padding: '0.55rem 0.75rem', verticalAlign: 'middle' }}>
                    {detailsMain ? (
                      <div
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                          lineHeight: '18px',
                        }}
                      >
                        {detailsMain}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>—</span>
                    )}

                    {notesExtra && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          marginTop: '2px',
                          lineHeight: '14px',
                        }}
                      >
                        {notesExtra}
                      </div>
                    )}
                  </td>

                  {/* Quantidade */}
                  <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle', width: '60px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '13px' }}>
                      {qty}
                    </span>
                  </td>

                  {/* Moeda */}
                  <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle', width: '70px' }}>
                    <span className="badge badge-neutral" style={{ fontSize: '11px', padding: '1px 6px' }}>
                      {itemCurrency}
                    </span>
                  </td>

                  {/* Valor unitário */}
                  <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle', width: '110px' }}>
                    {item.amount > 0 ? (
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {formatMoney(item.amount, itemCurrency)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                        Incluso
                      </span>
                    )}
                  </td>

                  {/* Custo Total */}
                  <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle', width: '115px' }}>
                    {item.amount > 0 ? (
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                        {formatMoney(subtotal, itemCurrency)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                        Incluso
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
