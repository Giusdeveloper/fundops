create table if not exists public.fundops_cap_table_scenarios (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.fundops_companies(id) on delete cascade,
  round_id uuid null references public.fundops_rounds(id) on delete set null,
  name text not null,
  notes text null,
  is_baseline boolean not null default false,
  version_count integer not null default 1,
  latest_result jsonb null,
  latest_result_summary jsonb null,
  draft_input jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_fundops_cap_table_baseline_per_company_round
  on public.fundops_cap_table_scenarios(company_id, coalesce(round_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_baseline = true;

create index if not exists idx_fundops_cap_table_scenarios_company
  on public.fundops_cap_table_scenarios(company_id, updated_at desc);

create index if not exists idx_fundops_cap_table_scenarios_round
  on public.fundops_cap_table_scenarios(round_id, updated_at desc);

create table if not exists public.fundops_cap_table_scenario_versions (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.fundops_cap_table_scenarios(id) on delete cascade,
  version_number integer not null,
  input_snapshot jsonb not null,
  result_snapshot jsonb not null,
  summary_snapshot jsonb null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists uniq_fundops_cap_table_version_number
  on public.fundops_cap_table_scenario_versions(scenario_id, version_number);

create index if not exists idx_fundops_cap_table_versions_scenario
  on public.fundops_cap_table_scenario_versions(scenario_id, version_number desc);

drop trigger if exists trg_fundops_cap_table_scenarios_updated_at on public.fundops_cap_table_scenarios;
create trigger trg_fundops_cap_table_scenarios_updated_at
before update on public.fundops_cap_table_scenarios
for each row execute procedure public.set_updated_at();
