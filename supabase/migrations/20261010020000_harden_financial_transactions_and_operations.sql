-- Migration: 20261010020000_harden_financial_transactions_and_operations.sql
-- Descrição: Fase 2A da Segurança Financeira
--
-- 1. Remove políticas RLS permissivas (FOR ALL) em:
--    - public.financial_operations
--    - public.financial_transactions
-- 2. Define políticas RLS estritas somente-leitura (FOR SELECT) para anon e authenticated.
-- 3. Revoga privilégios de escrita (INSERT, UPDATE, DELETE, TRUNCATE) de anon e authenticated nestas duas tabelas.
-- 4. Garante privilégio de leitura (SELECT) para anon e authenticated.
-- 5. Preserva privilégios completos (ALL) para service_role.
-- 6. Mantém a integridade e execução das RPCs SECURITY DEFINER (proprietário postgres).

-- ============================================================================
-- 1. POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ============================================================================

-- Tabela: public.financial_operations
-- Remove políticas prévias permissivas
DROP POLICY IF EXISTS "Allow anon and authenticated all on financial_operations" ON public.financial_operations;
DROP POLICY IF EXISTS "Allow anon and authenticated select on financial_operations" ON public.financial_operations;

-- Garante que RLS continua ativo
ALTER TABLE public.financial_operations ENABLE ROW LEVEL SECURITY;

-- Política restrita a SELECT
CREATE POLICY "Allow anon and authenticated select on financial_operations"
ON public.financial_operations
FOR SELECT
TO anon, authenticated
USING (true);

-- Tabela: public.financial_transactions
-- Remove políticas prévias permissivas
DROP POLICY IF EXISTS "Allow anon and authenticated all on financial_transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "Allow anon and authenticated select on financial_transactions" ON public.financial_transactions;

-- Garante que RLS continua ativo
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- Política restrita a SELECT
CREATE POLICY "Allow anon and authenticated select on financial_transactions"
ON public.financial_transactions
FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================================
-- 2. PRIVILÉGIOS NO POSTGRESQL (GRANTS E REVOKES)
-- ============================================================================

-- Revogação de escrita direta para roles públicas
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.financial_operations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.financial_transactions FROM anon, authenticated;

-- Garantia explícita de leitura para roles públicas
GRANT SELECT ON TABLE public.financial_operations TO anon, authenticated;
GRANT SELECT ON TABLE public.financial_transactions TO anon, authenticated;

-- Manutenção explícita de acesso irrestrito para service_role
GRANT ALL ON TABLE public.financial_operations TO service_role;
GRANT ALL ON TABLE public.financial_transactions TO service_role;

-- Comentários descritivos de governança
COMMENT ON TABLE public.financial_operations IS 'Operações financeiras vinculadas a cotações aprovadas. Escrita direta desativada para anon/authenticated (acesso exclusivo via RPCs SECURITY DEFINER).';
COMMENT ON TABLE public.financial_transactions IS 'Livro-razão financeiro (movimentações reais). Imutável e protegido contra escrita direta de anon/authenticated (apenas via RPCs SECURITY DEFINER).';
