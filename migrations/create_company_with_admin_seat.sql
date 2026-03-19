-- Crea company + seat admin per l'utente autenticato (founder o team Imment)
-- Eseguire via migration Supabase

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

  IF v_role IS NULL OR v_role NOT IN ('imment_admin', 'imment_operator', 'founder') THEN
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

GRANT EXECUTE ON FUNCTION public.create_company_with_admin_seat(
  TEXT,
  TEXT,
  TEXT,
  TEXT
) TO authenticated;
