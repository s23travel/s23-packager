-- ==============================================================================
-- Migration: 20261001070000_restrict_cancellation_adjustments_context.sql
-- Descrição: Restringe a criação de ajustes de cancelamento ao contexto correto:
--            - Aceita se a operação estiver cancelada; ou
--            - Aceita se o ajuste for vinculado a um serviço cancelado da mesma operação;
--            - Valida que o serviço informado pertence à mesma operação;
--            - Rejeita qualquer outro cenário (operação ativa sem serviço cancelado).
-- ==============================================================================

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
  v_service RECORD;
BEGIN
  -- 1. Validar operação existente
  SELECT * INTO v_op
  FROM financial_operations
  WHERE id = p_operation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operação financeira com ID % não encontrada.', p_operation_id;
  END IF;

  -- 2. Validar contexto de cancelamento:
  -- Só aceitar se:
  --   a) a operação estiver com status 'cancelled'; ou
  --   b) o ajuste estiver vinculado a um serviço da mesma operação com status 'cancelled'.
  IF p_operation_service_id IS NOT NULL THEN
    -- Validar que o serviço existe
    SELECT * INTO v_service
    FROM financial_operation_services
    WHERE id = p_operation_service_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Serviço financeiro com ID % não foi encontrado.', p_operation_service_id;
    END IF;

    -- Validar que o serviço pertence à mesma operação
    IF v_service.operation_id <> p_operation_id THEN
      RAISE EXCEPTION 'O serviço informado (%) não pertence à operação (%).', p_operation_service_id, p_operation_id;
    END IF;

    -- Se a operação não estiver cancelada, o serviço obrigatoriamente deve estar cancelado
    IF v_op.status <> 'cancelled' AND v_service.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Ajustes de cancelamento vinculados a um serviço exigem que o serviço esteja cancelado ou a operação esteja cancelada.';
    END IF;
  ELSE
    -- Sem serviço informado: a operação DEVE estar com status 'cancelled'
    IF v_op.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Ajustes de cancelamento avulsos só são permitidos quando a operação financeira estiver cancelada.';
    END IF;
  END IF;

  -- 3. Validar tipo de ajuste e definir tipo financeiro correspondente
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

  -- 4. Validar valor
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor do ajuste deve ser maior que zero.';
  END IF;

  -- 5. Validar moeda
  IF p_currency NOT IN ('EUR', 'BRL') THEN
    RAISE EXCEPTION 'Moeda do ajuste deve ser EUR ou BRL.';
  END IF;

  -- 6. Validar contraparte
  v_cp_name := trim(COALESCE(p_counterparty_name, ''));
  IF length(v_cp_name) = 0 THEN
    RAISE EXCEPTION 'O nome da contraparte (cliente ou fornecedor) é obrigatório.';
  END IF;

  -- 7. Inserir em financial_commitments
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
    'operation_service_id', p_operation_service_id,
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
