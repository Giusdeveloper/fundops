-- Allow company admins and imment_admin to insert LOI masters
-- Apply this in Supabase SQL editor or via migration runner

ALTER TABLE public.fundops_lois ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fundops_lois_insert_company" ON public.fundops_lois;
CREATE POLICY "fundops_lois_insert_company" ON public.fundops_lois
FOR INSERT
WITH CHECK (
  public.is_imment_admin()
  OR public.is_company_admin(company_id)
);
