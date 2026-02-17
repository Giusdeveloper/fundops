-- RLS minimale per Portal investitore
-- Helper functions + policies per fundops_companies, fundops_lois, fundops_loi_signers, fundops_loi_signer_events,
-- fundops_investor_users, fundops_investor_accounts
-- Esegui nel SQL Editor di Supabase

-- ========== HELPER FUNCTIONS ==========

CREATE OR REPLACE FUNCTION public.current_investor_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT investor_id FROM public.fundops_investor_users WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_imment_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT role_global FROM public.profiles WHERE id = auth.uid()) = 'imment_admin';
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fundops_company_users
    WHERE user_id = auth.uid() AND company_id = p_company_id AND is_active = true
  );
$$;

-- ========== ENABLE RLS (se non già attivo) ==========

ALTER TABLE public.fundops_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundops_lois ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundops_loi_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundops_loi_signer_events ENABLE ROW LEVEL SECURITY;

-- ========== FUNDOPS_COMPANIES ==========

DROP POLICY IF EXISTS "fundops_companies_select_investor" ON public.fundops_companies;
CREATE POLICY "fundops_companies_select_investor" ON public.fundops_companies
FOR SELECT
USING (
  public_slug IS NOT NULL
  AND (
    public.is_imment_admin()
    OR public.is_company_admin(id)
    OR EXISTS (
      SELECT 1 FROM public.fundops_investor_accounts ia
      WHERE ia.company_id = fundops_companies.id
        AND ia.investor_id = public.current_investor_id()
    )
  )
);

-- ========== FUNDOPS_LOIS ==========

DROP POLICY IF EXISTS "fundops_lois_select_investor" ON public.fundops_lois;
CREATE POLICY "fundops_lois_select_investor" ON public.fundops_lois
FOR SELECT
USING (
  (
    public.is_imment_admin()
    OR public.is_company_admin(company_id)
    OR EXISTS (
      SELECT 1 FROM public.fundops_investor_accounts ia
      WHERE ia.company_id = fundops_lois.company_id
        AND ia.investor_id = public.current_investor_id()
    )
  )
);

-- ========== FUNDOPS_LOI_SIGNERS ==========

DROP POLICY IF EXISTS "fundops_loi_signers_select" ON public.fundops_loi_signers;
CREATE POLICY "fundops_loi_signers_select" ON public.fundops_loi_signers
FOR SELECT
USING (
  public.is_imment_admin()
  OR public.is_company_admin((SELECT company_id FROM public.fundops_lois WHERE id = fundops_loi_signers.loi_id))
  OR investor_id = public.current_investor_id()
);

DROP POLICY IF EXISTS "fundops_loi_signers_update_investor" ON public.fundops_loi_signers;
CREATE POLICY "fundops_loi_signers_update_investor" ON public.fundops_loi_signers
FOR UPDATE
USING (investor_id = public.current_investor_id())
WITH CHECK (investor_id = public.current_investor_id());

DROP POLICY IF EXISTS "fundops_loi_signers_insert_investor" ON public.fundops_loi_signers;
CREATE POLICY "fundops_loi_signers_insert_investor" ON public.fundops_loi_signers
FOR INSERT
WITH CHECK (investor_id = public.current_investor_id());

-- ========== FUNDOPS_LOI_SIGNER_EVENTS ==========

DROP POLICY IF EXISTS "fundops_loi_signer_events_select" ON public.fundops_loi_signer_events;
CREATE POLICY "fundops_loi_signer_events_select" ON public.fundops_loi_signer_events
FOR SELECT
USING (
  public.is_imment_admin()
  OR public.is_company_admin((
    SELECT l.company_id FROM public.fundops_loi_signers s
    JOIN public.fundops_lois l ON l.id = s.loi_id
    WHERE s.id = fundops_loi_signer_events.signer_id
  ))
  OR signer_id IN (
    SELECT id FROM public.fundops_loi_signers WHERE investor_id = public.current_investor_id()
  )
);

DROP POLICY IF EXISTS "fundops_loi_signer_events_insert_investor" ON public.fundops_loi_signer_events;
CREATE POLICY "fundops_loi_signer_events_insert_investor" ON public.fundops_loi_signer_events
FOR INSERT
WITH CHECK (
  signer_id IN (
    SELECT id FROM public.fundops_loi_signers WHERE investor_id = public.current_investor_id()
  )
);

-- ========== FUNDOPS_INVESTOR_USERS ==========

DROP POLICY IF EXISTS "fundops_investor_users_select_own" ON public.fundops_investor_users;
CREATE POLICY "fundops_investor_users_select_own" ON public.fundops_investor_users
FOR SELECT
USING (
  public.is_imment_admin()
  OR user_id = auth.uid()
);

-- ========== FUNDOPS_INVESTOR_ACCOUNTS ==========

DROP POLICY IF EXISTS "fundops_investor_accounts_select" ON public.fundops_investor_accounts;
CREATE POLICY "fundops_investor_accounts_select" ON public.fundops_investor_accounts
FOR SELECT
USING (
  public.is_imment_admin()
  OR public.is_company_admin(company_id)
  OR investor_id = public.current_investor_id()
);

DROP POLICY IF EXISTS "fundops_investor_accounts_update_investor" ON public.fundops_investor_accounts;
-- L'update su investor_accounts (lifecycle, loi_signed_at) avviene via API con service role.
-- Se l'investor deve fare update diretto, aggiungere policy. Per ora le API usano service role.

-- ========== GRANT ==========

GRANT EXECUTE ON FUNCTION public.current_investor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_imment_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_admin(UUID) TO authenticated;

COMMENT ON FUNCTION public.current_investor_id() IS 'Investor ID per utente autenticato (da fundops_investor_users)';
COMMENT ON FUNCTION public.is_imment_admin() IS 'True se profiles.role_global = imment_admin';
COMMENT ON FUNCTION public.is_company_admin(UUID) IS 'True se utente ha seat attivo in fundops_company_users per company_id';
