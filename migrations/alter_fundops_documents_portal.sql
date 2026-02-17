-- Estende fundops_documents per portal (issuance/onboarding)
-- Esegui nel SQL Editor di Supabase

-- Aggiungi investor_id (nullable)
ALTER TABLE public.fundops_documents
  ADD COLUMN IF NOT EXISTS investor_id UUID REFERENCES public.fundops_investors(id) ON DELETE SET NULL;

-- Rendi loi_id nullable (per notary_deed, investment_form, wire_proof)
ALTER TABLE public.fundops_documents
  ALTER COLUMN loi_id DROP NOT NULL;

-- Rimuovi vecchio CHECK su type (nome tipico: fundops_documents_type_check)
ALTER TABLE public.fundops_documents
  DROP CONSTRAINT IF EXISTS fundops_documents_type_check;

-- Aggiungi nuovo CHECK con tutti i tipi
ALTER TABLE public.fundops_documents
  ADD CONSTRAINT fundops_documents_type_check
  CHECK (type IN ('loi_pdf', 'attachment', 'notary_deed', 'investment_form', 'wire_proof'));

-- Indice per query status
CREATE INDEX IF NOT EXISTS idx_fundops_documents_portal
  ON public.fundops_documents(company_id, investor_id, type)
  WHERE status = 'active';

COMMENT ON COLUMN public.fundops_documents.investor_id IS 'Investitore per doc investor-level (NULL per notary_deed)';
