-- ==============================================================================
-- Migration: 20261001081000_refine_financial_projections_guards.sql
-- Descrição: Refinamento dos filtros de projeção financeira:
--            - Exclusão estrita de compromissos de operações canceladas (preservando apenas ajustes de cancelamento)
--            - Proteção contra referência de data nula (fallback para CURRENT_DATE)
--            - Fallback defensivo em transferências internas (destination_amount COALESCE com amount)
-- ==============================================================================

-- 1. get_financial_account_balances() com guardas de cancelamento
CREATE OR REPLACE FUNCTION get_financial_account_balances()
RETURNS TABLE (
  account_id UUID,
  account_name TEXT,
  account_type TEXT,
  currency TEXT,
  active BOOLEAN,
  initial_balance NUMERIC(12, 2),
  initial_balance_date DATE,
  current_balance NUMERIC(12, 2),
  pending_receivables NUMERIC(12, 2),
  pending_payables NUMERIC(12, 2),
  projected_balance NUMERIC(12, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH tx_totals AS (
    SELECT
      fa.id AS acc_id,
      COALESCE(SUM(CASE WHEN ft.type IN ('inflow', 'refund') THEN ft.amount ELSE 0.00 END), 0.00) AS total_inflow,
      COALESCE(SUM(CASE WHEN ft.type = 'outflow' THEN ft.amount ELSE 0.00 END), 0.00) AS total_outflow,
      COALESCE(SUM(
        CASE
          WHEN ft.type = 'transfer' THEN
            ft.amount + CASE WHEN COALESCE(ft.transfer_fee_currency, fa.currency) = fa.currency THEN COALESCE(ft.transfer_fee, 0.00) ELSE 0.00 END
          ELSE 0.00
        END
      ), 0.00) AS total_transfer_out
    FROM financial_accounts fa
    LEFT JOIN financial_transactions ft ON ft.account_id = fa.id
    GROUP BY fa.id
  ),
  dest_transfers AS (
    SELECT
      fa.id AS acc_id,
      COALESCE(SUM(COALESCE(ft.destination_amount, ft.amount)), 0.00) AS total_transfer_in
    FROM financial_accounts fa
    LEFT JOIN financial_transactions ft ON ft.destination_account_id = fa.id AND ft.type = 'transfer'
    GROUP BY fa.id
  ),
  commitment_settled AS (
    SELECT
      ft.commitment_id,
      COALESCE(SUM(ft.amount), 0.00) AS settled_amount
    FROM financial_transactions ft
    WHERE ft.commitment_id IS NOT NULL
      AND ft.type IN ('inflow', 'outflow')
    GROUP BY ft.commitment_id
  ),
  pending_commitments AS (
    SELECT
      fc.expected_account_id AS acc_id,
      COALESCE(SUM(
        CASE
          WHEN fc.type = 'receivable' THEN
            GREATEST(0.00, fc.amount - COALESCE(cs.settled_amount, 0.00))
          ELSE 0.00
        END
      ), 0.00) AS pending_rec,
      COALESCE(SUM(
        CASE
          WHEN fc.type = 'payable' THEN
            GREATEST(0.00, fc.amount - COALESCE(cs.settled_amount, 0.00))
          ELSE 0.00
        END
      ), 0.00) AS pending_pay
    FROM financial_commitments fc
    INNER JOIN financial_operations fo ON fo.id = fc.operation_id
    LEFT JOIN commitment_settled cs ON cs.commitment_id = fc.id
    WHERE fc.status IN ('planned', 'partially_settled')
      AND fc.expected_account_id IS NOT NULL
      AND (fo.status != 'cancelled' OR fc.is_cancellation_adjustment = true)
    GROUP BY fc.expected_account_id
  )
  SELECT
    fa.id AS account_id,
    fa.name AS account_name,
    fa.type AS account_type,
    fa.currency,
    fa.active,
    fa.initial_balance,
    fa.initial_balance_date,
    ROUND(
      fa.initial_balance
      + COALESCE(tt.total_inflow, 0.00)
      - COALESCE(tt.total_outflow, 0.00)
      - COALESCE(tt.total_transfer_out, 0.00)
      + COALESCE(dt.total_transfer_in, 0.00),
      2
    ) AS current_balance,
    COALESCE(pc.pending_rec, 0.00) AS pending_receivables,
    COALESCE(pc.pending_pay, 0.00) AS pending_payables,
    ROUND(
      (
        fa.initial_balance
        + COALESCE(tt.total_inflow, 0.00)
        - COALESCE(tt.total_outflow, 0.00)
        - COALESCE(tt.total_transfer_out, 0.00)
        + COALESCE(dt.total_transfer_in, 0.00)
      )
      + COALESCE(pc.pending_rec, 0.00)
      - COALESCE(pc.pending_pay, 0.00),
      2
    ) AS projected_balance
  FROM financial_accounts fa
  LEFT JOIN tx_totals tt ON tt.acc_id = fa.id
  LEFT JOIN dest_transfers dt ON dt.acc_id = fa.id
  LEFT JOIN pending_commitments pc ON pc.acc_id = fa.id
  ORDER BY fa.currency ASC, fa.type ASC, fa.name ASC;
END;
$$;

-- 2. get_financial_consolidated_summary()
CREATE OR REPLACE FUNCTION get_financial_consolidated_summary(p_reference_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ref_date DATE := COALESCE(p_reference_date, CURRENT_DATE);
  v_result JSONB;
BEGIN
  WITH balances AS (
    SELECT * FROM get_financial_account_balances()
  ),
  commitment_settled AS (
    SELECT
      ft.commitment_id,
      COALESCE(SUM(ft.amount), 0.00) AS settled_amount
    FROM financial_transactions ft
    WHERE ft.commitment_id IS NOT NULL
      AND ft.type IN ('inflow', 'outflow')
    GROUP BY ft.commitment_id
  ),
  currency_commitments AS (
    SELECT
      fc.currency,
      COALESCE(SUM(
        CASE
          WHEN fc.type = 'receivable' THEN
            GREATEST(0.00, fc.amount - COALESCE(cs.settled_amount, 0.00))
          ELSE 0.00
        END
      ), 0.00) AS total_pending_receivables,
      COALESCE(SUM(
        CASE
          WHEN fc.type = 'payable' THEN
            GREATEST(0.00, fc.amount - COALESCE(cs.settled_amount, 0.00))
          ELSE 0.00
        END
      ), 0.00) AS total_pending_payables,
      COALESCE(SUM(
        CASE
          WHEN fc.type = 'receivable' AND fc.expected_date IS NOT NULL AND fc.expected_date < v_ref_date THEN
            GREATEST(0.00, fc.amount - COALESCE(cs.settled_amount, 0.00))
          ELSE 0.00
        END
      ), 0.00) AS overdue_receivables,
      COALESCE(SUM(
        CASE
          WHEN fc.type = 'payable' AND fc.expected_date IS NOT NULL AND fc.expected_date < v_ref_date THEN
            GREATEST(0.00, fc.amount - COALESCE(cs.settled_amount, 0.00))
          ELSE 0.00
        END
      ), 0.00) AS overdue_payables
    FROM financial_commitments fc
    INNER JOIN financial_operations fo ON fo.id = fc.operation_id
    LEFT JOIN commitment_settled cs ON cs.commitment_id = fc.id
    WHERE fc.status IN ('planned', 'partially_settled')
      AND (fo.status != 'cancelled' OR fc.is_cancellation_adjustment = true)
    GROUP BY fc.currency
  ),
  currency_balances AS (
    SELECT
      b.currency,
      COALESCE(SUM(CASE WHEN b.active AND b.account_type IN ('bank_account', 'cash', 'other') THEN b.current_balance ELSE 0.00 END), 0.00) AS available_balance,
      COALESCE(SUM(CASE WHEN b.active AND b.account_type = 'credit_card' THEN b.current_balance ELSE 0.00 END), 0.00) AS credit_card_balance
    FROM balances b
    GROUP BY b.currency
  )
  SELECT jsonb_object_agg(
    curr.code,
    jsonb_build_object(
      'currency', curr.code,
      'current_balance', COALESCE(cb.available_balance, 0.00),
      'credit_card_balance', COALESCE(cb.credit_card_balance, 0.00),
      'total_pending_receivables', COALESCE(cc.total_pending_receivables, 0.00),
      'total_pending_payables', COALESCE(cc.total_pending_payables, 0.00),
      'projected_balance', ROUND(COALESCE(cb.available_balance, 0.00) + COALESCE(cc.total_pending_receivables, 0.00) - COALESCE(cc.total_pending_payables, 0.00), 2),
      'overdue_receivables', COALESCE(cc.overdue_receivables, 0.00),
      'overdue_payables', COALESCE(cc.overdue_payables, 0.00)
    )
  ) INTO v_result
  FROM (VALUES ('EUR'), ('BRL')) AS curr(code)
  LEFT JOIN currency_balances cb ON cb.currency = curr.code
  LEFT JOIN currency_commitments cc ON cc.currency = curr.code;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- 3. get_period_cash_flow_forecast()
CREATE OR REPLACE FUNCTION get_period_cash_flow_forecast(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  currency TEXT,
  expected_inflows NUMERIC(12, 2),
  expected_outflows NUMERIC(12, 2),
  net_cash_flow NUMERIC(12, 2),
  receivables_count INT,
  payables_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH commitment_settled AS (
    SELECT
      ft.commitment_id,
      COALESCE(SUM(ft.amount), 0.00) AS settled_amount
    FROM financial_transactions ft
    WHERE ft.commitment_id IS NOT NULL
      AND ft.type IN ('inflow', 'outflow')
    GROUP BY ft.commitment_id
  ),
  period_data AS (
    SELECT
      fc.currency AS curr,
      COALESCE(SUM(
        CASE
          WHEN fc.type = 'receivable' THEN
            GREATEST(0.00, fc.amount - COALESCE(cs.settled_amount, 0.00))
          ELSE 0.00
        END
      ), 0.00) AS total_inflows,
      COALESCE(SUM(
        CASE
          WHEN fc.type = 'payable' THEN
            GREATEST(0.00, fc.amount - COALESCE(cs.settled_amount, 0.00))
          ELSE 0.00
        END
      ), 0.00) AS total_outflows,
      COUNT(CASE WHEN fc.type = 'receivable' AND GREATEST(0.00, fc.amount - COALESCE(cs.settled_amount, 0.00)) > 0 THEN 1 END)::INT AS rec_count,
      COUNT(CASE WHEN fc.type = 'payable' AND GREATEST(0.00, fc.amount - COALESCE(cs.settled_amount, 0.00)) > 0 THEN 1 END)::INT AS pay_count
    FROM financial_commitments fc
    INNER JOIN financial_operations fo ON fo.id = fc.operation_id
    LEFT JOIN commitment_settled cs ON cs.commitment_id = fc.id
    WHERE fc.status IN ('planned', 'partially_settled')
      AND (fo.status != 'cancelled' OR fc.is_cancellation_adjustment = true)
      AND fc.expected_date IS NOT NULL
      AND fc.expected_date >= p_start_date
      AND fc.expected_date <= p_end_date
    GROUP BY fc.currency
  )
  SELECT
    c.code AS currency,
    COALESCE(pd.total_inflows, 0.00) AS expected_inflows,
    COALESCE(pd.total_outflows, 0.00) AS expected_outflows,
    ROUND(COALESCE(pd.total_inflows, 0.00) - COALESCE(pd.total_outflows, 0.00), 2) AS net_cash_flow,
    COALESCE(pd.rec_count, 0) AS receivables_count,
    COALESCE(pd.pay_count, 0) AS payables_count
  FROM (VALUES ('EUR'), ('BRL')) AS c(code)
  LEFT JOIN period_data pd ON pd.curr = c.code
  ORDER BY c.code ASC;
END;
$$;

-- 4. get_pending_financial_commitments()
CREATE OR REPLACE FUNCTION get_pending_financial_commitments(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_currency TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_account_id UUID DEFAULT NULL,
  p_is_overdue BOOLEAN DEFAULT NULL,
  p_reference_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  id UUID,
  operation_id UUID,
  operation_service_id UUID,
  quotation_id UUID,
  quotation_reference TEXT,
  quotation_client_name TEXT,
  type TEXT,
  counterparty_name TEXT,
  counterparty_type TEXT,
  amount NUMERIC(12, 2),
  currency TEXT,
  status TEXT,
  expected_date DATE,
  expected_account_id UUID,
  expected_account_name TEXT,
  already_paid NUMERIC(12, 2),
  pending_amount NUMERIC(12, 2),
  is_overdue BOOLEAN,
  payment_method TEXT,
  is_credit_card_invoice BOOLEAN,
  origin_commitment_id UUID,
  credit_card_account_id UUID,
  is_cancellation_adjustment BOOLEAN,
  adjustment_type TEXT,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ref_date DATE := COALESCE(p_reference_date, CURRENT_DATE);
BEGIN
  RETURN QUERY
  WITH commitment_settled AS (
    SELECT
      ft.commitment_id,
      COALESCE(SUM(ft.amount), 0.00) AS settled_amount
    FROM financial_transactions ft
    WHERE ft.commitment_id IS NOT NULL
      AND ft.type IN ('inflow', 'outflow')
    GROUP BY ft.commitment_id
  )
  SELECT
    fc.id,
    fc.operation_id,
    fc.operation_service_id,
    fo.quotation_id,
    q.reference AS quotation_reference,
    q.client_name AS quotation_client_name,
    fc.type,
    fc.counterparty_name,
    fc.counterparty_type,
    fc.amount,
    fc.currency,
    fc.status,
    fc.expected_date,
    fc.expected_account_id,
    fa.name AS expected_account_name,
    COALESCE(cs.settled_amount, 0.00) AS already_paid,
    ROUND(GREATEST(0.00, fc.amount - COALESCE(cs.settled_amount, 0.00)), 2) AS pending_amount,
    (fc.expected_date IS NOT NULL AND fc.expected_date < v_ref_date) AS is_overdue,
    fc.payment_method,
    fc.is_credit_card_invoice,
    fc.origin_commitment_id,
    fc.credit_card_account_id,
    fc.is_cancellation_adjustment,
    fc.adjustment_type,
    fc.description,
    fc.notes,
    fc.created_at
  FROM financial_commitments fc
  INNER JOIN financial_operations fo ON fo.id = fc.operation_id
  LEFT JOIN quotations q ON q.id = fo.quotation_id
  LEFT JOIN financial_accounts fa ON fa.id = fc.expected_account_id
  LEFT JOIN commitment_settled cs ON cs.commitment_id = fc.id
  WHERE fc.status IN ('planned', 'partially_settled')
    AND (fo.status != 'cancelled' OR fc.is_cancellation_adjustment = true)
    AND GREATEST(0.00, fc.amount - COALESCE(cs.settled_amount, 0.00)) > 0
    AND (p_start_date IS NULL OR fc.expected_date >= p_start_date)
    AND (p_end_date IS NULL OR fc.expected_date <= p_end_date)
    AND (p_currency IS NULL OR fc.currency = p_currency)
    AND (p_type IS NULL OR fc.type = p_type)
    AND (p_account_id IS NULL OR fc.expected_account_id = p_account_id)
    AND (
      p_is_overdue IS NULL
      OR (p_is_overdue = true AND fc.expected_date IS NOT NULL AND fc.expected_date < v_ref_date)
      OR (p_is_overdue = false AND (fc.expected_date IS NULL OR fc.expected_date >= v_ref_date))
    )
  ORDER BY fc.expected_date ASC NULLS LAST, fc.created_at ASC;
END;
$$;
