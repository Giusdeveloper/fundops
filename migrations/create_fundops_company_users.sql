-- Seats: membership utente in aziende (company users)
-- Esegui nel SQL Editor di Supabase

CREATE TABLE IF NOT EXISTS public.fundops_company_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.fundops_companies(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  disabled_reason TEXT,
  disabled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_fundops_company_users_user_id ON public.fundops_company_users(user_id);
CREATE INDEX IF NOT EXISTS idx_fundops_company_users_company_id ON public.fundops_company_users(company_id);

ALTER TABLE public.fundops_company_users ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.fundops_company_users IS 'Membership utente-azienda (seats)';
