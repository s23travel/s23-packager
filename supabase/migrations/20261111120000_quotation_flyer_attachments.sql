-- Persistência isolada da lâmina de cotação.
-- Reutiliza o bucket privado e a fila de limpeza da lâmina de pacote, sem
-- alterar os registos de pacotes existentes. A fila passa a distinguir o dono
-- do objeto por owner_kind; o claim do pacote filtra apenas linhas de pacote.

create table if not exists public.quotation_flyer_operations (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  request_id uuid not null,
  expected_quotation_updated_at timestamptz not null,
  expected_revision integer not null check (expected_revision >= 0),
  html_path text not null unique,
  png_path text not null unique,
  status text not null default 'rendering' check (status in ('rendering', 'uploaded', 'published', 'failed')),
  html_sha256 text check (html_sha256 is null or html_sha256 ~ '^[0-9a-f]{64}$'),
  png_sha256 text check (png_sha256 is null or png_sha256 ~ '^[0-9a-f]{64}$'),
  html_bytes integer check (html_bytes is null or html_bytes between 1 and 10485760),
  png_bytes integer check (png_bytes is null or png_bytes between 1 and 12582912),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quotation_id, request_id),
  check (html_path = quotation_id::text || '/' || request_id::text || '.html'),
  check (png_path = quotation_id::text || '/' || request_id::text || '.png')
);

create table if not exists public.quotation_flyer_attachments (
  quotation_id uuid primary key references public.quotations(id) on delete cascade,
  operation_id uuid not null unique references public.quotation_flyer_operations(id) on delete cascade,
  request_id uuid not null,
  html_path text not null,
  png_path text not null,
  revision integer not null check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotation_flyer_operations_quotation_idx on public.quotation_flyer_operations (quotation_id);

alter table public.quotation_flyer_operations enable row level security;
alter table public.quotation_flyer_attachments enable row level security;

revoke all on table public.quotation_flyer_operations from public, anon, authenticated;
revoke all on table public.quotation_flyer_attachments from public, anon, authenticated;
grant select, insert, update, delete on table public.quotation_flyer_operations to service_role;
grant select, insert, update, delete on table public.quotation_flyer_attachments to service_role;

-- A fila é partilhada: pacotes mantêm o valor por omissão e a cotação grava
-- explicitamente 'quotation'.
alter table public.package_flyer_cleanup_queue add column if not exists owner_kind text not null default 'package' check (owner_kind in ('package', 'quotation'));

-- Claim do pacote: mesma rotina da migration anterior, agora limitada ao dono
-- 'package' para não consumir objetos de cotações.
create or replace function public.claim_package_flyer_cleanup(p_limit integer default 50)
returns table(object_path text, operation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  update public.package_flyer_operations o
  set status = 'failed', updated_at = now()
  where o.status in ('rendering', 'uploaded') and o.updated_at < now() - interval '24 hours';
  insert into public.package_flyer_cleanup_queue (object_path, operation_id)
  select o.html_path, o.id from public.package_flyer_operations o
  where o.status = 'failed' and o.created_at < now() - interval '24 hours'
  union all
  select o.png_path, o.id from public.package_flyer_operations o
  where o.status = 'failed' and o.created_at < now() - interval '24 hours'
  on conflict (object_path) do nothing;

  return query
  with due as (
    select q.object_path from public.package_flyer_cleanup_queue q
    where q.owner_kind = 'package'
      and q.next_attempt_at <= now()
      and (q.leased_at is null or q.leased_at < now() - interval '10 minutes')
    order by q.next_attempt_at, q.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  )
  update public.package_flyer_cleanup_queue q
  set leased_at = now()
  from due
  where q.object_path = due.object_path
  returning q.object_path, q.operation_id;
end;
$$;

create or replace function public.begin_quotation_flyer_upload(
  p_quotation_id uuid,
  p_quotation_updated_at timestamptz,
  p_expected_revision integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_at timestamptz;
  v_revision integer;
  v_operation public.quotation_flyer_operations%rowtype;
begin
  select q.updated_at into v_updated_at
  from public.quotations as q
  where q.id = p_quotation_id
  for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if v_updated_at is distinct from p_quotation_updated_at then
    return jsonb_build_object('status', 'conflict');
  end if;

  select o.* into v_operation
  from public.quotation_flyer_operations as o
  where o.quotation_id = p_quotation_id and o.request_id = p_request_id
  for update;
  if found then
    if v_operation.expected_quotation_updated_at is distinct from p_quotation_updated_at or
       v_operation.expected_revision <> p_expected_revision then
      return jsonb_build_object('status', 'conflict');
    end if;
    if v_operation.status = 'published' then
      if exists (select 1 from public.quotation_flyer_attachments a where a.quotation_id = p_quotation_id and a.operation_id = v_operation.id) then
        return jsonb_build_object('status', 'published', 'revision', (select a.revision from public.quotation_flyer_attachments a where a.quotation_id = p_quotation_id));
      end if;
      return jsonb_build_object('status', 'conflict');
    end if;
    select coalesce(a.revision, 0) into v_revision
    from public.quotation_flyer_attachments a where a.quotation_id = p_quotation_id;
    v_revision := coalesce(v_revision, 0);
    if v_revision <> p_expected_revision then return jsonb_build_object('status', 'conflict'); end if;
    if v_operation.status = 'uploaded' then
      return jsonb_build_object('status', 'uploaded', 'operation_id', v_operation.id,
        'html_path', v_operation.html_path, 'png_path', v_operation.png_path,
        'png_sha256', v_operation.png_sha256);
    end if;
    if v_operation.status <> 'rendering' then return jsonb_build_object('status', v_operation.status); end if;
    return jsonb_build_object('status', 'ready', 'operation_id', v_operation.id,
      'html_path', v_operation.html_path, 'png_path', v_operation.png_path);
  end if;

  select coalesce(a.revision, 0) into v_revision
  from public.quotation_flyer_attachments as a
  where a.quotation_id = p_quotation_id;
  v_revision := coalesce(v_revision, 0);
  if v_revision <> p_expected_revision then return jsonb_build_object('status', 'conflict'); end if;

  insert into public.quotation_flyer_operations (
    quotation_id, request_id, expected_quotation_updated_at, expected_revision, html_path, png_path
  ) values (
    p_quotation_id, p_request_id, p_quotation_updated_at, p_expected_revision,
    p_quotation_id::text || '/' || p_request_id::text || '.html',
    p_quotation_id::text || '/' || p_request_id::text || '.png'
  ) returning * into v_operation;
  return jsonb_build_object('status', 'ready', 'operation_id', v_operation.id,
    'html_path', v_operation.html_path, 'png_path', v_operation.png_path);
end;
$$;

create or replace function public.mark_quotation_flyer_uploaded(
  p_request_id uuid,
  p_html_sha256 text,
  p_png_sha256 text,
  p_html_bytes integer,
  p_png_bytes integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.quotation_flyer_operations%rowtype;
begin
  if p_html_sha256 is null or p_png_sha256 is null or p_html_bytes is null or p_png_bytes is null or
     p_html_sha256 !~ '^[0-9a-f]{64}$' or p_png_sha256 !~ '^[0-9a-f]{64}$' or
     p_html_bytes not between 1 and 10485760 or p_png_bytes not between 1 and 12582912 then
    return jsonb_build_object('status', 'invalid');
  end if;
  select o.* into v_operation
  from public.quotation_flyer_operations o
  where o.request_id = p_request_id
  for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if v_operation.status = 'published' then return jsonb_build_object('status', 'idempotent'); end if;
  if v_operation.status = 'uploaded' then
    if v_operation.html_sha256 = p_html_sha256 and v_operation.png_sha256 = p_png_sha256 and
       v_operation.html_bytes = p_html_bytes and v_operation.png_bytes = p_png_bytes then
      return jsonb_build_object('status', 'uploaded');
    end if;
    return jsonb_build_object('status', 'conflict');
  end if;
  if v_operation.status <> 'rendering' then return jsonb_build_object('status', v_operation.status); end if;
  update public.quotation_flyer_operations
  set status = 'uploaded', html_sha256 = p_html_sha256, png_sha256 = p_png_sha256,
      html_bytes = p_html_bytes, png_bytes = p_png_bytes, updated_at = now()
  where id = v_operation.id;
  return jsonb_build_object('status', 'uploaded');
end;
$$;

create or replace function public.publish_quotation_flyer(
  p_quotation_id uuid,
  p_quotation_updated_at timestamptz,
  p_expected_revision integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.quotation_flyer_operations%rowtype;
  v_quotation_updated_at timestamptz;
  v_revision integer;
begin
  select q.updated_at into v_quotation_updated_at
  from public.quotations as q where q.id = p_quotation_id for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;

  select o.* into v_operation
  from public.quotation_flyer_operations o
  where o.quotation_id = p_quotation_id and o.request_id = p_request_id
  for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if v_operation.expected_quotation_updated_at is distinct from p_quotation_updated_at or
     v_operation.expected_revision <> p_expected_revision then
    return jsonb_build_object('status', 'conflict');
  end if;
  if v_operation.status = 'published' then
    select a.revision into v_revision from public.quotation_flyer_attachments a
    where a.quotation_id = v_operation.quotation_id and a.operation_id = v_operation.id;
    if found then return jsonb_build_object('status', 'idempotent', 'revision', v_revision); end if;
    return jsonb_build_object('status', 'conflict');
  end if;
  if v_operation.status <> 'uploaded' then return jsonb_build_object('status', 'invalid_state'); end if;

  select a.revision into v_revision from public.quotation_flyer_attachments a where a.quotation_id = v_operation.quotation_id;
  v_revision := coalesce(v_revision, 0);
  if v_quotation_updated_at is distinct from v_operation.expected_quotation_updated_at or v_revision <> v_operation.expected_revision then
    update public.quotation_flyer_operations set status = 'failed', updated_at = now() where id = v_operation.id;
    insert into public.package_flyer_cleanup_queue (object_path, operation_id, owner_kind)
    values (v_operation.html_path, v_operation.id, 'quotation'), (v_operation.png_path, v_operation.id, 'quotation')
    on conflict (object_path) do nothing;
    return jsonb_build_object('status', 'conflict');
  end if;

  if v_revision > 0 then
    insert into public.package_flyer_cleanup_queue (object_path, operation_id, owner_kind)
    select old.html_path, old.id, 'quotation' from public.quotation_flyer_attachments a
    join public.quotation_flyer_operations old on old.id = a.operation_id
    where a.quotation_id = v_operation.quotation_id
    union all
    select old.png_path, old.id, 'quotation' from public.quotation_flyer_attachments a
    join public.quotation_flyer_operations old on old.id = a.operation_id
    where a.quotation_id = v_operation.quotation_id
    on conflict (object_path) do nothing;
  end if;

  insert into public.quotation_flyer_attachments (
    quotation_id, operation_id, request_id, html_path, png_path, revision, created_at, updated_at
  ) values (
    v_operation.quotation_id, v_operation.id, v_operation.request_id,
    v_operation.html_path, v_operation.png_path, v_revision + 1, now(), now()
  )
  on conflict (quotation_id) do update set
    operation_id = excluded.operation_id,
    request_id = excluded.request_id,
    html_path = excluded.html_path,
    png_path = excluded.png_path,
    revision = excluded.revision,
    updated_at = excluded.updated_at;
  update public.quotation_flyer_operations set status = 'published', updated_at = now() where id = v_operation.id;
  return jsonb_build_object('status', 'published', 'revision', v_revision + 1);
end;
$$;

create or replace function public.fail_quotation_flyer_upload(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.quotation_flyer_operations%rowtype;
begin
  select o.* into v_operation from public.quotation_flyer_operations o where o.request_id = p_request_id for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if v_operation.status = 'published' then return jsonb_build_object('status', 'published'); end if;
  update public.quotation_flyer_operations set status = 'failed', updated_at = now() where id = v_operation.id;
  insert into public.package_flyer_cleanup_queue (object_path, operation_id, owner_kind)
  values (v_operation.html_path, v_operation.id, 'quotation'), (v_operation.png_path, v_operation.id, 'quotation')
  on conflict (object_path) do nothing;
  return jsonb_build_object('status', 'failed');
end;
$$;

create or replace function public.claim_quotation_flyer_cleanup(p_limit integer default 50)
returns table(object_path text, operation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  update public.quotation_flyer_operations o
  set status = 'failed', updated_at = now()
  where o.status in ('rendering', 'uploaded') and o.updated_at < now() - interval '24 hours';
  insert into public.package_flyer_cleanup_queue (object_path, operation_id, owner_kind)
  select o.html_path, o.id, 'quotation' from public.quotation_flyer_operations o
  where o.status = 'failed' and o.created_at < now() - interval '24 hours'
  union all
  select o.png_path, o.id, 'quotation' from public.quotation_flyer_operations o
  where o.status = 'failed' and o.created_at < now() - interval '24 hours'
  on conflict (object_path) do nothing;

  return query
  with due as (
    select q.object_path from public.package_flyer_cleanup_queue q
    where q.owner_kind = 'quotation'
      and q.next_attempt_at <= now()
      and (q.leased_at is null or q.leased_at < now() - interval '10 minutes')
    order by q.next_attempt_at, q.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  )
  update public.package_flyer_cleanup_queue q
  set leased_at = now()
  from due
  where q.object_path = due.object_path
  returning q.object_path, q.operation_id;
end;
$$;

create or replace function public.finish_quotation_flyer_cleanup(
  p_object_path text,
  p_success boolean,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation_id uuid;
begin
  select q.operation_id into v_operation_id
  from public.package_flyer_cleanup_queue q
  where q.object_path = p_object_path and q.owner_kind = 'quotation';
  if not found then return jsonb_build_object('status', 'missing'); end if;
  if p_success then
    delete from public.package_flyer_cleanup_queue where object_path = p_object_path and owner_kind = 'quotation';
    if v_operation_id is not null and not exists (
      select 1 from public.quotation_flyer_attachments a where a.operation_id = v_operation_id
    ) and not exists (
      select 1 from public.package_flyer_cleanup_queue q where q.operation_id = v_operation_id
    ) then
      delete from public.quotation_flyer_operations where id = v_operation_id;
    end if;
    return jsonb_build_object('status', 'deleted');
  end if;
  update public.package_flyer_cleanup_queue
  set attempts = attempts + 1,
      next_attempt_at = now() + make_interval(mins => least(1440, power(2, least(attempts + 1, 10))::integer)),
      leased_at = null,
      last_error = left(coalesce(p_error, 'storage_error'), 80)
  where object_path = p_object_path and owner_kind = 'quotation';
  return jsonb_build_object('status', 'retry');
end;
$$;

-- Ao apagar uma cotação, os objetos da lâmina entram na fila. O trigger não
-- decide se a cotação pode ser apagada: a regra financeira existente continua
-- a ser a única autoridade e o rollback da transação descarta a fila.
create or replace function public.enqueue_quotation_flyer_cleanup_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.package_flyer_cleanup_queue (object_path, operation_id, owner_kind)
  select o.html_path, o.id, 'quotation' from public.quotation_flyer_operations o where o.quotation_id = old.id
  union all
  select o.png_path, o.id, 'quotation' from public.quotation_flyer_operations o where o.quotation_id = old.id
  on conflict (object_path) do nothing;
  return old;
end;
$$;

drop trigger if exists quotations_enqueue_flyer_cleanup on public.quotations;
create trigger quotations_enqueue_flyer_cleanup
before delete on public.quotations
for each row execute function public.enqueue_quotation_flyer_cleanup_before_delete();

revoke all on function public.begin_quotation_flyer_upload(uuid, timestamptz, integer, uuid) from public, anon, authenticated;
revoke all on function public.mark_quotation_flyer_uploaded(uuid, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.publish_quotation_flyer(uuid, timestamptz, integer, uuid) from public, anon, authenticated;
revoke all on function public.fail_quotation_flyer_upload(uuid) from public, anon, authenticated;
revoke all on function public.claim_quotation_flyer_cleanup(integer) from public, anon, authenticated;
revoke all on function public.finish_quotation_flyer_cleanup(text, boolean, text) from public, anon, authenticated;
revoke all on function public.enqueue_quotation_flyer_cleanup_before_delete() from public, anon, authenticated, service_role;
grant execute on function public.begin_quotation_flyer_upload(uuid, timestamptz, integer, uuid) to service_role;
grant execute on function public.mark_quotation_flyer_uploaded(uuid, text, text, integer, integer) to service_role;
grant execute on function public.publish_quotation_flyer(uuid, timestamptz, integer, uuid) to service_role;
grant execute on function public.fail_quotation_flyer_upload(uuid) to service_role;
grant execute on function public.claim_quotation_flyer_cleanup(integer) to service_role;
grant execute on function public.finish_quotation_flyer_cleanup(text, boolean, text) to service_role;

comment on table public.quotation_flyer_operations is 'Tentativas imutáveis de geração e upload do HTML/PNG da lâmina de cotação; apenas a última versão publicada fica ativa.';
comment on table public.quotation_flyer_attachments is 'Ponteiro para a única lâmina salva de cada cotação, sem histórico de versões.';
comment on column public.quotation_flyer_operations.quotation_id is 'Cotação dona da operação; apagada em cascata com a cotação.';
comment on column public.quotation_flyer_operations.expected_quotation_updated_at is 'Valor de quotations.updated_at usado no CAS da prévia e da publicação.';
comment on column public.quotation_flyer_operations.expected_revision is 'Revisão ativa esperada no início da operação.';
comment on column public.quotation_flyer_operations.status is 'Estado da operação: rendering, uploaded, published ou failed.';
comment on column public.quotation_flyer_operations.html_path is 'Caminho do HTML no bucket privado, no formato <cotação>/<pedido>.html.';
comment on column public.quotation_flyer_operations.png_path is 'Caminho do PNG no bucket privado, no formato <cotação>/<pedido>.png.';
comment on column public.quotation_flyer_attachments.quotation_id is 'Cotação da lâmina salva; existe no máximo uma por cotação.';
comment on column public.quotation_flyer_attachments.operation_id is 'Operação publicada que a cotação aponta como lâmina ativa.';
comment on column public.quotation_flyer_attachments.revision is 'Revisão da lâmina ativa, usada no controle de concorrência.';
comment on column public.package_flyer_cleanup_queue.owner_kind is 'Dono do objeto na fila de limpeza: pacote ou cotação.';
