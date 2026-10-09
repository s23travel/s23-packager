-- Migração: 20261010010000_atomic_split_financial_commitment.sql
-- Descrição: Cria a função RPC split_financial_commitment para divisão atômica de compromissos financeiros

CREATE OR REPLACE FUNCTION public.split_financial_commitment(
  p_commitment_id UUID,
  p_first_amount NUMERIC(12, 2) DEFAULT NULL,
  p_second_expected_date DATE DEFAULT NULL,
  p_first_description TEXT DEFAULT NULL,
  p_second_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op RECORD;
  v_comm RECORD;
  v_total_cents INT;
  v_first_cents INT;
  v_second_cents INT;
  v_final_first_amount NUMERIC(12, 2);
  v_final_second_amount NUMERIC(12, 2);
  v_base_desc TEXT;
  v_desc1 TEXT;
  v_desc2 TEXT;
  v_updated_comm RECORD;
  v_inserted_comm RECORD;
BEGIN
  -- 1. Validar parâmetro de entrada
  IF p_commitment_id IS NULL THEN
    RAISE EXCEPTION 'O identificador do compromisso é obrigatório.';
  END IF;

  -- 2. Localizar o compromisso para identificar a operação financeira pai vinculada
  SELECT * INTO v_comm
  FROM public.financial_commitments
  WHERE id = p_commitment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compromisso financeiro informado não foi encontrado.';
  END IF;

  -- 3. Bloquear a operação financeira pai em primeiro lugar (ordem consistente com cancel_financial_operation para evitar deadlock)
  SELECT * INTO v_op
  FROM public.financial_operations
  WHERE id = v_comm.operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operação financeira vinculada não foi encontrada.';
  END IF;

  IF v_op.status = 'cancelled' THEN
    RAISE EXCEPTION 'Não é possível dividir compromissos de uma operação financeira cancelada.';
  END IF;

  -- 4. Bloquear o compromisso original em segundo lugar (sob a proteção do lock pai)
  SELECT * INTO v_comm
  FROM public.financial_commitments
  WHERE id = p_commitment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compromisso financeiro informado não foi encontrado.';
  END IF;

  -- Revalidar integridade do vínculo com a operação após os locks
  IF v_comm.operation_id <> v_op.id THEN
    RAISE EXCEPTION 'Inconsistência de concorrência: a operação vinculada ao compromisso foi alterada concorrentemente.';
  END IF;

  -- 5. Revalidar estado sob lock
  IF v_comm.status = 'cancelled' THEN
    RAISE EXCEPTION 'Não é possível dividir um compromisso cancelado.';
  END IF;

  IF v_comm.status = 'settled' THEN
    RAISE EXCEPTION 'Não é possível dividir um compromisso já liquidado.';
  END IF;

  IF v_comm.status = 'partially_settled' THEN
    RAISE EXCEPTION 'Não é possível dividir um compromisso parcialmente liquidado.';
  END IF;

  IF v_comm.status <> 'planned' THEN
    RAISE EXCEPTION 'Apenas compromissos com status "planned" podem ser divididos (status atual: %).', v_comm.status;
  END IF;

  -- 6. Revalidar se existem transações financeiras vinculadas
  IF EXISTS (
    SELECT 1
    FROM public.financial_transactions
    WHERE commitment_id = p_commitment_id
  ) THEN
    RAISE EXCEPTION 'Não é possível dividir um compromisso que já possui movimentações financeiras registradas.';
  END IF;

  -- 7. Revalidar tipo de compromisso (não dividir faturas de cartão ou ajustes de cancelamento)
  IF v_comm.is_credit_card_invoice IS TRUE THEN
    RAISE EXCEPTION 'Não é permitido dividir faturas originadas por pagamentos com cartão de crédito.';
  END IF;

  IF v_comm.is_cancellation_adjustment IS TRUE THEN
    RAISE EXCEPTION 'Não é permitido dividir compromissos originados por ajustes de cancelamento ou reembolsos.';
  END IF;

  -- 8. Validar montante original e calcular divisão determinística em cêntimos inteiros
  v_total_cents := ROUND(v_comm.amount * 100)::INT;

  IF v_total_cents <= 0 THEN
    RAISE EXCEPTION 'O valor do compromisso original deve ser maior que zero.';
  END IF;

  IF v_total_cents < 2 THEN
    RAISE EXCEPTION 'O valor do compromisso original (0.01) não pode ser dividido em duas parcelas positivas.';
  END IF;

  IF p_first_amount IS NOT NULL THEN
    v_first_cents := ROUND(p_first_amount * 100)::INT;

    IF v_first_cents <= 0 THEN
      RAISE EXCEPTION 'O valor da primeira parcela deve ser maior que zero.';
    END IF;

    IF v_first_cents >= v_total_cents THEN
      RAISE EXCEPTION 'O valor da primeira parcela (%) deve ser menor que o valor total do compromisso (%).',
        p_first_amount, v_comm.amount;
    END IF;

    v_second_cents := v_total_cents - v_first_cents;
  ELSE
    -- Regra determinística 50/50: se ímpar em cêntimos, a primeira parcela recebe o teto (CEIL)
    v_first_cents := CEIL(v_total_cents / 2.0)::INT;
    v_second_cents := v_total_cents - v_first_cents;
  END IF;

  v_final_first_amount := (v_first_cents / 100.0)::NUMERIC(12, 2);
  v_final_second_amount := (v_second_cents / 100.0)::NUMERIC(12, 2);

  -- Invariante estrita: soma exata sem perda de cêntimos
  IF (v_final_first_amount + v_final_second_amount) <> v_comm.amount THEN
    RAISE EXCEPTION 'Erro de integridade no cálculo das parcelas: % + % <> %',
      v_final_first_amount, v_final_second_amount, v_comm.amount;
  END IF;

  -- 9. Tratar descrições
  v_base_desc := COALESCE(NULLIF(trim(v_comm.description), ''), 'Parcela');
  v_desc1 := COALESCE(NULLIF(trim(p_first_description), ''), v_base_desc || ' (1/2)');
  v_desc2 := COALESCE(NULLIF(trim(p_second_description), ''), v_base_desc || ' (2/2)');

  -- 10. Atualizar a primeira parcela (registro existente)
  UPDATE public.financial_commitments
  SET amount = v_final_first_amount,
      description = v_desc1,
      updated_at = now()
  WHERE id = p_commitment_id
  RETURNING * INTO v_updated_comm;

  -- 11. Inserir a segunda parcela (novo registro)
  INSERT INTO public.financial_commitments (
    operation_id,
    operation_service_id,
    type,
    counterparty_name,
    counterparty_type,
    amount,
    currency,
    status,
    payment_method,
    expected_date,
    expected_account_id,
    description,
    notes,
    is_credit_card_invoice,
    origin_commitment_id,
    credit_card_account_id,
    is_cancellation_adjustment,
    adjustment_type,
    cancellation_reason
  ) VALUES (
    v_comm.operation_id,
    v_comm.operation_service_id,
    v_comm.type,
    v_comm.counterparty_name,
    v_comm.counterparty_type,
    v_final_second_amount,
    v_comm.currency,
    'planned',
    v_comm.payment_method,
    COALESCE(p_second_expected_date, v_comm.expected_date),
    v_comm.expected_account_id,
    v_desc2,
    v_comm.notes,
    false,
    NULL,
    NULL,
    false,
    NULL,
    NULL
  )
  RETURNING * INTO v_inserted_comm;

  -- 12. Retornar payload estruturado
  RETURN jsonb_build_object(
    'success', true,
    'first_commitment', to_jsonb(v_updated_comm),
    'second_commitment', to_jsonb(v_inserted_comm),
    'original_amount', v_comm.amount,
    'first_amount', v_final_first_amount,
    'second_amount', v_final_second_amount
  );
END;
$$;

-- Revogar permissões públicas por padrão do PostgreSQL em funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.split_financial_commitment(UUID, NUMERIC, DATE, TEXT, TEXT) FROM PUBLIC;

-- Permissões mínimas para execução no modelo Supabase da aplicação
GRANT EXECUTE ON FUNCTION public.split_financial_commitment(UUID, NUMERIC, DATE, TEXT, TEXT) TO anon, authenticated;
