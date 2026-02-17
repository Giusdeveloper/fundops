-- Tabella fundops_invites per inviti investitori
-- Esegui nel SQL Editor di Supabase

CREATE TABLE IF NOT EXISTS public.fundops_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'investor',
  company_id UUID NOT NULL REFERENCES public.fundops_companies(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fundops_invites_company ON public.fundops_invites(company_id);
CREATE INDEX IF NOT EXISTS idx_fundops_invites_email ON public.fundops_invites(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_fundops_invites_expires ON public.fundops_invites(expires_at);

ALTER TABLE public.fundops_invites ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.fundops_invites IS 'Inviti per investitori - token con scadenza 7 giorni';
