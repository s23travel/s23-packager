-- Restringe os objetos existentes do Packager sem alterar as regras financeiras.
-- Aplicar somente após validar em DEV e auditar integrações que usam anon.
-- O cadastro público também deve ser desabilitado na configuração remota do Auth.

DO $migration$
DECLARE
  table_name text;
  policy_name text;
  rpc regprocedure;
  rpc_name text;
  source_body text;
  function_definition text;
  begin_line text;
  guarded_body text;
  guard text := $guard$
  -- Bloqueia até contas anônimas do Auth, que usam o papel authenticated.
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR (auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'false') THEN
    RAISE EXCEPTION 'Autenticação de usuário necessária.' USING ERRCODE = '42501';
  END IF;
$guard$;
BEGIN
  -- Abortamos se o estado tiver mudado: não apagar políticas inesperadas.
  FOR table_name, policy_name IN
    SELECT * FROM (VALUES
      ('packages', 'Allow anon and authenticated all on packages'),
      ('quotations', 'Allow anon and authenticated all on quotations'),
      ('favorite_services', 'Allow anon and authenticated all on favorite_services'),
      ('package_website_contents', 'Allow anon and authenticated all on package_website_contents'),
      ('financial_accounts', 'Allow anon and authenticated all on financial_accounts'),
      ('financial_operation_services', 'Allow anon and authenticated all on financial_operation_service'),
      ('financial_commitments', 'Allow anon and authenticated all on financial_commitments'),
      ('financial_operations', 'Allow anon and authenticated select on financial_operations'),
      ('financial_transactions', 'Allow anon and authenticated select on financial_transactions')
    ) AS expected(table_name, policy_name)
  LOOP
    IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name) <> 1
       OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name) THEN
      RAISE EXCEPTION 'Políticas inesperadas em public.%: revisar antes de aplicar.', table_name;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY %I ON public.%I', policy_name, table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    IF table_name IN ('financial_operations', 'financial_transactions') THEN
      EXECUTE format('CREATE POLICY packager_authenticated_select ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.jwt() ->> ''is_anonymous'') = ''false'')', table_name);
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', table_name);
    ELSE
      EXECUTE format('CREATE POLICY packager_authenticated_all ON public.%I FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.jwt() ->> ''is_anonymous'') = ''false'') WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.jwt() ->> ''is_anonymous'') = ''false'')', table_name);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', table_name);
    END IF;
  END LOOP;

  -- Recria apenas as 13 RPCs conhecidas, preservando assinatura e corpo; a
  -- checagem é inserida no primeiro BEGIN. Um formato inesperado aborta tudo.
  FOREACH rpc_name IN ARRAY ARRAY[
    'public.approve_quotation_and_create_operation(uuid,text)',
    'public.cancel_operation_service(uuid)',
    'public.record_commitment_settlement(uuid,uuid,numeric,timestamp with time zone,text,text,date)',
    'public.record_account_transfer(uuid,uuid,numeric,numeric,numeric,numeric,text,timestamp with time zone,text,text,uuid)',
    'public.cancel_financial_operation(uuid,text)',
    'public.cancel_operation_service_with_adjustments(uuid,text,numeric,text,numeric,text,text)',
    'public.create_cancellation_adjustment(uuid,text,text,numeric,text,text,date,text,text,uuid)',
    'public.record_balance_adjustment(uuid,numeric,text,text,timestamp with time zone,text)',
    'public.get_financial_account_balances()',
    'public.get_financial_consolidated_summary(date)',
    'public.get_period_cash_flow_forecast(date,date)',
    'public.get_pending_financial_commitments(date,date,text,text,uuid,boolean,date)',
    'public.split_financial_commitment(uuid,numeric,date,text,text)'
  ] LOOP
    rpc := to_regprocedure(rpc_name);
    IF rpc IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
      WHERE p.oid = rpc AND p.prosecdef AND l.lanname = 'plpgsql'
    ) THEN
      RAISE EXCEPTION 'RPC ausente ou com definição inesperada: %', rpc_name;
    END IF;

    SELECT p.prosrc, pg_get_functiondef(p.oid) INTO source_body, function_definition FROM pg_proc p WHERE p.oid = rpc;
    begin_line := substring(source_body FROM E'\nBEGIN\r?\n');
    IF begin_line IS NULL OR position(guard IN source_body) > 0 OR position(source_body IN function_definition) = 0 THEN
      RAISE EXCEPTION 'Corpo inesperado na RPC: %', rpc_name;
    END IF;
    guarded_body := overlay(source_body PLACING begin_line || guard FROM position(begin_line IN source_body) FOR length(begin_line));
    EXECUTE replace(function_definition, source_body, guarded_body);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', rpc);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', rpc);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', rpc);
  END LOOP;

  -- Funções de trigger não são endpoints da aplicação.
  REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
  REVOKE EXECUTE ON FUNCTION public.check_quotation_status_protection() FROM PUBLIC, anon, authenticated;
  REVOKE EXECUTE ON FUNCTION public.trg_check_quotation_archive() FROM PUBLIC, anon, authenticated;
END;
$migration$;
