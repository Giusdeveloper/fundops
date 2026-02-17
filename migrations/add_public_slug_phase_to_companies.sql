-- Aggiunge public_slug e phase a fundops_companies (se non esistono)
-- Esegui nel SQL Editor di Supabase

ALTER TABLE public.fundops_companies
  ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE;

ALTER TABLE public.fundops_companies
  ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'booking';

CREATE UNIQUE INDEX IF NOT EXISTS idx_fundops_companies_public_slug
  ON public.fundops_companies(public_slug)
  WHERE public_slug IS NOT NULL;

COMMENT ON COLUMN public.fundops_companies.public_slug IS 'Slug pubblico per URL portal (es: /portal/imment-srl)';
COMMENT ON COLUMN public.fundops_companies.phase IS 'Fase corrente: booking, issuing, onboarding';
