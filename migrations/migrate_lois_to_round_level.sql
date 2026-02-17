-- Migration: Migrazione LOI a modello round-level
-- Data: 2025-01-XX
-- Descrizione: Trasforma fundops_lois da modello one-per-investor a round-level con signers

-- STEP 1: Aggiungi nuovi campi a fundops_lois per supportare round-level
-- Nota: Manteniamo i campi esistenti per retrocompatibilità durante la migrazione

ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS round_name VARCHAR(255) NULL;

ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS master_expires_at TIMESTAMPTZ NULL;

ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS recommended_min_signers INTEGER NOT NULL DEFAULT 5;

ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS recommended_target_signers INTEGER NOT NULL DEFAULT 10;

ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS pdf_template_key VARCHAR(255) NULL;

ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS pdf_template_version VARCHAR(50) NULL;

-- Commenti per documentazione
COMMENT ON COLUMN fundops_lois.round_name IS 'Nome del round di investimento (es. "Round A 2025")';
COMMENT ON COLUMN fundops_lois.master_expires_at IS 'Data di scadenza master della LOI del round (può essere sovrascritta per singolo signer)';
COMMENT ON COLUMN fundops_lois.recommended_min_signers IS 'Numero minimo consigliato di firmatari per considerare il round pronto';
COMMENT ON COLUMN fundops_lois.recommended_target_signers IS 'Numero target consigliato di firmatari per il round';
COMMENT ON COLUMN fundops_lois.pdf_template_key IS 'Chiave del template PDF utilizzato per generare la LOI';
COMMENT ON COLUMN fundops_lois.pdf_template_version IS 'Versione del template PDF utilizzato';

-- STEP 2: Crea tabella fundops_loi_signers
CREATE TABLE IF NOT EXISTS fundops_loi_signers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  loi_id UUID NOT NULL REFERENCES fundops_lois(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES fundops_investors(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('invited', 'accepted', 'signed', 'expired', 'revoked')),
  soft_commitment_at TIMESTAMPTZ NULL,
  hard_signed_at TIMESTAMPTZ NULL,
  expires_at_override TIMESTAMPTZ NULL,
  indicative_amount NUMERIC(15, 2) NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_loi_investor UNIQUE (loi_id, investor_id)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_loi_signers_loi_id ON fundops_loi_signers(loi_id);
CREATE INDEX IF NOT EXISTS idx_loi_signers_investor_id ON fundops_loi_signers(investor_id);
CREATE INDEX IF NOT EXISTS idx_loi_signers_status ON fundops_loi_signers(status);
CREATE INDEX IF NOT EXISTS idx_loi_signers_expires_at ON fundops_loi_signers(expires_at_override);
CREATE INDEX IF NOT EXISTS idx_loi_signers_loi_status ON fundops_loi_signers(loi_id, status);

-- Commenti per documentazione
COMMENT ON TABLE fundops_loi_signers IS 'Gestisce gli investitori aderenti/firmatari di una LOI round-level';
COMMENT ON COLUMN fundops_loi_signers.status IS 'Stato del commitment: invited, accepted (soft), signed (hard), expired, revoked';
COMMENT ON COLUMN fundops_loi_signers.soft_commitment_at IS 'Timestamp dell''accettazione soft commitment (accept in piattaforma)';
COMMENT ON COLUMN fundops_loi_signers.hard_signed_at IS 'Timestamp della firma hard (firma PDF registrata)';
COMMENT ON COLUMN fundops_loi_signers.expires_at_override IS 'Scadenza personalizzata per questo signer (sovrascrive master_expires_at se presente)';
COMMENT ON COLUMN fundops_loi_signers.indicative_amount IS 'Importo indicativo (facoltativo, non usato per soglie)';

-- STEP 3: Crea tabella fundops_loi_signer_events per audit
CREATE TABLE IF NOT EXISTS fundops_loi_signer_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  signer_id UUID NOT NULL REFERENCES fundops_loi_signers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('invited', 'accepted', 'signed', 'revoked', 'expired', 'amount_set', 'expiry_override_set')),
  event_data JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255) NULL
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_loi_signer_events_signer_id ON fundops_loi_signer_events(signer_id);
CREATE INDEX IF NOT EXISTS idx_loi_signer_events_created_at ON fundops_loi_signer_events(created_at);
CREATE INDEX IF NOT EXISTS idx_loi_signer_events_event_type ON fundops_loi_signer_events(event_type);

-- Commenti per documentazione
COMMENT ON TABLE fundops_loi_signer_events IS 'Audit trail degli eventi per ogni signer LOI';
COMMENT ON COLUMN fundops_loi_signer_events.event_data IS 'Dati aggiuntivi dell''evento in formato JSON';

-- STEP 4: Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applica trigger a fundops_loi_signers
DROP TRIGGER IF EXISTS update_fundops_loi_signers_updated_at ON fundops_loi_signers;
CREATE TRIGGER update_fundops_loi_signers_updated_at
  BEFORE UPDATE ON fundops_loi_signers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
