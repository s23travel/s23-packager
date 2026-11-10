-- PL/pgSQL resolves `object_path` both as the function's OUT parameter and as
-- the queue column inside ON CONFLICT; prefer the column explicitly.
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
