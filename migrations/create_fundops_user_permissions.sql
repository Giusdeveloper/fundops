-- Feature flags override per utente (null = inherit from role)
-- Esegui nel SQL Editor di Supabase

CREATE TABLE IF NOT EXISTS public.fundops_user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allow_dashboard BOOLEAN,
  allow_companies BOOLEAN,
  allow_investors BOOLEAN,
  allow_lois BOOLEAN,
  allow_issuance BOOLEAN,
  allow_onboarding BOOLEAN,
  allow_invites BOOLEAN,
  allow_broadcast BOOLEAN,
  allow_admin_panel BOOLEAN,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_fundops_user_permissions_user_id ON public.fundops_user_permissions(user_id);

ALTER TABLE public.fundops_user_permissions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.fundops_user_permissions IS 'Override permessi per utente (null=inherit, true=allow, false=deny)';
COMMENT ON COLUMN public.fundops_user_permissions.allow_dashboard IS 'null=inherit, true=allow, false=deny';
