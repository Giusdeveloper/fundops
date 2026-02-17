-- Mapping user auth -> investor + investor accounts
-- Esegui nel SQL Editor di Supabase

-- Mapping: un utente auth può essere collegato a un investitore (fundops_investors)
CREATE TABLE IF NOT EXISTS public.fundops_investor_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES public.fundops_investors(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, investor_id)
);

-- Account investitore per company (lifecycle, active)
CREATE TABLE IF NOT EXISTS public.fundops_investor_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  investor_id UUID NOT NULL REFERENCES public.fundops_investors(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.fundops_companies(id) ON DELETE CASCADE,
  lifecycle_stage TEXT DEFAULT 'active',
  is_active BOOLEAN NOT NULL DEFAULT true,
  disabled_reason TEXT,
  disabled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(investor_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_fundops_investor_users_user_id ON public.fundops_investor_users(user_id);
CREATE INDEX IF NOT EXISTS idx_fundops_investor_accounts_investor ON public.fundops_investor_accounts(investor_id);
CREATE INDEX IF NOT EXISTS idx_fundops_investor_accounts_company ON public.fundops_investor_accounts(company_id);

ALTER TABLE public.fundops_investor_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundops_investor_accounts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.fundops_investor_users IS 'Mapping auth user -> investor';
COMMENT ON TABLE public.fundops_investor_accounts IS 'Account investitore per company (lifecycle, active)';
