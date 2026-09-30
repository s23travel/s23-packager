-- Migration: 20260930230000_fix_service_cost_and_currency_derivation.sql
-- Descrição: Ajusta a derivação de serviços na função approve_quotation_and_create_operation:
-- - Custo previsto = amount * quantity (quantity default = 1 se ausente ou <= 0)
-- - Moeda do serviço preservada se EUR ou BRL; fallback para moeda da cotação
-- - Serviço financeiro e compromisso a pagar recebem o mesmo valor total e moeda

CREATE OR REPLACE FUNCTION approve_quotation_and_create_operation(
  p_quotation_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote RECORD;
  v_op_id UUID;
  v_sale_price NUMERIC(12, 2);
  v_client_name TEXT;
  v_service JSONB;
  v_op_service_id UUID;
  v_raw_amount NUMERIC(12, 2);
  v_raw_quantity NUMERIC(12, 2);
  v_service_cost NUMERIC(12, 2);
  v_service_curr TEXT;
  v_final_curr TEXT;
  v_services_count INT := 0;
  v_commitments_count INT := 0;
BEGIN
  -- 1. Bloqueia e consulta a cotação
  SELECT * INTO v_quote
  FROM quotations
  WHERE id = p_quotation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação % não encontrada.', p_quotation_id;
  END IF;

  -- 2. Verifica se já existe operação financeira para a cotação (regra 1:1)
  IF EXISTS (SELECT 1 FROM financial_operations WHERE quotation_id = p_quotation_id) THEN
    RAISE EXCEPTION 'Já existe uma operação financeira para a cotação %.', v_quote.reference;
  END IF;

  -- 3. Atualiza a cotação para aceita/aprovada (accepted)
  UPDATE quotations
  SET status = 'accepted',
      updated_at = now()
  WHERE id = p_quotation_id;

  -- 4. Cria a operação financeira
  INSERT INTO financial_operations (quotation_id, status, notes)
  VALUES (p_quotation_id, 'active', p_notes)
  RETURNING id INTO v_op_id;

  -- 5. Extrair preço de venda (suporta financials.salePrice e legado financials.priceTotal.amount)
  v_sale_price := COALESCE(
    (v_quote.data->'financials'->>'salePrice')::NUMERIC,
    (v_quote.data->'financials'->'priceTotal'->>'amount')::NUMERIC,
    0
  );

  v_client_name := COALESCE(NULLIF(trim(v_quote.client_name), ''), 'Cliente');

  -- 6. Cria compromisso a receber do cliente (se houver valor de venda)
  IF v_sale_price > 0 THEN
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
      expected_account_id,
      description
    ) VALUES (
      v_op_id,
      NULL,
      'receivable',
      v_client_name,
      'client',
      v_sale_price,
      v_quote.currency,
      'planned',
      NULL,
      NULL,
      'Recebimento da cotação ' || v_quote.reference || ' - ' || v_client_name
    );
    v_commitments_count := v_commitments_count + 1;
  END IF;

  -- 7. Derivar serviços se existirem em data->'services'
  IF v_quote.data ? 'services' AND jsonb_typeof(v_quote.data->'services') = 'array' THEN
    FOR v_service IN SELECT * FROM jsonb_array_elements(v_quote.data->'services')
    LOOP
      -- Cálculo de custo total: amount * quantity (default 1)
      v_raw_amount := COALESCE((v_service->>'amount')::NUMERIC, 0);
      BEGIN
        v_raw_quantity := (v_service->>'quantity')::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        v_raw_quantity := 1;
      END;

      IF v_raw_quantity IS NULL OR v_raw_quantity <= 0 THEN
        v_raw_quantity := 1;
      END IF;

      v_service_cost := v_raw_amount * v_raw_quantity;

      -- Determinação da moeda: moeda do serviço se for EUR ou BRL; senão moeda da cotação
      v_service_curr := upper(trim(COALESCE(v_service->>'currency', '')));
      IF v_service_curr IN ('EUR', 'BRL') THEN
        v_final_curr := v_service_curr;
      ELSE
        v_final_curr := CASE WHEN v_quote.currency = 'BRL' THEN 'BRL' ELSE 'EUR' END;
      END IF;

      -- Inserir serviço financeiro
      INSERT INTO financial_operation_services (
        operation_id,
        original_service_id,
        type,
        description,
        supplier_name,
        cost_amount,
        cost_currency,
        status,
        notes
      ) VALUES (
        v_op_id,
        v_service->>'id',
        COALESCE(v_service->>'type', 'other'),
        COALESCE(v_service->>'description', 'Serviço da cotação'),
        v_service->>'carrier',
        v_service_cost,
        v_final_curr,
        'planned',
        v_service->>'notes'
      )
      RETURNING id INTO v_op_service_id;

      v_services_count := v_services_count + 1;

      -- Se tiver custo previsto > 0, cria o compromisso a pagar ao fornecedor com mesmo valor e moeda
      IF v_service_cost > 0 THEN
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
          expected_account_id,
          description
        ) VALUES (
          v_op_id,
          v_op_service_id,
          'payable',
          COALESCE(NULLIF(trim(v_service->>'carrier'), ''), 'Fornecedor'),
          'supplier',
          v_service_cost,
          v_final_curr,
          'planned',
          NULL,
          NULL,
          'Pagamento de ' || COALESCE(v_service->>'description', 'serviço')
        );
        v_commitments_count := v_commitments_count + 1;
      END IF;
    END LOOP;
  END IF;

  -- 8. Retorno do resultado estruturado
  RETURN jsonb_build_object(
    'success', true,
    'operation_id', v_op_id,
    'quotation_id', p_quotation_id,
    'quotation_reference', v_quote.reference,
    'services_count', v_services_count,
    'commitments_count', v_commitments_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION approve_quotation_and_create_operation(UUID, TEXT) TO anon, authenticated;
