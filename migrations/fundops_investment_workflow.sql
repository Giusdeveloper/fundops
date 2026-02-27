-- FundOps Issuance workflow: status evolution + audit events

create table if not exists public.fundops_investment_events (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.fundops_investments(id) on delete cascade,
  company_id uuid null references public.fundops_companies(id) on delete cascade,
  event_type text not null,
  event_data jsonb null default '{}'::jsonb,
  created_by text null,
  created_at timestamptz not null default now()
);

alter table public.fundops_investment_events
  add column if not exists company_id uuid null references public.fundops_companies(id) on delete cascade;

alter table public.fundops_investment_events
  add column if not exists event_data jsonb;

alter table public.fundops_investment_events
  add column if not exists created_by text;

update public.fundops_investment_events e
set company_id = i.company_id
from public.fundops_investments i
where e.company_id is null
  and e.investment_id = i.id;

update public.fundops_investment_events
set event_data = '{}'::jsonb
where event_data is null;

create index if not exists idx_investment_events_investment_id
  on public.fundops_investment_events(investment_id, created_at desc);

create index if not exists idx_investment_events_company_id
  on public.fundops_investment_events(company_id, created_at desc);

alter table public.fundops_investment_events enable row level security;

drop policy if exists "fundops_investment_events_select" on public.fundops_investment_events;
create policy "fundops_investment_events_select" on public.fundops_investment_events
for select
using (
  (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.role_global in ('imment_admin', 'imment_operator')
    )
  )
  or (
    exists (
      select 1
      from public.fundops_company_users cu
      where cu.company_id = fundops_investment_events.company_id
        and cu.user_id = auth.uid()
        and cu.role = 'company_admin'
        and cu.is_active = true
    )
  )
);

drop policy if exists "fundops_investment_events_insert" on public.fundops_investment_events;
create policy "fundops_investment_events_insert" on public.fundops_investment_events
for insert
with check (
  (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.role_global in ('imment_admin', 'imment_operator')
    )
  )
  or (
    exists (
      select 1
      from public.fundops_company_users cu
      where cu.company_id = fundops_investment_events.company_id
        and cu.user_id = auth.uid()
        and cu.role = 'company_admin'
        and cu.is_active = true
    )
  )
);

alter table public.fundops_investments
  drop constraint if exists fundops_investments_status_check;

alter table public.fundops_investments
  add constraint fundops_investments_status_check
  check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected'));

alter table public.fundops_investment_events
  alter column company_id set not null;
