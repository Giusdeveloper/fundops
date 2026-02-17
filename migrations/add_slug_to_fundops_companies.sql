-- Aggiunge slug a fundops_companies per URL portal
-- Esegui nel SQL Editor di Supabase

ALTER TABLE public.fundops_companies
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Popola slug da id per esistenti (slug = primi 8 char di uuid)
UPDATE public.fundops_companies
SET slug = LOWER(REPLACE(SUBSTRING(id::text, 1, 8), '-', ''))
WHERE slug IS NULL;

-- Indice per lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_fundops_companies_slug
  ON public.fundops_companies(slug)
  WHERE slug IS NOT NULL;

COMMENT ON COLUMN public.fundops_companies.slug IS 'Slug per URL portal (es: /portal/abc123)';
