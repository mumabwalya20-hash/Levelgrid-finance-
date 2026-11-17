begin;

create sequence finance_private.sync_version;

alter table public.finance_departments add column sync_version bigint not null default 0;
alter table public.finance_daily_records add column sync_version bigint not null default 0;
alter table public.finance_shared_expenses add column sync_version bigint not null default 0;

update public.finance_departments set sync_version = nextval('finance_private.sync_version');
update public.finance_daily_records set sync_version = nextval('finance_private.sync_version');
update public.finance_shared_expenses set sync_version = nextval('finance_private.sync_version');

create index finance_department_changes on public.finance_departments (owner_id, sync_version);
create index finance_daily_record_changes on public.finance_daily_records (owner_id, sync_version);
create index finance_shared_expense_changes on public.finance_shared_expenses (owner_id, sync_version);

create table finance_private.sync_receipts (
  owner_id uuid not null references finance_private.owner (user_id) on delete restrict,
  operation_id uuid not null,
  operation_hash bytea not null,
  primary key (owner_id, operation_id)
);
alter table finance_private.sync_receipts enable row level security;
revoke all on finance_private.sync_receipts from public, anon, authenticated;
revoke all on sequence finance_private.sync_version from public, anon, authenticated;

create function finance_private.stamp_sync_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Allocate change versions in commit order for this single-owner application.
  perform pg_advisory_xact_lock(20261117, 4);
  new.sync_version := nextval('finance_private.sync_version');
  if tg_op = 'UPDATE' then
    new.revision := old.revision + 1;
  end if;
  return new;
end;
$$;
revoke all on function finance_private.stamp_sync_version() from public, anon, authenticated;

create trigger finance_department_change
  before insert or update on public.finance_departments
  for each row execute function finance_private.stamp_sync_version();
create trigger finance_daily_record_change
  before insert or update on public.finance_daily_records
  for each row execute function finance_private.stamp_sync_version();
create trigger finance_shared_expense_change
  before insert or update on public.finance_shared_expenses
  for each row execute function finance_private.stamp_sync_version();

create function finance_private.apply_sync_record(
  p_owner uuid, p_entity text, p_record jsonb, p_expected integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  department public.finance_departments;
  daily public.finance_daily_records;
  shared public.finance_shared_expenses;
begin
  case p_entity
    when 'department' then
      department := jsonb_populate_record(null::public.finance_departments, p_record);
      if p_expected is null then
        insert into public.finance_departments (
          owner_id, id, name, position, created_at, updated_at, deactivated_at, revision
        ) values (
          p_owner, department.id, department.name, department.position, department.created_at,
          department.updated_at, department.deactivated_at, department.revision
        ) on conflict do nothing;
      else
        update public.finance_departments as stored
        set name = department.name, position = department.position, updated_at = department.updated_at,
            deactivated_at = department.deactivated_at
        where stored.owner_id = p_owner and stored.id = department.id
          and stored.revision = p_expected and stored.created_at = department.created_at;
      end if;
    when 'daily-record' then
      daily := jsonb_populate_record(null::public.finance_daily_records, p_record);
      if p_expected is null then
        insert into public.finance_daily_records (
          owner_id, id, department_id, business_date, sales_minor, expenses_minor,
          expense_comment, updated_at, revision
        ) values (
          p_owner, daily.id, daily.department_id, daily.business_date, daily.sales_minor,
          daily.expenses_minor, daily.expense_comment, daily.updated_at, daily.revision
        ) on conflict do nothing;
      else
        update public.finance_daily_records as stored
        set sales_minor = daily.sales_minor, expenses_minor = daily.expenses_minor,
            expense_comment = daily.expense_comment, updated_at = daily.updated_at
        where stored.owner_id = p_owner and stored.id = daily.id
          and stored.revision = p_expected and stored.department_id = daily.department_id
          and stored.business_date = daily.business_date;
      end if;
    when 'shared-expense' then
      shared := jsonb_populate_record(null::public.finance_shared_expenses, p_record);
      if p_expected is null then
        insert into public.finance_shared_expenses (
          owner_id, id, business_date, expenses_minor, expense_comment, updated_at, revision
        ) values (
          p_owner, shared.id, shared.business_date, shared.expenses_minor,
          shared.expense_comment, shared.updated_at, shared.revision
        ) on conflict do nothing;
      else
        update public.finance_shared_expenses as stored
        set expenses_minor = shared.expenses_minor, expense_comment = shared.expense_comment,
            updated_at = shared.updated_at
        where stored.owner_id = p_owner and stored.id = shared.id
          and stored.revision = p_expected and stored.business_date = shared.business_date;
      end if;
    else
      return false;
  end case;
  return found;
end;
$$;
revoke all on function finance_private.apply_sync_record(uuid, text, jsonb, integer) from public, anon, authenticated;

create function public.finance_sync_upload(p_operations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_uuid uuid := finance_private.current_owner_id();
  operation jsonb;
  record_data jsonb;
  operation_uuid uuid;
  record_uuid uuid;
  entity text;
  expected integer;
  proposed integer;
  payload_hash bytea;
  previous_hash bytea;
  applied boolean;
  acknowledged uuid[] := '{}';
  conflict jsonb;
begin
  if owner_uuid is null then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_operations) is distinct from 'array' then
    raise exception 'Send a batch of sync operations' using errcode = '22023';
  end if;
  if jsonb_array_length(p_operations) > 40 then
    raise exception 'Batch exceeds 40 operations' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(20261117, 4);
  for operation in select value from jsonb_array_elements(p_operations)
  loop
    operation_uuid := (operation ->> 'id')::uuid;
    record_uuid := (operation ->> 'recordId')::uuid;
    entity := operation ->> 'entity';
    expected := (operation ->> 'expectedRevision')::integer;
    record_data := operation -> 'record';
    proposed := (record_data ->> 'revision')::integer;
    if operation_uuid is null or record_uuid is null or entity is null
      or not operation ? 'expectedRevision'
      or entity not in ('department', 'daily-record', 'shared-expense')
      or (record_data ->> 'id')::uuid is distinct from record_uuid
      or (expected is not null and expected < 1)
      or proposed::bigint is distinct from coalesce(expected::bigint, 0) + 1
    then
      raise exception 'Invalid sync operation' using errcode = '22023';
    end if;

    payload_hash := sha256(convert_to(operation::text, 'UTF8'));
    select receipt.operation_hash into previous_hash
    from finance_private.sync_receipts as receipt
    where receipt.owner_id = owner_uuid and receipt.operation_id = operation_uuid;

    if found then
      applied := previous_hash = payload_hash;
    else
      begin
        applied := finance_private.apply_sync_record(owner_uuid, entity, record_data, expected);
      exception when integrity_constraint_violation then
        applied := false;
      end;
      if applied then
        insert into finance_private.sync_receipts (owner_id, operation_id, operation_hash)
        values (owner_uuid, operation_uuid, payload_hash);
      end if;
    end if;

    if not applied then
      conflict := jsonb_build_object('id', operation_uuid, 'entity', entity, 'recordId', record_uuid);
      exit;
    end if;
    acknowledged := array_append(acknowledged, operation_uuid);
  end loop;

  return jsonb_build_object('acknowledged', acknowledged, 'conflict', conflict);
end;
$$;

create function public.finance_sync_download(p_after bigint, p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner_uuid uuid := finance_private.current_owner_id();
  response jsonb;
begin
  if owner_uuid is null then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_after is null or p_after < 0 or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'Invalid sync page' using errcode = '22023';
  end if;

  with candidates as (
    (select d.sync_version, 'department' as entity, to_jsonb(d) - 'owner_id' - 'sync_version' as record
     from public.finance_departments as d where d.owner_id = owner_uuid and d.sync_version > p_after
     order by d.sync_version limit p_limit)
    union all
    (select d.sync_version, 'daily-record', to_jsonb(d) - 'owner_id' - 'sync_version'
     from public.finance_daily_records as d where d.owner_id = owner_uuid and d.sync_version > p_after
     order by d.sync_version limit p_limit)
    union all
    (select s.sync_version, 'shared-expense', to_jsonb(s) - 'owner_id' - 'sync_version'
     from public.finance_shared_expenses as s where s.owner_id = owner_uuid and s.sync_version > p_after
     order by s.sync_version limit p_limit)
  ), page as (
    select * from candidates order by sync_version limit p_limit
  )
  select jsonb_build_object(
    'cursor', coalesce(max(sync_version), p_after),
    'changes', coalesce(jsonb_agg(jsonb_build_object('entity', entity, 'record', record) order by sync_version), '[]')
  ) into response from page;

  return response;
end;
$$;

revoke all on function public.finance_sync_upload(jsonb), public.finance_sync_download(bigint, integer)
  from public, anon, authenticated;
grant execute on function public.finance_sync_upload(jsonb), public.finance_sync_download(bigint, integer)
  to authenticated;

notify pgrst, 'reload schema';
commit;
