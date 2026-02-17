-- RLS su public.fundops_documents (Opzione A)
-- Company team vede tutti i doc della company; investor solo i propri; Imment admin/operator tutto
-- Esegui nel SQL Editor di Supabase

-- Rimuovi policy legacy
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.fundops_documents;

-- Helper: profilo attivo
-- Helper: role in imment_admin, imment_operator
-- Helper: seat attivo per company
-- Helper: investor owns doc + account attivo

-- SELECT: profile active AND (imment_admin/operator OR company seat OR investor owns doc)
CREATE POLICY "fundops_documents_select" ON public.fundops_documents
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
  AND (
    -- Imment admin/operator vede tutto
    (SELECT role_global FROM public.profiles WHERE id = auth.uid()) IN ('imment_admin', 'imment_operator')
    OR
    -- Company team (seat attivo) vede tutti i doc della company
    EXISTS (
      SELECT 1 FROM public.fundops_company_users
      WHERE user_id = auth.uid()
        AND company_id = fundops_documents.company_id
        AND is_active = true
    )
    OR
    -- Investor vede solo i propri doc (investor_id = suo) E account attivo per quella company
    (
      fundops_documents.investor_id IS NOT NULL
      AND fundops_documents.investor_id IN (
        SELECT investor_id FROM public.fundops_investor_users WHERE user_id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM public.fundops_investor_accounts ia
        JOIN public.fundops_investor_users iu ON ia.investor_id = iu.investor_id
        WHERE iu.user_id = auth.uid()
          AND ia.company_id = fundops_documents.company_id
          AND ia.is_active = true
      )
    )
  )
);

-- INSERT: profile active AND (imment_admin/operator OR company seat OR investor owns insert)
CREATE POLICY "fundops_documents_insert" ON public.fundops_documents
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
  AND (
    (SELECT role_global FROM public.profiles WHERE id = auth.uid()) IN ('imment_admin', 'imment_operator')
    OR
    EXISTS (
      SELECT 1 FROM public.fundops_company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = fundops_documents.company_id
        AND cu.is_active = true
    )
    OR
    (
      fundops_documents.investor_id IS NOT NULL
      AND fundops_documents.investor_id IN (
        SELECT investor_id FROM public.fundops_investor_users WHERE user_id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM public.fundops_investor_accounts ia
        JOIN public.fundops_investor_users iu ON ia.investor_id = iu.investor_id
        WHERE iu.user_id = auth.uid()
          AND ia.company_id = fundops_documents.company_id
          AND ia.is_active = true
      )
    )
  )
);

-- UPDATE: solo imment_admin/operator OR company seat attivo (investors cannot update)
CREATE POLICY "fundops_documents_update" ON public.fundops_documents
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
  AND (
    (SELECT role_global FROM public.profiles WHERE id = auth.uid()) IN ('imment_admin', 'imment_operator')
    OR
    EXISTS (
      SELECT 1 FROM public.fundops_company_users
      WHERE user_id = auth.uid()
        AND company_id = fundops_documents.company_id
        AND is_active = true
    )
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
  AND (
    (SELECT role_global FROM public.profiles WHERE id = auth.uid()) IN ('imment_admin', 'imment_operator')
    OR
    EXISTS (
      SELECT 1 FROM public.fundops_company_users
      WHERE user_id = auth.uid()
        AND company_id = fundops_documents.company_id
        AND is_active = true
    )
  )
);

-- DELETE: solo imment_admin
CREATE POLICY "fundops_documents_delete" ON public.fundops_documents
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
  AND (SELECT role_global FROM public.profiles WHERE id = auth.uid()) = 'imment_admin'
);

COMMENT ON TABLE public.fundops_documents IS 'Documenti LOI e portal. RLS: company team vede company, investor solo propri, admin tutto.';

-- NOTA: Le API che leggono fundops_documents con RLS devono usare il client con auth
-- (createClient da @/lib/supabase/server con cookies). supabaseServer (service role) bypassa RLS.
