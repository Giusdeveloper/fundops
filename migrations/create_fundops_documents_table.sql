-- Tabella per gestire documenti LOI
CREATE TABLE IF NOT EXISTS public.fundops_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  loi_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('loi_pdf', 'attachment')),
  title text NOT NULL,
  file_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  size_bytes bigint,
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  
  CONSTRAINT fk_company FOREIGN KEY (company_id) REFERENCES public.fundops_companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_loi FOREIGN KEY (loi_id) REFERENCES public.fundops_lois(id) ON DELETE CASCADE
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_fundops_documents_company_loi ON public.fundops_documents(company_id, loi_id);
CREATE INDEX IF NOT EXISTS idx_fundops_documents_loi ON public.fundops_documents(loi_id);
CREATE INDEX IF NOT EXISTS idx_fundops_documents_status ON public.fundops_documents(status) WHERE status = 'active';

-- RLS (Row Level Security) - per ora disabilitato in dev, ma struttura pronta
ALTER TABLE public.fundops_documents ENABLE ROW LEVEL SECURITY;

-- Policy per permettere tutto in dev (da rimuovere in produzione)
CREATE POLICY "Allow all for authenticated users" ON public.fundops_documents
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Commenti per documentazione
COMMENT ON TABLE public.fundops_documents IS 'Documenti associati alle LOI (PDF generati e allegati)';
COMMENT ON COLUMN public.fundops_documents.type IS 'Tipo documento: loi_pdf (generato) o attachment (caricato)';
COMMENT ON COLUMN public.fundops_documents.file_path IS 'Path nel bucket Supabase Storage';
COMMENT ON COLUMN public.fundops_documents.version IS 'Versione del documento (per loi_pdf incrementale)';
COMMENT ON COLUMN public.fundops_documents.status IS 'Stato: active (visibile) o deleted (soft delete)';
