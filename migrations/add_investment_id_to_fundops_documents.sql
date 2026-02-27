alter table public.fundops_documents
  add column if not exists investment_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fundops_documents_investment_id_fkey'
      and conrelid = 'public.fundops_documents'::regclass
  ) then
    alter table public.fundops_documents
      add constraint fundops_documents_investment_id_fkey
      foreign key (investment_id)
      references public.fundops_investments(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_fundops_documents_investment_type
  on public.fundops_documents(investment_id, type);

create unique index if not exists uniq_fundops_documents_investment_type
  on public.fundops_documents(investment_id, type)
  where investment_id is not null;
