import {
  AccountBalanceSummary,
  PendingCommitmentItem,
  FinancialAlert,
  GroupedFinancialAlerts,
  Currency,
} from '../types';

export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
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

const formatMoney = (val: number, curr: Currency) => {
  return new Intl.NumberFormat(curr === 'BRL' ? 'pt-BR' : 'pt-PT', {
    style: 'currency',
    currency: curr,
  }).format(val || 0);
};

export interface GenerateAlertsParams {
  accounts: AccountBalanceSummary[];
  commitments: PendingCommitmentItem[];
  referenceDate?: string; // YYYY-MM-DD (default: data atual)
}

export const financialAlertsService = {
  /**
   * Avalia os dados da Fase 3A e gera alertas internos categorizados por moeda (EUR e BRL)
   */
  generateFinancialAlerts(params: GenerateAlertsParams): GroupedFinancialAlerts {
    const { accounts, commitments } = params;

    const refDateStr = params.referenceDate || formatIsoDate(new Date());
    const [y, m, d] = refDateStr.split('-').map(Number);
    const refDate = new Date(y, m - 1, d);

    // Datas calculadas
    const in3DaysStr = formatIsoDate(addDays(refDate, 3));
    const currentMonday = getMonday(refDate);
    const weekMondayStr = formatIsoDate(currentMonday);
    const weekSundayStr = formatIsoDate(addDays(currentMonday, 6));

    const eurAlerts: FinancialAlert[] = [];
    const brlAlerts: FinancialAlert[] = [];

    const pushAlert = (alert: FinancialAlert) => {
      if (alert.currency === 'EUR') {
        eurAlerts.push(alert);
      } else if (alert.currency === 'BRL') {
        brlAlerts.push(alert);
      }
    };

    // =========================================================================
    // REGRA 1: PAGÁVEIS VENCIDOS (Crítico)
    // =========================================================================
    const overduePayables = commitments.filter(
      (c) =>
        c.type === 'payable' &&
        c.status !== 'cancelled' &&
        c.status !== 'settled' &&
        c.pending_amount > 0 &&
        c.expected_date !== null &&
        c.expected_date.trim() !== '' &&
        (c.is_overdue || c.expected_date < refDateStr)
    );

    for (const item of overduePayables) {
      pushAlert({
        id: `alert-overdue-pay-${item.id}`,
        type: 'overdue_payable',
        severity: 'critical',
        currency: item.currency,
        title: `Pagamento vencido: ${item.counterparty_name}`,
        message: `${item.description || 'Pagamento a fornecedor'} no valor de ${formatMoney(
          item.pending_amount,
          item.currency
        )} venceu em ${item.expected_date}.`,
        counterparty_name: item.counterparty_name,
        amount: item.pending_amount,
        expected_date: item.expected_date,
        quotation_id: item.quotation_id,
        quotation_reference: item.quotation_reference,
        commitment_id: item.id,
        action: item.quotation_id
          ? {
              label: 'Liquidar na cotação',
              url: `/cotacoes/${item.quotation_id}/financeiro`,
            }
          : undefined,
      });
    }

    // =========================================================================
    // REGRA 2: RECEBÍVEIS VENCIDOS (Crítico)
    // =========================================================================
    const overdueReceivables = commitments.filter(
      (c) =>
        c.type === 'receivable' &&
        c.status !== 'cancelled' &&
        c.status !== 'settled' &&
        c.pending_amount > 0 &&
        c.expected_date !== null &&
        c.expected_date.trim() !== '' &&
        (c.is_overdue || c.expected_date < refDateStr)
    );

    for (const item of overdueReceivables) {
      pushAlert({
        id: `alert-overdue-rec-${item.id}`,
        type: 'overdue_receivable',
        severity: 'critical',
        currency: item.currency,
        title: `Recebimento atrasado: ${item.counterparty_name}`,
        message: `Cobrança de ${formatMoney(
          item.pending_amount,
          item.currency
        )} com vencimento ultrapassado em ${item.expected_date}.`,
        counterparty_name: item.counterparty_name,
        amount: item.pending_amount,
        expected_date: item.expected_date,
        quotation_id: item.quotation_id,
        quotation_reference: item.quotation_reference,
        commitment_id: item.id,
        action: item.quotation_id
          ? {
              label: 'Liquidar na cotação',
              url: `/cotacoes/${item.quotation_id}/financeiro`,
            }
          : undefined,
      });
    }

    // =========================================================================
    // REGRA 3: FATURAS DE CARTÃO COM VENCIMENTO NOS PRÓXIMOS 3 DIAS (Atenção)
    // =========================================================================
    const creditCardDueSoon = commitments.filter(
      (c) =>
        c.is_credit_card_invoice &&
        c.status !== 'cancelled' &&
        c.status !== 'settled' &&
        c.pending_amount > 0 &&
        c.expected_date !== null &&
        c.expected_date.trim() !== '' &&
        !c.is_overdue &&
        c.expected_date >= refDateStr &&
        c.expected_date <= in3DaysStr
    );

    for (const item of creditCardDueSoon) {
      pushAlert({
        id: `alert-cc-due-${item.id}`,
        type: 'credit_card_due_soon',
        severity: 'warning',
        currency: item.currency,
        title: `Fatura de cartão a vencer: ${item.counterparty_name || 'Cartão de Crédito'}`,
        message: `Fatura de ${formatMoney(
          item.pending_amount,
          item.currency
        )} vence nos próximos 3 dias (${item.expected_date}).`,
        counterparty_name: item.counterparty_name,
        amount: item.pending_amount,
        expected_date: item.expected_date,
        quotation_id: item.quotation_id,
        quotation_reference: item.quotation_reference,
        commitment_id: item.id,
        action: item.quotation_id
          ? {
              label: 'Ver na cotação',
              url: `/cotacoes/${item.quotation_id}/financeiro`,
            }
          : {
              label: 'Ver contas',
              url: item.currency === 'EUR' ? '#secao-contas-eur' : '#secao-contas-brl',
            },
      });
    }

    // =========================================================================
    // REGRA 4: COMPROMISSOS SEM EXPECTED_DATE (Atenção)
    // =========================================================================
    const missingDateCommitments = commitments.filter(
      (c) =>
        c.status !== 'cancelled' &&
        c.status !== 'settled' &&
        c.pending_amount > 0 &&
        (!c.expected_date || c.expected_date.trim() === '')
    );

    for (const item of missingDateCommitments) {
      pushAlert({
        id: `alert-missing-date-${item.id}`,
        type: 'missing_expected_date',
        severity: 'warning',
        currency: item.currency,
        title: `Compromisso sem data: ${item.counterparty_name}`,
        message: `${item.type === 'receivable' ? 'Recebível' : 'Pagável'} de ${formatMoney(
          item.pending_amount,
          item.currency
        )} sem data prevista de liquidação definida.`,
        counterparty_name: item.counterparty_name,
        amount: item.pending_amount,
        expected_date: null,
        quotation_id: item.quotation_id,
        quotation_reference: item.quotation_reference,
        commitment_id: item.id,
        action: item.quotation_id
          ? {
              label: 'Definir data na cotação',
              url: `/cotacoes/${item.quotation_id}/financeiro`,
            }
          : undefined,
      });
    }

    // =========================================================================
    // REGRA 5: CONTAS COM SALDO ATUAL NEGATIVO (Crítico)
    // =========================================================================
    const negativeAccounts = accounts.filter(
      (a) => a.account_type !== 'credit_card' && a.current_balance < 0
    );

    for (const acc of negativeAccounts) {
      pushAlert({
        id: `alert-neg-bal-${acc.account_id}`,
        type: 'negative_current_balance',
        severity: 'critical',
        currency: acc.currency,
        title: `Saldo devedor em caixa: ${acc.account_name}`,
        message: `Conta bancária/caixa com saldo negativo atual de ${formatMoney(
          acc.current_balance,
          acc.currency
        )}.`,
        account_id: acc.account_id,
        account_name: acc.account_name,
        amount: Math.abs(acc.current_balance),
        action: {
          label: 'Ver contas',
          url: acc.currency === 'EUR' ? '#secao-contas-eur' : '#secao-contas-brl',
        },
      });
    }

    // =========================================================================
    // REGRA 6: CONTAS COM PROJEÇÃO SEMANAL NEGATIVA (Atenção)
    // =========================================================================
    // Alerta contas bancárias/caixa que atualmente possuem saldo >= 0,
    // mas que ficarão com saldo negativo devido aos compromissos da semana.
    const nonNegativeBankAccounts = accounts.filter(
      (a) => a.account_type !== 'credit_card' && a.current_balance >= 0
    );

    for (const acc of nonNegativeBankAccounts) {
      // Calcular entradas e saídas da semana para esta conta específica
      const weeklyInflows = commitments
        .filter(
          (c) =>
            c.expected_account_id === acc.account_id &&
            c.status !== 'cancelled' &&
            c.status !== 'settled' &&
            c.type === 'receivable' &&
            c.expected_date !== null &&
            c.expected_date >= weekMondayStr &&
            c.expected_date <= weekSundayStr
        )
        .reduce((sum, c) => sum + c.pending_amount, 0);

      const weeklyOutflows = commitments
        .filter(
          (c) =>
            c.expected_account_id === acc.account_id &&
            c.status !== 'cancelled' &&
            c.status !== 'settled' &&
            c.type === 'payable' &&
            c.expected_date !== null &&
            c.expected_date >= weekMondayStr &&
            c.expected_date <= weekSundayStr
        )
        .reduce((sum, c) => sum + c.pending_amount, 0);

      const weeklyProjected = acc.current_balance + weeklyInflows - weeklyOutflows;


      // Disparar se a projeção da semana for negativa
      if (weeklyProjected < 0) {
        pushAlert({

          id: `alert-proj-neg-${acc.account_id}`,
          type: 'negative_weekly_projection',
          severity: 'warning',
          currency: acc.currency,
          title: `Projeção semanal deficitária: ${acc.account_name}`,
          message: `Saldo projetado até ${weekSundayStr} é ${formatMoney(
            weeklyProjected,
            acc.currency
          )} (Atual: ${formatMoney(acc.current_balance, acc.currency)}, Entradas: +${formatMoney(
            weeklyInflows,
            acc.currency
          )}, Saídas: -${formatMoney(weeklyOutflows, acc.currency)}).`,
          account_id: acc.account_id,
          account_name: acc.account_name,
          amount: Math.abs(weeklyProjected),
          action: {
            label: 'Ver contas',
            url: acc.currency === 'EUR' ? '#secao-contas-eur' : '#secao-contas-brl',
          },
        });
      }
    }

    const allAlerts = [...eurAlerts, ...brlAlerts];
    const totalCritical = allAlerts.filter((a) => a.severity === 'critical').length;
    const totalWarning = allAlerts.filter((a) => a.severity === 'warning').length;

    return {
      EUR: eurAlerts,
      BRL: brlAlerts,
      totalCritical,
      totalWarning,
    };
  },
};
