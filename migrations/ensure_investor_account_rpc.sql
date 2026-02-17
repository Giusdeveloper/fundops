-- RPC: ensure_investor_account
-- Crea o assicura: fundops_investors (by email), fundops_investor_users, fundops_investor_accounts
-- Usa lower(email) per evitare duplicati

-- 1. Aggiungi colonne source e registered_at a fundops_investor_accounts se non esistono
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fundops_investor_accounts' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.fundops_investor_accounts ADD COLUMN source TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fundops_investor_accounts' AND column_name = 'registered_at'
  ) THEN
    ALTER TABLE public.fundops_investor_accounts ADD COLUMN registered_at TIMESTAMPTZ;
  END IF;
END $$;

-- 2. Indice per lookup per email (lower)
CREATE INDEX IF NOT EXISTS idx_fundops_investors_email_lower
ON public.fundops_investors(LOWER(TRIM(email)))
WHERE email IS NOT NULL AND email != '';

-- 3. RPC ensure_investor_account
DROP FUNCTION IF EXISTS public.ensure_investor_account(UUID);
CREATE OR REPLACE FUNCTION public.ensure_investor_account(p_company_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_full_name TEXT;
  v_lower_email TEXT;
  v_investor_id UUID;
  v_account_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non autenticato';
  END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '')
  INTO v_email, v_full_name
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Email utente non disponibile';
  END IF;

  v_lower_email := LOWER(TRIM(v_email));

  -- Trova o crea investor (dedupe per lower(email))
  SELECT id INTO v_investor_id
  FROM public.fundops_investors
  WHERE LOWER(TRIM(email)) = v_lower_email
  LIMIT 1;

  IF v_investor_id IS NULL THEN
    INSERT INTO public.fundops_investors (
      email,
      full_name,
      company_id,
      client_company_id
    )
    VALUES (v_email, NULLIF(TRIM(v_full_name), ''), p_company_id, p_company_id)
    RETURNING id INTO v_investor_id;
  END IF;

  -- Mapping user -> investor
  INSERT INTO public.fundops_investor_users (user_id, investor_id)
  VALUES (v_user_id, v_investor_id)
  ON CONFLICT (user_id, investor_id) DO NOTHING;

  -- Account investitore per company
  INSERT INTO public.fundops_investor_accounts (
    investor_id,
    company_id,
    lifecycle_stage,
    source,
    registered_at,
    is_active
  )
  VALUES (v_investor_id, p_company_id, 'registered', 'link', NOW(), true)
  ON CONFLICT (investor_id, company_id) DO UPDATE SET
    lifecycle_stage = COALESCE(public.fundops_investor_accounts.lifecycle_stage, 'registered'),
    source = COALESCE(public.fundops_investor_accounts.source, 'link'),
    registered_at = COALESCE(public.fundops_investor_accounts.registered_at, NOW()),
    updated_at = NOW()
  RETURNING id INTO v_account_id;

  RETURN v_investor_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_investor_account(UUID) IS 'Bootstrap portal: crea investor (by email), user mapping e account per company';

GRANT EXECUTE ON FUNCTION public.ensure_investor_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_investor_account(UUID) TO service_role;
