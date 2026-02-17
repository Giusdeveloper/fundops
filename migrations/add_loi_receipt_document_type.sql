-- Aggiungi tipo 'loi_receipt' a fundops_documents
ALTER TABLE public.fundops_documents
  DROP CONSTRAINT IF EXISTS fundops_documents_type_check;

ALTER TABLE public.fundops_documents
  ADD CONSTRAINT fundops_documents_type_check
  CHECK (type IN ('loi_pdf', 'attachment', 'notary_deed', 'investment_form', 'wire_proof', 'loi_receipt'));
