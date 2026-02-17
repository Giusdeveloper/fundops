-- Estende fundops_admin_audit con campi per audit dettagliato
-- Esegui nel SQL Editor di Supabase

ALTER TABLE public.fundops_admin_audit
  ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entity TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID;

-- Per backward compatibility: target_id resta, target_user_id per user-target
COMMENT ON COLUMN public.fundops_admin_audit.target_user_id IS 'Utente target dell''azione (profilo/permessi modificati)';
COMMENT ON COLUMN public.fundops_admin_audit.entity IS 'Entità modificata: profile, permissions, seat, investor_account';
COMMENT ON COLUMN public.fundops_admin_audit.entity_id IS 'ID entità specifica (membership_id, account_id, etc)';
