-- Portal LOI signing: loi_signed_at + trigger per lifecycle_stage (registered -> loi_signed)

-- 1. Aggiungi loi_signed_at a fundops_investor_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fundops_investor_accounts' AND column_name = 'loi_signed_at'
  ) THEN
    ALTER TABLE public.fundops_investor_accounts ADD COLUMN loi_signed_at TIMESTAMPTZ;
  END IF;
END $$;

-- 2. Trigger: permette solo transizione registered -> loi_signed
CREATE OR REPLACE FUNCTION public.fundops_investor_accounts_lifecycle_check()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se non stiamo cambiando lifecycle_stage, ok
  IF OLD.lifecycle_stage IS NOT DISTINCT FROM NEW.lifecycle_stage THEN
    RETURN NEW;
  END IF;

  -- Permesso: registered o active -> loi_signed (active = legacy default)
  IF NEW.lifecycle_stage = 'loi_signed' AND OLD.lifecycle_stage IN ('registered', 'active') THEN
    RETURN NEW;
  END IF;

  -- Permesso: nessun cambio verso indietro se già loi_signed (conservativo)
  IF OLD.lifecycle_stage = 'loi_signed' THEN
    IF NEW.lifecycle_stage = 'loi_signed' THEN
      RETURN NEW; -- stesso stato, ok
    END IF;
    RAISE EXCEPTION 'lifecycle_stage non può tornare indietro da loi_signed';
  END IF;

  -- Blocca altre transizioni (es. active -> loi_signed senza passare da registered)
  RAISE EXCEPTION 'Transizione lifecycle_stage non consentita: % -> %',
    OLD.lifecycle_stage, NEW.lifecycle_stage;
END;
$$;

DROP TRIGGER IF EXISTS trg_fundops_investor_accounts_lifecycle ON public.fundops_investor_accounts;
CREATE TRIGGER trg_fundops_investor_accounts_lifecycle
  BEFORE UPDATE OF lifecycle_stage ON public.fundops_investor_accounts
  FOR EACH ROW
  WHEN (OLD.lifecycle_stage IS DISTINCT FROM NEW.lifecycle_stage)
  EXECUTE FUNCTION public.fundops_investor_accounts_lifecycle_check();

COMMENT ON COLUMN public.fundops_investor_accounts.loi_signed_at IS 'Data/ora firma LOI dal portal';
