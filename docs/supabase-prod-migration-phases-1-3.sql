-- ==============================================================================
-- S23 PACKAGER - MIGRAÇÃO CONSOLIDADA SUPABASE PROD (FASES 1, 2 E 3)
-- ==============================================================================
-- Data de Preparação: 09/10/2026
-- Ambiente Alvo: Supabase PROD (iqtfqitquykasvfybndl)
--
-- NOTAS CRÍTICAS DE SEGURANÇA E OPERAÇÃO:
-- 1. Este ficheiro contém estritamente as Fases 1 (DDL), 2 (Triggers/RPCs) e 3 (RLS/Grants).
-- 2. Preserva integralmente os dados existentes em PROD:
--    - packages (16 registos)
--    - quotations (34 registos: 32 sent, 1 draft, 1 accepted)
--    - favorite_services (1 registo)
--    - package_website_contents (1 registo)
-- 3. Cada fase é delimitada por bloco atômico próprio (BEGIN ... COMMIT).
-- 4. Fase 4 (Reconciliação de Histórico) foi deliberadamente SUSPENSA:
--    - Nenhuma alteração é feita em supabase_migrations.schema_migrations.
--    - O uso de "supabase db push" em PROD permanece proibido até ao baseline unificado.
-- 5. RLS Permissiva: As políticas de RLS para anon/authenticated são uma dívida técnica
--    temporária formalmente aceite pelo projeto para esta fase operacional sem login.
-- ==============================================================================


-- ==============================================================================
-- FASE 1: DDL ESTRUTURAL, ÍNDICES E COLUNAS ADITIVAS
-- Origem: Migrações 07, 08, 11, 14, 15, 17, 19, 20, 21
-- ==============================================================================
BEGIN;

-- 1. Coluna archived_at na tabela quotations (Origem: Migração 19 - 20261001090000)
ALTER TABLE public.quotations 
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_archived_at 
  ON public.quotations(archived_at);

COMMENT ON COLUMN public.quotations.archived_at IS 'Data/hora de arquivamento da cotação. Cotações arquivadas não aparecem nas listagens normais.';

-- 2. Tabela financial_accounts (Origem: Migrações 07 - 20260930210000 e 08 - 20260930220000)
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  type TEXT NOT NULL CHECK (type IN ('bank_account', 'cash', 'credit_card', 'other')),
  currency TEXT NOT NULL CHECK (currency IN ('EUR', 'BRL')),
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  initial_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  initial_balance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_active ON public.financial_accounts(active);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_currency ON public.financial_accounts(currency);

DROP TRIGGER IF EXISTS tr_financial_accounts_set_updated_at ON public.financial_accounts;
CREATE TRIGGER tr_financial_accounts_set_updated_at
  BEFORE UPDATE ON public.financial_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.financial_accounts IS 'Contas financeiras da S23 (ex.: Caixa Portugal em EUR, Caixa Brasil em BRL, cartões)';
COMMENT ON COLUMN public.financial_accounts.initial_balance IS 'Saldo de abertura/inicial da conta para projeção financeira';
COMMENT ON COLUMN public.financial_accounts.initial_balance_date IS 'Data de referência do saldo inicial da conta';

-- 3. Tabela financial_operations (Origem: Migrações 07 - 20260930210000 e 15 - 20261001060000)
CREATE TABLE IF NOT EXISTS public.financial_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_financial_operations_quotation_id UNIQUE (quotation_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_operations_quotation_id ON public.financial_operations(quotation_id);
CREATE INDEX IF NOT EXISTS idx_financial_operations_status ON public.financial_operations(status);

DROP TRIGGER IF EXISTS tr_financial_operations_set_updated_at ON public.financial_operations;
CREATE TRIGGER tr_financial_operations_set_updated_at
  BEFORE UPDATE ON public.financial_operations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.financial_operations IS 'Operação financeira atrelada exclusivamente a uma única cotação aprovada';

-- 4. Tabela financial_operation_services (Origem: Migrações 07 - 20260930210000 e 08 - 20260930220000)
CREATE TABLE IF NOT EXISTS public.financial_operation_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES public.financial_operations(id) ON DELETE CASCADE,
  original_service_id TEXT,
  type TEXT NOT NULL,
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  supplier_name TEXT,
  cost_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost_amount >= 0),
  cost_currency TEXT NOT NULL DEFAULT 'EUR' CHECK (cost_currency IN ('EUR', 'BRL')),
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_operation_services 
  DROP CONSTRAINT IF EXISTS financial_operation_services_status_check;
ALTER TABLE public.financial_operation_services 
  ADD CONSTRAINT financial_operation_services_status_check 
  CHECK (status IN ('planned', 'reserved', 'contracted', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_financial_operation_services_operation_id ON public.financial_operation_services(operation_id);
CREATE INDEX IF NOT EXISTS idx_financial_operation_services_status ON public.financial_operation_services(status);

DROP TRIGGER IF EXISTS tr_financial_operation_services_set_updated_at ON public.financial_operation_services;
CREATE TRIGGER tr_financial_operation_services_set_updated_at
  BEFORE UPDATE ON public.financial_operation_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.financial_operation_services IS 'Serviços independentes de uma operação financeira para controle de fornecimento e execução';

-- 5. Tabela financial_commitments (Origem: Migrações 07, 11, 14 e 15)
CREATE TABLE IF NOT EXISTS public.financial_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES public.financial_operations(id) ON DELETE CASCADE,
  operation_service_id UUID REFERENCES public.financial_operation_services(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
  counterparty_name TEXT NOT NULL CHECK (length(trim(counterparty_name)) > 0),
  counterparty_type TEXT NOT NULL DEFAULT 'client' CHECK (counterparty_type IN ('client', 'supplier', 'other')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'BRL')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'partially_settled', 'settled', 'cancelled')),
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('transfer', 'card', 'payment_link', 'cash', 'other')),
  expected_date DATE,
  expected_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  description TEXT,
  notes TEXT,
  is_credit_card_invoice BOOLEAN NOT NULL DEFAULT false,
  origin_commitment_id UUID REFERENCES public.financial_commitments(id) ON DELETE SET NULL,
  credit_card_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  is_cancellation_adjustment BOOLEAN NOT NULL DEFAULT false,
  adjustment_type TEXT CHECK (adjustment_type IS NULL OR adjustment_type IN ('client_refund', 'supplier_refund', 'cancellation_fee')),
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_commitments_operation_id ON public.financial_commitments(operation_id);
CREATE INDEX IF NOT EXISTS idx_financial_commitments_status ON public.financial_commitments(status);
CREATE INDEX IF NOT EXISTS idx_financial_commitments_type ON public.financial_commitments(type);
CREATE INDEX IF NOT EXISTS idx_financial_commitments_expected_date ON public.financial_commitments(expected_date);
CREATE INDEX IF NOT EXISTS idx_financial_commitments_is_credit_card_invoice ON public.financial_commitments(is_credit_card_invoice);
CREATE INDEX IF NOT EXISTS idx_financial_commitments_origin_commitment_id ON public.financial_commitments(origin_commitment_id);
CREATE INDEX IF NOT EXISTS idx_financial_commitments_is_adjustment ON public.financial_commitments(is_cancellation_adjustment) WHERE is_cancellation_adjustment = true;
CREATE INDEX IF NOT EXISTS idx_financial_commitments_adjustment_type ON public.financial_commitments(adjustment_type) WHERE adjustment_type IS NOT NULL;

DROP TRIGGER IF EXISTS tr_financial_commitments_set_updated_at ON public.financial_commitments;
CREATE TRIGGER tr_financial_commitments_set_updated_at
  BEFORE UPDATE ON public.financial_commitments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.financial_commitments IS 'Compromissos previstos a receber (cliente) ou a pagar (fornecedor)';
COMMENT ON COLUMN public.financial_commitments.payment_method IS 'Método previsto de pagamento: transfer, card, payment_link, cash, other';
COMMENT ON COLUMN public.financial_commitments.is_credit_card_invoice IS 'Indica se a parcela prevista é uma fatura de cartão de crédito originada por pagamento a fornecedor';

-- 6. Tabela financial_transactions (Origem: Migrações 07, 08, 20 e 21)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('inflow', 'outflow', 'transfer', 'refund', 'balance_adjustment')),
  account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  destination_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  operation_id UUID REFERENCES public.financial_operations(id) ON DELETE SET NULL,
  commitment_id UUID REFERENCES public.financial_commitments(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'BRL')),
  destination_amount NUMERIC(12, 2),
  destination_currency TEXT CHECK (destination_currency IS NULL OR destination_currency IN ('EUR', 'BRL')),
  exchange_rate NUMERIC(12, 6),
  transfer_fee NUMERIC(12, 2) DEFAULT 0.00,
  transfer_fee_currency TEXT CHECK (transfer_fee_currency IS NULL OR transfer_fee_currency IN ('EUR', 'BRL')),
  transacted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  counterparty_name TEXT,
  description TEXT,
  reference TEXT,
  adjustment_direction TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_transactions 
  DROP CONSTRAINT IF EXISTS financial_transactions_adjustment_direction_check;
ALTER TABLE public.financial_transactions 
  ADD CONSTRAINT financial_transactions_adjustment_direction_check 
  CHECK (
    (type = 'balance_adjustment' AND adjustment_direction IN ('positive', 'negative'))
    OR
    (type != 'balance_adjustment' AND adjustment_direction IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_financial_transactions_account_id ON public.financial_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_operation_id ON public.financial_transactions(operation_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_commitment_id ON public.financial_transactions(commitment_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_transacted_at ON public.financial_transactions(transacted_at DESC);

DROP TRIGGER IF EXISTS tr_financial_transactions_set_updated_at ON public.financial_transactions;
CREATE TRIGGER tr_financial_transactions_set_updated_at
  BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.financial_transactions IS 'Movimentações reais de caixa registradas (recebimentos, pagamentos, reembolsos, transferências e ajustes)';
COMMENT ON COLUMN public.financial_transactions.adjustment_direction IS 'Direção estruturada para balance_adjustment: positive (aumenta saldo) ou negative (reduz saldo). Deve ser NULL para outros tipos.';

COMMIT;


-- ==============================================================================
-- FASE 2: TRIGGERS DE INTEGRIDADE DE COTAÇÕES E AS 12 RPCS FINANCEIRAS
-- Origem: Migrações 09, 10, 12, 14, 15, 16, 18, 19, 21
-- ==============================================================================
BEGIN;

-- 1. Trigger de proteção da cotação aprovada com operação financeira vinculada
-- Origem: Migração 10 (20261001010000_protect_approved_quotation_status.sql)
CREATE OR REPLACE FUNCTION public.check_quotation_status_protection()
RETURNS TRIGGER 
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_protect_approved_quotation_status ON public.quotations;
CREATE TRIGGER trg_protect_approved_quotation_status
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_quotation_status_protection();

-- 2. Trigger de proteção contra arquivamento de cotações com operação financeira ativa
-- Origem: Migração 19 (20261001090000_add_archived_at_to_quotations.sql)
CREATE OR REPLACE FUNCTION public.trg_check_quotation_archive()
RETURNS TRIGGER 
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS check_quotation_archive_trigger ON public.quotations;
CREATE TRIGGER check_quotation_archive_trigger
  BEFORE UPDATE OF archived_at ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_check_quotation_archive();

-- 3. RPC: approve_quotation_and_create_operation
-- Origem: Migração 09 (20260930230000_fix_service_cost_and_currency_derivation.sql)
CREATE OR REPLACE FUNCTION public.approve_quotation_and_create_operation(
  p_quotation_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 4. RPC: cancel_operation_service
-- Origem: Migração 12 (20261001030000_atomic_cancel_operation_service.sql)
CREATE OR REPLACE FUNCTION public.cancel_operation_service(p_service_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 5. RPC: record_commitment_settlement (7 parâmetros)
-- Origem: Migração 14 (20261001050000_phase2b_credit_card_and_transfers.sql)
DROP FUNCTION IF EXISTS public.record_commitment_settlement(UUID, UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.record_commitment_settlement(
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
SET search_path = public
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

-- 6. RPC: record_account_transfer
-- Origem: Migração 14 (20261001050000_phase2b_credit_card_and_transfers.sql)
CREATE OR REPLACE FUNCTION public.record_account_transfer(
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
SET search_path = public
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

-- 7. RPC: cancel_financial_operation
-- Origem: Migração 15 (20261001060000_phase2c_cancellations_refunds_and_fees.sql)
CREATE OR REPLACE FUNCTION public.cancel_financial_operation(
  p_operation_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 8. RPC: cancel_operation_service_with_adjustments
-- Origem: Migração 15 (20261001060000_phase2c_cancellations_refunds_and_fees.sql)
CREATE OR REPLACE FUNCTION public.cancel_operation_service_with_adjustments(
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
SET search_path = public
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

-- 9. RPC: create_cancellation_adjustment
-- Origem: Migração 16 (20261001070000_restrict_cancellation_adjustments_context.sql)
CREATE OR REPLACE FUNCTION public.create_cancellation_adjustment(
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
SET search_path = public
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

-- 10. RPC: record_balance_adjustment
-- Origem: Migração 21 (20261001110000_add_structured_adjustment_direction.sql)
CREATE OR REPLACE FUNCTION public.record_balance_adjustment(
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
SET search_path = public
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

-- 11. RPC: get_financial_account_balances
-- Origem: Migração 21 (20261001110000_add_structured_adjustment_direction.sql)
CREATE OR REPLACE FUNCTION public.get_financial_account_balances()
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
SET search_path = public
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

-- 12. RPC: get_financial_consolidated_summary
-- Origem: Migração 18 (20261001081000_refine_financial_projections_guards.sql)
CREATE OR REPLACE FUNCTION public.get_financial_consolidated_summary(p_reference_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 13. RPC: get_period_cash_flow_forecast
-- Origem: Migração 18 (20261001081000_refine_financial_projections_guards.sql)
CREATE OR REPLACE FUNCTION public.get_period_cash_flow_forecast(
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
SET search_path = public
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

-- 14. RPC: get_pending_financial_commitments
-- Origem: Migração 18 (20261001081000_refine_financial_projections_guards.sql)
CREATE OR REPLACE FUNCTION public.get_pending_financial_commitments(
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
SET search_path = public
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

COMMIT;


-- ==============================================================================
-- FASE 3: RLS E GRANTS ESTRITAMENTE PONTUAIS
-- Origem: Migrações 07, 09, 12, 14, 15, 16, 18, 21
-- ==============================================================================
BEGIN;

-- 1. Habilitar RLS nas 5 tabelas financeiras
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_operation_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- 2. Políticas de acesso para anon e authenticated (modo sem autenticação)
DROP POLICY IF EXISTS "Allow anon and authenticated all on financial_accounts" ON public.financial_accounts;
CREATE POLICY "Allow anon and authenticated all on financial_accounts"
  ON public.financial_accounts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and authenticated all on financial_operations" ON public.financial_operations;
CREATE POLICY "Allow anon and authenticated all on financial_operations"
  ON public.financial_operations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and authenticated all on financial_operation_services" ON public.financial_operation_services;
CREATE POLICY "Allow anon and authenticated all on financial_operation_services"
  ON public.financial_operation_services FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and authenticated all on financial_commitments" ON public.financial_commitments;
CREATE POLICY "Allow anon and authenticated all on financial_commitments"
  ON public.financial_commitments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and authenticated all on financial_transactions" ON public.financial_transactions;
CREATE POLICY "Allow anon and authenticated all on financial_transactions"
  ON public.financial_transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. Grants de tabelas estritamente direcionados
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.financial_accounts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.financial_operations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.financial_operation_services TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.financial_commitments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.financial_transactions TO anon, authenticated;

-- 4. Grants explícitos apenas nas 12 RPCs da aplicação
GRANT EXECUTE ON FUNCTION public.approve_quotation_and_create_operation(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_operation_service(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_commitment_settlement(UUID, UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_account_transfer(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, TEXT, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_financial_operation(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_operation_service_with_adjustments(UUID, TEXT, NUMERIC, TEXT, NUMERIC, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_cancellation_adjustment(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, DATE, TEXT, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_balance_adjustment(UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_account_balances() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_consolidated_summary(DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_period_cash_flow_forecast(DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_financial_commitments(DATE, DATE, TEXT, TEXT, UUID, BOOLEAN, DATE) TO anon, authenticated;

COMMIT;

