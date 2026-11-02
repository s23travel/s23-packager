// Testes isolados: Deno + PostgreSQL em memória (PGlite), sem acesso ao Supabase.
// deno test --node-modules-dir=none --allow-read tests/test_auth_security_local.ts
import { PGlite } from 'npm:@electric-sql/pglite@0.3.14';
import { authorizeUser } from '../supabase/functions/_shared/auth.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('Edge Functions exigem usuário permanente validado pelo Auth', async () => {
  const request = (header?: string) => new Request('https://example.test', {
    headers: header ? { Authorization: header } : {},
  });
  let calls = 0;
  const mock = (status: number, body: unknown): typeof fetch => async (_url, init) => {
    calls++;
    const headers = (init as { headers?: HeadersInit } | undefined)?.headers;
    assert(new Headers(headers).get('Authorization') === 'Bearer token-teste', 'token não encaminhado');
    return new Response(JSON.stringify(body), { status });
  };
  const config = { url: 'https://example.test', key: 'chave-publica-teste' };
  assert(await authorizeUser(request(), { ...config, fetch: mock(200, {}) }) === 'unauthorized', 'sem token');
  assert(calls === 0, 'não deve consultar Auth sem token');
  assert(await authorizeUser(request('Bearer token-teste'), { ...config, fetch: mock(401, {}) }) === 'unauthorized', 'token inválido');
  assert(await authorizeUser(request('Bearer token-teste'), { ...config, fetch: mock(200, { id: '1', role: 'authenticated', is_anonymous: true }) }) === 'unauthorized', 'usuário anônimo');
  assert(await authorizeUser(request('Bearer token-teste'), { ...config, fetch: mock(200, { id: '1', role: 'authenticated' }) }) === 'unauthorized', 'usuário sem indicação de anonimato');
  assert(await authorizeUser(request('Bearer token-teste'), { ...config, fetch: mock(200, { id: '1', role: 'service_role', is_anonymous: false }) }) === 'unauthorized', 'chave privilegiada não é usuário');
  assert(await authorizeUser(request('Bearer token-teste'), { ...config, fetch: mock(200, { id: '1', role: 'authenticated', is_anonymous: false }) }) === 'ok', 'usuário permanente');
  assert(await authorizeUser(request('Bearer token-teste'), { ...config, fetch: mock(503, {}) }) === 'unavailable', 'falha do Auth');
  assert(await authorizeUser(request('Bearer token-teste'), { ...config, fetch: (() => Promise.reject(new Error('offline'))) as typeof fetch }) === 'unavailable', 'falha de rede');
});

Deno.test('migrations restringem tabelas e todas as RPCs em banco isolado', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
        SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
      $$;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(auth.jwt() ->> 'sub', '')::uuid
      $$;
    `);
    const files = [];
    for await (const entry of Deno.readDir('supabase/migrations')) {
      if (entry.isFile && entry.name.endsWith('.sql')) files.push(entry.name);
    }
    files.sort();
    for (const file of files) {
      let sql = await Deno.readTextFile(`supabase/migrations/${file}`);
      // PGlite já fornece gen_random_uuid(); a extensão pgcrypto não vem no WASM.
      sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', '');
      try { await db.exec(sql); } catch (error) { throw new Error(`${file}: ${error}`); }
    }

    const permissions = await db.query<{ missing: number }>(`
      SELECT count(*)::int AS missing FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef AND p.prorettype <> 'event_trigger'::regtype
        AND (has_function_privilege('anon', p.oid, 'execute') OR NOT has_function_privilege('authenticated', p.oid, 'execute'))
    `);
    assert(permissions.rows[0].missing === 0, 'privilégios RPC incorretos');
    const tables = ['packages', 'quotations', 'favorite_services', 'package_website_contents', 'financial_accounts', 'financial_operation_services', 'financial_commitments', 'financial_operations', 'financial_transactions'];
    for (const table of tables) {
      const result = await db.query<{ rls: boolean; anon_select: boolean; auth_select: boolean; auth_truncate: boolean }>(
        `SELECT relrowsecurity AS rls, has_table_privilege('anon', oid, 'select') AS anon_select,
          has_table_privilege('authenticated', oid, 'select') AS auth_select,
          has_table_privilege('authenticated', oid, 'truncate') AS auth_truncate
         FROM pg_class WHERE oid = $1::regclass`, [`public.${table}`],
      );
      const row = result.rows[0];
      assert(row.rls && !row.anon_select && row.auth_select && !row.auth_truncate, `privilégios incorretos: ${table}`);
    }

    await db.exec(`SET ROLE authenticated; SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}';`);
    await db.exec("INSERT INTO public.packages (reference, name) VALUES ('TESTE-001', 'Teste');");
    assert((await db.query('SELECT * FROM public.packages')).rows.length === 1, 'usuário permanente sem acesso');
    await db.query('SELECT * FROM public.get_financial_account_balances()');

    await db.exec(`SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":true}';`);
    assert((await db.query('SELECT * FROM public.packages')).rows.length === 0, 'usuário anônimo leu tabela');
    try {
      await db.exec("INSERT INTO public.packages (reference, name) VALUES ('TESTE-002', 'Negado');");
      throw new Error('usuário anônimo gravou tabela');
    } catch (error) {
      assert((error as { code?: string }).code === '42501', `usuário anônimo não foi bloqueado: ${error}`);
    }
    const calls = [
      'approve_quotation_and_create_operation(null,null)', 'cancel_operation_service(null)',
      'record_commitment_settlement(null,null,null,null,null,null,null)',
      'record_account_transfer(null,null,null,null,null,null,null,null,null,null,null)',
      'cancel_financial_operation(null,null)', 'cancel_operation_service_with_adjustments(null,null,null,null,null,null,null)',
      'create_cancellation_adjustment(null,null,null,null,null,null,null,null,null,null)',
      'record_balance_adjustment(null,null,null,null,null,null)', 'get_financial_account_balances()',
      'get_financial_consolidated_summary(null)', 'get_period_cash_flow_forecast(null,null)',
      'get_pending_financial_commitments(null,null,null,null,null,null,null)',
      'split_financial_commitment(null,null,null,null,null)',
    ];
    for (const call of calls) {
      try {
        await db.query(`SELECT * FROM public.${call}`);
        throw new Error(`RPC permitiu usuário anônimo: ${call}`);
      } catch (error) {
        assert((error as { code?: string }).code === '42501', `RPC não bloqueou autenticação: ${call}: ${error}`);
      }
    }
    await db.exec(`SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}';`);
    for (const call of calls) {
      try {
        await db.query(`SELECT * FROM public.${call}`);
      } catch (error) {
        assert((error as { code?: string }).code !== '42501', `RPC rejeitou usuário permanente: ${call}: ${error}`);
      }
    }
    await db.exec(`SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';`);
    assert((await db.query('SELECT * FROM public.packages')).rows.length === 0, 'claim de anonimato ausente');
    await db.exec('RESET ROLE; SET ROLE anon;');
    try {
      await db.query('SELECT * FROM public.packages');
      throw new Error('Papel anon leu tabela');
    } catch (error) {
      assert((error as { code?: string }).code === '42501', `Papel anon não foi bloqueado: ${error}`);
    }
    await db.exec('RESET ROLE; SET ROLE service_role;');
    await db.query('SELECT * FROM public.get_financial_account_balances()');
  } finally {
    await db.close();
  }
});
