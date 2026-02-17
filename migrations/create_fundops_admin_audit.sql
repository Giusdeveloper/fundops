-- Tabella audit per azioni admin (se non esiste già)
-- Esegui nel SQL Editor di Supabase

CREATE TABLE IF NOT EXISTS public.fundops_admin_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT,
  action TEXT NOT NULL,
  target_id UUID,
  target_type TEXT,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fundops_admin_audit_admin_id ON public.fundops_admin_audit(admin_id);
CREATE INDEX IF NOT EXISTS idx_fundops_admin_audit_target ON public.fundops_admin_audit(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_fundops_admin_audit_created ON public.fundops_admin_audit(created_at DESC);

ALTER TABLE public.fundops_admin_audit ENABLE ROW LEVEL SECURITY;

-- Nessuna policy = accesso solo via service role (bypassa RLS)
-- Le API admin usano supabaseServer (service role) per scrivere l'audit

COMMENT ON TABLE public.fundops_admin_audit IS 'Audit log azioni admin su utenti e permessi';
