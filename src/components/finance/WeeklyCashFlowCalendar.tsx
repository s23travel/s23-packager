import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { financialService } from '../../services/financialService';
import {
  PeriodCashFlowForecast,
  PendingCommitmentItem,
  Currency,
} from '../../types';

// Utilitários de manipulação de datas para semanas (Segunda a Domingo)
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Se for domingo (0), volta 6 dias; senão volta day - 1
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function addDays(date: Date, days: number): Date {
  const res = new Date(date);
  res.setDate(res.getDate() + days);
  return res;
}

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

export function formatLongDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

const formatMoney = (val: number, curr: Currency) => {
  return new Intl.NumberFormat(curr === 'BRL' ? 'pt-BR' : 'pt-PT', {
    style: 'currency',
    currency: curr,
  }).format(val || 0);
};

const WEEKDAY_NAMES = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo',
];

const WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

interface DaySummary {
  date: Date;
  dateStr: string;
  weekdayName: string;
  weekdayShort: string;
  isToday: boolean;
  isPast: boolean;
  commitments: PendingCommitmentItem[];
  // EUR
  eurInflows: number;
  eurOutflows: number;
  eurNet: number;
  // BRL
  brlInflows: number;
  brlOutflows: number;
  brlNet: number;
  hasMovements: boolean;
}

interface WeeklyCashFlowCalendarProps {
  onCommitmentClick?: (commitment: PendingCommitmentItem) => void;
  refreshTrigger?: number;
}

export const WeeklyCashFlowCalendar: React.FC<WeeklyCashFlowCalendarProps> = ({
  refreshTrigger,
}) => {
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null);
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'EUR' | 'BRL'>('ALL');

  const [forecast, setForecast] = useState<PeriodCashFlowForecast[]>([]);
  const [commitments, setCommitments] = useState<PendingCommitmentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const startDateStr = useMemo(() => formatIsoDate(currentMonday), [currentMonday]);
  const endDateStr = useMemo(() => formatIsoDate(addDays(currentMonday, 6)), [currentMonday]);

  // Carregar dados da semana usando exclusivamente métodos da Fase 3A
  const loadWeekData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [forecastRes, commitmentsRes] = await Promise.all([
        financialService.getPeriodCashFlowForecast(startDateStr, endDateStr),
        financialService.getPendingCommitments({
          startDate: startDateStr,
          endDate: endDateStr,
        }),
      ]);
      setForecast(forecastRes);
      setCommitments(commitmentsRes);
    } catch (err: any) {
      console.error('Erro ao carregar calendário semanal de vencimentos:', err);
      setError(err?.message || 'Falha ao carregar vencimentos da semana.');
    } finally {
      setLoading(false);
    }
  }, [startDateStr, endDateStr, refreshTrigger]);

  useEffect(() => {
    loadWeekData();
  }, [loadWeekData]);


  // Navegação semanal
  const handlePrevWeek = () => {
    setSelectedDayStr(null);
    setCurrentMonday((prev) => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setSelectedDayStr(null);
    setCurrentMonday((prev) => addDays(prev, 7));
  };

  const handleCurrentWeek = () => {
    setSelectedDayStr(null);
    setCurrentMonday(getMonday(new Date()));
  };

  const isCurrentWeek = useMemo(() => {
    const thisMonday = getMonday(new Date());
    return formatIsoDate(thisMonday) === startDateStr;
  }, [startDateStr]);

  const todayIso = useMemo(() => formatIsoDate(new Date()), []);

  // Agregar dados por cada um dos 7 dias da semana
  const weekDays = useMemo<DaySummary[]>(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(currentMonday, i);
      const dateStr = formatIsoDate(d);
      const isToday = dateStr === todayIso;
      const isPast = dateStr < todayIso;

      const dayCommitments = commitments.filter((c) => c.expected_date === dateStr);

      let eurIn = 0;
      let eurOut = 0;
      let brlIn = 0;
      let brlOut = 0;

      for (const item of dayCommitments) {
        if (item.currency === 'EUR') {
          if (item.type === 'receivable') {
            eurIn += item.pending_amount;
          } else {
            eurOut += item.pending_amount;
          }
        } else if (item.currency === 'BRL') {
          if (item.type === 'receivable') {
            brlIn += item.pending_amount;
          } else {
            brlOut += item.pending_amount;
          }
        }
      }

      const hasMovements = dayCommitments.length > 0;

      return {
        date: d,
        dateStr,
        weekdayName: WEEKDAY_NAMES[i],
        weekdayShort: WEEKDAY_SHORT[i],
        isToday,
        isPast,
        commitments: dayCommitments,
        eurInflows: eurIn,
        eurOutflows: eurOut,
        eurNet: eurIn - eurOut,
        brlInflows: brlIn,
        brlOutflows: brlOut,
        brlNet: brlIn - brlOut,
        hasMovements,
      };
    });
  }, [currentMonday, todayIso, commitments]);

  // Dia atualmente selecionado para o painel de detalhes (drawer)
  const selectedDaySummary = useMemo(() => {
    if (!selectedDayStr) return null;
    return weekDays.find((d) => d.dateStr === selectedDayStr) || null;
  }, [selectedDayStr, weekDays]);

  // Filtrar compromissos do drawer por moeda selecionada
  const drawerCommitments = useMemo(() => {
    if (!selectedDaySummary) return [];
    if (currencyFilter === 'ALL') return selectedDaySummary.commitments;
    return selectedDaySummary.commitments.filter((c) => c.currency === currencyFilter);
  }, [selectedDaySummary, currencyFilter]);

  // Totais consolidados da semana por moeda (vindos de getPeriodCashFlowForecast)
  const eurForecast = forecast.find((f) => f.currency === 'EUR');
  const brlForecast = forecast.find((f) => f.currency === 'BRL');

  return (
    <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Cabeçalho do Calendário e Controles de Navegação */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '20px' }}>🗓️</span>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Calendário semanal de vencimentos
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Segunda a domingo • Previsão de entradas e saídas diárias
            </span>
          </div>
        </div>

        {/* Controles de Navegação e Filtros */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Filtro de moeda */}
          <div style={{ display: 'flex', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setCurrencyFilter('ALL')}
              className="btn btn-sm"
              style={{
                backgroundColor: currencyFilter === 'ALL' ? 'var(--accent-primary)' : 'var(--bg-surface)',
                color: currencyFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                borderRadius: 0,
                border: 'none',
                fontWeight: currencyFilter === 'ALL' ? 600 : 400,
              }}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setCurrencyFilter('EUR')}
              className="btn btn-sm"
              style={{
                backgroundColor: currencyFilter === 'EUR' ? 'var(--accent-primary)' : 'var(--bg-surface)',
                color: currencyFilter === 'EUR' ? '#ffffff' : 'var(--text-secondary)',
                borderRadius: 0,
                border: 'none',
                fontWeight: currencyFilter === 'EUR' ? 600 : 400,
              }}
            >
              EUR
            </button>
            <button
              type="button"
              onClick={() => setCurrencyFilter('BRL')}
              className="btn btn-sm"
              style={{
                backgroundColor: currencyFilter === 'BRL' ? 'var(--accent-primary)' : 'var(--bg-surface)',
                color: currencyFilter === 'BRL' ? '#ffffff' : 'var(--text-secondary)',
                borderRadius: 0,
                border: 'none',
                fontWeight: currencyFilter === 'BRL' ? 600 : 400,
              }}
            >
              BRL
            </button>
          </div>

          {/* Navegação de semanas */}
          <button
            type="button"
            onClick={handlePrevWeek}
            className="btn btn-sm btn-secondary"
            title="Semana anterior"
          >
            ← Anterior
          </button>

          {!isCurrentWeek && (
            <button
              type="button"
              onClick={handleCurrentWeek}
              className="btn btn-sm btn-secondary"
              title="Voltar para a semana atual"
            >
              Hoje
            </button>
          )}

          <button
            type="button"
            onClick={handleNextWeek}
            className="btn btn-sm btn-secondary"
            title="Semana seguinte"
          >
            Seguinte →
          </button>
        </div>
      </div>

      {/* Faixa de Período e Resumo Consolidado da Semana */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          backgroundColor: 'var(--bg-surface-elevated)',
          padding: '0.65rem 0.9rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
            Semana de {formatShortDate(currentMonday)} a {formatShortDate(addDays(currentMonday, 6))}
          </strong>
          {isCurrentWeek && (
            <span
              className="badge"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent-primary)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              Semana atual
            </span>
          )}
        </div>

        {/* Resumo da semana por moeda (EUR e BRL rigorosamente separados) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '12px' }}>
          {(currencyFilter === 'ALL' || currencyFilter === 'EUR') && eurForecast && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>EUR:</span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                +{formatMoney(eurForecast.expected_inflows, 'EUR')}
              </span>
              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                -{formatMoney(eurForecast.expected_outflows, 'EUR')}
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color: eurForecast.net_cash_flow >= 0 ? 'var(--text-primary)' : 'var(--danger)',
                }}
              >
                (Líq: {formatMoney(eurForecast.net_cash_flow, 'EUR')})
              </span>
            </div>
          )}

          {(currencyFilter === 'ALL' || currencyFilter === 'BRL') && brlForecast && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>BRL:</span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                +{formatMoney(brlForecast.expected_inflows, 'BRL')}
              </span>
              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                -{formatMoney(brlForecast.expected_outflows, 'BRL')}
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color: brlForecast.net_cash_flow >= 0 ? 'var(--text-primary)' : 'var(--danger)',
                }}
              >
                (Líq: {formatMoney(brlForecast.net_cash_flow, 'BRL')})
              </span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '0.65rem 0.85rem',
            backgroundColor: 'var(--danger-soft)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--danger)',
            fontSize: '12px',
          }}
        >
          {error}
        </div>
      )}

      {/* Grid Semanal de 7 Dias (Segunda a Domingo) */}
      <div
        className="calendar-week-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: '0.6rem',
        }}
      >
        {weekDays.map((day) => {
          const isSelected = selectedDayStr === day.dateStr;
          const showEur = currencyFilter === 'ALL' || currencyFilter === 'EUR';
          const showBrl = currencyFilter === 'ALL' || currencyFilter === 'BRL';

          const hasEurMovements = day.eurInflows > 0 || day.eurOutflows > 0;
          const hasBrlMovements = day.brlInflows > 0 || day.brlOutflows > 0;
          const hasDisplayMovements =
            (showEur && hasEurMovements) || (showBrl && hasBrlMovements);

          return (
            <div
              key={day.dateStr}
              onClick={() => setSelectedDayStr(day.dateStr)}
              className="calendar-day-card"
              style={{
                backgroundColor: isSelected
                  ? 'var(--accent-soft)'
                  : day.isToday
                  ? 'var(--bg-surface-elevated)'
                  : 'var(--bg-surface)',
                border: isSelected
                  ? '2px solid var(--accent-primary)'
                  : day.isToday
                  ? '2px solid var(--accent-primary)'
                  : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '145px',
                transition: 'all var(--transition-fast)',
                position: 'relative',
              }}
              title="Clique para abrir detalhes do dia"
            >
              {/* Header do Card Diário */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.4rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: day.isToday ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {day.weekdayShort}
                  </span>

                  {day.isToday && (
                    <span
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      HOJE
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem',
                  }}
                >
                  {formatShortDate(day.date)}
                </div>

                {/* Movimentos do Dia */}
                {loading ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    ...
                  </div>
                ) : !hasDisplayMovements ? (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                      marginTop: '0.4rem',
                    }}
                  >
                    Sem movimentos
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '11px' }}>
                    {/* Bloco EUR se houver */}
                    {showEur && hasEurMovements && (
                      <div
                        style={{
                          backgroundColor: 'var(--bg-surface-elevated)',
                          padding: '0.25rem 0.35rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '1px' }}>
                          EUR
                        </div>
                        {day.eurInflows > 0 && (
                          <div style={{ color: 'var(--success)', fontWeight: 600 }}>
                            +{formatMoney(day.eurInflows, 'EUR')}
                          </div>
                        )}
                        {day.eurOutflows > 0 && (
                          <div style={{ color: 'var(--danger)', fontWeight: 600 }}>
                            -{formatMoney(day.eurOutflows, 'EUR')}
                          </div>
                        )}
                        <div
                          style={{
                            fontWeight: 700,
                            color: day.eurNet >= 0 ? 'var(--text-primary)' : 'var(--danger)',
                            borderTop: '1px dotted var(--border-subtle)',
                            marginTop: '2px',
                            paddingTop: '1px',
                          }}
                        >
                          Líq: {formatMoney(day.eurNet, 'EUR')}
                        </div>
                      </div>
                    )}

                    {/* Bloco BRL se houver */}
                    {showBrl && hasBrlMovements && (
                      <div
                        style={{
                          backgroundColor: 'var(--bg-surface-elevated)',
                          padding: '0.25rem 0.35rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '1px' }}>
                          BRL
                        </div>
                        {day.brlInflows > 0 && (
                          <div style={{ color: 'var(--success)', fontWeight: 600 }}>
                            +{formatMoney(day.brlInflows, 'BRL')}
                          </div>
                        )}
                        {day.brlOutflows > 0 && (
                          <div style={{ color: 'var(--danger)', fontWeight: 600 }}>
                            -{formatMoney(day.brlOutflows, 'BRL')}
                          </div>
                        )}
                        <div
                          style={{
                            fontWeight: 700,
                            color: day.brlNet >= 0 ? 'var(--text-primary)' : 'var(--danger)',
                            borderTop: '1px dotted var(--border-subtle)',
                            marginTop: '2px',
                            paddingTop: '1px',
                          }}
                        >
                          Líq: {formatMoney(day.brlNet, 'BRL')}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Rodapé do Card: Contador de Itens */}
              <div
                style={{
                  marginTop: '0.6rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '0.4rem',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                }}
              >
                <span>{day.commitments.length} item(ns)</span>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                  Ver &rarr;
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* DRAWER / PAINEL LATERAL DE COMPROMISSOS DO DIA SELECIONADO            */}
      {/* ===================================================================== */}
      {selectedDaySummary && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setSelectedDayStr(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: 'var(--bg-surface)',
              height: '100%',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1001,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Drawer */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-surface-elevated)',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--accent-primary)',
                    letterSpacing: '0.05em',
                  }}
                >
                  Detalhamento diário de vencimentos
                </span>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    margin: '0.2rem 0 0 0',
                    textTransform: 'capitalize',
                  }}
                >
                  {formatLongDate(selectedDaySummary.dateStr)}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDayStr(null)}
                className="btn btn-sm btn-secondary"
                style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
                title="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Resumo Financeiro do Dia */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-app)',
                display: 'grid',
                gridTemplateColumns: currencyFilter === 'ALL' ? '1fr 1fr' : '1fr',
                gap: '0.75rem',
              }}
            >
              {/* Resumo EUR */}
              {(currencyFilter === 'ALL' || currencyFilter === 'EUR') && (
                <div
                  style={{
                    padding: '0.65rem 0.75rem',
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    PORTUGAL / EUR
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '0.2rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Entradas:</span>
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                      +{formatMoney(selectedDaySummary.eurInflows, 'EUR')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '0.15rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Saídas:</span>
                    <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                      -{formatMoney(selectedDaySummary.eurOutflows, 'EUR')}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderTop: '1px solid var(--border-subtle)',
                      marginTop: '0.35rem',
                      paddingTop: '0.25rem',
                      color: selectedDaySummary.eurNet >= 0 ? 'var(--text-primary)' : 'var(--danger)',
                    }}
                  >
                    <span>Saldo Líquido:</span>
                    <span>{formatMoney(selectedDaySummary.eurNet, 'EUR')}</span>
                  </div>
                </div>
              )}

              {/* Resumo BRL */}
              {(currencyFilter === 'ALL' || currencyFilter === 'BRL') && (
                <div
                  style={{
                    padding: '0.65rem 0.75rem',
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    BRASIL / BRL
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '0.2rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Entradas:</span>
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                      +{formatMoney(selectedDaySummary.brlInflows, 'BRL')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '0.15rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Saídas:</span>
                    <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                      -{formatMoney(selectedDaySummary.brlOutflows, 'BRL')}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderTop: '1px solid var(--border-subtle)',
                      marginTop: '0.35rem',
                      paddingTop: '0.25rem',
                      color: selectedDaySummary.brlNet >= 0 ? 'var(--text-primary)' : 'var(--danger)',
                    }}
                  >
                    <span>Saldo Líquido:</span>
                    <span>{formatMoney(selectedDaySummary.brlNet, 'BRL')}</span>
                  </div>
                </div>
              )}
            </div>


            {/* Lista de Compromissos do Dia */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                  Compromissos ({drawerCommitments.length})
                </strong>
                {selectedDaySummary.isPast && (
                  <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 600 }}>
                    ⚠️ Vencidos
                  </span>
                )}
              </div>

              {drawerCommitments.length === 0 ? (
                <div
                  style={{
                    padding: '2.5rem 1rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '13px',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  Nenhum compromisso financeiro previsto para este dia.
                </div>
              ) : (
                drawerCommitments.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.85rem 1rem',
                      backgroundColor: 'var(--bg-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    {/* Linha superior: Tipo e Valor */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        className="badge"
                        style={{
                          backgroundColor:
                            item.type === 'receivable' ? 'var(--success-soft)' : 'var(--danger-soft)',
                          color: item.type === 'receivable' ? 'var(--success)' : 'var(--danger)',
                          fontWeight: 600,
                          fontSize: '11px',
                        }}
                      >
                        {item.type === 'receivable' ? 'Recebível (Entrada)' : 'Pagável (Saída)'}
                      </span>

                      <span
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: item.type === 'receivable' ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {item.type === 'receivable' ? '+' : '-'}
                        {formatMoney(item.pending_amount, item.currency)}
                      </span>
                    </div>

                    {/* Contraparte e Descrição */}
                    <div>
                      <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                        {item.counterparty_name}
                      </strong>
                      {item.description && (
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Metadados: Cotação e Conta Esperada */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '0.5rem',
                        fontSize: '11px',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        padding: '0.45rem 0.65rem',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Cotação:</span>{' '}
                        {item.quotation_reference ? (
                          <strong style={{ color: 'var(--text-primary)' }}>{item.quotation_reference}</strong>
                        ) : (
                          '—'
                        )}
                        {item.quotation_client_name && (
                          <div style={{ color: 'var(--text-secondary)' }}>{item.quotation_client_name}</div>
                        )}
                      </div>

                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Conta Prevista:</span>{' '}
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {item.expected_account_name || 'Sem conta definida'}
                        </strong>
                        {item.is_credit_card_invoice && (
                          <div style={{ color: 'var(--warning)', fontWeight: 600 }}>Fatura de cartão</div>
                        )}
                      </div>
                    </div>

                    {/* Ação para abrir o fluxo financeiro da cotação para liquidação */}
                    {item.quotation_id && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                        <Link
                          to={`/cotacoes/${item.quotation_id}/financeiro`}
                          className="btn btn-sm btn-secondary"
                          style={{ fontSize: '12px' }}
                        >
                          Abrir liquidador na cotação &rarr;
                        </Link>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer do Drawer */}
            <div
              style={{
                padding: '0.85rem 1.5rem',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedDayStr(null)}
                className="btn btn-secondary"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
