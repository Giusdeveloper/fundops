-- Allinea i permessi al flusso onboarding attuale:
-- 1. un utente senza ruolo puo' creare la prima company e viene promosso a founder
-- 2. la creazione supporter richiede un seat attivo sulla company, non necessariamente role=company_admin

CREATE OR REPLACE FUNCTION public.create_company_with_admin_seat(
  p_name TEXT,
  p_legal_name TEXT,
  p_vat_number TEXT,
  p_address TEXT
)
RETURNS public.fundops_companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_company public.fundops_companies;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT role_global INTO v_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_role = 'investor' THEN
    RAISE EXCEPTION 'insufficient permissions';
  END IF;

  IF v_role IS NULL THEN
    UPDATE public.profiles
    SET role_global = 'founder'
    WHERE id = v_user_id;
    v_role := 'founder';
  END IF;

  IF v_role NOT IN ('imment_admin', 'imment_operator', 'founder') THEN
    RAISE EXCEPTION 'insufficient permissions';
  END IF;

  INSERT INTO public.fundops_companies (name, legal_name, vat_number, address)
  VALUES (p_name, p_legal_name, p_vat_number, p_address)
  RETURNING * INTO v_company;

  INSERT INTO public.fundops_company_users (user_id, company_id, role, is_active)
  VALUES (v_user_id, v_company.id, 'company_admin', true)
  ON CONFLICT (user_id, company_id)
  DO UPDATE SET role = EXCLUDED.role, is_active = true;

  RETURN v_company;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_fundops_investor(
  p_company_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_category TEXT,
  p_investor_type TEXT,
  p_linkedin TEXT,
  p_notes TEXT
)
RETURNS public.fundops_investors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_is_active BOOLEAN;
  v_investor public.fundops_investors;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT role_global, is_active INTO v_role, v_is_active
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'access disabled';
  END IF;

  IF v_role NOT IN ('imment_admin', 'imment_operator') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.fundops_company_users cu
      WHERE cu.user_id = v_user_id
        AND cu.company_id = p_company_id
        AND cu.is_active = true
    ) THEN
      RAISE EXCEPTION 'insufficient permissions';
    END IF;
  END IF;

  INSERT INTO public.fundops_investors (
    company_id,
    client_company_id,
    full_name,
    email,
    phone,
    category,
    investor_type,
    linkedin,
    notes
  )
  VALUES (
    p_company_id,
    p_company_id,
    p_full_name,
    p_email,
    p_phone,
    p_category,
    p_investor_type,
    p_linkedin,
    p_notes
  )
  RETURNING * INTO v_investor;

  RETURN v_investor;
END;
$$;
