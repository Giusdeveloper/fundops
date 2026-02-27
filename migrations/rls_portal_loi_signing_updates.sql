-- Portal LOI signing RLS hardening
-- Obiettivo: consentire update solo sulle righe dell'investor autenticato
-- per fundops_loi_signers e fundops_investor_accounts.

CREATE OR REPLACE FUNCTION public.current_investor_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT investor_id
  FROM public.fundops_investor_users
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

ALTER TABLE public.fundops_loi_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundops_investor_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fundops_loi_signers_update_investor" ON public.fundops_loi_signers;
CREATE POLICY "fundops_loi_signers_update_investor"
ON public.fundops_loi_signers
FOR UPDATE
USING (investor_id = public.current_investor_id())
WITH CHECK (investor_id = public.current_investor_id());

DROP POLICY IF EXISTS "fundops_investor_accounts_update_investor" ON public.fundops_investor_accounts;
CREATE POLICY "fundops_investor_accounts_update_investor"
ON public.fundops_investor_accounts
FOR UPDATE
USING (investor_id = public.current_investor_id())
WITH CHECK (investor_id = public.current_investor_id());

GRANT EXECUTE ON FUNCTION public.current_investor_id() TO authenticated;
