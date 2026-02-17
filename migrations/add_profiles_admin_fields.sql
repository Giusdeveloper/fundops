-- Aggiunge colonne admin a public.profiles
-- Esegui nel SQL Editor di Supabase

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS disabled_reason TEXT,
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.profiles.is_active IS 'Utente attivo (false = disabilitato)';
COMMENT ON COLUMN public.profiles.disabled_reason IS 'Motivo disabilitazione quando is_active=false';
COMMENT ON COLUMN public.profiles.disabled_at IS 'Timestamp disabilitazione';
