CREATE TABLE IF NOT EXISTS public.fundops_provider_tokens (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.fundops_companies(id) on delete cascade,
  provider text not null check (provider = 'google_drive'),
  access_token text null,
  refresh_token text null,
  expiry timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  UNIQUE(company_id, provider)
);

ALTER TABLE public.fundops_provider_tokens ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS provider_tokens_none ON public.fundops_provider_tokens;
CREATE POLICY provider_tokens_none
ON public.fundops_provider_tokens
FOR ALL TO authenticated
USING (false)
WITH CHECK (false);

DROP TRIGGER IF EXISTS trg_fundops_provider_tokens_updated_at ON public.fundops_provider_tokens;
CREATE TRIGGER trg_fundops_provider_tokens_updated_at
BEFORE UPDATE ON public.fundops_provider_tokens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
