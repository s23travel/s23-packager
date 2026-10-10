


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."approve_quotation_and_create_operation"("p_quotation_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  FROM public.quotations
  WHERE id = p_quotation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação % não encontrada.', p_quotation_id;
  END IF;

  -- 2. Verifica se já existe operação financeira para a cotação (regra 1:1)
  IF EXISTS (SELECT 1 FROM public.financial_operations WHERE quotation_id = p_quotation_id) THEN
    RAISE EXCEPTION 'Já existe uma operação financeira para a cotação %.', v_quote.reference;
  END IF;

  -- 3. Atualiza a cotação para aceita/aprovada (accepted)
  UPDATE public.quotations
  SET status = 'accepted',
      updated_at = now()
  WHERE id = p_quotation_id;

  -- 4. Cria a operação financeira
  INSERT INTO public.financial_operations (quotation_id, status, notes)
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
    INSERT INTO public.financial_commitments (
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
      INSERT INTO public.financial_operation_services (
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
        INSERT INTO public.financial_commitments (
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


ALTER FUNCTION "public"."approve_quotation_and_create_operation"("p_quotation_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_financial_operation"("p_operation_id" "uuid", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  SELECT * INTO v_op
  FROM public.financial_operations
  WHERE id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operação financeira com ID % não foi encontrada.', p_operation_id;
  END IF;

  IF v_op.status = 'cancelled' THEN
    RAISE EXCEPTION 'A operação financeira já se encontra cancelada.';
  END IF;

  UPDATE public.financial_operations
  SET status = 'cancelled',
      cancellation_reason = v_trimmed_reason,
      cancelled_at = now(),
      updated_at = now()
  WHERE id = p_operation_id;

  WITH cancelled_services AS (
    UPDATE public.financial_operation_services
    SET status = 'cancelled',
        updated_at = now()
    WHERE operation_id = p_operation_id
      AND status NOT IN ('completed', 'cancelled')
    RETURNING id
  )
  SELECT count(*) INTO v_cancelled_services_count
  FROM cancelled_services;

  WITH cancelled_commitments AS (
    UPDATE public.financial_commitments fc
    SET status = 'cancelled',
        cancellation_reason = v_trimmed_reason,
        updated_at = now()
    WHERE fc.operation_id = p_operation_id
      AND fc.status = 'planned'
      AND fc.is_cancellation_adjustment = false
      AND NOT EXISTS (
        SELECT 1
        FROM public.financial_transactions ft
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


ALTER FUNCTION "public"."cancel_financial_operation"("p_operation_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_operation_service"("p_service_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_service RECORD;
  v_cancelled_commitments_count INT := 0;
BEGIN
  SELECT * INTO v_service
  FROM public.financial_operation_services
  WHERE id = p_service_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço financeiro com ID % não foi encontrado.', p_service_id;
  END IF;

  PERFORM id
  FROM public.financial_commitments
  WHERE operation_service_id = p_service_id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.financial_commitments
    WHERE operation_service_id = p_service_id
      AND status IN ('partially_settled', 'settled')
  ) THEN
    RAISE EXCEPTION 'Não é possível cancelar um serviço que possui pagamentos já realizados ou parcialmente liquidados sem tratar reembolso ou multa.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financial_transactions ft
    INNER JOIN public.financial_commitments fc ON fc.id = ft.commitment_id
    WHERE fc.operation_service_id = p_service_id
  ) THEN
    RAISE EXCEPTION 'Não é possível cancelar um serviço cujos pagamentos já possuem movimentações financeiras registradas sem tratar reembolso ou multa.';
  END IF;

  UPDATE public.financial_operation_services
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = p_service_id;

  WITH updated_rows AS (
    UPDATE public.financial_commitments
    SET status = 'cancelled',
        updated_at = now()
    WHERE operation_service_id = p_service_id
      AND status = 'planned'
    RETURNING id
  )
  SELECT count(*) INTO v_cancelled_commitments_count
  FROM updated_rows;

  RETURN jsonb_build_object(
    'service_id', p_service_id,
    'status', 'cancelled',
    'cancelled_commitments_count', v_cancelled_commitments_count
  );
END;
$$;


ALTER FUNCTION "public"."cancel_operation_service"("p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_operation_service_with_adjustments"("p_service_id" "uuid", "p_reason" "text", "p_supplier_refund_amount" numeric DEFAULT 0, "p_supplier_refund_currency" "text" DEFAULT 'EUR'::"text", "p_cancellation_fee_amount" numeric DEFAULT 0, "p_cancellation_fee_currency" "text" DEFAULT 'EUR'::"text", "p_fee_counterparty_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  SELECT * INTO v_service
  FROM public.financial_operation_services
  WHERE id = p_service_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço financeiro com ID % não foi encontrado.', p_service_id;
  END IF;

  IF v_service.status = 'cancelled' THEN
    RAISE EXCEPTION 'O serviço já se encontra cancelado.';
  END IF;

  UPDATE public.financial_operation_services
  SET status = 'cancelled',
      notes = CASE
        WHEN notes IS NULL OR length(notes) = 0 THEN 'Motivo do cancelamento: ' || v_trimmed_reason
        ELSE notes || E'\nMotivo do cancelamento: ' || v_trimmed_reason
      END,
      updated_at = now()
  WHERE id = p_service_id;

  WITH cancelled_rows AS (
    UPDATE public.financial_commitments fc
    SET status = 'cancelled',
        cancellation_reason = v_trimmed_reason,
        updated_at = now()
    WHERE fc.operation_service_id = p_service_id
      AND fc.status = 'planned'
      AND fc.is_cancellation_adjustment = false
      AND NOT EXISTS (
        SELECT 1
        FROM public.financial_transactions ft
        WHERE ft.commitment_id = fc.id
      )
    RETURNING id
  )
  SELECT count(*) INTO v_cancelled_commitments_count
  FROM cancelled_rows;

  IF p_supplier_refund_amount > 0 THEN
    IF p_supplier_refund_currency NOT IN ('EUR', 'BRL') THEN
      RAISE EXCEPTION 'Moeda inválida para reembolso do fornecedor: %', p_supplier_refund_currency;
    END IF;

    INSERT INTO public.financial_commitments (
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

  IF p_cancellation_fee_amount > 0 THEN
    IF p_cancellation_fee_currency NOT IN ('EUR', 'BRL') THEN
      RAISE EXCEPTION 'Moeda inválida para multa de cancelamento: %', p_cancellation_fee_currency;
    END IF;

    INSERT INTO public.financial_commitments (
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


ALTER FUNCTION "public"."cancel_operation_service_with_adjustments"("p_service_id" "uuid", "p_reason" "text", "p_supplier_refund_amount" numeric, "p_supplier_refund_currency" "text", "p_cancellation_fee_amount" numeric, "p_cancellation_fee_currency" "text", "p_fee_counterparty_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_quotation_status_protection"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF (NEW.status IS DISTINCT FROM 'accepted') THEN
    IF EXISTS (
      SELECT 1 FROM public.financial_operations 
      WHERE quotation_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cotação possui operação financeira vinculada e deve permanecer com status "accepted". Alterações para "%" não são permitidas.', NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_quotation_status_protection"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_cancellation_adjustment"("p_operation_id" "uuid", "p_adjustment_type" "text", "p_counterparty_name" "text", "p_amount" numeric, "p_currency" "text", "p_counterparty_type" "text" DEFAULT NULL::"text", "p_expected_date" "date" DEFAULT NULL::"date", "p_description" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text", "p_operation_service_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  SELECT * INTO v_op
  FROM public.financial_operations
  WHERE id = p_operation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operação financeira com ID % não encontrada.', p_operation_id;
  END IF;

  IF p_operation_service_id IS NOT NULL THEN
    SELECT * INTO v_service
    FROM public.financial_operation_services
    WHERE id = p_operation_service_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Serviço financeiro com ID % não foi encontrado.', p_operation_service_id;
    END IF;

    IF v_service.operation_id <> p_operation_id THEN
      RAISE EXCEPTION 'O serviço informado (%) não pertence à operação (%).', p_operation_service_id, p_operation_id;
    END IF;

    IF v_op.status <> 'cancelled' AND v_service.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Ajustes de cancelamento vinculados a um serviço exigem que o serviço esteja cancelado ou a operação esteja cancelada.';
    END IF;
  ELSE
    IF v_op.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Ajustes de cancelamento avulsos só são permitidos quando a operação financeira estiver cancelada.';
    END IF;
  END IF;

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

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor do ajuste deve ser maior que zero.';
  END IF;

  IF p_currency NOT IN ('EUR', 'BRL') THEN
    RAISE EXCEPTION 'Moeda do ajuste deve ser EUR ou BRL.';
  END IF;

  v_cp_name := trim(COALESCE(p_counterparty_name, ''));
  IF length(v_cp_name) = 0 THEN
    RAISE EXCEPTION 'O nome da contraparte (cliente ou fornecedor) é obrigatório.';
  END IF;

  INSERT INTO public.financial_commitments (
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


ALTER FUNCTION "public"."create_cancellation_adjustment"("p_operation_id" "uuid", "p_adjustment_type" "text", "p_counterparty_name" "text", "p_amount" numeric, "p_currency" "text", "p_counterparty_type" "text", "p_expected_date" "date", "p_description" "text", "p_notes" "text", "p_operation_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_financial_account_balances"() RETURNS TABLE("account_id" "uuid", "account_name" "text", "account_type" "text", "currency" "text", "active" boolean, "initial_balance" numeric, "initial_balance_date" "date", "current_balance" numeric, "pending_receivables" numeric, "pending_payables" numeric, "projected_balance" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
    FROM public.financial_accounts fa
    LEFT JOIN public.financial_transactions ft ON ft.account_id = fa.id
    GROUP BY fa.id
  ),
  dest_transfers AS (
    SELECT
      fa.id AS acc_id,
      COALESCE(SUM(COALESCE(ft.destination_amount, ft.amount)), 0.00) AS total_transfer_in
    FROM public.financial_accounts fa
    LEFT JOIN public.financial_transactions ft ON ft.destination_account_id = fa.id AND ft.type = 'transfer'
    GROUP BY fa.id
  ),
  commitment_settled AS (
    SELECT
      ft.commitment_id,
      COALESCE(SUM(ft.amount), 0.00) AS settled_amount
    FROM public.financial_transactions ft
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
    FROM public.financial_commitments fc
    INNER JOIN public.financial_operations fo ON fo.id = fc.operation_id
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
  FROM public.financial_accounts fa
  LEFT JOIN tx_totals tt ON tt.acc_id = fa.id
  LEFT JOIN dest_transfers dt ON dt.acc_id = fa.id
  LEFT JOIN pending_commitments pc ON pc.acc_id = fa.id
  ORDER BY fa.currency ASC, fa.type ASC, fa.name ASC;
END;
$$;


ALTER FUNCTION "public"."get_financial_account_balances"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_financial_consolidated_summary"("p_reference_date" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_ref_date DATE := COALESCE(p_reference_date, CURRENT_DATE);
  v_result JSONB;
BEGIN
  WITH balances AS (
    SELECT * FROM public.get_financial_account_balances()
  ),
  commitment_settled AS (
    SELECT
      ft.commitment_id,
      COALESCE(SUM(ft.amount), 0.00) AS settled_amount
    FROM public.financial_transactions ft
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
    FROM public.financial_commitments fc
    INNER JOIN public.financial_operations fo ON fo.id = fc.operation_id
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


ALTER FUNCTION "public"."get_financial_consolidated_summary"("p_reference_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_financial_commitments"("p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date", "p_currency" "text" DEFAULT NULL::"text", "p_type" "text" DEFAULT NULL::"text", "p_account_id" "uuid" DEFAULT NULL::"uuid", "p_is_overdue" boolean DEFAULT NULL::boolean, "p_reference_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("id" "uuid", "operation_id" "uuid", "operation_service_id" "uuid", "quotation_id" "uuid", "quotation_reference" "text", "quotation_client_name" "text", "type" "text", "counterparty_name" "text", "counterparty_type" "text", "amount" numeric, "currency" "text", "status" "text", "expected_date" "date", "expected_account_id" "uuid", "expected_account_name" "text", "already_paid" numeric, "pending_amount" numeric, "is_overdue" boolean, "payment_method" "text", "is_credit_card_invoice" boolean, "origin_commitment_id" "uuid", "credit_card_account_id" "uuid", "is_cancellation_adjustment" boolean, "adjustment_type" "text", "description" "text", "notes" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_ref_date DATE := COALESCE(p_reference_date, CURRENT_DATE);
BEGIN
  RETURN QUERY
  WITH commitment_settled AS (
    SELECT
      ft.commitment_id,
      COALESCE(SUM(ft.amount), 0.00) AS settled_amount
    FROM public.financial_transactions ft
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
  FROM public.financial_commitments fc
  INNER JOIN public.financial_operations fo ON fo.id = fc.operation_id
  LEFT JOIN public.quotations q ON q.id = fo.quotation_id
  LEFT JOIN public.financial_accounts fa ON fa.id = fc.expected_account_id
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


ALTER FUNCTION "public"."get_pending_financial_commitments"("p_start_date" "date", "p_end_date" "date", "p_currency" "text", "p_type" "text", "p_account_id" "uuid", "p_is_overdue" boolean, "p_reference_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_period_cash_flow_forecast"("p_start_date" "date", "p_end_date" "date") RETURNS TABLE("currency" "text", "expected_inflows" numeric, "expected_outflows" numeric, "net_cash_flow" numeric, "receivables_count" integer, "payables_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH commitment_settled AS (
    SELECT
      ft.commitment_id,
      COALESCE(SUM(ft.amount), 0.00) AS settled_amount
    FROM public.financial_transactions ft
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
    FROM public.financial_commitments fc
    INNER JOIN public.financial_operations fo ON fo.id = fc.operation_id
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


ALTER FUNCTION "public"."get_period_cash_flow_forecast"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_account_transfer"("p_source_account_id" "uuid", "p_destination_account_id" "uuid", "p_amount" numeric, "p_destination_amount" numeric, "p_exchange_rate" numeric DEFAULT NULL::numeric, "p_transfer_fee" numeric DEFAULT 0.00, "p_transfer_fee_currency" "text" DEFAULT NULL::"text", "p_transacted_at" timestamp with time zone DEFAULT "now"(), "p_reference" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text", "p_operation_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  FROM public.financial_accounts
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
  FROM public.financial_accounts
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
  INSERT INTO public.financial_transactions (
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


ALTER FUNCTION "public"."record_account_transfer"("p_source_account_id" "uuid", "p_destination_account_id" "uuid", "p_amount" numeric, "p_destination_amount" numeric, "p_exchange_rate" numeric, "p_transfer_fee" numeric, "p_transfer_fee_currency" "text", "p_transacted_at" timestamp with time zone, "p_reference" "text", "p_description" "text", "p_operation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_balance_adjustment"("p_account_id" "uuid", "p_amount" numeric, "p_direction" "text", "p_reason" "text", "p_adjusted_at" timestamp with time zone DEFAULT "now"(), "p_reference" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  FROM public.financial_accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta financeira % não encontrada.', p_account_id;
  END IF;

  IF NOT v_account.active THEN
    RAISE EXCEPTION 'Ajuste de saldo não permitido em conta desativada: %.', v_account.name;
  END IF;

  INSERT INTO public.financial_transactions (
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


ALTER FUNCTION "public"."record_balance_adjustment"("p_account_id" "uuid", "p_amount" numeric, "p_direction" "text", "p_reason" "text", "p_adjusted_at" timestamp with time zone, "p_reference" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_commitment_settlement"("p_commitment_id" "uuid", "p_account_id" "uuid", "p_amount" numeric, "p_transacted_at" timestamp with time zone DEFAULT "now"(), "p_reference" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text", "p_invoice_due_date" "date" DEFAULT NULL::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  FROM public.financial_commitments
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
  FROM public.financial_accounts
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
  FROM public.financial_transactions
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
  INSERT INTO public.financial_transactions (
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

  UPDATE public.financial_commitments
  SET status = v_new_status,
      updated_at = now()
  WHERE id = p_commitment_id;

  -- 11. Se foi pago com Cartão de Crédito, criar atomicamente a parcela prevista da fatura do cartão
  IF v_commitment.type = 'payable' AND v_account.type = 'credit_card' THEN
    v_invoice_desc := 'Fatura ' || v_account.name || ' - ' || COALESCE(v_commitment.description, v_commitment.counterparty_name);

    INSERT INTO public.financial_commitments (
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


ALTER FUNCTION "public"."record_commitment_settlement"("p_commitment_id" "uuid", "p_account_id" "uuid", "p_amount" numeric, "p_transacted_at" timestamp with time zone, "p_reference" "text", "p_description" "text", "p_invoice_due_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."split_financial_commitment"("p_commitment_id" "uuid", "p_first_amount" numeric DEFAULT NULL::numeric, "p_second_expected_date" "date" DEFAULT NULL::"date", "p_first_description" "text" DEFAULT NULL::"text", "p_second_description" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."split_financial_commitment"("p_commitment_id" "uuid", "p_first_amount" numeric, "p_second_expected_date" "date", "p_first_description" "text", "p_second_description" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."split_financial_commitment"("p_commitment_id" "uuid", "p_first_amount" numeric, "p_second_expected_date" "date", "p_first_description" "text", "p_second_description" "text") IS 'Divide atomicamente um compromisso financeiro em status planned em duas parcelas sem perda de cêntimos.';



CREATE OR REPLACE FUNCTION "public"."trg_check_quotation_archive"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.archived_at IS NOT NULL AND (OLD.archived_at IS NULL OR OLD.archived_at IS DISTINCT FROM NEW.archived_at) THEN
    IF EXISTS (
      SELECT 1 FROM public.financial_operations
      WHERE quotation_id = NEW.id
        AND status != 'cancelled'
    ) THEN
      RAISE EXCEPTION 'Não é permitido arquivar cotação com operação financeira ativa. A operação precisa ser cancelada previamente.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_check_quotation_archive"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."favorite_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "country" "text" NOT NULL,
    "city" "text",
    "notes" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "favorite_services_country_check" CHECK (("length"(TRIM(BOTH FROM "country")) > 0)),
    CONSTRAINT "favorite_services_name_check" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "favorite_services_type_check" CHECK (("type" = ANY (ARRAY['hotel'::"text", 'airline'::"text", 'transfer'::"text", 'tour'::"text", 'insurance'::"text", 'car_rental'::"text", 'additional'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."favorite_services" OWNER TO "postgres";


COMMENT ON TABLE "public"."favorite_services" IS 'Catálogo de serviços reutilizáveis para preenchimento de novos pacotes. Fonte de dados apenas — packages mantêm snapshot próprio.';



COMMENT ON COLUMN "public"."favorite_services"."type" IS 'Tipo do serviço: hotel, airline, transfer, tour, insurance, car_rental, additional, other';



COMMENT ON COLUMN "public"."favorite_services"."active" IS 'Serviços inativos não aparecem nas sugestões de autocomplete. Pacotes já criados não são alterados.';



CREATE TABLE IF NOT EXISTS "public"."financial_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "currency" "text" NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true NOT NULL,
    "initial_balance" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "initial_balance_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "financial_accounts_currency_check" CHECK (("currency" = ANY (ARRAY['EUR'::"text", 'BRL'::"text"]))),
    CONSTRAINT "financial_accounts_name_check" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "financial_accounts_type_check" CHECK (("type" = ANY (ARRAY['bank_account'::"text", 'cash'::"text", 'credit_card'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."financial_accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."financial_accounts" IS 'Contas financeiras da S23 (ex.: Caixa Portugal em EUR, Caixa Brasil em BRL, cartões)';



COMMENT ON COLUMN "public"."financial_accounts"."initial_balance" IS 'Saldo de abertura/inicial da conta para projeção financeira';



COMMENT ON COLUMN "public"."financial_accounts"."initial_balance_date" IS 'Data de referência do saldo inicial da conta';



CREATE TABLE IF NOT EXISTS "public"."financial_commitments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operation_id" "uuid" NOT NULL,
    "operation_service_id" "uuid",
    "type" "text" NOT NULL,
    "counterparty_name" "text" NOT NULL,
    "counterparty_type" "text" DEFAULT 'client'::"text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "payment_method" "text",
    "expected_date" "date",
    "expected_account_id" "uuid",
    "description" "text",
    "notes" "text",
    "is_credit_card_invoice" boolean DEFAULT false NOT NULL,
    "origin_commitment_id" "uuid",
    "credit_card_account_id" "uuid",
    "is_cancellation_adjustment" boolean DEFAULT false NOT NULL,
    "adjustment_type" "text",
    "cancellation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "financial_commitments_adjustment_type_check" CHECK ((("adjustment_type" IS NULL) OR ("adjustment_type" = ANY (ARRAY['client_refund'::"text", 'supplier_refund'::"text", 'cancellation_fee'::"text"])))),
    CONSTRAINT "financial_commitments_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "financial_commitments_counterparty_name_check" CHECK (("length"(TRIM(BOTH FROM "counterparty_name")) > 0)),
    CONSTRAINT "financial_commitments_counterparty_type_check" CHECK (("counterparty_type" = ANY (ARRAY['client'::"text", 'supplier'::"text", 'other'::"text"]))),
    CONSTRAINT "financial_commitments_currency_check" CHECK (("currency" = ANY (ARRAY['EUR'::"text", 'BRL'::"text"]))),
    CONSTRAINT "financial_commitments_payment_method_check" CHECK ((("payment_method" IS NULL) OR ("payment_method" = ANY (ARRAY['transfer'::"text", 'card'::"text", 'payment_link'::"text", 'cash'::"text", 'other'::"text"])))),
    CONSTRAINT "financial_commitments_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'partially_settled'::"text", 'settled'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "financial_commitments_type_check" CHECK (("type" = ANY (ARRAY['receivable'::"text", 'payable'::"text"])))
);


ALTER TABLE "public"."financial_commitments" OWNER TO "postgres";


COMMENT ON TABLE "public"."financial_commitments" IS 'Compromissos previstos a receber (cliente) ou a pagar (fornecedor)';



COMMENT ON COLUMN "public"."financial_commitments"."payment_method" IS 'Método previsto de pagamento: transfer, card, payment_link, cash, other';



COMMENT ON COLUMN "public"."financial_commitments"."is_credit_card_invoice" IS 'Indica se a parcela prevista é uma fatura de cartão de crédito originada por pagamento a fornecedor';



CREATE TABLE IF NOT EXISTS "public"."financial_operation_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operation_id" "uuid" NOT NULL,
    "original_service_id" "text",
    "type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "supplier_name" "text",
    "cost_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "cost_currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "financial_operation_services_cost_amount_check" CHECK (("cost_amount" >= (0)::numeric)),
    CONSTRAINT "financial_operation_services_cost_currency_check" CHECK (("cost_currency" = ANY (ARRAY['EUR'::"text", 'BRL'::"text"]))),
    CONSTRAINT "financial_operation_services_description_check" CHECK (("length"(TRIM(BOTH FROM "description")) > 0)),
    CONSTRAINT "financial_operation_services_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'reserved'::"text", 'contracted'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."financial_operation_services" OWNER TO "postgres";


COMMENT ON TABLE "public"."financial_operation_services" IS 'Serviços independentes de uma operação financeira para controle de fornecimento e execução';



CREATE TABLE IF NOT EXISTS "public"."financial_operations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quotation_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text",
    "cancellation_reason" "text",
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "financial_operations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."financial_operations" OWNER TO "postgres";


COMMENT ON TABLE "public"."financial_operations" IS 'Operações financeiras vinculadas a cotações aprovadas. Escrita direta desativada para anon/authenticated (acesso exclusivo via RPCs SECURITY DEFINER).';



CREATE TABLE IF NOT EXISTS "public"."financial_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "destination_account_id" "uuid",
    "operation_id" "uuid",
    "commitment_id" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "destination_amount" numeric(12,2),
    "destination_currency" "text",
    "exchange_rate" numeric(12,6),
    "transfer_fee" numeric(12,2) DEFAULT 0.00,
    "transfer_fee_currency" "text",
    "transacted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "counterparty_name" "text",
    "description" "text",
    "reference" "text",
    "adjustment_direction" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "financial_transactions_adjustment_direction_check" CHECK (((("type" = 'balance_adjustment'::"text") AND ("adjustment_direction" = ANY (ARRAY['positive'::"text", 'negative'::"text"]))) OR (("type" <> 'balance_adjustment'::"text") AND ("adjustment_direction" IS NULL)))),
    CONSTRAINT "financial_transactions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "financial_transactions_currency_check" CHECK (("currency" = ANY (ARRAY['EUR'::"text", 'BRL'::"text"]))),
    CONSTRAINT "financial_transactions_destination_currency_check" CHECK ((("destination_currency" IS NULL) OR ("destination_currency" = ANY (ARRAY['EUR'::"text", 'BRL'::"text"])))),
    CONSTRAINT "financial_transactions_transfer_fee_currency_check" CHECK ((("transfer_fee_currency" IS NULL) OR ("transfer_fee_currency" = ANY (ARRAY['EUR'::"text", 'BRL'::"text"])))),
    CONSTRAINT "financial_transactions_type_check" CHECK (("type" = ANY (ARRAY['inflow'::"text", 'outflow'::"text", 'transfer'::"text", 'refund'::"text", 'balance_adjustment'::"text"])))
);


ALTER TABLE "public"."financial_transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."financial_transactions" IS 'Livro-razão financeiro (movimentações reais). Imutável e protegido contra escrita direta de anon/authenticated (apenas via RPCs SECURITY DEFINER).';



COMMENT ON COLUMN "public"."financial_transactions"."adjustment_direction" IS 'Direção estruturada para balance_adjustment: positive (aumenta saldo) ou negative (reduz saldo). Deve ser NULL para outros tipos.';



CREATE TABLE IF NOT EXISTS "public"."package_website_contents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "content" "jsonb" NOT NULL,
    "markdown" "text" NOT NULL,
    "filename" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."package_website_contents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reference" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "base_currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "packages_base_currency_check" CHECK (("base_currency" = ANY (ARRAY['EUR'::"text", 'BRL'::"text"]))),
    CONSTRAINT "packages_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."packages" OWNER TO "postgres";


COMMENT ON TABLE "public"."packages" IS 'Armazena pacotes base de viagens e seus componentes flexíveis via JSONB';



CREATE TABLE IF NOT EXISTS "public"."quotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid",
    "reference" "text" NOT NULL,
    "client_name" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "exchange_rate" numeric(12,6),
    "exchange_rate_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    CONSTRAINT "quotations_currency_check" CHECK (("currency" = ANY (ARRAY['EUR'::"text", 'BRL'::"text"]))),
    CONSTRAINT "quotations_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'accepted'::"text", 'rejected'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."quotations" OWNER TO "postgres";


COMMENT ON TABLE "public"."quotations" IS 'Armazena cotações com snapshot independente do pacote original no campo data (JSONB)';



COMMENT ON COLUMN "public"."quotations"."package_id" IS 'Referência ao pacote de origem. Mantém rastreabilidade sem afetar o snapshot independente';



COMMENT ON COLUMN "public"."quotations"."data" IS 'Snapshot completo e imutável dos dados e componentes da cotação no momento de criação';



COMMENT ON COLUMN "public"."quotations"."archived_at" IS 'Data/hora de arquivamento da cotação. Cotações arquivadas não aparecem nas listagens normais.';



ALTER TABLE ONLY "public"."favorite_services"
    ADD CONSTRAINT "favorite_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_accounts"
    ADD CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_commitments"
    ADD CONSTRAINT "financial_commitments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_operation_services"
    ADD CONSTRAINT "financial_operation_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_operations"
    ADD CONSTRAINT "financial_operations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."package_website_contents"
    ADD CONSTRAINT "package_website_contents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_operations"
    ADD CONSTRAINT "uq_financial_operations_quotation_id" UNIQUE ("quotation_id");



ALTER TABLE ONLY "public"."package_website_contents"
    ADD CONSTRAINT "uq_package_website_contents_package_id" UNIQUE ("package_id");



CREATE INDEX "idx_favorite_services_active" ON "public"."favorite_services" USING "btree" ("active");



CREATE INDEX "idx_favorite_services_created_at" ON "public"."favorite_services" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_favorite_services_name" ON "public"."favorite_services" USING "btree" ("lower"("name"));



CREATE INDEX "idx_favorite_services_type" ON "public"."favorite_services" USING "btree" ("type");



CREATE INDEX "idx_financial_accounts_active" ON "public"."financial_accounts" USING "btree" ("active");



CREATE INDEX "idx_financial_accounts_currency" ON "public"."financial_accounts" USING "btree" ("currency");



CREATE INDEX "idx_financial_commitments_adjustment_type" ON "public"."financial_commitments" USING "btree" ("adjustment_type") WHERE ("adjustment_type" IS NOT NULL);



CREATE INDEX "idx_financial_commitments_expected_date" ON "public"."financial_commitments" USING "btree" ("expected_date");



CREATE INDEX "idx_financial_commitments_is_adjustment" ON "public"."financial_commitments" USING "btree" ("is_cancellation_adjustment") WHERE ("is_cancellation_adjustment" = true);



CREATE INDEX "idx_financial_commitments_is_credit_card_invoice" ON "public"."financial_commitments" USING "btree" ("is_credit_card_invoice");



CREATE INDEX "idx_financial_commitments_operation_id" ON "public"."financial_commitments" USING "btree" ("operation_id");



CREATE INDEX "idx_financial_commitments_origin_commitment_id" ON "public"."financial_commitments" USING "btree" ("origin_commitment_id");



CREATE INDEX "idx_financial_commitments_status" ON "public"."financial_commitments" USING "btree" ("status");



CREATE INDEX "idx_financial_commitments_type" ON "public"."financial_commitments" USING "btree" ("type");



CREATE INDEX "idx_financial_operation_services_operation_id" ON "public"."financial_operation_services" USING "btree" ("operation_id");



CREATE INDEX "idx_financial_operation_services_status" ON "public"."financial_operation_services" USING "btree" ("status");



CREATE INDEX "idx_financial_operations_quotation_id" ON "public"."financial_operations" USING "btree" ("quotation_id");



CREATE INDEX "idx_financial_operations_status" ON "public"."financial_operations" USING "btree" ("status");



CREATE INDEX "idx_financial_transactions_account_id" ON "public"."financial_transactions" USING "btree" ("account_id");



CREATE INDEX "idx_financial_transactions_commitment_id" ON "public"."financial_transactions" USING "btree" ("commitment_id");



CREATE INDEX "idx_financial_transactions_operation_id" ON "public"."financial_transactions" USING "btree" ("operation_id");



CREATE INDEX "idx_financial_transactions_transacted_at" ON "public"."financial_transactions" USING "btree" ("transacted_at" DESC);



CREATE INDEX "idx_package_website_contents_package_id" ON "public"."package_website_contents" USING "btree" ("package_id");



CREATE INDEX "idx_packages_created_at" ON "public"."packages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_packages_reference" ON "public"."packages" USING "btree" ("reference");



CREATE INDEX "idx_packages_status" ON "public"."packages" USING "btree" ("status");



CREATE INDEX "idx_quotations_archived_at" ON "public"."quotations" USING "btree" ("archived_at");



CREATE INDEX "idx_quotations_created_at" ON "public"."quotations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_quotations_package_id" ON "public"."quotations" USING "btree" ("package_id");



CREATE INDEX "idx_quotations_reference" ON "public"."quotations" USING "btree" ("reference");



CREATE INDEX "idx_quotations_status" ON "public"."quotations" USING "btree" ("status");



CREATE UNIQUE INDEX "uq_packages_reference" ON "public"."packages" USING "btree" ("reference");



CREATE UNIQUE INDEX "uq_quotations_reference" ON "public"."quotations" USING "btree" ("reference");



CREATE OR REPLACE TRIGGER "check_quotation_archive_trigger" BEFORE UPDATE OF "archived_at" ON "public"."quotations" FOR EACH ROW EXECUTE FUNCTION "public"."trg_check_quotation_archive"();



CREATE OR REPLACE TRIGGER "tr_favorite_services_set_updated_at" BEFORE UPDATE ON "public"."favorite_services" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_financial_accounts_set_updated_at" BEFORE UPDATE ON "public"."financial_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_financial_commitments_set_updated_at" BEFORE UPDATE ON "public"."financial_commitments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_financial_operation_services_set_updated_at" BEFORE UPDATE ON "public"."financial_operation_services" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_financial_operations_set_updated_at" BEFORE UPDATE ON "public"."financial_operations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_financial_transactions_set_updated_at" BEFORE UPDATE ON "public"."financial_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_package_website_contents_set_updated_at" BEFORE UPDATE ON "public"."package_website_contents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_packages_set_updated_at" BEFORE UPDATE ON "public"."packages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_quotations_set_updated_at" BEFORE UPDATE ON "public"."quotations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_protect_approved_quotation_status" BEFORE UPDATE ON "public"."quotations" FOR EACH ROW EXECUTE FUNCTION "public"."check_quotation_status_protection"();



ALTER TABLE ONLY "public"."financial_commitments"
    ADD CONSTRAINT "financial_commitments_credit_card_account_id_fkey" FOREIGN KEY ("credit_card_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_commitments"
    ADD CONSTRAINT "financial_commitments_expected_account_id_fkey" FOREIGN KEY ("expected_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_commitments"
    ADD CONSTRAINT "financial_commitments_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "public"."financial_operations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_commitments"
    ADD CONSTRAINT "financial_commitments_operation_service_id_fkey" FOREIGN KEY ("operation_service_id") REFERENCES "public"."financial_operation_services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_commitments"
    ADD CONSTRAINT "financial_commitments_origin_commitment_id_fkey" FOREIGN KEY ("origin_commitment_id") REFERENCES "public"."financial_commitments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_operation_services"
    ADD CONSTRAINT "financial_operation_services_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "public"."financial_operations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_operations"
    ADD CONSTRAINT "financial_operations_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "public"."financial_commitments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_destination_account_id_fkey" FOREIGN KEY ("destination_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."financial_transactions"
    ADD CONSTRAINT "financial_transactions_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "public"."financial_operations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."package_website_contents"
    ADD CONSTRAINT "package_website_contents_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE SET NULL;



CREATE POLICY "Allow anon and authenticated all on favorite_services" ON "public"."favorite_services" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon and authenticated all on financial_accounts" ON "public"."financial_accounts" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon and authenticated all on financial_commitments" ON "public"."financial_commitments" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon and authenticated all on financial_operation_service" ON "public"."financial_operation_services" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon and authenticated all on package_website_contents" ON "public"."package_website_contents" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon and authenticated all on packages" ON "public"."packages" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon and authenticated all on quotations" ON "public"."quotations" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon and authenticated select on financial_operations" ON "public"."financial_operations" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow anon and authenticated select on financial_transactions" ON "public"."financial_transactions" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."favorite_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_commitments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_operation_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_operations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."package_website_contents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotations" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."approve_quotation_and_create_operation"("p_quotation_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_quotation_and_create_operation"("p_quotation_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_quotation_and_create_operation"("p_quotation_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_financial_operation"("p_operation_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_financial_operation"("p_operation_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_financial_operation"("p_operation_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_operation_service"("p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_operation_service"("p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_operation_service"("p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_operation_service_with_adjustments"("p_service_id" "uuid", "p_reason" "text", "p_supplier_refund_amount" numeric, "p_supplier_refund_currency" "text", "p_cancellation_fee_amount" numeric, "p_cancellation_fee_currency" "text", "p_fee_counterparty_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_operation_service_with_adjustments"("p_service_id" "uuid", "p_reason" "text", "p_supplier_refund_amount" numeric, "p_supplier_refund_currency" "text", "p_cancellation_fee_amount" numeric, "p_cancellation_fee_currency" "text", "p_fee_counterparty_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_operation_service_with_adjustments"("p_service_id" "uuid", "p_reason" "text", "p_supplier_refund_amount" numeric, "p_supplier_refund_currency" "text", "p_cancellation_fee_amount" numeric, "p_cancellation_fee_currency" "text", "p_fee_counterparty_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_quotation_status_protection"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_quotation_status_protection"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_quotation_status_protection"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_cancellation_adjustment"("p_operation_id" "uuid", "p_adjustment_type" "text", "p_counterparty_name" "text", "p_amount" numeric, "p_currency" "text", "p_counterparty_type" "text", "p_expected_date" "date", "p_description" "text", "p_notes" "text", "p_operation_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_cancellation_adjustment"("p_operation_id" "uuid", "p_adjustment_type" "text", "p_counterparty_name" "text", "p_amount" numeric, "p_currency" "text", "p_counterparty_type" "text", "p_expected_date" "date", "p_description" "text", "p_notes" "text", "p_operation_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_cancellation_adjustment"("p_operation_id" "uuid", "p_adjustment_type" "text", "p_counterparty_name" "text", "p_amount" numeric, "p_currency" "text", "p_counterparty_type" "text", "p_expected_date" "date", "p_description" "text", "p_notes" "text", "p_operation_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_financial_account_balances"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_financial_account_balances"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_financial_account_balances"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_financial_consolidated_summary"("p_reference_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_financial_consolidated_summary"("p_reference_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_financial_consolidated_summary"("p_reference_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_financial_commitments"("p_start_date" "date", "p_end_date" "date", "p_currency" "text", "p_type" "text", "p_account_id" "uuid", "p_is_overdue" boolean, "p_reference_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_financial_commitments"("p_start_date" "date", "p_end_date" "date", "p_currency" "text", "p_type" "text", "p_account_id" "uuid", "p_is_overdue" boolean, "p_reference_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_financial_commitments"("p_start_date" "date", "p_end_date" "date", "p_currency" "text", "p_type" "text", "p_account_id" "uuid", "p_is_overdue" boolean, "p_reference_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_period_cash_flow_forecast"("p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_period_cash_flow_forecast"("p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_period_cash_flow_forecast"("p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_account_transfer"("p_source_account_id" "uuid", "p_destination_account_id" "uuid", "p_amount" numeric, "p_destination_amount" numeric, "p_exchange_rate" numeric, "p_transfer_fee" numeric, "p_transfer_fee_currency" "text", "p_transacted_at" timestamp with time zone, "p_reference" "text", "p_description" "text", "p_operation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."record_account_transfer"("p_source_account_id" "uuid", "p_destination_account_id" "uuid", "p_amount" numeric, "p_destination_amount" numeric, "p_exchange_rate" numeric, "p_transfer_fee" numeric, "p_transfer_fee_currency" "text", "p_transacted_at" timestamp with time zone, "p_reference" "text", "p_description" "text", "p_operation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_account_transfer"("p_source_account_id" "uuid", "p_destination_account_id" "uuid", "p_amount" numeric, "p_destination_amount" numeric, "p_exchange_rate" numeric, "p_transfer_fee" numeric, "p_transfer_fee_currency" "text", "p_transacted_at" timestamp with time zone, "p_reference" "text", "p_description" "text", "p_operation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_balance_adjustment"("p_account_id" "uuid", "p_amount" numeric, "p_direction" "text", "p_reason" "text", "p_adjusted_at" timestamp with time zone, "p_reference" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_balance_adjustment"("p_account_id" "uuid", "p_amount" numeric, "p_direction" "text", "p_reason" "text", "p_adjusted_at" timestamp with time zone, "p_reference" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_balance_adjustment"("p_account_id" "uuid", "p_amount" numeric, "p_direction" "text", "p_reason" "text", "p_adjusted_at" timestamp with time zone, "p_reference" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_commitment_settlement"("p_commitment_id" "uuid", "p_account_id" "uuid", "p_amount" numeric, "p_transacted_at" timestamp with time zone, "p_reference" "text", "p_description" "text", "p_invoice_due_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."record_commitment_settlement"("p_commitment_id" "uuid", "p_account_id" "uuid", "p_amount" numeric, "p_transacted_at" timestamp with time zone, "p_reference" "text", "p_description" "text", "p_invoice_due_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_commitment_settlement"("p_commitment_id" "uuid", "p_account_id" "uuid", "p_amount" numeric, "p_transacted_at" timestamp with time zone, "p_reference" "text", "p_description" "text", "p_invoice_due_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."split_financial_commitment"("p_commitment_id" "uuid", "p_first_amount" numeric, "p_second_expected_date" "date", "p_first_description" "text", "p_second_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."split_financial_commitment"("p_commitment_id" "uuid", "p_first_amount" numeric, "p_second_expected_date" "date", "p_first_description" "text", "p_second_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."split_financial_commitment"("p_commitment_id" "uuid", "p_first_amount" numeric, "p_second_expected_date" "date", "p_first_description" "text", "p_second_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."split_financial_commitment"("p_commitment_id" "uuid", "p_first_amount" numeric, "p_second_expected_date" "date", "p_first_description" "text", "p_second_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_check_quotation_archive"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_check_quotation_archive"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_check_quotation_archive"() TO "service_role";


















GRANT ALL ON TABLE "public"."favorite_services" TO "anon";
GRANT ALL ON TABLE "public"."favorite_services" TO "authenticated";
GRANT ALL ON TABLE "public"."favorite_services" TO "service_role";



GRANT ALL ON TABLE "public"."financial_accounts" TO "anon";
GRANT ALL ON TABLE "public"."financial_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."financial_commitments" TO "anon";
GRANT ALL ON TABLE "public"."financial_commitments" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_commitments" TO "service_role";



GRANT ALL ON TABLE "public"."financial_operation_services" TO "anon";
GRANT ALL ON TABLE "public"."financial_operation_services" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_operation_services" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."financial_operations" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."financial_operations" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_operations" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."financial_transactions" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."financial_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."package_website_contents" TO "anon";
GRANT ALL ON TABLE "public"."package_website_contents" TO "authenticated";
GRANT ALL ON TABLE "public"."package_website_contents" TO "service_role";



GRANT ALL ON TABLE "public"."packages" TO "anon";
GRANT ALL ON TABLE "public"."packages" TO "authenticated";
GRANT ALL ON TABLE "public"."packages" TO "service_role";



GRANT ALL ON TABLE "public"."quotations" TO "anon";
GRANT ALL ON TABLE "public"."quotations" TO "authenticated";
GRANT ALL ON TABLE "public"."quotations" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































