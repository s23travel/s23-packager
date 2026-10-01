-- ==============================================================================
-- Migration: 20261001110000_add_structured_adjustment_direction.sql
-- Descrição: Estruturação da direção de ajustes de saldo em financial_transactions:
--            1. Adiciona coluna adjustment_direction (positive / negative / NULL)
--            2. Retrocompatibilidade: preenche adjustment_direction de registros legados
--               e limpa marcador [positive]/[negative] da description
--            3. Constraint estrita: adjustment_direction IN ('positive', 'negative')
--               para balance_adjustment e NULL para outros tipos
--            4. Atualiza record_balance_adjustment() para persistir adjustment_direction
--               e gravar description somente como motivo legível
--            5. Atualiza get_financial_account_balances() para usar adjustment_direction
--               sem qualquer dependência de description LIKE
-- ==============================================================================

-- 1. Adicionar coluna adjustment_direction
ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS adjustment_direction TEXT;

COMMENT ON COLUMN financial_transactions.adjustment_direction IS
  'Direção estruturada para balance_adjustment: positive (aumenta saldo) ou negative (reduz saldo). Deve ser NULL para outros tipos de transação.';

-- 2. Retrocompatibilidade para registros existentes em DEV antes da constraint
UPDATE financial_transactions
SET
  adjustment_direction = CASE
    WHEN description LIKE '%[positive]%' THEN 'positive'
    WHEN description LIKE '%[negative]%' THEN 'negative'
    ELSE 'positive'
  END,
  description = TRIM(REGEXP_REPLACE(description, '\s*\[(positive|negative)\]$', ''))
WHERE type = 'balance_adjustment' AND (adjustment_direction IS NULL OR adjustment_direction NOT IN ('positive', 'negative'));

-- 3. Constraint de integridade
ALTER TABLE financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_adjustment_direction_check;
ALTER TABLE financial_transactions
  ADD CONSTRAINT financial_transactions_adjustment_direction_check
  CHECK (
    (type = 'balance_adjustment' AND adjustment_direction IN ('positive', 'negative'))
    OR
    (type != 'balance_adjustment' AND adjustment_direction IS NULL)
  );

-- 4. Atualizar record_balance_adjustment()
CREATE OR REPLACE FUNCTION record_balance_adjustment(
  p_account_id  UUID,
  p_amount      NUMERIC(12, 2),
  p_direction   TEXT,
  p_reason      TEXT,
  p_adjusted_at TIMESTAMPTZ DEFAULT now(),
  p_reference   TEXT        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account financial_accounts%ROWTYPE;
  v_tx_id   UUID;
BEGIN
  IF p_direction NOT IN ('positive', 'negative') THEN
    RAISE EXCEPTION 'direction deve ser ''positive'' ou ''negative''.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor do ajuste deve ser maior que zero.';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'O motivo do ajuste é obrigatório.';
  END IF;

  SELECT * INTO v_account
  FROM financial_accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta financeira % não encontrada.', p_account_id;
  END IF;

  IF NOT v_account.active THEN
    RAISE EXCEPTION 'Ajuste de saldo não permitido em conta desativada: %.', v_account.name;
  END IF;

  INSERT INTO financial_transactions (
    type,
    account_id,
    amount,
    currency,
    transacted_at,
    description,
    reference,
    adjustment_direction,
    operation_id,
    commitment_id,
    destination_account_id
  ) VALUES (
    'balance_adjustment',
    p_account_id,
    p_amount,
    v_account.currency,
    p_adjusted_at,
    trim(p_reason),
    p_reference,
    p_direction,
    NULL,
    NULL,
    NULL
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success',              true,
    'transaction_id',       v_tx_id,
    'account_id',           p_account_id,
    'account_name',         v_account.name,
    'currency',             v_account.currency,
    'amount',               p_amount,
    'direction',            p_direction,
    'adjustment_direction', p_direction,
    'reason',               trim(p_reason),
    'adjusted_at',          p_adjusted_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION record_balance_adjustment(UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT)
  TO anon, authenticated;

-- 5. Atualizar get_financial_account_balances() usando adjustment_direction estruturado
CREATE OR REPLACE FUNCTION get_financial_account_balances()
RETURNS TABLE (
  account_id           UUID,
  account_name         TEXT,
  account_type         TEXT,
  currency             TEXT,
  active               BOOLEAN,
  initial_balance      NUMERIC(12, 2),
  initial_balance_date DATE,
  current_balance      NUMERIC(12, 2),
  pending_receivables  NUMERIC(12, 2),
  pending_payables     NUMERIC(12, 2),
  projected_balance    NUMERIC(12, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH tx_totals AS (
    SELECT
      fa.id AS acc_id,
      COALESCE(SUM(CASE
        WHEN ft.type IN ('inflow', 'refund')                                      THEN ft.amount
        WHEN ft.type = 'balance_adjustment' AND ft.adjustment_direction = 'positive' THEN ft.amount
        ELSE 0
      END), 0.00) AS total_inflow,
      COALESCE(SUM(CASE
        WHEN ft.type = 'outflow'                                                   THEN ft.amount
        WHEN ft.type = 'balance_adjustment' AND ft.adjustment_direction = 'negative' THEN ft.amount
        ELSE 0
      END), 0.00) AS total_outflow,
      COALESCE(SUM(CASE
        WHEN ft.type = 'transfer' THEN
          ft.amount + CASE
            WHEN COALESCE(ft.transfer_fee_currency, fa.currency) = fa.currency
            THEN COALESCE(ft.transfer_fee, 0.00)
            ELSE 0.00
          END
        ELSE 0.00
      END), 0.00) AS total_transfer_out
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
      COALESCE(SUM(CASE
        WHEN fc.type = 'receivable'
        THEN GREATEST(0.00, fc.amount - COALESCE(cs.settled_amount, 0.00))
        ELSE 0.00
      END), 0.00) AS pending_rec,
      COALESCE(SUM(CASE
        WHEN fc.type = 'payable'
        THEN GREATEST(0.00, fc.amount - COALESCE(cs.settled_amount, 0.00))
        ELSE 0.00
      END), 0.00) AS pending_pay
    FROM financial_commitments fc
    INNER JOIN financial_operations fo ON fo.id = fc.operation_id
    LEFT JOIN commitment_settled cs ON cs.commitment_id = fc.id
    WHERE fc.status IN ('planned', 'partially_settled')
      AND fc.expected_account_id IS NOT NULL
      AND (fo.status != 'cancelled' OR fc.is_cancellation_adjustment = true)
    GROUP BY fc.expected_account_id
  )
  SELECT
    fa.id                         AS account_id,
    fa.name                       AS account_name,
    fa.type                       AS account_type,
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
    )                             AS current_balance,
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
    )                             AS projected_balance
  FROM financial_accounts fa
  LEFT JOIN tx_totals tt ON tt.acc_id = fa.id
  LEFT JOIN dest_transfers dt ON dt.acc_id = fa.id
  LEFT JOIN pending_commitments pc ON pc.acc_id = fa.id
  ORDER BY fa.currency ASC, fa.type ASC, fa.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_financial_account_balances() TO anon, authenticated;
