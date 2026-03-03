CREATE TABLE IF NOT EXISTS public.fundops_drive_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.fundops_companies(id) on delete cascade,
  provider text not null check (provider = 'google_drive'),
  drive_kind text not null check (drive_kind in ('my_drive', 'shared_drive')),
  shared_drive_id text null,
  root_folder_id text null,
  root_folder_name text null,
  status text not null default 'connected' check (status in ('connected', 'error', 'disconnected')),
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  UNIQUE(company_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_fundops_drive_connections_company
  ON public.fundops_drive_connections(company_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_fundops_drive_connections_updated_at ON public.fundops_drive_connections;
CREATE TRIGGER trg_fundops_drive_connections_updated_at
BEFORE UPDATE ON public.fundops_drive_connections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.fundops_drive_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drive_connections_select ON public.fundops_drive_connections;
CREATE POLICY drive_connections_select ON public.fundops_drive_connections
FOR SELECT TO authenticated
USING (
  public.is_imment_staff()
  OR public.is_company_admin(company_id)
  OR public.is_company_member(company_id)
);

DROP POLICY IF EXISTS drive_connections_upsert ON public.fundops_drive_connections;
CREATE POLICY drive_connections_upsert ON public.fundops_drive_connections
FOR INSERT TO authenticated
WITH CHECK (
  public.is_imment_staff()
  OR public.is_company_admin(company_id)
);

DROP POLICY IF EXISTS drive_connections_update ON public.fundops_drive_connections;
CREATE POLICY drive_connections_update ON public.fundops_drive_connections
FOR UPDATE TO authenticated
USING (
  public.is_imment_staff()
  OR public.is_company_admin(company_id)
)
WITH CHECK (
  public.is_imment_staff()
  OR public.is_company_admin(company_id)
);

