begin;

create schema finance_private;
revoke all on schema finance_private from public, anon, authenticated;
grant usage on schema finance_private to authenticated;

create table finance_private.owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users (id) on delete restrict
);

revoke all on finance_private.owner from public, anon, authenticated;
alter table finance_private.owner enable row level security;

create table public.finance_departments (
  owner_id uuid not null references finance_private.owner (user_id) on delete restrict,
  id uuid not null,
  name text not null check (
    name <> ''
    and name = btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))
    and lower(name) <> 'finance expenses'
  ),
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  primary key (owner_id, id)
);

create unique index finance_active_department_name
  on public.finance_departments (owner_id, lower(name))
  where deactivated_at is null;

create table public.finance_daily_records (
  owner_id uuid not null,
  id uuid not null,
  department_id uuid not null,
  business_date date not null,
  sales_minor bigint not null check (sales_minor between -9007199254740991 and 9007199254740991),
  expenses_minor bigint not null check (expenses_minor between -9007199254740991 and 9007199254740991),
  expense_comment text,
  updated_at timestamptz not null default now(),
  revision integer not null default 1 check (revision > 0),
  primary key (owner_id, id),
  unique (owner_id, department_id, business_date),
  foreign key (owner_id, department_id) references public.finance_departments (owner_id, id) on delete restrict
);

create table public.finance_shared_expenses (
  owner_id uuid not null references finance_private.owner (user_id) on delete restrict,
  id uuid not null,
  business_date date not null,
  expenses_minor bigint not null check (expenses_minor between -9007199254740991 and 9007199254740991),
  expense_comment text,
  updated_at timestamptz not null default now(),
  revision integer not null default 1 check (revision > 0),
  primary key (owner_id, id),
  unique (owner_id, business_date)
);

create function finance_private.current_owner_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select owner.user_id
  from finance_private.owner as owner
  where owner.user_id = (select auth.uid())
    and exists (
      select 1
      from auth.sessions as session
      where session.id = ((select auth.jwt()) ->> 'session_id')::uuid
        and session.user_id = owner.user_id
    );
$$;

revoke all on function finance_private.current_owner_id() from public, anon, authenticated;
grant execute on function finance_private.current_owner_id() to authenticated;

alter table public.finance_departments enable row level security;
alter table public.finance_daily_records enable row level security;
alter table public.finance_shared_expenses enable row level security;

revoke all on public.finance_departments, public.finance_daily_records, public.finance_shared_expenses
  from public, anon, authenticated;
grant select on public.finance_departments, public.finance_daily_records, public.finance_shared_expenses
  to authenticated;

create policy finance_departments_owner_read on public.finance_departments
  for select to authenticated using (owner_id = (select finance_private.current_owner_id()));
create policy finance_daily_records_owner_read on public.finance_daily_records
  for select to authenticated using (owner_id = (select finance_private.current_owner_id()));
create policy finance_shared_expenses_owner_read on public.finance_shared_expenses
  for select to authenticated using (owner_id = (select finance_private.current_owner_id()));

create function finance_private.seed_departments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.finance_departments (owner_id, id, name, position) values
    (new.user_id, '16000000-0000-4000-8000-000000000001', 'Chibombo Distributors', 1),
    (new.user_id, '16000000-0000-4000-8000-000000000002', 'Chibombo Stationery', 2),
    (new.user_id, '16000000-0000-4000-8000-000000000003', 'Chiyuni Stationery', 3),
    (new.user_id, '16000000-0000-4000-8000-000000000004', 'Factory', 4),
    (new.user_id, '16000000-0000-4000-8000-000000000005', 'Laundry', 5);
  return new;
end;
$$;

revoke all on function finance_private.seed_departments() from public, anon, authenticated;

create trigger finance_seed_owner_departments
  after insert on finance_private.owner
  for each row execute function finance_private.seed_departments();

commit;
