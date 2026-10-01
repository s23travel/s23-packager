-- Migration: 20261001060000_phase2c_cancellations_refunds_and_fees.sql
-- Descrição: Fase 2C - Cancelamentos, reembolsos e multas
-- 1. Colunas de motivo e timestamp de cancelamento em financial_operations
-- 2. Colunas de identificação de ajustes de cancelamento em financial_commitments
-- 3. Função atômica cancel_financial_operation
-- 4. Função atômica cancel_operation_service_with_adjustments
-- 5. Função atômica create_cancellation_adjustment

-- 1. Campos de cancelamento na operação financeira
ALTER TABLE financial_operations
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 2. Campos de ajuste de cancelamento nos compromissos
ALTER TABLE financial_commitments
  ADD COLUMN IF NOT EXISTS is_cancellation_adjustment BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS adjustment_type TEXT CHECK (adjustment_type IS NULL OR adjustment_type IN ('client_refund', 'supplier_refund', 'cancellation_fee')),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_financial_commitments_is_adjustment
  ON financial_commitments(is_cancellation_adjustment)
  WHERE is_cancellation_adjustment = true;

CREATE INDEX IF NOT EXISTS idx_financial_commitments_adjustment_type
  ON financial_commitments(adjustment_type)
  WHERE adjustment_type IS NOT NULL;

-- 3. Função atômica: Cancelar Operação Financeira
CREATE OR REPLACE FUNCTION cancel_financial_operation(
  p_operation_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_op RECORD;
  v_cancelled_services_count INT := 0;
  v_cancelled_commitments_count INT := 0;
  v_trimmed_reason TEXT;
BEGIN
  v_trimmed_reason := trim(COALESCE(p_reason, ''));
  IF length(v_trimmed_reason) = 0 THEN
    RAISE EXCEPTION 'O motivo do cancelamento da operação é obrigatório.';
  END IF;

  -- 1. Bloquear a operação para atualização
  SELECT * INTO v_op
  FROM financial_operations
  WHERE id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operação financeira com ID % não foi encontrada.', p_operation_id;
  END IF;

  IF v_op.status = 'cancelled' THEN
    RAISE EXCEPTION 'A operação financeira já se encontra cancelada.';
  END IF;

  -- 2. Atualizar status da operação para 'cancelled' com motivo e data
  UPDATE financial_operations
  SET status = 'cancelled',
      cancellation_reason = v_trimmed_reason,
      cancelled_at = now(),
      updated_at = now()
  WHERE id = p_operation_id;

  -- 3. Cancelar serviços que ainda NÃO foram concluídos (status != 'completed' e status != 'cancelled')
  WITH cancelled_services AS (
    UPDATE financial_operation_services
    SET status = 'cancelled',
        updated_at = now()
    WHERE operation_id = p_operation_id
      AND status NOT IN ('completed', 'cancelled')
    RETURNING id
  )
  SELECT count(*) INTO v_cancelled_services_count
  FROM cancelled_services;

  -- 4. Cancelar SOMENTE parcelas originais ainda previstas ('planned')
  -- Preservar:
  -- - parcelas parcialmente liquidadas ('partially_settled')
  -- - parcelas totalmente liquidadas ('settled')
  -- - parcelas com qualquer movimentação financeira real vinculada
  -- - ajustes de cancelamento previamente existentes
  WITH cancelled_commitments AS (
    UPDATE financial_commitments fc
    SET status = 'cancelled',
        cancellation_reason = v_trimmed_reason,
        updated_at = now()
    WHERE fc.operation_id = p_operation_id
      AND fc.status = 'planned'
      AND fc.is_cancellation_adjustment = false
      AND NOT EXISTS (
        SELECT 1
        FROM financial_transactions ft
        WHERE ft.commitment_id = fc.id
      )
    RETURNING id
  )
  SELECT count(*) INTO v_cancelled_commitments_count
  FROM cancelled_commitments;

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', p_operation_id,
    'status', 'cancelled',
    'cancellation_reason', v_trimmed_reason,
    'cancelled_at', now(),
    'cancelled_services_count', v_cancelled_services_count,
    'cancelled_commitments_count', v_cancelled_commitments_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_financial_operation(UUID, TEXT) TO anon, authenticated;

-- 4. Função atômica: Cancelar Serviço com Fluxo de Ajuste
CREATE OR REPLACE FUNCTION cancel_operation_service_with_adjustments(
  p_service_id UUID,
  p_reason TEXT,
  p_supplier_refund_amount NUMERIC DEFAULT 0,
  p_supplier_refund_currency TEXT DEFAULT 'EUR',
  p_cancellation_fee_amount NUMERIC DEFAULT 0,
  p_cancellation_fee_currency TEXT DEFAULT 'EUR',
  p_fee_counterparty_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_service RECORD;
  v_trimmed_reason TEXT;
  v_cancelled_commitments_count INT := 0;
  v_supplier_refund_id UUID := NULL;
  v_cancellation_fee_id UUID := NULL;
BEGIN
  v_trimmed_reason := trim(COALESCE(p_reason, ''));
  IF length(v_trimmed_reason) = 0 THEN
    RAISE EXCEPTION 'O motivo do cancelamento do serviço é obrigatório.';
  END IF;

  -- 1. Bloquear o serviço para atualização
  SELECT * INTO v_service
  FROM financial_operation_services
  WHERE id = p_service_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço financeiro com ID % não foi encontrado.', p_service_id;
  END IF;

  IF v_service.status = 'cancelled' THEN
    RAISE EXCEPTION 'O serviço já se encontra cancelado.';
  END IF;

  -- 2. Alterar o serviço para 'cancelled'
  UPDATE financial_operation_services
  SET status = 'cancelled',
      notes = CASE
        WHEN notes IS NULL OR length(notes) = 0 THEN 'Motivo do cancelamento: ' || v_trimmed_reason
        ELSE notes || E'\nMotivo do cancelamento: ' || v_trimmed_reason
      END,
      updated_at = now()
  WHERE id = p_service_id;

  -- 3. Cancelar parcelas previstas abertas ('planned') vinculadas ao serviço que não tenham pagamentos reais
  WITH cancelled_rows AS (
    UPDATE financial_commitments fc
    SET status = 'cancelled',
        cancellation_reason = v_trimmed_reason,
        updated_at = now()
    WHERE fc.operation_service_id = p_service_id
      AND fc.status = 'planned'
      AND fc.is_cancellation_adjustment = false
      AND NOT EXISTS (
        SELECT 1
        FROM financial_transactions ft
        WHERE ft.commitment_id = fc.id
      )
    RETURNING id
  )
  SELECT count(*) INTO v_cancelled_commitments_count
  FROM cancelled_rows;

  -- 4. Se houver reembolso do fornecedor previsto:
  -- Reembolso de fornecedor gera entrada (type = 'receivable')
  IF p_supplier_refund_amount > 0 THEN
    IF p_supplier_refund_currency NOT IN ('EUR', 'BRL') THEN
      RAISE EXCEPTION 'Moeda inválida para reembolso do fornecedor: %', p_supplier_refund_currency;
    END IF;

    INSERT INTO financial_commitments (
      operation_id,
      operation_service_id,
      type,
      counterparty_name,
      counterparty_type,
      amount,
      currency,
      status,
      is_cancellation_adjustment,
      adjustment_type,
      description,
      notes
    ) VALUES (
      v_service.operation_id,
      p_service_id,
      'receivable',
      COALESCE(v_service.supplier_name, 'Fornecedor'),
      'supplier',
      p_supplier_refund_amount,
      p_supplier_refund_currency,
      'planned',
      true,
      'supplier_refund',
      'Reembolso de fornecedor - ' || v_service.description,
      v_trimmed_reason
    ) RETURNING id INTO v_supplier_refund_id;
  END IF;

  -- 5. Se houver multa ou custo de cancelamento:
  -- Multa gera saída (type = 'payable')
  IF p_cancellation_fee_amount > 0 THEN
    IF p_cancellation_fee_currency NOT IN ('EUR', 'BRL') THEN
      RAISE EXCEPTION 'Moeda inválida para multa de cancelamento: %', p_cancellation_fee_currency;
    END IF;

    INSERT INTO financial_commitments (
      operation_id,
      operation_service_id,
      type,
      counterparty_name,
      counterparty_type,
      amount,
      currency,
      status,
      is_cancellation_adjustment,
      adjustment_type,
      description,
      notes
    ) VALUES (
      v_service.operation_id,
      p_service_id,
      'payable',
      COALESCE(p_fee_counterparty_name, v_service.supplier_name, 'Fornecedor'),
      'supplier',
      p_cancellation_fee_amount,
      p_cancellation_fee_currency,
      'planned',
      true,
      'cancellation_fee',
      'Multa de cancelamento - ' || v_service.description,
      v_trimmed_reason
    ) RETURNING id INTO v_cancellation_fee_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'service_id', p_service_id,
    'status', 'cancelled',
    'cancellation_reason', v_trimmed_reason,
    'cancelled_commitments_count', v_cancelled_commitments_count,
    'supplier_refund_id', v_supplier_refund_id,
    'cancellation_fee_id', v_cancellation_fee_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_operation_service_with_adjustments(UUID, TEXT, NUMERIC, TEXT, NUMERIC, TEXT, TEXT) TO anon, authenticated;

-- 5. Função atômica: Criar Ajuste de Cancelamento Avulso (Reembolso Cliente, Reembolso Fornecedor, Multa)
CREATE OR REPLACE FUNCTION create_cancellation_adjustment(
  p_operation_id UUID,
  p_adjustment_type TEXT,
  p_counterparty_name TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_counterparty_type TEXT DEFAULT NULL,
  p_expected_date DATE DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_operation_service_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_type TEXT;
  v_cp_type TEXT;
  v_cp_name TEXT;
  v_desc TEXT;
  v_id UUID;
  v_op RECORD;
BEGIN
  -- 1. Validar operação existente
  SELECT * INTO v_op
  FROM financial_operations
  WHERE id = p_operation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operação financeira com ID % não encontrada.', p_operation_id;
  END IF;

  -- 2. Validar tipo de ajuste e definir tipo financeiro correspondente
  -- - Reembolso ao cliente: agência devolve dinheiro -> saída (payable)
  -- - Reembolso do fornecedor: agência recebe dinheiro de volta -> entrada (receivable)
  -- - Multa ou custo de cancelamento: novo valor a pagar -> saída (payable)
  IF p_adjustment_type = 'client_refund' THEN
    v_type := 'payable';
    v_cp_type := 'client';
    v_desc := COALESCE(p_description, 'Reembolso ao cliente');
  ELSIF p_adjustment_type = 'supplier_refund' THEN
    v_type := 'receivable';
    v_cp_type := 'supplier';
    v_desc := COALESCE(p_description, 'Reembolso do fornecedor');
  ELSIF p_adjustment_type = 'cancellation_fee' THEN
    v_type := 'payable';
    v_cp_type := COALESCE(p_counterparty_type, 'supplier');
    v_desc := COALESCE(p_description, 'Multa / Custo de cancelamento');
  ELSE
    RAISE EXCEPTION 'Tipo de ajuste inválido: %. Valores permitidos: client_refund, supplier_refund, cancellation_fee.', p_adjustment_type;
  END IF;

  -- 3. Validar valor
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor do ajuste deve ser maior que zero.';
  END IF;

  -- 4. Validar moeda
  IF p_currency NOT IN ('EUR', 'BRL') THEN
    RAISE EXCEPTION 'Moeda do ajuste deve ser EUR ou BRL.';
  END IF;

  -- 5. Validar contraparte
  v_cp_name := trim(COALESCE(p_counterparty_name, ''));
  IF length(v_cp_name) = 0 THEN
    RAISE EXCEPTION 'O nome da contraparte (cliente ou fornecedor) é obrigatório.';
  END IF;

  -- 6. Inserir em financial_commitments
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
    is_cancellation_adjustment,
    adjustment_type,
    description,
    notes
  ) VALUES (
    p_operation_id,
    p_operation_service_id,
    v_type,
    v_cp_name,
    v_cp_type,
    p_amount,
    p_currency,
    'planned',
    p_expected_date,
    true,
    p_adjustment_type,
    v_desc,
    p_notes
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'operation_id', p_operation_id,
    'type', v_type,
    'adjustment_type', p_adjustment_type,
    'counterparty_name', v_cp_name,
    'counterparty_type', v_cp_type,
    'amount', p_amount,
    'currency', p_currency,
    'status', 'planned',
    'expected_date', p_expected_date,
    'description', v_desc
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_cancellation_adjustment(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, DATE, TEXT, TEXT, UUID) TO anon, authenticated;
