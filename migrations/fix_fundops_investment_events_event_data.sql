-- Align fundops_investment_events to event_data/created_by schema
-- Safe on existing environments with legacy columns

alter table public.fundops_investment_events
  add column if not exists event_data jsonb;

alter table public.fundops_investment_events
  add column if not exists created_by text;

update public.fundops_investment_events
set event_data = jsonb_build_object(
  'from_status', from_status,
  'to_status', to_status,
  'note', note
)
where event_data is null
  and (
    from_status is not null
    or to_status is not null
    or note is not null
  );

update public.fundops_investment_events
set event_data = '{}'::jsonb
where event_data is null;

do $$
declare
  created_by_type text;
begin
  select data_type
  into created_by_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'fundops_investment_events'
    and column_name = 'created_by';

  if created_by_type = 'uuid' then
    execute $q$
      update public.fundops_investment_events
      set created_by = actor_user_id
      where created_by is null
        and actor_user_id is not null
    $q$;
  else
    execute $q$
      update public.fundops_investment_events
      set created_by = actor_user_id::text
      where created_by is null
        and actor_user_id is not null
    $q$;
  end if;
end $$;

alter table public.fundops_investment_events
  alter column event_data set default '{}'::jsonb;

alter table public.fundops_investment_events
  drop column if exists from_status;

alter table public.fundops_investment_events
  drop column if exists to_status;

alter table public.fundops_investment_events
  drop column if exists note;

alter table public.fundops_investment_events
  drop column if exists actor_user_id;
