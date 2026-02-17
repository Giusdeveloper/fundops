-- Tabella per gli eventi LOI
CREATE TABLE IF NOT EXISTS public.fundops_loi_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    loi_id UUID NOT NULL REFERENCES public.fundops_lois(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    label TEXT NOT NULL,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NULL
);

-- Indice per query efficienti
CREATE INDEX IF NOT EXISTS idx_fundops_loi_events_loi_id_created_at 
ON public.fundops_loi_events(loi_id, created_at DESC);

-- Commenti per documentazione
COMMENT ON TABLE public.fundops_loi_events IS 'Timeline degli eventi per ogni LOI';
COMMENT ON COLUMN public.fundops_loi_events.event_type IS 'Tipo di evento: created, sent, reminder, signed, expired, reopened, cancelled, duplicated';
COMMENT ON COLUMN public.fundops_loi_events.label IS 'Etichetta leggibile dell\'evento in italiano';
COMMENT ON COLUMN public.fundops_loi_events.metadata IS 'Dati aggiuntivi opzionali in formato JSON';
