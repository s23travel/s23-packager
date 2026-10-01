-- Migration: 20261001050000_phase2b_credit_card_and_transfers.sql
-- Descrição: Fase 2B - Suporte a pagamentos por Cartão de Crédito e Transferências entre contas:
-- 1. Colunas aditivas em financial_commitments para faturas de cartão de crédito
-- 2. Atualização atômica de record_commitment_settlement com suporte a cartão e fatura automática
-- 3. Função atômica record_account_transfer para transferências entre contas

-- 1. Colunas aditivas para rastreio de faturas de cartão
ALTER TABLE financial_commitments
  ADD COLUMN IF NOT EXISTS is_credit_card_invoice BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS origin_commitment_id UUID REFERENCES financial_commitments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credit_card_account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_commitments_is_credit_card_invoice ON financial_commitments(is_credit_card_invoice);
CREATE INDEX IF NOT EXISTS idx_financial_commitments_origin_commitment_id ON financial_commitments(origin_commitment_id);

COMMENT ON COLUMN financial_commitments.is_credit_card_invoice IS 'Indica se a parcela prevista é uma fatura de cartão de crédito originada por pagamento a fornecedor';
COMMENT ON COLUMN financial_commitments.origin_commitment_id IS 'ID do compromisso original do fornecedor pago via cartão de crédito';
COMMENT ON COLUMN financial_commitments.credit_card_account_id IS 'Conta do cartão de crédito que originou a fatura';

-- 2. Atualização da função atômica record_commitment_settlement
CREATE OR REPLACE FUNCTION record_commitment_settlement(
  p_commitment_id UUID,
  p_account_id UUID,
  p_amount NUMERIC(12, 2),
  p_transacted_at TIMESTAMPTZ DEFAULT now(),
  p_reference TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_invoice_due_date DATE DEFAULT NULL
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
  v_invoice_commitment_id UUID := NULL;
  v_invoice_desc TEXT;
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

  IF v_account.active IS NOT TRUE THEN
    RAISE EXCEPTION 'A conta financeira selecionada está inativa.';
  END IF;

  -- 3. Regra de Cartão de Crédito para Recebimentos
  IF v_commitment.type = 'receivable' AND v_account.type = 'credit_card' THEN
    RAISE EXCEPTION 'Não é permitido utilizar conta do tipo cartão de crédito para registrar recebimentos de clientes.';
  END IF;

  -- Regra para Faturas de Cartão: não pagar fatura com outro cartão de crédito
  IF v_commitment.is_credit_card_invoice IS TRUE AND v_account.type = 'credit_card' THEN
    RAISE EXCEPTION 'Não é permitido pagar a fatura de um cartão com outro cartão de crédito.';
  END IF;

  -- 4. Validar compatibilidade estrita de moeda
  IF v_account.currency <> v_commitment.currency THEN
    RAISE EXCEPTION 'A moeda da conta selecionada (%) deve ser idêntica à moeda do compromisso (%).', v_account.currency, v_commitment.currency;
  END IF;

  -- 5. Validar valor
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor da movimentação deve ser maior que zero.';
  END IF;

  -- 6. Definir tipo da transação
  IF v_commitment.type = 'receivable' THEN
    v_tx_type := 'inflow';
  ELSIF v_commitment.type = 'payable' THEN
    v_tx_type := 'outflow';
  ELSE
    RAISE EXCEPTION 'Tipo de compromisso inválido: %', v_commitment.type;
  END IF;

  -- 7. Calcular total já pago/recebido e saldo pendente
  SELECT COALESCE(SUM(amount), 0.00) INTO v_already_paid
  FROM financial_transactions
  WHERE commitment_id = p_commitment_id
    AND type = v_tx_type;

  v_pending_balance := v_commitment.amount - v_already_paid;

  IF p_amount > v_pending_balance THEN
    RAISE EXCEPTION 'O valor informado (%) excede o saldo pendente deste compromisso (%).', p_amount, v_pending_balance;
  END IF;

  -- 8. Se for pagamento no cartão de crédito, exigir data de vencimento da fatura
  IF v_commitment.type = 'payable' AND v_account.type = 'credit_card' THEN
    IF p_invoice_due_date IS NULL THEN
      RAISE EXCEPTION 'A data de vencimento da fatura é obrigatória para pagamentos com cartão de crédito.';
    END IF;
  END IF;

  -- 9. Inserir movimentação real em financial_transactions
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

  -- 10. Atualizar status do compromisso
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

  -- 11. Se foi pago com Cartão de Crédito, criar atomicamente a parcela prevista da fatura do cartão
  IF v_commitment.type = 'payable' AND v_account.type = 'credit_card' THEN
    v_invoice_desc := 'Fatura ' || v_account.name || ' - ' || COALESCE(v_commitment.description, v_commitment.counterparty_name);

    INSERT INTO financial_commitments (
      operation_id,
      operation_service_id,
      type,
      counterparty_name,
      counterparty_type,
      amount,
      currency,
      status,
      expected_date,
      payment_method,
      description,
      notes,
      is_credit_card_invoice,
      origin_commitment_id,
      credit_card_account_id
    ) VALUES (
      v_commitment.operation_id,
      v_commitment.operation_service_id,
      'payable',
      'Fatura ' || v_account.name,
      'other',
      p_amount,
      v_commitment.currency,
      'planned',
      p_invoice_due_date,
      'transfer',
      v_invoice_desc,
      'Fatura originada pelo pagamento de ' || p_amount || ' ' || v_commitment.currency || ' ao fornecedor "' || v_commitment.counterparty_name || '" usando o cartão ' || v_account.name,
      true,
      p_commitment_id,
      p_account_id
    ) RETURNING id INTO v_invoice_commitment_id;
  END IF;

  -- 12. Retorno consolidado
  RETURN jsonb_build_object(
    'transaction_id', v_transaction_id,
    'commitment_id', p_commitment_id,
    'commitment_status', v_new_status,
    'type', v_tx_type,
    'amount', p_amount,
    'currency', v_commitment.currency,
    'already_paid', v_new_paid,
    'pending_balance', (v_commitment.amount - v_new_paid),
    'invoice_commitment_id', v_invoice_commitment_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION record_commitment_settlement(UUID, UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, DATE) TO anon, authenticated;

-- 3. Função atômica record_account_transfer para transferências entre contas
CREATE OR REPLACE FUNCTION record_account_transfer(
  p_source_account_id UUID,
  p_destination_account_id UUID,
  p_amount NUMERIC(12, 2),
  p_destination_amount NUMERIC(12, 2),
  p_exchange_rate NUMERIC(12, 6) DEFAULT NULL,
  p_transfer_fee NUMERIC(12, 2) DEFAULT 0.00,
  p_transfer_fee_currency TEXT DEFAULT NULL,
  p_transacted_at TIMESTAMPTZ DEFAULT now(),
  p_reference TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_operation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_source RECORD;
  v_dest RECORD;
  v_transaction_id UUID;
  v_fee_currency TEXT;
  v_rate NUMERIC(12, 6);
  v_dest_amt NUMERIC(12, 2);
BEGIN
  -- 1. Validar presença e diferença entre as contas
  IF p_source_account_id IS NULL OR p_destination_account_id IS NULL THEN
    RAISE EXCEPTION 'As contas de origem e de destino são obrigatórias.';
  END IF;

  IF p_source_account_id = p_destination_account_id THEN
    RAISE EXCEPTION 'A conta de origem e a conta de destino devem ser diferentes.';
  END IF;

  -- 2. Bloquear e validar conta de origem
  SELECT * INTO v_source
  FROM financial_accounts
  WHERE id = p_source_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta de origem informada não foi encontrada.';
  END IF;

  IF v_source.active IS NOT TRUE THEN
    RAISE EXCEPTION 'A conta de origem informada está inativa.';
  END IF;

  IF v_source.type = 'credit_card' THEN
    RAISE EXCEPTION 'Contas do tipo cartão de crédito não podem ser usadas como origem de transferência.';
  END IF;

  -- 3. Bloquear e validar conta de destino
  SELECT * INTO v_dest
  FROM financial_accounts
  WHERE id = p_destination_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta de destino informada não foi encontrada.';
  END IF;

  IF v_dest.active IS NOT TRUE THEN
    RAISE EXCEPTION 'A conta de destino informada está inativa.';
  END IF;

  IF v_dest.type = 'credit_card' THEN
    RAISE EXCEPTION 'Contas do tipo cartão de crédito não podem ser usadas como destino de transferência.';
  END IF;

  -- 4. Validar valor de origem
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor de origem da transferência deve ser maior que zero.';
  END IF;

  -- 5. Moedas e Câmbio
  IF v_source.currency = v_dest.currency THEN
    v_dest_amt := COALESCE(p_destination_amount, p_amount);
    IF v_dest_amt <> p_amount THEN
      RAISE EXCEPTION 'Para contas na mesma moeda (%), o valor de origem e destino devem ser iguais.', v_source.currency;
    END IF;
    v_rate := 1.000000;
  ELSE
    -- Moedas diferentes (EUR <-> BRL)
    v_dest_amt := p_destination_amount;
    IF v_dest_amt IS NULL OR v_dest_amt <= 0 THEN
      RAISE EXCEPTION 'O valor de destino da transferência deve ser maior que zero.';
    END IF;

    v_rate := p_exchange_rate;
    IF v_rate IS NULL OR v_rate <= 0 THEN
      v_rate := ROUND((v_dest_amt / p_amount)::numeric, 6);
    END IF;
  END IF;

  v_fee_currency := COALESCE(p_transfer_fee_currency, v_source.currency);
  IF v_fee_currency NOT IN ('EUR', 'BRL') THEN
    v_fee_currency := v_source.currency;
  END IF;

  -- 6. Inserir a transação de transferência (commitment_id estritamente NULL)
  INSERT INTO financial_transactions (
    type,
    account_id,
    destination_account_id,
    operation_id,
    commitment_id,
    amount,
    currency,
    destination_amount,
    destination_currency,
    exchange_rate,
    transfer_fee,
    transfer_fee_currency,
    transacted_at,
    reference,
    description
  ) VALUES (
    'transfer',
    p_source_account_id,
    p_destination_account_id,
    p_operation_id,
    NULL,
    p_amount,
    v_source.currency,
    v_dest_amt,
    v_dest.currency,
    v_rate,
    COALESCE(p_transfer_fee, 0.00),
    v_fee_currency,
    COALESCE(p_transacted_at, now()),
    p_reference,
    COALESCE(p_description, 'Transferência de ' || v_source.name || ' para ' || v_dest.name)
  ) RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'source_account_id', p_source_account_id,
    'source_account_name', v_source.name,
    'source_currency', v_source.currency,
    'source_amount', p_amount,
    'destination_account_id', p_destination_account_id,
    'destination_account_name', v_dest.name,
    'destination_currency', v_dest.currency,
    'destination_amount', v_dest_amt,
    'exchange_rate', v_rate,
    'transfer_fee', COALESCE(p_transfer_fee, 0.00),
    'transacted_at', COALESCE(p_transacted_at, now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION record_account_transfer(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, TEXT, TEXT, UUID) TO anon, authenticated;

COMMENT ON FUNCTION record_account_transfer IS
'Registra de forma atômica uma transferência entre contas financeiras ativas com validação cambial e bloqueio estrito de cartões de crédito.';
