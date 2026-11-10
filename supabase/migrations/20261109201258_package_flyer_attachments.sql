-- Persist only the current flyer attachment per package. Objects are immutable;
-- the active pointer changes only after both renderer outputs have been verified.
do $$
declare
  v_public boolean;
  v_file_size_limit bigint;
  v_allowed_mime_types text[];
begin
  select b.public, b.file_size_limit, b.allowed_mime_types
  into v_public, v_file_size_limit, v_allowed_mime_types
  from storage.buckets b where b.id = 's23-package-flyers';
  if found then
    if v_public or coalesce(v_file_size_limit, 0) < 12582912 or
       not coalesce(v_allowed_mime_types, array[]::text[]) @> array['text/html', 'image/png'] then
      raise exception 'Existing s23-package-flyers bucket has incompatible access or limits';
    end if;
  else
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('s23-package-flyers', 's23-package-flyers', false, 12582912, array['text/html', 'image/png']);
  end if;
end;
$$;

create table public.package_flyer_operations (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  request_id uuid not null,
  expected_package_updated_at timestamptz not null,
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
  unique (package_id, request_id),
  check (html_path = package_id::text || '/' || request_id::text || '.html'),
  check (png_path = package_id::text || '/' || request_id::text || '.png')
);

create table public.package_flyer_attachments (
  package_id uuid primary key references public.packages(id) on delete cascade,
  operation_id uuid not null unique references public.package_flyer_operations(id) on delete cascade,
  revision integer not null check (revision > 0),
  saved_at timestamptz not null default now()
);

create table public.package_flyer_cleanup_queue (
  object_path text primary key,
  operation_id uuid,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  leased_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  check (object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(html|png)$')
);

create index package_flyer_cleanup_due_idx
  on public.package_flyer_cleanup_queue (next_attempt_at, created_at)
  where leased_at is null;

alter table public.package_flyer_operations enable row level security;
alter table public.package_flyer_attachments enable row level security;
alter table public.package_flyer_cleanup_queue enable row level security;

revoke all on table public.package_flyer_operations from public, anon, authenticated;
revoke all on table public.package_flyer_attachments from public, anon, authenticated;
revoke all on table public.package_flyer_cleanup_queue from public, anon, authenticated;
grant select, insert, update, delete on table public.package_flyer_operations to service_role;
grant select, insert, update, delete on table public.package_flyer_attachments to service_role;
grant select, insert, update, delete on table public.package_flyer_cleanup_queue to service_role;

create or replace function public.begin_package_flyer_upload(
  p_package_id uuid,
  p_package_updated_at timestamptz,
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
  v_operation public.package_flyer_operations%rowtype;
begin
  select p.updated_at into v_updated_at
  from public.packages as p
  where p.id = p_package_id
  for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if v_updated_at is distinct from p_package_updated_at then
    return jsonb_build_object('status', 'conflict');
  end if;

  select o.* into v_operation
  from public.package_flyer_operations as o
  where o.package_id = p_package_id and o.request_id = p_request_id
  for update;
  if found then
    if v_operation.expected_package_updated_at is distinct from p_package_updated_at or
       v_operation.expected_revision <> p_expected_revision then
      return jsonb_build_object('status', 'conflict');
    end if;
    if v_operation.status = 'published' then
      if exists (select 1 from public.package_flyer_attachments a where a.package_id = p_package_id and a.operation_id = v_operation.id) then
        return jsonb_build_object('status', 'published', 'revision', (select a.revision from public.package_flyer_attachments a where a.package_id = p_package_id));
      end if;
      return jsonb_build_object('status', 'conflict');
    end if;
    select coalesce(a.revision, 0) into v_revision
    from public.package_flyer_attachments a where a.package_id = p_package_id;
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
  from public.package_flyer_attachments as a
  where a.package_id = p_package_id;
  v_revision := coalesce(v_revision, 0);
  if v_revision <> p_expected_revision then return jsonb_build_object('status', 'conflict'); end if;

  insert into public.package_flyer_operations (
    package_id, request_id, expected_package_updated_at, expected_revision, html_path, png_path
  ) values (
    p_package_id, p_request_id, p_package_updated_at, p_expected_revision,
    p_package_id::text || '/' || p_request_id::text || '.html',
    p_package_id::text || '/' || p_request_id::text || '.png'
  ) returning * into v_operation;
  return jsonb_build_object('status', 'ready', 'operation_id', v_operation.id,
    'html_path', v_operation.html_path, 'png_path', v_operation.png_path);
end;
$$;

create or replace function public.mark_package_flyer_uploaded(
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
  v_operation public.package_flyer_operations%rowtype;
begin
  if p_html_sha256 is null or p_png_sha256 is null or p_html_bytes is null or p_png_bytes is null or
     p_html_sha256 !~ '^[0-9a-f]{64}$' or p_png_sha256 !~ '^[0-9a-f]{64}$' or
     p_html_bytes not between 1 and 10485760 or p_png_bytes not between 1 and 12582912 then
    return jsonb_build_object('status', 'invalid');
  end if;
  select o.* into v_operation
  from public.package_flyer_operations o
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
  update public.package_flyer_operations
  set status = 'uploaded', html_sha256 = p_html_sha256, png_sha256 = p_png_sha256,
      html_bytes = p_html_bytes, png_bytes = p_png_bytes, updated_at = now()
  where id = v_operation.id;
  return jsonb_build_object('status', 'uploaded');
end;
$$;

create or replace function public.publish_package_flyer(
  p_package_id uuid,
  p_package_updated_at timestamptz,
  p_expected_revision integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.package_flyer_operations%rowtype;
  v_package_updated_at timestamptz;
  v_revision integer;
begin
  select p.updated_at into v_package_updated_at
  from public.packages p where p.id = p_package_id for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;

  select o.* into v_operation
  from public.package_flyer_operations o
  where o.package_id = p_package_id and o.request_id = p_request_id
  for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if v_operation.expected_package_updated_at is distinct from p_package_updated_at or
     v_operation.expected_revision <> p_expected_revision then
    return jsonb_build_object('status', 'conflict');
  end if;
  if v_operation.status = 'published' then
    select a.revision into v_revision from public.package_flyer_attachments a
    where a.package_id = v_operation.package_id and a.operation_id = v_operation.id;
    if found then return jsonb_build_object('status', 'idempotent', 'revision', v_revision); end if;
    return jsonb_build_object('status', 'conflict');
  end if;
  if v_operation.status <> 'uploaded' then return jsonb_build_object('status', 'invalid_state'); end if;

  select a.revision into v_revision from public.package_flyer_attachments a where a.package_id = v_operation.package_id;
  v_revision := coalesce(v_revision, 0);
  if v_package_updated_at is distinct from v_operation.expected_package_updated_at or v_revision <> v_operation.expected_revision then
    update public.package_flyer_operations set status = 'failed', updated_at = now() where id = v_operation.id;
    insert into public.package_flyer_cleanup_queue (object_path, operation_id)
    values (v_operation.html_path, v_operation.id), (v_operation.png_path, v_operation.id)
    on conflict (object_path) do nothing;
    return jsonb_build_object('status', 'conflict');
  end if;

  if v_revision > 0 then
    insert into public.package_flyer_cleanup_queue (object_path, operation_id)
    select old.html_path, old.id from public.package_flyer_attachments a
    join public.package_flyer_operations old on old.id = a.operation_id
    where a.package_id = v_operation.package_id
    union all
    select old.png_path, old.id from public.package_flyer_attachments a
    join public.package_flyer_operations old on old.id = a.operation_id
    where a.package_id = v_operation.package_id
    on conflict (object_path) do nothing;
  end if;

  insert into public.package_flyer_attachments (package_id, operation_id, revision, saved_at)
  values (v_operation.package_id, v_operation.id, v_revision + 1, now())
  on conflict (package_id) do update set
    operation_id = excluded.operation_id, revision = excluded.revision, saved_at = excluded.saved_at;
  update public.package_flyer_operations set status = 'published', updated_at = now() where id = v_operation.id;
  return jsonb_build_object('status', 'published', 'revision', v_revision + 1);
end;
$$;

create or replace function public.fail_package_flyer_upload(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.package_flyer_operations%rowtype;
begin
  select o.* into v_operation from public.package_flyer_operations o where o.request_id = p_request_id for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if v_operation.status = 'published' then return jsonb_build_object('status', 'published'); end if;
  update public.package_flyer_operations set status = 'failed', updated_at = now() where id = v_operation.id;
  insert into public.package_flyer_cleanup_queue (object_path, operation_id)
  values (v_operation.html_path, v_operation.id), (v_operation.png_path, v_operation.id)
  on conflict (object_path) do nothing;
  return jsonb_build_object('status', 'failed');
end;
$$;

create or replace function public.claim_package_flyer_cleanup(p_limit integer default 50)
returns table(object_path text, operation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
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
    where q.next_attempt_at <= now() and (q.leased_at is null or q.leased_at < now() - interval '10 minutes')
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

create or replace function public.finish_package_flyer_cleanup(
  p_object_path text,
  p_success boolean,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation_id uuid;
begin
  select q.operation_id into v_operation_id from public.package_flyer_cleanup_queue q where q.object_path = p_object_path;
  if not found then return jsonb_build_object('status', 'missing'); end if;
  if p_success then
    delete from public.package_flyer_cleanup_queue where object_path = p_object_path;
    if v_operation_id is not null and not exists (
      select 1 from public.package_flyer_attachments a where a.operation_id = v_operation_id
    ) and not exists (
      select 1 from public.package_flyer_cleanup_queue q where q.operation_id = v_operation_id
    ) then
      delete from public.package_flyer_operations where id = v_operation_id;
    end if;
    return jsonb_build_object('status', 'deleted');
  end if;
  update public.package_flyer_cleanup_queue
  set attempts = attempts + 1,
      next_attempt_at = now() + make_interval(mins => least(1440, power(2, least(attempts + 1, 10))::integer)),
      leased_at = null,
      last_error = left(coalesce(p_error_code, 'storage_error'), 80)
  where object_path = p_object_path;
  return jsonb_build_object('status', 'retry');
end;
$$;

create or replace function public.enqueue_package_flyer_cleanup_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.package_flyer_cleanup_queue (object_path, operation_id)
  select o.html_path, o.id from public.package_flyer_operations o where o.package_id = old.id
  union all
  select o.png_path, o.id from public.package_flyer_operations o where o.package_id = old.id
  on conflict (object_path) do nothing;
  return old;
end;
$$;

create trigger packages_enqueue_flyer_cleanup
before delete on public.packages
for each row execute function public.enqueue_package_flyer_cleanup_before_delete();

revoke all on function public.begin_package_flyer_upload(uuid, timestamptz, integer, uuid) from public, anon, authenticated;
revoke all on function public.mark_package_flyer_uploaded(uuid, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.publish_package_flyer(uuid, timestamptz, integer, uuid) from public, anon, authenticated;
revoke all on function public.fail_package_flyer_upload(uuid) from public, anon, authenticated;
revoke all on function public.claim_package_flyer_cleanup(integer) from public, anon, authenticated;
revoke all on function public.finish_package_flyer_cleanup(text, boolean, text) from public, anon, authenticated;
revoke all on function public.enqueue_package_flyer_cleanup_before_delete() from public, anon, authenticated, service_role;
grant execute on function public.begin_package_flyer_upload(uuid, timestamptz, integer, uuid) to service_role;
grant execute on function public.mark_package_flyer_uploaded(uuid, text, text, integer, integer) to service_role;
grant execute on function public.publish_package_flyer(uuid, timestamptz, integer, uuid) to service_role;
grant execute on function public.fail_package_flyer_upload(uuid) to service_role;
grant execute on function public.claim_package_flyer_cleanup(integer) to service_role;
grant execute on function public.finish_package_flyer_cleanup(text, boolean, text) to service_role;

comment on table public.package_flyer_operations is 'Server-rendered immutable HTML/PNG upload attempts for package flyer attachments.';
comment on table public.package_flyer_attachments is 'Pointer to the only current flyer attachment for each package.';
comment on table public.package_flyer_cleanup_queue is 'Durable tombstones for removing superseded or orphaned flyer objects through the Storage API.';
