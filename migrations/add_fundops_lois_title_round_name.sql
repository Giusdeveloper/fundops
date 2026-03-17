-- Add title and round_name to fundops_lois for LOI master metadata
ALTER TABLE public.fundops_lois
ADD COLUMN IF NOT EXISTS title TEXT NULL;

ALTER TABLE public.fundops_lois
ADD COLUMN IF NOT EXISTS round_name TEXT NULL;

UPDATE public.fundops_lois
SET title = COALESCE(title, round_name, loi_number, 'LOI')
WHERE title IS NULL;
