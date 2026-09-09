-- Migration: 20260909020000_enable_crud_rls_policies.sql
-- Descrição: Habilita políticas de acesso para permitir operações de CRUD nas tabelas packages e quotations
-- mantendo o RLS estritamente ativado para a aplicação interna.

-- Políticas para packages
DROP POLICY IF EXISTS "Allow anon and authenticated all on packages" ON packages;
CREATE POLICY "Allow anon and authenticated all on packages"
ON packages
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Políticas para quotations
DROP POLICY IF EXISTS "Allow anon and authenticated all on quotations" ON quotations;
CREATE POLICY "Allow anon and authenticated all on quotations"
ON quotations
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
