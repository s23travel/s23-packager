-- Migration: 20260930220000_enhance_financial_foundation.sql
-- Descrição: Reforço aditivo da fundação financeira:
-- 1. Saldo de abertura e data de referência em contas financeiras
-- 2. Suporte a transferências cambiais (EUR <-> BRL, câmbio e taxa de remessa)
-- 3. Expansão dos estados dos serviços: planned, reserved, contracted, completed, cancelled
-- 4. Função atômica approve_quotation_and_create_operation para aprovação e inicialização financeira

-- 1. Contas Financeiras: Saldo de abertura e data de referência
ALTER TABLE financial_accounts
  ADD COLUMN IF NOT EXISTS initial_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS initial_balance_date DATE NOT NULL DEFAULT CURRENT_DATE;

COMMENT ON COLUMN financial_accounts.initial_balance IS 'Saldo de abertura/inicial da conta para projeção financeira';
COMMENT ON COLUMN financial_accounts.initial_balance_date IS 'Data de referência do saldo inicial da conta';

-- 2. Transações: Suporte a transferências multimoeda (EUR <-> BRL) e taxas
ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS destination_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS destination_currency TEXT CHECK (destination_currency IN ('EUR', 'BRL')),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12, 6),
  ADD COLUMN IF NOT EXISTS transfer_fee NUMERIC(12, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS transfer_fee_currency TEXT CHECK (transfer_fee_currency IN ('EUR', 'BRL'));

COMMENT ON COLUMN financial_transactions.destination_amount IS 'Valor que entra na conta destino em caso de transferência';
COMMENT ON COLUMN financial_transactions.destination_currency IS 'Moeda de destino da transferência (EUR ou BRL)';
COMMENT ON COLUMN financial_transactions.exchange_rate IS 'Taxa de câmbio aplicada na conversão da transferência';
COMMENT ON COLUMN financial_transactions.transfer_fee IS 'Custo ou taxa de remessa/bancária cobrada na transferência';

-- 3. Serviços da Operação: Expansão dos estados internos
ALTER TABLE financial_operation_services DROP CONSTRAINT IF EXISTS financial_operation_services_status_check;

ALTER TABLE financial_operation_services
  ADD CONSTRAINT financial_operation_services_status_check
  CHECK (status IN ('planned', 'reserved', 'contracted', 'completed', 'cancelled'));

ALTER TABLE financial_operation_services ALTER COLUMN status SET DEFAULT 'planned';

-- Atualizar serviços existentes com status 'active' para 'planned' (se houver)
UPDATE financial_operation_services SET status = 'planned' WHERE status = 'active';

-- 4. Operação Atômica: approve_quotation_and_create_operation
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
  v_service_cost NUMERIC(12, 2);
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
      v_service_cost := COALESCE((v_service->>'amount')::NUMERIC, 0);

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
        v_quote.currency,
        'planned',
        v_service->>'notes'
      )
      RETURNING id INTO v_op_service_id;

      v_services_count := v_services_count + 1;

      -- Se tiver custo previsto > 0, cria o compromisso a pagar ao fornecedor
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
          v_quote.currency,
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

COMMENT ON FUNCTION approve_quotation_and_create_operation IS 'Aprova atomicamente uma cotação e inicializa sua operação financeira com serviços e previsões';
