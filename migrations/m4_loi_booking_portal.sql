-- M4.1 Booking portal: loi_signed_name + archived status per LOI master

-- 1. lois_signed_name su fundops_investor_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fundops_investor_accounts' AND column_name = 'loi_signed_name'
  ) THEN
    ALTER TABLE public.fundops_investor_accounts ADD COLUMN loi_signed_name TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.fundops_investor_accounts.loi_signed_name IS 'Nome firmato sulla LOI (portal booking)';

-- Nota: LOI master = SELECT * FROM fundops_lois WHERE company_id=X AND status!='archived' ORDER BY created_at DESC LIMIT 1
