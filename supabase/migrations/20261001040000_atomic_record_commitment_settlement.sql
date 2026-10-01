-- Migration: 20261001040000_atomic_record_commitment_settlement.sql
-- Descrição: Função atômica record_commitment_settlement para registrar recebimento/pagamento real:
-- 1. Bloqueia compromisso e conta com FOR UPDATE
-- 2. Valida conta obrigatória e compatibilidade estrita de moeda
-- 3. Recusa se compromisso estiver cancelado ou já liquidado
-- 4. Valida se valor informado é maior que zero e não excede o saldo pendente
-- 5. Garante que recebíveis geram apenas 'inflow' e pagáveis geram apenas 'outflow'
-- 6. Insere a movimentação real em financial_transactions
-- 7. Atualiza o status do compromisso para 'partially_settled' ou 'settled'
-- 8. Rollback total automático em caso de qualquer exceção

CREATE OR REPLACE FUNCTION record_commitment_settlement(
  p_commitment_id UUID,
  p_account_id UUID,
  p_amount NUMERIC(12, 2),
  p_transacted_at TIMESTAMPTZ DEFAULT now(),
  p_reference TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_commitment RECORD;
  v_account RECORD;
  v_tx_type TEXT;
  v_already_paid NUMERIC(12, 2) := 0.00;
  v_pending_balance NUMERIC(12, 2) := 0.00;
  v_new_paid NUMERIC(12, 2) := 0.00;
  v_new_status TEXT;
  v_transaction_id UUID;
BEGIN
  -- 1. Validar e bloquear o compromisso
  SELECT * INTO v_commitment
  FROM financial_commitments
  WHERE id = p_commitment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compromisso financeiro informado não foi encontrado.';
  END IF;

  IF v_commitment.status = 'cancelled' THEN
    RAISE EXCEPTION 'Não é possível registrar movimentações em compromissos cancelados.';
  END IF;

  IF v_commitment.status = 'settled' THEN
    RAISE EXCEPTION 'Não é possível registrar movimentações em compromissos já liquidados.';
  END IF;

  -- 2. Validar e bloquear a conta financeira
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'A conta financeira é obrigatória para registrar a movimentação.';
  END IF;

  SELECT * INTO v_account
  FROM financial_accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta financeira informada não foi encontrada.';
  END IF;

  IF v_account.currency <> v_commitment.currency THEN
    RAISE EXCEPTION 'A moeda da conta selecionada (%) deve ser idêntica à moeda do compromisso (%).', v_account.currency, v_commitment.currency;
  END IF;

  -- 3. Validar valor
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor da movimentação deve ser maior que zero.';
  END IF;

  -- 4. Definir tipo da transação ('inflow' para recebíveis, 'outflow' para pagáveis)
  IF v_commitment.type = 'receivable' THEN
    v_tx_type := 'inflow';
  ELSIF v_commitment.type = 'payable' THEN
    v_tx_type := 'outflow';
  ELSE
    RAISE EXCEPTION 'Tipo de compromisso inválido: %', v_commitment.type;
  END IF;

  -- 5. Calcular total já pago/recebido e saldo pendente
  SELECT COALESCE(SUM(amount), 0.00) INTO v_already_paid
  FROM financial_transactions
  WHERE commitment_id = p_commitment_id
    AND type = v_tx_type;

  v_pending_balance := v_commitment.amount - v_already_paid;

  IF p_amount > v_pending_balance THEN
    RAISE EXCEPTION 'O valor informado (%) excede o saldo pendente deste compromisso (%).', p_amount, v_pending_balance;
  END IF;

  -- 6. Inserir movimentação real em financial_transactions
  INSERT INTO financial_transactions (
    type,
    account_id,
    operation_id,
    commitment_id,
    amount,
    currency,
    transacted_at,
    counterparty_name,
    description,
    reference
  ) VALUES (
    v_tx_type,
    p_account_id,
    v_commitment.operation_id,
    p_commitment_id,
    p_amount,
    v_commitment.currency,
    COALESCE(p_transacted_at, now()),
    v_commitment.counterparty_name,
    COALESCE(p_description, CASE WHEN v_commitment.type = 'receivable' THEN 'Recebimento de parcela' ELSE 'Pagamento de parcela' END),
    p_reference
  ) RETURNING id INTO v_transaction_id;

  -- 7. Atualizar status do compromisso
  v_new_paid := v_already_paid + p_amount;
  IF v_new_paid >= v_commitment.amount THEN
    v_new_status := 'settled';
  ELSE
    v_new_status := 'partially_settled';
  END IF;

  UPDATE financial_commitments
  SET status = v_new_status,
      updated_at = now()
  WHERE id = p_commitment_id;

  -- 8. Retorno consolidado
  RETURN jsonb_build_object(
    'transaction_id', v_transaction_id,
    'commitment_id', p_commitment_id,
    'commitment_status', v_new_status,
    'type', v_tx_type,
    'amount', p_amount,
    'currency', v_commitment.currency,
    'already_paid', v_new_paid,
    'pending_balance', (v_commitment.amount - v_new_paid)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION record_commitment_settlement(UUID, UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION record_commitment_settlement(UUID, UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT) IS
'Registra de forma atômica uma movimentação financeira real de liquidação de compromisso e atualiza seu status para partially_settled ou settled.';
