import React, { useMemo } from 'react';
import { CostCategory, CostComponent, Currency, PassengerConfig } from '../../types';
import {
  calculateFinancialSummary,
  COST_CATEGORY_LABELS,
  formatMoney,
  formatPercent,
  roundMoney,
} from '../../services/financeService';

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
    <div className="space-y-6">
      {/* Alerta de Câmbio / Conversão pendente */}
      {summary.conversionError && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-md shadow-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-semibold text-amber-800">
                Atenção: Conversão Cambial Bloqueada
              </h3>
              <p className="mt-1 text-sm text-amber-700">{summary.conversionError}</p>
              <p className="mt-1 text-xs text-amber-600 font-medium">
                Regra: Nenhum cálculo financeiro ocorre silenciosamente entre moedas distintas sem uma taxa válida.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bloco de Configuração de Câmbio Manual */}
      {(hasCurrencyMismatch || exchangeRate !== undefined) && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>💱</span> Câmbio Manual (Multi-Moeda)
              </h4>
              <p className="text-xs text-slate-500">
                Convenção oficial Packager: <strong>1 EUR = X BRL</strong>
              </p>
            </div>
            {hasCurrencyMismatch && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                Moedas mistas detectadas
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Taxa de Câmbio (1 EUR em BRL)
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-sm">
                  1 € =
                </div>
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
                  placeholder="Ex: 6.2000"
                  className="w-full pl-12 pr-12 py-2 text-sm border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 font-mono"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-sm font-bold">
                  BRL
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data de Referência da Cotação
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
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
              />
            </div>
          </div>
        </div>
      )}

      {/* Lista de Componentes de Custo */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-800">Componentes de Custo</h3>
            <p className="text-xs text-slate-500">
              Discriminação de custos (transporte, hospedagem, taxas, etc.) que formam o custo total.
            </p>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAddComponent}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-md text-xs font-semibold transition-colors"
            >
              <span>+</span> Adicionar Item de Custo
            </button>
          )}
        </div>

        {components.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
            <p className="text-sm text-slate-500 font-medium">Nenhum componente de custo cadastrado.</p>
            <p className="text-xs text-slate-400 mt-1">
              Adicione itens como transporte, hospedagem e taxas para alimentar o motor financeiro.
            </p>
            {!readOnly && (
              <button
                type="button"
                onClick={handleAddComponent}
                className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-white text-blue-600 hover:text-blue-800 border border-slate-300 rounded-md text-xs font-semibold shadow-sm"
              >
                + Adicionar Primeiro Custo
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 rounded-l">Categoria</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-2 w-20 text-center">Qtd</th>
                  <th className="py-2.5 px-2 w-24">Moeda</th>
                  <th className="py-2.5 px-3 w-32 text-right">Valor Unit.</th>
                  <th className="py-2.5 px-3 w-32 text-right">Subtotal</th>
                  {!readOnly && <th className="py-2.5 px-2 w-12 text-center rounded-r">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {components.map((comp, idx) => {
                  const qty = comp.quantity && comp.quantity > 0 ? comp.quantity : 1;
                  const itemSubtotal = roundMoney((comp.amount || 0) * qty);

                  return (
                    <tr key={comp.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 align-middle">
                        {readOnly ? (
                          <span className="font-medium text-slate-800">
                            {COST_CATEGORY_LABELS[comp.category] || comp.category}
                          </span>
                        ) : (
                          <select
                            value={comp.category}
                            onChange={(e) =>
                              handleUpdateComponent(idx, { category: e.target.value as CostCategory })
                            }
                            className="w-full text-xs py-1.5 px-2 border border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500"
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
                      <td className="py-2 px-3 align-middle">
                        {readOnly ? (
                          <div>
                            <div className="font-semibold text-slate-800">{comp.description || '—'}</div>
                            {comp.notes && <div className="text-[11px] text-slate-400">{comp.notes}</div>}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={comp.description}
                              onChange={(e) => handleUpdateComponent(idx, { description: e.target.value })}
                              placeholder="Ex: Voo LIS-MAD ou Hotel 4 estrelas"
                              className="w-full text-xs py-1.5 px-2 border border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500"
                            />
                            <input
                              type="text"
                              value={comp.notes || ''}
                              onChange={(e) => handleUpdateComponent(idx, { notes: e.target.value })}
                              placeholder="Observação opcional..."
                              className="w-full text-[11px] py-1 px-2 text-slate-500 border border-slate-200 rounded focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2 align-middle text-center">
                        {readOnly ? (
                          <span className="font-mono">{qty}</span>
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
                            className="w-16 text-center text-xs py-1.5 px-1 border border-slate-300 rounded font-mono focus:ring-blue-500 focus:border-blue-500"
                          />
                        )}
                      </td>
                      <td className="py-2 px-2 align-middle">
                        {readOnly ? (
                          <span className="font-bold text-slate-700">{comp.currency}</span>
                        ) : (
                          <select
                            value={comp.currency}
                            onChange={(e) =>
                              handleUpdateComponent(idx, { currency: e.target.value as Currency })
                            }
                            className="w-20 text-xs py-1.5 px-1.5 border border-slate-300 rounded font-semibold focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="EUR">EUR (€)</option>
                            <option value="BRL">BRL (R$)</option>
                          </select>
                        )}
                      </td>
                      <td className="py-2 px-3 align-middle text-right font-mono">
                        {readOnly ? (
                          formatMoney(comp.amount || 0, comp.currency)
                        ) : (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={comp.amount ?? ''}
                            onChange={(e) =>
                              handleUpdateComponent(idx, {
                                amount: Math.max(0, parseFloat(e.target.value) || 0),
                              })
                            }
                            placeholder="0.00"
                            className="w-28 text-right text-xs py-1.5 px-2 border border-slate-300 rounded font-mono focus:ring-blue-500 focus:border-blue-500"
                          />
                        )}
                      </td>
                      <td className="py-2 px-3 align-middle text-right font-mono font-bold text-slate-800">
                        {formatMoney(itemSubtotal, comp.currency)}
                      </td>
                      {!readOnly && (
                        <td className="py-2 px-2 align-middle text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveComponent(idx)}
                            title="Remover componente"
                            className="text-slate-400 hover:text-red-600 transition-colors p-1"
                          >
                            ✕
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

      {/* Painel Consolidado: Seção "Financeiro" */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl p-6 shadow-lg border border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 pb-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold tracking-tight text-white">Resumo Financeiro</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Motor Determinístico
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Cálculos em tempo real na moeda da cotação ({currency}). Divisor: {payingPassengers} passageiro(s) pagante(s).
            </p>
          </div>

          {/* Campo de Preço de Venda */}
          <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-2">
            <label className="text-xs font-semibold text-slate-300">Preço de Venda ({currency}):</label>
            {readOnly ? (
              <span className="text-base font-bold font-mono text-emerald-400">
                {formatMoney(salePrice, currency)}
              </span>
            ) : (
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salePrice || ''}
                  onChange={(e) => onChangeSalePrice(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-36 px-3 py-1.5 text-sm font-mono font-bold bg-slate-900 text-emerald-400 border border-slate-600 rounded focus:ring-emerald-500 focus:border-emerald-500 text-right"
                />
              </div>
            )}
          </div>
        </div>

        {/* Métricas Calculadas (Visualmente distintas de entradas manuais) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Custo Total */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Custo Total</span>
                <span className="text-[9px] bg-slate-700 text-slate-300 px-1 py-0.2 rounded font-sans">AUTO</span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-slate-100 mt-1">
                {formatMoney(summary.totalCost, currency)}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 truncate">
              {components.length} item(ns) de custo
            </span>
          </div>

          {/* Impostos / Taxas */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Impostos / Taxas</span>
                <span className="text-[9px] bg-slate-700 text-slate-300 px-1 py-0.2 rounded font-sans">AUTO</span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-slate-200 mt-1">
                {formatMoney(summary.taxesAndFeesTotal, currency)}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 truncate">Subtotal de taxas</span>
          </div>

          {/* Preço de Venda Total */}
          <div className="bg-slate-800/60 border border-emerald-500/30 rounded-lg p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-medium text-emerald-300 uppercase tracking-wider flex items-center justify-between">
                <span>Preço Venda Total</span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-emerald-400 mt-1">
                {formatMoney(summary.salePrice, currency)}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 truncate">Pacote completo</span>
          </div>

          {/* Preço Por Pessoa */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Preço p/ Pessoa</span>
                <span className="text-[9px] bg-slate-700 text-slate-300 px-1 py-0.2 rounded font-sans">AUTO</span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-cyan-300 mt-1">
                {formatMoney(summary.pricePerPerson, currency)}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 truncate">
              {payingPassengers} pagante(s)
            </span>
          </div>

          {/* Lucro Bruto */}
          <div
            className={`border rounded-lg p-3.5 flex flex-col justify-between ${
              summary.profit >= 0
                ? 'bg-emerald-950/30 border-emerald-500/40'
                : 'bg-rose-950/30 border-rose-500/40'
            }`}
          >
            <div>
              <div className="text-[11px] font-medium text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Lucro Bruto</span>
                <span className="text-[9px] bg-slate-700 text-slate-300 px-1 py-0.2 rounded font-sans">AUTO</span>
              </div>
              <div
                className={`text-base sm:text-lg font-bold font-mono mt-1 ${
                  summary.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatMoney(summary.profit, currency)}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 truncate">Venda − Custos</span>
          </div>

          {/* Margem % */}
          <div
            className={`border rounded-lg p-3.5 flex flex-col justify-between ${
              summary.profitPercent >= 0
                ? 'bg-indigo-950/30 border-indigo-500/40'
                : 'bg-rose-950/30 border-rose-500/40'
            }`}
          >
            <div>
              <div className="text-[11px] font-medium text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Margem Lucro</span>
                <span className="text-[9px] bg-slate-700 text-slate-300 px-1 py-0.2 rounded font-sans">AUTO</span>
              </div>
              <div
                className={`text-base sm:text-lg font-bold font-mono mt-1 ${
                  summary.profitPercent >= 0 ? 'text-indigo-300' : 'text-rose-400'
                }`}
              >
                {formatPercent(summary.profitPercent)}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 truncate">Lucro / Venda</span>
          </div>
        </div>
      </div>
    </div>
  );
};
