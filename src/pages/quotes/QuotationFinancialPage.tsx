import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { quotationsService } from '../../services/quotationsService';
import { financialService } from '../../services/financialService';
import {
  Quotation,
  FinancialAccount,
  FinancialOperation,
  FinancialOperationService,
  FinancialCommitment,
  FinancialOperationServiceStatus,
  FinancialPaymentMethod,
  Currency,
  PAYMENT_METHOD_LABELS,
  SERVICE_STATUS_LABELS,
} from '../../types';
import { FeedbackBanner } from '../../components/common/FeedbackBanner';

export const QuotationFinancialPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [quote, setQuote] = useState<Quotation | null>(null);
  const [operation, setOperation] = useState<FinancialOperation | null>(null);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [services, setServices] = useState<FinancialOperationService[]>([]);
  const [commitments, setCommitments] = useState<FinancialCommitment[]>([]);

  // Estado para modal / formulário de novo serviço
  const [isAddingService, setIsAddingService] = useState(false);
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServiceType, setNewServiceType] = useState('tour');
  const [newServiceSupplier, setNewServiceSupplier] = useState('');
  const [newServiceCost, setNewServiceCost] = useState('');
  const [newServiceCurrency, setNewServiceCurrency] = useState<Currency>('EUR');

  // Estados locais para edição rápida de recebimentos
  const [receivableEdits, setReceivableEdits] = useState<Record<string, Partial<FinancialCommitment>>>({});
  // Estados locais para edição rápida de parcelas de serviço
  const [payableEdits, setPayableEdits] = useState<Record<string, Partial<FinancialCommitment>>>({});
  // Estados locais para edição rápida de serviços
  const [serviceEdits, setServiceEdits] = useState<Record<string, Partial<FinancialOperationService>>>({});

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [quoteData, opData, accountsList] = await Promise.all([
        quotationsService.getQuotationById(id),
        financialService.getOperationByQuotationId(id),
        financialService.listAccounts(true),
      ]);

      setQuote(quoteData);
      setOperation(opData);
      setAccounts(accountsList);

      if (opData) {
        const details = await financialService.getOperationDetails(opData.id);
        if (details) {
          setServices(details.services || []);
          setCommitments(details.commitments || []);
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao carregar dados financeiros.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Separação de compromissos
  const receivables = useMemo(
    () => commitments.filter((c) => c.type === 'receivable'),
    [commitments]
  );

  const payables = useMemo(
    () => commitments.filter((c) => c.type === 'payable'),
    [commitments]
  );

  // Totais previstos a receber e a pagar separados por EUR e BRL
  const totals = useMemo(() => {
    const recEUR = receivables
      .filter((c) => c.currency === 'EUR' && c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const recBRL = receivables
      .filter((c) => c.currency === 'BRL' && c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const payEUR = payables
      .filter((c) => c.currency === 'EUR' && c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const payBRL = payables
      .filter((c) => c.currency === 'BRL' && c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    return { recEUR, recBRL, payEUR, payBRL };
  }, [receivables, payables]);

  const formatMoney = (val: number, curr: Currency) => {
    return new Intl.NumberFormat(curr === 'BRL' ? 'pt-BR' : 'pt-PT', {
      style: 'currency',
      currency: curr,
    }).format(val || 0);
  };

  // ==============================================================
  // AÇÕES DE RECEBIMENTOS DO CLIENTE
  // ==============================================================

  const handleUpdateReceivableField = (id: string, field: keyof FinancialCommitment, value: any) => {
    setReceivableEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSaveReceivable = async (item: FinancialCommitment) => {
    const edits = receivableEdits[item.id];
    if (!edits) return;

    try {
      setSaving(true);
      const updated = await financialService.updateCommitment(item.id, {
        amount: edits.amount !== undefined ? Number(edits.amount) : item.amount,
        currency: edits.currency || item.currency,
        expected_date: edits.expected_date !== undefined ? (edits.expected_date ? edits.expected_date : null) : item.expected_date,
        expected_account_id: edits.expected_account_id !== undefined ? (edits.expected_account_id ? edits.expected_account_id : null) : item.expected_account_id,
        payment_method: edits.payment_method !== undefined ? (edits.payment_method ? edits.payment_method : null) : item.payment_method,
        notes: edits.notes !== undefined ? edits.notes : item.notes,
      });

      setCommitments((prev) => prev.map((c) => (c.id === item.id ? updated : c)));
      setReceivableEdits((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setFeedback({ type: 'success', message: 'Recebimento atualizado com sucesso.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao salvar recebimento: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleAddReceivableInstallment = async () => {
    if (!operation) return;
    try {
      setSaving(true);
      const newCommitment = await financialService.createCommitment({
        operation_id: operation.id,
        type: 'receivable',
        counterparty_name: quote?.client_name || 'Cliente',
        counterparty_type: 'client',
        amount: 0,
        currency: quote?.currency || 'EUR',
        status: 'planned',
        description: `Parcela de recebimento ${receivables.length + 1}`,
      });

      setCommitments((prev) => [...prev, newCommitment]);
      setFeedback({ type: 'success', message: 'Nova parcela de recebimento adicionada.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao adicionar parcela: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleSplitReceivable = async (item: FinancialCommitment) => {
    if (!operation) return;
    try {
      setSaving(true);
      const currentAmount = Number(receivableEdits[item.id]?.amount ?? item.amount);
      const half1 = Number((currentAmount / 2).toFixed(2));
      const half2 = Number((currentAmount - half1).toFixed(2));

      // Atualiza primeira metade
      const updatedFirst = await financialService.updateCommitment(item.id, {
        amount: half1,
        description: `${item.description || 'Parcela'} (1/2)`,
      });

      // Cria segunda metade
      const createdSecond = await financialService.createCommitment({
        operation_id: operation.id,
        type: 'receivable',
        counterparty_name: item.counterparty_name,
        counterparty_type: 'client',
        amount: half2,
        currency: item.currency,
        status: 'planned',
        expected_date: item.expected_date,
        expected_account_id: item.expected_account_id,
        payment_method: item.payment_method,
        description: `${item.description || 'Parcela'} (2/2)`,
      });

      setCommitments((prev) =>
        prev.map((c) => (c.id === item.id ? updatedFirst : c)).concat(createdSecond)
      );
      setReceivableEdits((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setFeedback({ type: 'success', message: 'Recebimento dividido em 2 parcelas.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao dividir recebimento: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelCommitment = async (commitmentId: string, desc: string) => {
    if (!window.confirm(`Deseja cancelar esta parcela (${desc})? O histórico será preservado.`)) return;
    try {
      setSaving(true);
      const updated = await financialService.cancelCommitment(commitmentId);
      setCommitments((prev) => prev.map((c) => (c.id === commitmentId ? updated : c)));
      setFeedback({ type: 'success', message: 'Parcela cancelada com sucesso. Histórico financeiro preservado.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao cancelar parcela: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // ==============================================================
  // AÇÕES DE SERVIÇOS E PAGAMENTOS
  // ==============================================================

  const handleUpdateServiceField = (serviceId: string, field: keyof FinancialOperationService, value: any) => {
    setServiceEdits((prev) => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        [field]: value,
      },
    }));
  };

  const handleSaveService = async (service: FinancialOperationService) => {
    const edits = serviceEdits[service.id];
    if (!edits) return;

    try {
      setSaving(true);
      const updated = await financialService.updateOperationService(service.id, {
        description: edits.description !== undefined ? edits.description : service.description,
        supplier_name: edits.supplier_name !== undefined ? edits.supplier_name : service.supplier_name,
        status: (edits.status as FinancialOperationServiceStatus) || service.status,
        cost_amount: edits.cost_amount !== undefined ? Number(edits.cost_amount) : service.cost_amount,
        cost_currency: edits.cost_currency || service.cost_currency,
        notes: edits.notes !== undefined ? edits.notes : service.notes,
      });

      setServices((prev) => prev.map((s) => (s.id === service.id ? updated : s)));
      setServiceEdits((prev) => {
        const next = { ...prev };
        delete next[service.id];
        return next;
      });
      setFeedback({ type: 'success', message: 'Serviço atualizado com sucesso.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao atualizar serviço: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operation || !newServiceDesc.trim()) return;

    try {
      setSaving(true);
      const costNum = Math.max(0, Number(newServiceCost) || 0);

      // 1. Cria o serviço na operação
      const createdService = await financialService.addOperationService({
        operation_id: operation.id,
        type: newServiceType,
        description: newServiceDesc.trim(),
        supplier_name: newServiceSupplier.trim() || undefined,
        cost_amount: costNum,
        cost_currency: newServiceCurrency,
        status: 'planned',
      });

      // 2. Se houver custo previsto, cria a primeira parcela de pagamento
      let createdCommitment: FinancialCommitment | null = null;
      if (costNum > 0) {
        createdCommitment = await financialService.createCommitment({
          operation_id: operation.id,
          operation_service_id: createdService.id,
          type: 'payable',
          counterparty_name: newServiceSupplier.trim() || 'Fornecedor',
          counterparty_type: 'supplier',
          amount: costNum,
          currency: newServiceCurrency,
          status: 'planned',
          description: `Pagamento de ${createdService.description}`,
        });
      }

      setServices((prev) => [...prev, createdService]);
      if (createdCommitment) {
        setCommitments((prev) => [...prev, createdCommitment!]);
      }

      setNewServiceDesc('');
      setNewServiceSupplier('');
      setNewServiceCost('');
      setIsAddingService(false);
      setFeedback({ type: 'success', message: 'Novo serviço adicionado ao financeiro.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao adicionar serviço: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelService = async (serviceId: string, desc: string) => {
    if (!window.confirm(`Deseja cancelar o serviço "${desc}" e todos os seus pagamentos previstos abertos? O histórico será preservado.`)) return;
    try {
      setSaving(true);
      const res = await financialService.cancelOperationService(serviceId);
      setServices((prev) =>
        prev.map((s) => (s.id === serviceId ? res.service : s))
      );
      setCommitments((prev) =>
        prev.map((c) =>
          c.operation_service_id === serviceId && c.status === 'planned'
            ? { ...c, status: 'cancelled' }
            : c
        )
      );
      setFeedback({
        type: 'success',
        message: 'Serviço e pagamentos vinculados cancelados com sucesso. Histórico preservado.',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao cancelar serviço: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // ==============================================================
  // AÇÕES DE PARCELAS DE PAGAMENTO DE SERVIÇOS
  // ==============================================================

  const handleUpdatePayableField = (id: string, field: keyof FinancialCommitment, value: any) => {
    setPayableEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSavePayable = async (item: FinancialCommitment) => {
    const edits = payableEdits[item.id];
    if (!edits) return;

    try {
      setSaving(true);
      const updated = await financialService.updateCommitment(item.id, {
        amount: edits.amount !== undefined ? Number(edits.amount) : item.amount,
        currency: edits.currency || item.currency,
        expected_date: edits.expected_date !== undefined ? (edits.expected_date ? edits.expected_date : null) : item.expected_date,
        expected_account_id: edits.expected_account_id !== undefined ? (edits.expected_account_id ? edits.expected_account_id : null) : item.expected_account_id,
        payment_method: edits.payment_method !== undefined ? (edits.payment_method ? edits.payment_method : null) : item.payment_method,
        notes: edits.notes !== undefined ? edits.notes : item.notes,
      });

      setCommitments((prev) => prev.map((c) => (c.id === item.id ? updated : c)));
      setPayableEdits((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setFeedback({ type: 'success', message: 'Parcela de pagamento atualizada.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao salvar pagamento: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayableInstallment = async (service: FinancialOperationService) => {
    if (!operation) return;
    try {
      setSaving(true);
      const newCommitment = await financialService.createCommitment({
        operation_id: operation.id,
        operation_service_id: service.id,
        type: 'payable',
        counterparty_name: service.supplier_name || 'Fornecedor',
        counterparty_type: 'supplier',
        amount: 0,
        currency: service.cost_currency,
        status: 'planned',
        description: `Parcela de pagamento - ${service.description}`,
      });

      setCommitments((prev) => [...prev, newCommitment]);
      setFeedback({ type: 'success', message: `Nova parcela de pagamento adicionada para "${service.description}".` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao adicionar parcela: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Carregando dados financeiros...</p>
      </div>
    );
  }

  if (!quote || !operation) {
    return (
      <div className="placeholder-view">
        <h3>Financeiro não disponível</h3>
        <p>A cotação solicitada não existe ou ainda não foi aprovada comercialmente.</p>
        <Link to="/cotacoes" className="btn btn-primary">
          Voltar para Cotações
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Cabeçalho */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Link to={`/cotacoes/${quote.id}`} className="btn btn-sm btn-secondary">
              ← Voltar para Cotação
            </Link>
            <span className="badge badge-neutral"><code>{quote.reference}</code></span>
            <span className="badge badge-success">Aprovada</span>
          </div>
          <h1 className="page-title">
            Financeiro: Cotação {quote.reference}
          </h1>
          <p className="page-subtitle">
            Cliente: <strong>{quote.client_name || 'Não informado'}</strong> • Moeda Comercial: <strong>{quote.currency}</strong>
          </p>
        </div>
      </div>

      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {/* Cards de Totais Previstos Separados por EUR e BRL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Receber Previsto (EUR)
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.25rem' }}>
            {formatMoney(totals.recEUR, 'EUR')}
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Receber Previsto (BRL)
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.25rem' }}>
            {formatMoney(totals.recBRL, 'BRL')}
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Pagar Previsto (EUR)
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)', marginTop: '0.25rem' }}>
            {formatMoney(totals.payEUR, 'EUR')}
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Pagar Previsto (BRL)
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)', marginTop: '0.25rem' }}>
            {formatMoney(totals.payBRL, 'BRL')}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SEÇÃO 1: RECEBIMENTOS DO CLIENTE */}
      {/* ============================================================== */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Recebimentos</h2>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Parcelas previstas do cliente {quote.client_name ? `(${quote.client_name})` : ''}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={handleAddReceivableInstallment}
            disabled={saving}
          >
            + Adicionar Parcela de Recebimento
          </button>
        </div>

        {receivables.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem 0' }}>
            Nenhum recebimento previsto registrado para esta cotação.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {receivables.map((rec, idx) => {
              const isCancelled = rec.status === 'cancelled';
              const edits = receivableEdits[rec.id] || {};
              const currentAmount = edits.amount !== undefined ? edits.amount : rec.amount;
              const currentCurrency = edits.currency || rec.currency;
              const currentDate = edits.expected_date !== undefined ? edits.expected_date : (rec.expected_date || '');
              const currentAccount = edits.expected_account_id !== undefined ? edits.expected_account_id : (rec.expected_account_id || '');
              const currentMethod = edits.payment_method !== undefined ? edits.payment_method : (rec.payment_method || '');
              const currentNotes = edits.notes !== undefined ? edits.notes : (rec.notes || '');
              const hasChanges = Object.keys(edits).length > 0;

              return (
                <div
                  key={rec.id}
                  style={{
                    border: isCancelled ? '1px dashed var(--border-subtle)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    background: isCancelled ? 'var(--bg-surface)' : 'var(--bg-surface-elevated)',
                    opacity: isCancelled ? 0.65 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-neutral" style={{ fontWeight: 600 }}>
                        Parcela {idx + 1}
                      </span>
                      {isCancelled && (
                        <span className="badge badge-danger">Cancelada</span>
                      )}
                      <span
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: isCancelled ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: isCancelled ? 'line-through' : 'none',
                        }}
                      >
                        {rec.description || 'Recebimento do Cliente'}
                      </span>
                      {isCancelled && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          (Preservado no histórico • Ignorado nos totais)
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {!isCancelled && (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleSplitReceivable(rec)}
                            disabled={saving}
                            title="Dividir esta parcela em duas de valores iguais"
                          >
                            Dividir em 2 parcelas
                          </button>

                          {hasChanges && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => handleSaveReceivable(rec)}
                              disabled={saving}
                            >
                              Salvar Alterações
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-sm btn-danger-outline"
                            onClick={() => handleCancelCommitment(rec.id, rec.description || `Parcela ${idx + 1}`)}
                            disabled={saving}
                          >
                            Cancelar Parcela
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Campos Editáveis */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Valor</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={currentAmount}
                        disabled={isCancelled || saving}
                        onChange={(e) => handleUpdateReceivableField(rec.id, 'amount', e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Moeda</label>
                      <select
                        className="form-select"
                        value={currentCurrency}
                        disabled={isCancelled || saving}
                        onChange={(e) => handleUpdateReceivableField(rec.id, 'currency', e.target.value as Currency)}
                      >
                        <option value="EUR">EUR (€)</option>
                        <option value="BRL">BRL (R$)</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Data Prevista</label>
                      <input
                        type="date"
                        className="form-control"
                        value={currentDate || ''}
                        disabled={isCancelled || saving}
                        onChange={(e) => handleUpdateReceivableField(rec.id, 'expected_date', e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Conta de Entrada</label>
                      <select
                        className="form-select"
                        value={currentAccount || ''}
                        disabled={isCancelled || saving}
                        onChange={(e) => handleUpdateReceivableField(rec.id, 'expected_account_id', e.target.value)}
                      >
                        <option value="">— Nenhuma conta —</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.currency})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Método de Pagamento</label>
                      <select
                        className="form-select"
                        value={currentMethod || ''}
                        disabled={isCancelled || saving}
                        onChange={(e) => handleUpdateReceivableField(rec.id, 'payment_method', e.target.value as FinancialPaymentMethod)}
                      >
                        <option value="">— Selecionar —</option>
                        {(Object.keys(PAYMENT_METHOD_LABELS) as FinancialPaymentMethod[]).map((m) => (
                          <option key={m} value={m}>
                            {PAYMENT_METHOD_LABELS[m]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Observação</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ex: Entrada 30% PIX, Saldo no cartão..."
                        value={currentNotes ?? ''}
                        disabled={isCancelled || saving}
                        onChange={(e) => handleUpdateReceivableField(rec.id, 'notes', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* SEÇÃO 2: SERVIÇOS & PAGAMENTOS PREVISTOS */}
      {/* ============================================================== */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Serviços</h2>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Serviços da viagem e respectivos pagamentos previstos a fornecedores
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setIsAddingService(true)}
            disabled={saving || isAddingService}
          >
            + Adicionar Serviço
          </button>
        </div>

        {/* Modal / Formulário Inline de Novo Serviço */}
        {isAddingService && (
          <form
            onSubmit={handleAddService}
            style={{
              border: '2px dashed var(--accent-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              background: 'var(--accent-soft)',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Novo Serviço Pós-Aprovação
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Descrição do Serviço *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Jantar de boas-vindas..."
                  className="form-control"
                  value={newServiceDesc}
                  onChange={(e) => setNewServiceDesc(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Tipo de Serviço</label>
                <select
                  className="form-select"
                  value={newServiceType}
                  onChange={(e) => setNewServiceType(e.target.value)}
                >
                  <option value="lodging">Hospedagem</option>
                  <option value="flight">Voo / Transporte</option>
                  <option value="transfer">Transfer</option>
                  <option value="tour">Passeio / Atividade</option>
                  <option value="insurance">Seguro</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Fornecedor</label>
                <input
                  type="text"
                  placeholder="Nome do fornecedor"
                  className="form-control"
                  value={newServiceSupplier}
                  onChange={(e) => setNewServiceSupplier(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Custo Previsto</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="form-control"
                  value={newServiceCost}
                  onChange={(e) => setNewServiceCost(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Moeda</label>
                <select
                  className="form-select"
                  value={newServiceCurrency}
                  onChange={(e) => setNewServiceCurrency(e.target.value as Currency)}
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="BRL">BRL (R$)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setIsAddingService(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
                Confirmar Serviço
              </button>
            </div>
          </form>
        )}

        {services.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem 0' }}>
            Nenhum serviço registrado nesta operação.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {services.map((srv) => {
              const sEdits = serviceEdits[srv.id] || {};
              const currentDesc = sEdits.description !== undefined ? sEdits.description : srv.description;
              const currentSupplier = sEdits.supplier_name !== undefined ? sEdits.supplier_name : (srv.supplier_name || '');
              const currentStatus = (sEdits.status as FinancialOperationServiceStatus) || srv.status;
              const isServiceCancelled = currentStatus === 'cancelled';
              const serviceHasChanges = Object.keys(sEdits).length > 0;

              // Parcelas de pagamento deste serviço
              const servicePayables = payables.filter((p) => p.operation_service_id === srv.id);

              return (
                <div
                  key={srv.id}
                  style={{
                    border: isServiceCancelled ? '1px dashed var(--border-subtle)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.25rem',
                    background: 'var(--bg-surface)',
                    opacity: isServiceCancelled ? 0.75 : 1,
                  }}
                >
                  {/* Linha Principal do Serviço */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                          {srv.type}
                        </span>
                        <span
                          className={`badge ${
                            currentStatus === 'completed'
                              ? 'badge-success'
                              : currentStatus === 'cancelled'
                              ? 'badge-danger'
                              : currentStatus === 'contracted'
                              ? 'badge-primary'
                              : 'badge-warning'
                          }`}
                        >
                          {SERVICE_STATUS_LABELS[currentStatus] || currentStatus}
                        </span>
                        {srv.cost_amount > 0 && (
                          <span
                            style={{
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)',
                              textDecoration: isServiceCancelled ? 'line-through' : 'none',
                            }}
                          >
                            • Custo Base: {formatMoney(srv.cost_amount, srv.cost_currency)}
                          </span>
                        )}
                        {isServiceCancelled && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            (Serviço cancelado • Histórico preservado)
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        className="form-control"
                        style={{
                          fontWeight: 600,
                          fontSize: '1rem',
                          textDecoration: isServiceCancelled ? 'line-through' : 'none',
                        }}
                        value={currentDesc}
                        disabled={isServiceCancelled || saving}
                        onChange={(e) => handleUpdateServiceField(srv.id, 'description', e.target.value)}
                      />
                    </div>

                    {/* Fornecedor, Status e Ações */}
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div className="form-group" style={{ margin: 0, minWidth: 160 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Fornecedor</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Nome do Fornecedor"
                          value={currentSupplier ?? ''}
                          disabled={isServiceCancelled || saving}
                          onChange={(e) => handleUpdateServiceField(srv.id, 'supplier_name', e.target.value)}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0, minWidth: 140 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Estado do Serviço</label>
                        <select
                          className="form-select"
                          value={currentStatus}
                          disabled={isServiceCancelled || saving}
                          onChange={(e) =>
                            handleUpdateServiceField(
                              srv.id,
                              'status',
                              e.target.value as FinancialOperationServiceStatus
                            )
                          }
                        >
                          {(Object.keys(SERVICE_STATUS_LABELS) as FinancialOperationServiceStatus[]).map((st) => (
                            <option key={st} value={st}>
                              {SERVICE_STATUS_LABELS[st]}
                            </option>
                          ))}
                        </select>
                      </div>

                      {!isServiceCancelled && serviceHasChanges && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleSaveService(srv)}
                          disabled={saving}
                        >
                          Salvar Serviço
                        </button>
                      )}

                      {!isServiceCancelled && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger-outline"
                          onClick={() => handleCancelService(srv.id, srv.description)}
                          disabled={saving}
                        >
                          Cancelar Serviço
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sub-seção: Pagamentos Previstos do Serviço */}
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        Pagamentos Previstos para este Serviço
                      </span>
                      {!isServiceCancelled && (
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleAddPayableInstallment(srv)}
                          disabled={saving}
                        >
                          + Adicionar Parcela de Pagamento
                        </button>
                      )}
                    </div>

                    {servicePayables.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', margin: 0 }}>
                        {isServiceCancelled
                          ? 'Nenhum pagamento registrado.'
                          : 'Nenhum pagamento previsto registrado para este serviço. Clique em "+ Adicionar Parcela de Pagamento".'}
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {servicePayables.map((pay, pIdx) => {
                          const isPayCancelled = pay.status === 'cancelled';
                          const pEdits = payableEdits[pay.id] || {};
                          const pAmount = pEdits.amount !== undefined ? pEdits.amount : pay.amount;
                          const pCurrency = pEdits.currency || pay.currency;
                          const pDate = pEdits.expected_date !== undefined ? pEdits.expected_date : (pay.expected_date || '');
                          const pAccount = pEdits.expected_account_id !== undefined ? pEdits.expected_account_id : (pay.expected_account_id || '');
                          const pMethod = pEdits.payment_method !== undefined ? pEdits.payment_method : (pay.payment_method || '');
                          const pNotes = pEdits.notes !== undefined ? pEdits.notes : (pay.notes || '');
                          const payHasChanges = Object.keys(pEdits).length > 0;

                          return (
                            <div
                              key={pay.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr)) auto',
                                gap: '0.65rem',
                                alignItems: 'flex-end',
                                padding: '0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                background: isPayCancelled ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                                border: isPayCancelled ? '1px dashed var(--border-subtle)' : '1px solid var(--border-subtle)',
                                opacity: isPayCancelled ? 0.65 : 1,
                              }}
                            >
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>
                                  Parcela {pIdx + 1} (Valor)
                                  {isPayCancelled && (
                                    <span className="badge badge-danger" style={{ fontSize: '0.65rem', marginLeft: '0.35rem' }}>
                                      Cancelada
                                    </span>
                                  )}
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="form-control"
                                  value={pAmount}
                                  disabled={isPayCancelled || isServiceCancelled || saving}
                                  onChange={(e) => handleUpdatePayableField(pay.id, 'amount', e.target.value)}
                                />
                              </div>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Moeda</label>
                                <select
                                  className="form-select"
                                  value={pCurrency}
                                  disabled={isPayCancelled || isServiceCancelled || saving}
                                  onChange={(e) => handleUpdatePayableField(pay.id, 'currency', e.target.value as Currency)}
                                >
                                  <option value="EUR">EUR (€)</option>
                                  <option value="BRL">BRL (R$)</option>
                                </select>
                              </div>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Data Prevista</label>
                                <input
                                  type="date"
                                  className="form-control"
                                  value={pDate || ''}
                                  disabled={isPayCancelled || isServiceCancelled || saving}
                                  onChange={(e) => handleUpdatePayableField(pay.id, 'expected_date', e.target.value)}
                                />
                              </div>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Conta de Saída</label>
                                <select
                                  className="form-select"
                                  value={pAccount || ''}
                                  disabled={isPayCancelled || isServiceCancelled || saving}
                                  onChange={(e) => handleUpdatePayableField(pay.id, 'expected_account_id', e.target.value)}
                                >
                                  <option value="">— Nenhuma conta —</option>
                                  {accounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                      {acc.name} ({acc.currency})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Forma de Pagamento</label>
                                <select
                                  className="form-select"
                                  value={pMethod || ''}
                                  disabled={isPayCancelled || isServiceCancelled || saving}
                                  onChange={(e) => handleUpdatePayableField(pay.id, 'payment_method', e.target.value as FinancialPaymentMethod)}
                                >
                                  <option value="">— Selecionar —</option>
                                  {(Object.keys(PAYMENT_METHOD_LABELS) as FinancialPaymentMethod[]).map((m) => (
                                    <option key={m} value={m}>
                                      {PAYMENT_METHOD_LABELS[m]}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Observação</label>
                                <input
                                  type="text"
                                  placeholder="Notas..."
                                  className="form-control"
                                  value={pNotes ?? ''}
                                  disabled={isPayCancelled || isServiceCancelled || saving}
                                  onChange={(e) => handleUpdatePayableField(pay.id, 'notes', e.target.value)}
                                />
                              </div>

                              <div style={{ display: 'flex', gap: '0.35rem', alignSelf: 'flex-end' }}>
                                {!isPayCancelled && !isServiceCancelled && payHasChanges && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    onClick={() => handleSavePayable(pay)}
                                    disabled={saving}
                                  >
                                    Salvar
                                  </button>
                                )}
                                {!isPayCancelled && !isServiceCancelled && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-danger-outline"
                                    onClick={() => handleCancelCommitment(pay.id, `Parcela ${pIdx + 1}`)}
                                    disabled={saving}
                                    title="Cancelar parcela de pagamento"
                                  >
                                    Cancelar Parcela
                                  </button>
                                )}
                                {isPayCancelled && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', paddingBottom: '0.35rem' }}>
                                    Cancelada
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
