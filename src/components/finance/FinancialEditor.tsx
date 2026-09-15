import React, { useMemo, useState, useEffect } from 'react';
import { CostCategory, CostComponent, Currency, PassengerConfig } from '../../types';
import {
  calculateFinancialSummary,
  COST_CATEGORY_LABELS,
  formatMoney,
  formatPercent,
  roundMoney,
} from '../../services/financeService';

interface AmountInputProps {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Campo numérico para valores monetários.
 * - Inicia vazio (com placeholder) quando o valor é 0 para evitar que o usuário precise apagar o 0 manualmente.
 * - Ao clicar ou focar com valor 0, limpa imediatamente para aceitar o novo input.
 * - Ao focar/clicar com valor existente, seleciona todo o texto para sobrescrita direta.
 */
const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  placeholder = '0.00',
  className = 'form-input',
  style,
}) => {
  const [text, setText] = useState<string>(value === 0 ? '' : String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setText(value === 0 ? '' : String(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    if (raw === '' || raw === '-') {
      onChange(0);
      return;
    }
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      onChange(Math.max(0, num));
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (text === '0' || value === 0) {
      setText('');
      onChange(0);
    } else {
      e.target.select();
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    if (text === '0' || value === 0) {
      setText('');
      onChange(0);
    } else {
      (e.target as HTMLInputElement).select();
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (text === '' || text === '0') {
      setText('');
      onChange(0);
    } else {
      const num = parseFloat(text);
      if (!isNaN(num) && num > 0) {
        onChange(num);
        setText(String(num));
      } else {
        setText('');
        onChange(0);
      }
    }
  };

  return (
    <input
      type="number"
      step="0.01"
      min="0"
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onClick={handleClick}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      style={style}
    />
  );
};

interface FinancialEditorProps {
  currency: Currency;
  components: CostComponent[];
  onChangeComponents: (components: CostComponent[]) => void;
  salePrice: number;
  onChangeSalePrice: (val: number) => void;
  exchangeRate?: number | null;
  onChangeExchangeRate?: (val: number | null) => void;
  exchangeRateDate?: string | null;
  onChangeExchangeRateDate?: (val: string) => void;
  passengers?: PassengerConfig;
  readOnly?: boolean;
}

export const FinancialEditor: React.FC<FinancialEditorProps> = ({
  currency,
  components,
  onChangeComponents,
  salePrice,
  onChangeSalePrice,
  exchangeRate,
  onChangeExchangeRate,
  exchangeRateDate,
  onChangeExchangeRateDate,
  passengers,
  readOnly = false,
}) => {
  // Cálculo determinístico em tempo real
  const summary = useMemo(() => {
    return calculateFinancialSummary({
      components,
      salePrice,
      targetCurrency: currency,
      exchangeRate,
      passengers,
    });
  }, [components, salePrice, currency, exchangeRate, passengers]);

  // Checagem se há moedas mistas
  const hasCurrencyMismatch = useMemo(() => {
    return components.some((c) => c.currency !== currency);
  }, [components, currency]);

  // Passageiros pagantes para exibição informativa
  const payingPassengers = useMemo(() => {
    const adults = Math.max(0, passengers?.adults ?? 0);
    const children = Math.max(0, passengers?.children ?? 0);
    const total = adults + children;
    return total > 0 ? total : 1;
  }, [passengers]);

  const handleAddComponent = () => {
    const newComponent: CostComponent = {
      id: `cost_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      category: 'services',
      description: '',
      amount: 0,
      currency: currency, // Inicia na moeda padrão
      quantity: 1,
      notes: '',
    };
    onChangeComponents([...components, newComponent]);
  };

  const handleUpdateComponent = (index: number, patch: Partial<CostComponent>) => {
    const updated = [...components];
    updated[index] = { ...updated[index], ...patch };
    onChangeComponents(updated);
  };

  const handleRemoveComponent = (index: number) => {
    const updated = components.filter((_, i) => i !== index);
    onChangeComponents(updated);
  };

  return (
    <div className="space-y-4">
      {/* Alerta de Câmbio / Conversão pendente */}
      {summary.conversionError && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded shadow-sm">
          <div>
            <h3 className="text-sm font-medium text-amber-800">
              Atenção: Conversão cambial pendente
            </h3>
            <p className="mt-0.5 text-xs text-amber-700">{summary.conversionError}</p>
            <p className="mt-0.5 text-xs text-amber-600">
              Regra: Nenhum cálculo financeiro ocorre silenciosamente entre moedas distintas sem uma taxa válida.
            </p>
          </div>
        </div>
      )}

      {/* Bloco de Configuração de Câmbio Manual */}
      {(hasCurrencyMismatch || exchangeRate !== undefined) && (
        <div className="bg-slate-50 border border-slate-200 rounded p-3 mb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Taxa de câmbio (1 EUR em BRL)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>1 € =</span>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  disabled={readOnly}
                  value={exchangeRate ?? ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (onChangeExchangeRate) {
                      onChangeExchangeRate(isNaN(val) ? null : val);
                    }
                  }}
                  placeholder="Ex: 6.1800"
                  className="form-input"
                  style={{ width: '120px' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>BRL</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Data de referência da taxa
              </label>
              <input
                type="date"
                disabled={readOnly}
                value={exchangeRateDate || ''}
                onChange={(e) => {
                  if (onChangeExchangeRateDate) {
                    onChangeExchangeRateDate(e.target.value);
                  }
                }}
                className="form-input"
                style={{ width: '160px' }}
              />
            </div>

            {hasCurrencyMismatch && (
              <div style={{ alignSelf: 'center', marginTop: '1rem' }}>
                <span className="badge badge-info">
                  Moedas mistas detectadas
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabela de Componentes de Custo */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Componentes de custo
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Discriminação de custos (transporte, hospedagem, taxas, etc.) que formam o custo total.
            </p>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAddComponent}
              className="btn btn-sm btn-action-primary"
            >
              + Adicionar Custo
            </button>
          )}
        </div>

        {components.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '13px', fontWeight: 500 }}>Nenhum componente de custo cadastrado.</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Adicione itens como transporte, hospedagem e taxas para alimentar o motor financeiro.
            </p>
            {!readOnly && (
              <button
                type="button"
                onClick={handleAddComponent}
                className="btn btn-sm btn-secondary"
                style={{ marginTop: '0.75rem' }}
              >
                + Adicionar primeiro custo
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Descrição</th>
                  <th style={{ textAlign: 'center', width: '70px' }}>Qtd</th>
                  <th style={{ width: '90px' }}>Moeda</th>
                  <th style={{ textAlign: 'right', width: '120px' }}>Valor unit.</th>
                  <th style={{ textAlign: 'right', width: '120px' }}>Subtotal</th>
                  {!readOnly && <th style={{ textAlign: 'center', width: '50px' }}>Ação</th>}
                </tr>
              </thead>
              <tbody>
                {components.map((comp, idx) => {
                  const qty = comp.quantity && comp.quantity > 0 ? comp.quantity : 1;
                  const itemSubtotal = roundMoney((comp.amount || 0) * qty);

                  return (
                    <tr key={comp.id || idx}>
                      <td>
                        {readOnly ? (
                          <span style={{ fontWeight: 500 }}>
                            {COST_CATEGORY_LABELS[comp.category] || comp.category}
                          </span>
                        ) : (
                          <select
                            value={comp.category}
                            onChange={(e) =>
                              handleUpdateComponent(idx, {
                                category: e.target.value as CostCategory,
                                isCustomized: true,
                              })
                            }
                            className="form-select"
                            style={{ padding: '0.3rem 0.5rem', fontSize: '13px' }}
                          >
                            <option value="outbound_transport">Transporte de ida</option>
                            <option value="inbound_transport">Transporte de volta</option>
                            <option value="lodging">Hospedagem</option>
                            <option value="services">Serviços adicionais</option>
                            <option value="taxes">Impostos/taxas</option>
                            <option value="other">Outros custos</option>
                          </select>
                        )}
                      </td>
                      <td>
                        {readOnly ? (
                          <div>
                            <div style={{ fontWeight: 500 }}>{comp.description || '—'}</div>
                            {comp.notes && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{comp.notes}</div>}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <input
                              type="text"
                              value={comp.description}
                              onChange={(e) =>
                                handleUpdateComponent(idx, {
                                  description: e.target.value,
                                  isCustomized: true,
                                })
                              }
                              placeholder="Ex: Voo LIS-MAD ou Hotel"
                              className="form-input"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '13px' }}
                            />
                            <input
                              type="text"
                              value={comp.notes || ''}
                              onChange={(e) => handleUpdateComponent(idx, { notes: e.target.value })}
                              placeholder="Observação opcional..."
                              className="form-input"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '11px', color: 'var(--text-secondary)' }}
                            />
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {readOnly ? (
                          <span>{qty}</span>
                        ) : (
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={comp.quantity ?? 1}
                            onChange={(e) =>
                              handleUpdateComponent(idx, {
                                quantity: Math.max(1, parseInt(e.target.value) || 1),
                              })
                            }
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            className="form-input"
                            style={{ width: '50px', textAlign: 'center', padding: '0.3rem 0.2rem', fontSize: '13px' }}
                          />
                        )}
                      </td>
                      <td>
                        {readOnly ? (
                          <span className="badge badge-neutral">{comp.currency}</span>
                        ) : (
                          <select
                            value={comp.currency}
                            onChange={(e) =>
                              handleUpdateComponent(idx, { currency: e.target.value as Currency })
                            }
                            className="form-select"
                            style={{ padding: '0.3rem 0.4rem', fontSize: '12px' }}
                          >
                            <option value="EUR">EUR (€)</option>
                            <option value="BRL">BRL (R$)</option>
                            <option value="USD">USD ($)</option>
                          </select>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {readOnly ? (
                          <span>{formatMoney(comp.amount || 0, comp.currency)}</span>
                        ) : (
                          <AmountInput
                            value={comp.amount || 0}
                            onChange={(val) =>
                              handleUpdateComponent(idx, {
                                amount: val,
                              })
                            }
                            placeholder="0.00"
                            className="form-input"
                            style={{ width: '95px', textAlign: 'right', padding: '0.3rem 0.4rem', fontSize: '13px' }}
                          />
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>
                        {formatMoney(itemSubtotal, comp.currency)}
                      </td>
                      {!readOnly && (
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveComponent(idx)}
                            className="btn btn-sm btn-danger-outline"
                            title="Remover componente"
                          >
                            ×
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Painel Consolidado: Resumo Financeiro (Clean Back-office) */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Resumo financeiro
              </h3>
              <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                Motor determinístico
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Cálculos na moeda da cotação ({currency}). Divisor: {payingPassengers} passageiro(s) pagante(s).
            </p>
          </div>

          {/* Campo de Preço de Venda */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-surface-elevated)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Preço de venda ({currency}):
            </label>
            {readOnly ? (
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatMoney(salePrice, currency)}
              </span>
            ) : (
              <AmountInput
                value={salePrice}
                onChange={onChangeSalePrice}
                placeholder="0.00"
                className="form-input"
                style={{ width: '110px', textAlign: 'right', fontWeight: 600, fontSize: '14px' }}
              />
            )}
          </div>
        </div>

        {/* 6 Métricas Calculadas em Grid Compacto com Nomes em Caixa Baixa */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Custo total */}
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                <span>Custo total</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>auto</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {formatMoney(summary.totalCost, currency)}
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {components.length} item(ns)
            </span>
          </div>

          {/* Impostos e taxas */}
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                <span>Impostos e taxas</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>auto</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {formatMoney(summary.taxesAndFeesTotal, currency)}
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Subtotal de taxas
            </span>
          </div>

          {/* Preço de venda */}
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid rgba(0, 102, 255, 0.25)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 500 }}>
                <span>Preço de venda</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent-primary)', marginTop: '0.25rem' }}>
                {formatMoney(summary.salePrice, currency)}
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Pacote completo
            </span>
          </div>

          {/* Preço por pessoa */}
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                <span>Preço por pessoa</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>auto</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {formatMoney(summary.pricePerPerson, currency)}
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {payingPassengers} pagante(s)
            </span>
          </div>

          {/* Lucro bruto */}
          <div
            style={{
              background: summary.profit >= 0 ? 'var(--success-soft)' : 'var(--danger-soft)',
              border: `1px solid ${summary.profit >= 0 ? 'rgba(5, 150, 105, 0.25)' : 'rgba(220, 38, 38, 0.25)'}`,
              borderRadius: 'var(--radius-sm)',
              padding: '0.65rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: summary.profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                <span>Lucro bruto</span>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>auto</span>
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: summary.profit >= 0 ? 'var(--success)' : 'var(--danger)',
                  marginTop: '0.25rem',
                }}
              >
                {formatMoney(summary.profit, currency)}
              </div>
            </div>
            <span style={{ fontSize: '11px', opacity: 0.75, marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
              Venda − custos
            </span>
          </div>

          {/* Margem de lucro */}
          <div
            style={{
              background: summary.profitPercent >= 0 ? 'var(--success-soft)' : 'var(--danger-soft)',
              border: `1px solid ${summary.profitPercent >= 0 ? 'rgba(5, 150, 105, 0.25)' : 'rgba(220, 38, 38, 0.25)'}`,
              borderRadius: 'var(--radius-sm)',
              padding: '0.65rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: summary.profitPercent >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                <span>Margem de lucro</span>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>auto</span>
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
            <span style={{ fontSize: '11px', opacity: 0.75, marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
              Lucro / venda
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
