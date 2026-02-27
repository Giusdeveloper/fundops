create table if not exists public.fundops_investments (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.fundops_companies(id) on delete cascade,
  round_id uuid not null references public.fundops_rounds(id) on delete cascade,
  investor_id uuid not null references public.fundops_investors(id) on delete cascade,

  amount numeric not null default 0,
  currency text not null default 'EUR',

  status text not null default 'draft' check (status in ('draft','submitted','verified','rejected')),

  submitted_at timestamptz null,
  verified_at timestamptz null,
  rejected_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_investment_per_investor_round
  on public.fundops_investments(investor_id, round_id);

create index if not exists idx_investments_company_round_status
  on public.fundops_investments(company_id, round_id, status);

create index if not exists idx_investments_investor
  on public.fundops_investments(investor_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_investments_updated_at on public.fundops_investments;
create trigger trg_investments_updated_at
before update on public.fundops_investments
for each row execute procedure public.set_updated_at();
