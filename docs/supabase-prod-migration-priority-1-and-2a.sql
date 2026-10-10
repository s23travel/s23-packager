-- ==============================================================================
-- S23 PACKAGER - MIGRAÇÃO CONSOLIDADA SUPABASE PROD (PRIORIDADE 1 E FASE 2A)
-- ==============================================================================
-- Data de Preparação: 09/10/2026
-- Ambiente Alvo: Supabase PROD (iqtfqitquykasvfybndl)
--
-- ESCOPO DA MIGRAÇÃO:
-- 1. Prioridade 1 (Migração 20261010010000):
--    - Criação da função RPC atômica `public.split_financial_commitment` com SECURITY DEFINER.
--    - Locks FOR UPDATE ordenados (operação pai primeiro, compromisso em seguida).
--    - Revalidação estrita de status ('planned') e ausência de movimentações vinculadas.
--    - Conservação determinística de cêntimos inteiros (CEIL na 1ª parcela se ímpar).
--    - Permissões explícitas de EXECUTE para anon e authenticated.
--
-- 2. Prioridade 2 - Fase 2A (Migração 20261010020000):
--    - Endurecimento do livro-razão financeiro (`financial_transactions`) e operações (`financial_operations`).
--    - Remoção das políticas RLS permissivas FOR ALL ("Allow anon and authenticated all on...").
--    - Definição de políticas RLS estritas FOR SELECT para anon e authenticated.
--    - Revogação de privilégios de escrita direta (INSERT, UPDATE, DELETE, TRUNCATE) para anon e authenticated.
--    - Preservação explícita de SELECT para anon e authenticated.
--    - Manutenção de GRANT ALL para service_role.
--    - Preservação das mutações legítimas via RPCs SECURITY DEFINER existentes.
--
-- NOTAS CRÍTICAS DE SEGURANÇA E OPERAÇÃO EM PROD:
-- 1. MOTIVO DO SCRIPT CONSOLIDADO EM VEZ DE "supabase db push":
--    - As migrações anteriores das Fases 1 a 3 (07 a 21) foram aplicadas em PROD via script consolidado
--      (docs/supabase-prod-migration-phases-1-3.sql) sem reconciliar a tabela supabase_migrations.schema_migrations.
--    - O uso de "supabase db push" em PROD permanece TERMINANTEMENTE PROIBIDO, pois tentaria reexecutar
--      as migrações históricas anteriores, corrompendo a base de dados.
--    - Este script atômico aplica estritamente as alterações validadas sem alterar schema_migrations.
-- 2. TRANSAÇÃO ATÔMICA E LIMITAÇÕES DE ROLLBACK:
--    - Todo o script é executado dentro de um único bloco BEGIN ... COMMIT.
--    - Se qualquer erro ocorrer durante a execução ou nas verificações de pós-condição, o PostgreSQL
--      efetua rollback automático completo da transação, deixando PROD no estado original.
--    - Caso o COMMIT seja concluído com sucesso e seja necessária uma reversão posterior, deve ser
--      utilizado o script de reversão manual documentado no final deste ficheiro.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. VERIFICAÇÃO DE PRÉ-CONDIÇÕES (PRE-CHECKS)
-- ==============================================================================
DO $$
BEGIN
  -- 1.1 Verificar existência das tabelas base em PROD
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_operations') THEN
    RAISE EXCEPTION '[PRE-CHECK FALHOU] Tabela public.financial_operations não encontrada em PROD.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_commitments') THEN
    RAISE EXCEPTION '[PRE-CHECK FALHOU] Tabela public.financial_commitments não encontrada em PROD.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_transactions') THEN
    RAISE EXCEPTION '[PRE-CHECK FALHOU] Tabela public.financial_transactions não encontrada em PROD.';
  END IF;

  -- 1.2 Verificar colunas essenciais criadas nas fases anteriores
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_commitments' AND column_name = 'is_credit_card_invoice') THEN
    RAISE EXCEPTION '[PRE-CHECK FALHOU] Coluna is_credit_card_invoice ausente em public.financial_commitments.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_commitments' AND column_name = 'is_cancellation_adjustment') THEN
    RAISE EXCEPTION '[PRE-CHECK FALHOU] Coluna is_cancellation_adjustment ausente em public.financial_commitments.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_commitments' AND column_name = 'payment_method') THEN
    RAISE EXCEPTION '[PRE-CHECK FALHOU] Coluna payment_method ausente em public.financial_commitments.';
  END IF;

  RAISE NOTICE '>>> [PRE-CHECK APROVADO] Todas as tabelas e colunas necessárias foram confirmadas em PROD.';
END $$;


-- ==============================================================================
-- 2. BLOCO PRIORIDADE 1: RPC split_financial_commitment
-- Fonte: supabase/migrations/20261010010000_atomic_split_financial_commitment.sql
-- ==============================================================================

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

-- Permissões explícitas para os papéis de aplicação Supabase
GRANT EXECUTE ON FUNCTION public.split_financial_commitment(UUID, NUMERIC, DATE, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.split_financial_commitment IS 'Divide atomicamente um compromisso financeiro em status planned em duas parcelas sem perda de cêntimos.';


-- ==============================================================================
-- 3. BLOCO PRIORIDADE 2 - FASE 2A: ENDURECIMENTO RLS E PRIVILÉGIOS DE ESCRITA
-- Fonte: supabase/migrations/20261010020000_harden_financial_transactions_and_operations.sql
-- ==============================================================================

-- 3.1 Tabela: public.financial_operations
DROP POLICY IF EXISTS "Allow anon and authenticated all on financial_operations" ON public.financial_operations;
DROP POLICY IF EXISTS "Allow anon and authenticated select on financial_operations" ON public.financial_operations;

ALTER TABLE public.financial_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon and authenticated select on financial_operations"
ON public.financial_operations
FOR SELECT
TO anon, authenticated
USING (true);

-- 3.2 Tabela: public.financial_transactions
DROP POLICY IF EXISTS "Allow anon and authenticated all on financial_transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "Allow anon and authenticated select on financial_transactions" ON public.financial_transactions;

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon and authenticated select on financial_transactions"
ON public.financial_transactions
FOR SELECT
TO anon, authenticated
USING (true);

-- 3.3 Revogação de escrita direta para roles públicas
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.financial_operations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.financial_transactions FROM anon, authenticated;

-- 3.4 Concessão explícita de leitura para roles públicas
GRANT SELECT ON TABLE public.financial_operations TO anon, authenticated;
GRANT SELECT ON TABLE public.financial_transactions TO anon, authenticated;

-- 3.5 Manutenção explícita de acesso irrestrito para service_role
GRANT ALL ON TABLE public.financial_operations TO service_role;
GRANT ALL ON TABLE public.financial_transactions TO service_role;

COMMENT ON TABLE public.financial_operations IS 'Operações financeiras vinculadas a cotações aprovadas. Escrita direta desativada para anon/authenticated (acesso exclusivo via RPCs SECURITY DEFINER).';
COMMENT ON TABLE public.financial_transactions IS 'Livro-razão financeiro (movimentações reais). Imutável e protegido contra escrita direta de anon/authenticated (apenas via RPCs SECURITY DEFINER).';


-- ==============================================================================
-- 4. VERIFICAÇÃO DE PÓS-CONDIÇÕES (POST-CHECKS)
-- ==============================================================================
DO $$
DECLARE
  v_rpc_secdef BOOLEAN;
  v_op_policy_cmd TEXT;
  v_tx_policy_cmd TEXT;
  v_has_tx_write_priv INT;
  v_has_op_write_priv INT;
BEGIN
  -- 4.1 Verificar se split_financial_commitment existe e é SECURITY DEFINER
  SELECT prosecdef INTO v_rpc_secdef
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'split_financial_commitment';

  IF v_rpc_secdef IS NULL THEN
    RAISE EXCEPTION '[POST-CHECK FALHOU] Função public.split_financial_commitment não foi criada.';
  END IF;

  IF v_rpc_secdef IS NOT TRUE THEN
    RAISE EXCEPTION '[POST-CHECK FALHOU] Função public.split_financial_commitment não foi configurada como SECURITY DEFINER.';
  END IF;

  -- 4.2 Verificar se as políticas RLS estão ativas e restritas a SELECT
  SELECT cmd INTO v_op_policy_cmd
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'financial_operations' AND policyname = 'Allow anon and authenticated select on financial_operations';

  IF v_op_policy_cmd <> 'SELECT' THEN
    RAISE EXCEPTION '[POST-CHECK FALHOU] Política select em financial_operations não está configurada para SELECT (encontrado: %).', v_op_policy_cmd;
  END IF;

  SELECT cmd INTO v_tx_policy_cmd
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'financial_transactions' AND policyname = 'Allow anon and authenticated select on financial_transactions';

  IF v_tx_policy_cmd <> 'SELECT' THEN
    RAISE EXCEPTION '[POST-CHECK FALHOU] Política select em financial_transactions não está configurada para SELECT (encontrado: %).', v_tx_policy_cmd;
  END IF;

  -- 4.3 Verificar se as antigas políticas permissivas FOR ALL foram eliminadas
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('financial_operations', 'financial_transactions')
      AND policyname LIKE '%all%'
  ) THEN
    RAISE EXCEPTION '[POST-CHECK FALHOU] Políticas permissivas FOR ALL ainda estão presentes em PROD.';
  END IF;

  -- 4.4 Verificar que privilégios de escrita foram efetivamente revogados de anon
  SELECT count(*) INTO v_has_tx_write_priv
  FROM information_schema.table_privileges
  WHERE table_schema = 'public' AND table_name = 'financial_transactions'
    AND grantee = 'anon' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

  IF v_has_tx_write_priv > 0 THEN
    RAISE EXCEPTION '[POST-CHECK FALHOU] Papel anon ainda possui privilégios de escrita em financial_transactions.';
  END IF;

  SELECT count(*) INTO v_has_op_write_priv
  FROM information_schema.table_privileges
  WHERE table_schema = 'public' AND table_name = 'financial_operations'
    AND grantee = 'anon' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

  IF v_has_op_write_priv > 0 THEN
    RAISE EXCEPTION '[POST-CHECK FALHOU] Papel anon ainda possui privilégios de escrita em financial_operations.';
  END IF;

  RAISE NOTICE '>>> [POST-CHECK APROVADO] RPC split_financial_commitment e endurecimento de livro-razão verificados com sucesso em PROD.';
END $$;

COMMIT;

-- ==============================================================================
-- INSTRUÇÕES DE REVERSÃO MANUAL (ROLLBACK EMERGENCIAL)
-- Executar apenas se for necessária a reversão deliberada após o COMMIT com sucesso:
-- ==============================================================================
-- BEGIN;
-- -- 1. Reverter Fase 2A: Restaurar permissões e RLS permissivas
-- DROP POLICY IF EXISTS "Allow anon and authenticated select on financial_operations" ON public.financial_operations;
-- DROP POLICY IF EXISTS "Allow anon and authenticated select on financial_transactions" ON public.financial_transactions;
--
-- CREATE POLICY "Allow anon and authenticated all on financial_operations"
--   ON public.financial_operations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow anon and authenticated all on financial_transactions"
--   ON public.financial_transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
--
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.financial_operations TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.financial_transactions TO anon, authenticated;
--
-- -- 2. Reverter Prioridade 1: Remover RPC split_financial_commitment
-- DROP FUNCTION IF EXISTS public.split_financial_commitment(UUID, NUMERIC, DATE, TEXT, TEXT);
-- COMMIT;
-- ==============================================================================
