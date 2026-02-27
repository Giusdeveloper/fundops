-- Aggiunge first_investor_login_at a public.profiles
-- Usato per redirect post firma LOI: welcome al primo accesso, dashboard ai successivi

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_investor_login_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.profiles.first_investor_login_at IS 'Primo accesso a Investor Area dopo firma LOI';
