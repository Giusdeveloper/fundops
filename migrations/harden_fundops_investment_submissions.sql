-- FundOps Issuance - hardening fundops_investment_submissions
-- Binding scelto: submission per (company_id, investor_id)

-- 1) CHECK status
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fundops_investment_submissions_status_check'
  ) then
    alter table public.fundops_investment_submissions
      add constraint fundops_investment_submissions_status_check
      check (status in ('draft','submitted','under_review','approved','rejected'));
  end if;
end $$;

-- 2) amount_eur > 0
-- Normalizzazione preventiva per evitare failure su NOT NULL/CHECK
update public.fundops_investment_submissions
set amount_eur = 1
where amount_eur is null or amount_eur <= 0;

alter table public.fundops_investment_submissions
  alter column amount_eur set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fundops_investment_submissions_amount_check'
  ) then
    alter table public.fundops_investment_submissions
      add constraint fundops_investment_submissions_amount_check
      check (amount_eur > 0);
  end if;
end $$;

-- 3) Unica submission attiva per company + investor
create unique index if not exists uq_submission_active_company_investor
  on public.fundops_investment_submissions(company_id, investor_id)
  where status in ('draft','submitted','under_review');

-- 4) Indici utili
create index if not exists idx_submissions_company_status
  on public.fundops_investment_submissions(company_id, status);

create index if not exists idx_submissions_investor_status
  on public.fundops_investment_submissions(investor_id, status);
