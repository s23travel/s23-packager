import * as fs from 'node:fs';
import * as path from 'node:path';

// Teste estático e offline da migration da lâmina de cotação.
// Não abre ligação ao Supabase: lê o ficheiro SQL e compara com o espelho da lâmina de pacote.

let passed = 0;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed++;
}

function readLatestMigration(): { name: string; sql: string; flat: string; lower: string } {
  const dir = path.resolve(process.cwd(), 'supabase/migrations');
  const names = fs
    .readdirSync(dir)
    .filter((name) => /^\d{14}_quotation_flyer_attachments\.sql$/.test(name))
    .sort();
  assert(names.length > 0, 'Deve existir supabase/migrations/<timestamp>_quotation_flyer_attachments.sql');
  const name = names[names.length - 1];
  assert(
    name.slice(0, 14) > '20261109234000',
    `A migration da cotação deve ter timestamp posterior a 20261109234000 (encontrado: ${name})`
  );
  const sql = fs.readFileSync(path.join(dir, name), 'utf-8');
  return { name, sql, flat: sql.replace(/\s+/g, ' '), lower: sql.toLowerCase() };
}

function tableBody(sql: string, table: string): string {
  const match = new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`).exec(sql);
  assert(match !== null, `Tabela public.${table} deve ser criada com "create table if not exists"`);
  return match[1].replace(/\s+/g, ' ');
}

function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert(start >= 0, `Função public.${name} deve ser criada com "create or replace function"`);
  const end = sql.indexOf('$$;', start);
  assert(end > start, `Função public.${name} deve ter corpo delimitado por $$`);
  return sql.slice(start, end).replace(/\s+/g, ' ');
}

function run() {
  console.log('=== TESTES: MIGRATION DA LÂMINA DE COTAÇÃO (ESTÁTICO, OFFLINE) ===\n');

  const { sql, flat, lower } = readLatestMigration();

  // -------------------------------------------------------------------------
  // Tabelas da cotação
  // -------------------------------------------------------------------------
  const operations = tableBody(sql, 'quotation_flyer_operations');
  assert(
    operations.includes('quotation_id uuid not null references public.quotations(id) on delete cascade'),
    'quotation_flyer_operations deve apontar para quotations com FK e on delete cascade'
  );
  assert(operations.includes('request_id uuid not null'), 'quotation_flyer_operations deve guardar request_id');
  assert(
    operations.includes('expected_quotation_updated_at timestamptz not null'),
    'quotation_flyer_operations deve guardar expected_quotation_updated_at (CAS por quotations.updated_at)'
  );
  assert(
    operations.includes('expected_revision integer not null check (expected_revision >= 0)'),
    'quotation_flyer_operations deve guardar expected_revision'
  );
  assert(operations.includes('html_path text not null unique'), 'quotation_flyer_operations deve guardar html_path único');
  assert(operations.includes('png_path text not null unique'), 'quotation_flyer_operations deve guardar png_path único');
  assert(
    operations.includes("status text not null default 'rendering' check (status in ('rendering', 'uploaded', 'published', 'failed'))"),
    'quotation_flyer_operations deve repetir os estados da lâmina de pacote'
  );
  assert(
    operations.includes('html_sha256 text check (html_sha256 is null or html_sha256 ~ \'^[0-9a-f]{64}$\')'),
    'quotation_flyer_operations deve validar o hash do HTML'
  );
  assert(
    operations.includes('png_sha256 text check (png_sha256 is null or png_sha256 ~ \'^[0-9a-f]{64}$\')'),
    'quotation_flyer_operations deve validar o hash do PNG'
  );
  assert(
    operations.includes('html_bytes integer check (html_bytes is null or html_bytes between 1 and 10485760)'),
    'quotation_flyer_operations deve limitar o tamanho do HTML'
  );
  assert(
    operations.includes('png_bytes integer check (png_bytes is null or png_bytes between 1 and 12582912)'),
    'quotation_flyer_operations deve limitar o tamanho do PNG'
  );
  assert(
    operations.includes('created_at timestamptz not null default now()') &&
      operations.includes('updated_at timestamptz not null default now()'),
    'quotation_flyer_operations deve ter created_at/updated_at'
  );
  assert(operations.includes('unique (quotation_id, request_id)'), 'quotation_flyer_operations deve ser idempotente por (quotation_id, request_id)');
  assert(
    operations.includes("check (html_path = quotation_id::text || '/' || request_id::text || '.html')") &&
      operations.includes("check (png_path = quotation_id::text || '/' || request_id::text || '.png')"),
    'quotation_flyer_operations deve amarrar os caminhos a <quotationId>/<requestId>.html|png'
  );

  const attachments = tableBody(sql, 'quotation_flyer_attachments');
  assert(
    attachments.includes('quotation_id uuid primary key references public.quotations(id) on delete cascade'),
    'quotation_flyer_attachments deve usar quotation_id como PK com on delete cascade'
  );
  assert(
    attachments.includes('operation_id uuid not null unique references public.quotation_flyer_operations(id) on delete cascade'),
    'quotation_flyer_attachments deve referenciar a operação publicada'
  );
  assert(attachments.includes('request_id uuid not null'), 'quotation_flyer_attachments deve guardar request_id');
  assert(
    attachments.includes('html_path text not null') && attachments.includes('png_path text not null'),
    'quotation_flyer_attachments deve guardar os caminhos HTML/PNG'
  );
  assert(
    attachments.includes('revision integer not null check (revision > 0)'),
    'quotation_flyer_attachments deve guardar a revisão ativa para o CAS'
  );
  assert(
    attachments.includes('saved_at timestamptz not null default now()'),
    'quotation_flyer_attachments deve guardar saved_at para o contrato `current`'
  );
  assert(
    attachments.includes('created_at timestamptz not null default now()') &&
      attachments.includes('updated_at timestamptz not null default now()'),
    'quotation_flyer_attachments deve ter created_at/updated_at'
  );

  assert(
    flat.includes('create index if not exists quotation_flyer_operations_quotation_idx on public.quotation_flyer_operations (quotation_id);'),
    'Deve existir índice por quotation_id'
  );

  // -------------------------------------------------------------------------
  // RLS e grants das tabelas
  // -------------------------------------------------------------------------
  for (const table of ['quotation_flyer_operations', 'quotation_flyer_attachments']) {
    assert(
      lower.includes(`alter table public.${table} enable row level security;`),
      `RLS deve estar ativa em public.${table}`
    );
    assert(
      lower.includes(`revoke all on table public.${table} from public, anon, authenticated;`),
      `revoke all deve cobrir public.${table}`
    );
    assert(
      lower.includes(`grant select, insert, update, delete on table public.${table} to service_role;`),
      `grant de tabela deve cobrir public.${table}`
    );
  }

  // -------------------------------------------------------------------------
  // Fila partilhada com owner_kind
  // -------------------------------------------------------------------------
  assert(
    flat.includes(
      "alter table public.package_flyer_cleanup_queue add column if not exists owner_kind text not null default 'package' check (owner_kind in ('package', 'quotation'));"
    ),
    'A fila partilhada deve ganhar owner_kind com default package e valores package/quotation'
  );
  assert(!lower.includes('create table public.package_flyer_cleanup_queue'), 'A fila de limpeza não deve ser duplicada');
  assert(
    !lower.includes('create table if not exists public.package_flyer_cleanup_queue'),
    'A fila de limpeza não deve ser recriada'
  );

  const packageAlters = [...sql.matchAll(/alter table\s+public\.package_flyer_[a-z_]+[\s\S]*?;/gi)].map((match) =>
    match[0].replace(/\s+/g, ' ').toLowerCase()
  );
  assert(packageAlters.length === 1, `Só pode haver um "alter table" de pacote (o da fila); encontrados: ${packageAlters.length}`);
  assert(
    packageAlters[0].startsWith('alter table public.package_flyer_cleanup_queue add column if not exists owner_kind'),
    'A única alteração a tabelas de pacote é a coluna owner_kind da fila'
  );
  assert(!lower.includes('drop table'), 'A migration não deve remover tabelas');
  assert(!lower.includes('drop column'), 'A migration não deve remover colunas');
  assert(
    !lower.includes('delete from public.package_flyer_operations') &&
      !lower.includes('delete from public.package_flyer_attachments'),
    'A migration não deve apagar dados de lâminas de pacotes'
  );
  const queueDeletes = [...sql.matchAll(/delete from public\.package_flyer_cleanup_queue[\s\S]*?;/gi)].map((match) =>
    match[0].replace(/\s+/g, ' ').toLowerCase()
  );
  for (const statement of queueDeletes) {
    assert(
      statement.includes("owner_kind = 'quotation'"),
      'Qualquer DELETE na fila partilhada tem de filtrar owner_kind para não afetar pacotes'
    );
  }

  // -------------------------------------------------------------------------
  // Assinaturas espelhadas das RPCs
  // -------------------------------------------------------------------------
  const expectedFunctions: Array<{ name: string; args: string; returns: string }> = [
    {
      name: 'begin_quotation_flyer_upload',
      args: 'p_quotation_id uuid, p_quotation_updated_at timestamptz, p_expected_revision integer, p_request_id uuid',
      returns: 'jsonb',
    },
    {
      name: 'mark_quotation_flyer_uploaded',
      args: 'p_request_id uuid, p_html_sha256 text, p_png_sha256 text, p_html_bytes integer, p_png_bytes integer',
      returns: 'jsonb',
    },
    {
      name: 'publish_quotation_flyer',
      args: 'p_quotation_id uuid, p_quotation_updated_at timestamptz, p_expected_revision integer, p_request_id uuid',
      returns: 'jsonb',
    },
    { name: 'fail_quotation_flyer_upload', args: 'p_request_id uuid', returns: 'jsonb' },
    { name: 'claim_quotation_flyer_cleanup', args: 'p_limit integer default 50', returns: 'table(object_path text, operation_id uuid)' },
    {
      name: 'finish_quotation_flyer_cleanup',
      args: 'p_object_path text, p_success boolean, p_error text default null',
      returns: 'jsonb',
    },
    { name: 'enqueue_quotation_flyer_cleanup_before_delete', args: '', returns: 'trigger' },
  ];

  for (const fn of expectedFunctions) {
    const body = functionBody(sql, fn.name);
    assert(
      body.includes(`returns ${fn.returns}`),
      `public.${fn.name} deve devolver ${fn.returns}`
    );
    assert(
      body.includes('language plpgsql') && body.includes('security definer') && body.includes("set search_path = ''"),
      `public.${fn.name} deve ser security definer com search_path vazio`
    );
  }

  const createdFunctions = [...sql.matchAll(/create or replace function public\.([a-z_]+)\(/g)].map((match) => match[1]);
  assert(
    new Set(createdFunctions).size === createdFunctions.length,
    'Cada função deve ser criada uma única vez'
  );
  for (const name of createdFunctions) {
    assert(
      expectedFunctions.some((fn) => fn.name === name) || name === 'claim_package_flyer_cleanup',
      `Função inesperada criada pela migration: ${name}`
    );
  }

  // Revokes e grants explícitos de todas as funções novas.
  const signatures: Record<string, string> = {
    begin_quotation_flyer_upload: 'uuid, timestamptz, integer, uuid',
    mark_quotation_flyer_uploaded: 'uuid, text, text, integer, integer',
    publish_quotation_flyer: 'uuid, timestamptz, integer, uuid',
    fail_quotation_flyer_upload: 'uuid',
    claim_quotation_flyer_cleanup: 'integer',
    finish_quotation_flyer_cleanup: 'text, boolean, text',
    enqueue_quotation_flyer_cleanup_before_delete: '',
  };
  for (const [name, args] of Object.entries(signatures)) {
    assert(
      lower.includes(`revoke all on function public.${name}(${args}) from public, anon, authenticated`),
      `revoke all deve cobrir public.${name}`
    );
    if (name === 'enqueue_quotation_flyer_cleanup_before_delete') {
      assert(
        lower.includes(`revoke all on function public.${name}() from public, anon, authenticated, service_role;`),
        'Função de trigger não deve ser executável por service_role'
      );
    } else {
      assert(
        lower.includes(`grant execute on function public.${name}(${args}) to service_role;`),
        `grant execute a service_role deve cobrir public.${name}`
      );
    }
  }
  assert(!/grant[^;]*\bto\s+(?:anon|authenticated)\b/i.test(sql), 'Nenhuma concessão pode chegar a anon/authenticated');

  // -------------------------------------------------------------------------
  // Corpo das RPCs: CAS, idempotência, fila e limpeza
  // -------------------------------------------------------------------------
  const begin = functionBody(sql, 'begin_quotation_flyer_upload');
  assert(begin.includes('from public.quotations as q') || begin.includes('from public.quotations q'), 'begin deve ler quotations');
  assert(begin.includes('for update'), 'begin deve bloquear a cotação para CAS');
  assert(begin.includes('v_updated_at is distinct from p_quotation_updated_at'), 'begin deve comparar quotations.updated_at');
  assert(begin.includes("return jsonb_build_object('status', 'conflict')"), 'begin deve devolver conflict no CAS');
  assert(begin.includes('from public.quotation_flyer_attachments'), 'begin deve ler a revisão ativa da cotação');
  assert(begin.includes("p_quotation_id::text || '/' || p_request_id::text || '.html'"), 'begin deve montar o caminho HTML da cotação');
  assert(begin.includes("p_quotation_id::text || '/' || p_request_id::text || '.png'"), 'begin deve montar o caminho PNG da cotação');

  const mark = functionBody(sql, 'mark_quotation_flyer_uploaded');
  assert(mark.includes("p_html_sha256 !~ '^[0-9a-f]{64}$'"), 'mark deve validar o hash do HTML');
  assert(mark.includes("p_png_sha256 !~ '^[0-9a-f]{64}$'"), 'mark deve validar o hash do PNG');
  assert(mark.includes('p_html_bytes not between 1 and 10485760'), 'mark deve validar o tamanho do HTML');
  assert(mark.includes('p_png_bytes not between 1 and 12582912'), 'mark deve validar o tamanho do PNG');
  assert(mark.includes("status = 'uploaded'"), 'mark deve promover a operação para uploaded');

  const publish = functionBody(sql, 'publish_quotation_flyer');
  assert(publish.includes('expected_quotation_updated_at is distinct from p_quotation_updated_at') || publish.includes('v_quotation_updated_at is distinct from v_operation.expected_quotation_updated_at'), 'publish deve revalidar o CAS');
  assert(publish.includes("status = 'failed'"), 'publish deve marcar a operação antiga como failed no conflito');
  assert(publish.includes('insert into public.package_flyer_cleanup_queue'), 'publish deve enfileirar os objetos substituídos');
  assert(publish.includes("'quotation'"), 'publish deve enfileirar com owner_kind quotation');
  assert(publish.includes('on conflict (quotation_id) do update'), 'publish deve substituir a versão anterior sem histórico');
  assert(publish.includes("status = 'published'"), 'publish deve marcar a operação como published');

  const fail = functionBody(sql, 'fail_quotation_flyer_upload');
  assert(fail.includes("status = 'failed'"), 'fail deve marcar a operação como failed');
  assert(fail.includes('insert into public.package_flyer_cleanup_queue'), 'fail deve enfileirar os objetos da operação');
  assert(fail.includes("'quotation'"), 'fail deve enfileirar com owner_kind quotation');

  const trigger = functionBody(sql, 'enqueue_quotation_flyer_cleanup_before_delete');
  assert(trigger.includes('insert into public.package_flyer_cleanup_queue'), 'O trigger de exclusão deve enfileirar objetos');
  assert(trigger.includes("'quotation'"), 'O trigger de exclusão deve gravar owner_kind quotation');
  assert(trigger.includes('where o.quotation_id = old.id'), 'O trigger de exclusão deve filtrar a cotação apagada');
  assert(trigger.includes('return old;'), 'O trigger de exclusão não pode bloquear a exclusão da cotação');
  assert(!trigger.includes('raise '), 'O trigger de exclusão não pode levantar exceção');

  assert(
    flat.includes('drop trigger if exists quotations_enqueue_flyer_cleanup on public.quotations;'),
    'O trigger da cotação deve ser idempotente'
  );
  assert(
    flat.includes('create trigger quotations_enqueue_flyer_cleanup before delete on public.quotations for each row execute function public.enqueue_quotation_flyer_cleanup_before_delete();'),
    'Deve existir um trigger before delete em quotations'
  );

  // -------------------------------------------------------------------------
  // Claim do pacote filtrado por owner_kind, sem outras alterações
  // -------------------------------------------------------------------------
  assert(
    lower.includes('create or replace function public.claim_package_flyer_cleanup(p_limit integer default 50)'),
    'O claim do pacote deve continuar a existir com a mesma assinatura'
  );
  const packageClaim = functionBody(sql, 'claim_package_flyer_cleanup');
  assert(
    packageClaim.includes("q.owner_kind = 'package'"),
    'O claim do pacote deve filtrar owner_kind = package'
  );
  assert(
    !packageClaim.includes("owner_kind = 'quotation'"),
    'O claim do pacote não pode consumir linhas de cotação'
  );
  assert(
    packageClaim.includes('#variable_conflict use_column'),
    'O claim do pacote deve manter a resolução de coluna do ON CONFLICT'
  );
  assert(
    packageClaim.includes('update public.package_flyer_cleanup_queue q set leased_at = now()'),
    'O claim do pacote deve manter o lease da fila'
  );

  const quotationClaim = functionBody(sql, 'claim_quotation_flyer_cleanup');
  assert(quotationClaim.includes("q.owner_kind = 'quotation'"), 'O claim da cotação deve filtrar owner_kind = quotation');
  assert(
    quotationClaim.includes('insert into public.package_flyer_cleanup_queue (object_path, operation_id, owner_kind)'),
    'O claim da cotação deve gravar owner_kind nas linhas que cria'
  );
  assert(quotationClaim.includes('#variable_conflict use_column'), 'O claim da cotação deve usar a resolução de coluna do ON CONFLICT');

  const finish = functionBody(sql, 'finish_quotation_flyer_cleanup');
  assert(
    finish.includes("q.owner_kind = 'quotation'"),
    'O finish da cotação só pode consumir linhas com owner_kind quotation'
  );
  assert(finish.includes('from public.quotation_flyer_attachments'), 'O finish da cotação deve preservar anexos ativos');
  assert(finish.includes('from public.quotation_flyer_operations'), 'O finish da cotação deve limpar operações órfãs');

  // -------------------------------------------------------------------------
  // Comentários em pt-BR
  // -------------------------------------------------------------------------
  const comments = [
    /comment on table public\.quotation_flyer_operations is '[^']*(?:l[âa]mina|cota[çc][ãa]o)[^']*';/i,
    /comment on table public\.quotation_flyer_attachments is '[^']*(?:l[âa]mina|cota[çc][ãa]o)[^']*';/i,
    /comment on column public\.package_flyer_cleanup_queue\.owner_kind is '[^']*(?:fila|pacote|cota[çc][ãa]o)[^']*';/i,
  ];
  for (const pattern of comments) {
    assert(pattern.test(sql), `Falta um comentário em pt-BR que corresponda a ${pattern}`);
  }

  console.log(`\n${passed} verificações estáticas passaram.`);
  console.log('quotation flyer SQL tests passed');
}

try {
  run();
} catch (error) {
  console.error(`\n[FAIL] ${(error as Error).message}`);
  process.exit(1);
}
