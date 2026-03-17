-- Add legacy expiry_date for LOI compatibility
ALTER TABLE public.fundops_lois
ADD COLUMN IF NOT EXISTS expiry_date DATE NULL;

COMMENT ON COLUMN public.fundops_lois.expiry_date IS 'Legacy LOI expiry date (date-only).';
