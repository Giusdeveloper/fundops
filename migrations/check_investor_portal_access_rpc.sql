-- RPC: check_investor_portal_access
-- Verifica se l'utente ha un investor_account per la company (invite flow).
-- Se sì: crea fundops_investor_users (link user->investor) e ritorna true.
-- Se no: ritorna false (non crea nulla).

DROP FUNCTION IF EXISTS public.check_investor_portal_access(UUID);
CREATE OR REPLACE FUNCTION public.check_investor_portal_access(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_lower_email TEXT;
  v_investor_id UUID;
  v_account_exists BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT email INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN FALSE;
  END IF;

  v_lower_email := LOWER(TRIM(v_email));

  -- Trova investor per email
  SELECT id INTO v_investor_id
  FROM public.fundops_investors
  WHERE LOWER(TRIM(email)) = v_lower_email
  LIMIT 1;

  IF v_investor_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Verifica se esiste investor_account per (investor_id, company_id)
  SELECT EXISTS(
    SELECT 1 FROM public.fundops_investor_accounts
    WHERE investor_id = v_investor_id AND company_id = p_company_id
  ) INTO v_account_exists;

  IF NOT v_account_exists THEN
    RETURN FALSE;
  END IF;

  -- Assicura fundops_investor_users (user -> investor)
  INSERT INTO public.fundops_investor_users (user_id, investor_id)
  VALUES (v_user_id, v_investor_id)
  ON CONFLICT (user_id, investor_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.check_investor_portal_access(UUID) IS 'Verifica accesso portal: investor_account deve esistere (invite flow). Se sì, crea user->investor link.';

GRANT EXECUTE ON FUNCTION public.check_investor_portal_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_investor_portal_access(UUID) TO service_role;
