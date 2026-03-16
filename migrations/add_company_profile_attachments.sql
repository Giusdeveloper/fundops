-- Table to track attachments uploaded during company profiling
CREATE TABLE IF NOT EXISTS public.company_profile_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('deck', 'registry')),
  url text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'profiling',
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_company_profile_company FOREIGN KEY (company_id) REFERENCES public.fundops_companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company_profile_attachments_company ON public.company_profile_attachments(company_id);
CREATE INDEX IF NOT EXISTS idx_company_profile_attachments_type ON public.company_profile_attachments(type);

ALTER TABLE public.company_profile_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles attachments are visible to company members" ON public.company_profile_attachments;
CREATE POLICY "Profiles attachments are visible to company members" ON public.company_profile_attachments
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Profiles attachments insert allowed" ON public.company_profile_attachments;
CREATE POLICY "Profiles attachments insert allowed" ON public.company_profile_attachments
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Profiles attachments delete allowed" ON public.company_profile_attachments;
CREATE POLICY "Profiles attachments delete allowed" ON public.company_profile_attachments
  FOR DELETE
  USING (true);

-- The policy above assumes access is controlled in the API layer; tighten it later if needed.
