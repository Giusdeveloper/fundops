-- RLS Portal: rimuove is_company_admin (fundops_company_users) dalle policy
-- Il Portal investor valida accesso solo tramite investor_users + investor_accounts.
-- Le API company team usano supabaseServer (service role) per i dati.
-- Esegui nel SQL Editor di Supabase

-- FUNDOPS_COMPANIES: solo imment_admin e investor con account (no company_admin)
DROP POLICY IF EXISTS "fundops_companies_select_investor" ON public.fundops_companies;
CREATE POLICY "fundops_companies_select_investor" ON public.fundops_companies
FOR SELECT
USING (
  public_slug IS NOT NULL
  AND (
    public.is_imment_admin()
    OR EXISTS (
      SELECT 1 FROM public.fundops_investor_accounts ia
      WHERE ia.company_id = fundops_companies.id
        AND ia.investor_id = public.current_investor_id()
    )
  )
);

-- FUNDOPS_LOIS: solo imment_admin e investor con account (no company_admin)
DROP POLICY IF EXISTS "fundops_lois_select_investor" ON public.fundops_lois;
CREATE POLICY "fundops_lois_select_investor" ON public.fundops_lois
FOR SELECT
USING (
  public.is_imment_admin()
  OR EXISTS (
    SELECT 1 FROM public.fundops_investor_accounts ia
    WHERE ia.company_id = fundops_lois.company_id
      AND ia.investor_id = public.current_investor_id()
  )
);

-- FUNDOPS_LOI_SIGNERS: solo imment_admin e investor (no company_admin)
DROP POLICY IF EXISTS "fundops_loi_signers_select" ON public.fundops_loi_signers;
CREATE POLICY "fundops_loi_signers_select" ON public.fundops_loi_signers
FOR SELECT
USING (
  public.is_imment_admin()
  OR investor_id = public.current_investor_id()
);

-- FUNDOPS_LOI_SIGNER_EVENTS: solo imment_admin e investor (no company_admin)
DROP POLICY IF EXISTS "fundops_loi_signer_events_select" ON public.fundops_loi_signer_events;
CREATE POLICY "fundops_loi_signer_events_select" ON public.fundops_loi_signer_events
FOR SELECT
USING (
  public.is_imment_admin()
  OR signer_id IN (
    SELECT id FROM public.fundops_loi_signers WHERE investor_id = public.current_investor_id()
  )
);

-- FUNDOPS_INVESTOR_ACCOUNTS: solo imment_admin e investor (no company_admin)
DROP POLICY IF EXISTS "fundops_investor_accounts_select" ON public.fundops_investor_accounts;
CREATE POLICY "fundops_investor_accounts_select" ON public.fundops_investor_accounts
FOR SELECT
USING (
  public.is_imment_admin()
  OR investor_id = public.current_investor_id()
);
