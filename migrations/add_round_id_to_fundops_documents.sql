alter table public.fundops_documents
add column if not exists round_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fundops_documents_round_id_fkey'
  ) then
    alter table public.fundops_documents
      add constraint fundops_documents_round_id_fkey
      foreign key (round_id)
      references public.fundops_rounds(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_fundops_documents_round_id
on public.fundops_documents(round_id);
