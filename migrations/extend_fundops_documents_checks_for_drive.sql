-- Extend fundops_documents checks for Drive-backed round documents.
-- Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fundops_documents'
      AND column_name = 'round_id'
  ) THEN
    ALTER TABLE public.fundops_documents
      ADD COLUMN round_id uuid NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fundops_documents_company_round
  ON public.fundops_documents(company_id, round_id);

ALTER TABLE public.fundops_documents
  DROP CONSTRAINT IF EXISTS fundops_documents_status_check;

ALTER TABLE public.fundops_documents
  ADD CONSTRAINT fundops_documents_status_check
  CHECK (status IN ('active', 'deleted', 'uploaded', 'ready'));

ALTER TABLE public.fundops_documents
  DROP CONSTRAINT IF EXISTS fundops_documents_type_check;

ALTER TABLE public.fundops_documents
  ADD CONSTRAINT fundops_documents_type_check
  CHECK (
    type IN (
      'loi_pdf',
      'attachment',
      'notary_deed',
      'investment_form',
      'wire_proof',
      'loi_receipt',
      'round_booking_doc',
      'round_issuance_doc',
      'round_onboarding_doc'
    )
  );
