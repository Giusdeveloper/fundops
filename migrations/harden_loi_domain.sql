-- Migration: Hardening dominio LOI - Consolidamento modello round-level
-- Data: 2025-01-XX
-- Descrizione: 
--   1. Deprecare investor_id in fundops_lois (rendere nullable, mantenere legacy)
--   2. Migrare LOI esistenti a signers (una LOI legacy -> un signer)
--   3. Assicurare che tutti i campi master siano presenti

-- STEP 1: Assicura che tutti i campi master siano presenti (idempotente)
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

-- STEP 2: Rendere investor_id nullable e deprecato (mantenere per compatibilità legacy)
-- Nota: Non rimuoviamo la colonna per non rompere query esistenti, ma la rendiamo nullable
ALTER TABLE fundops_lois
ALTER COLUMN investor_id DROP NOT NULL;

-- Aggiungi commento per indicare deprecazione
COMMENT ON COLUMN fundops_lois.investor_id IS 'DEPRECATO: Usare fundops_loi_signers invece. Mantenuto solo per compatibilità legacy.';

-- STEP 3: Assicura che fundops_loi_signers esista (se non già creata)
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

-- STEP 4: Assicura che fundops_loi_signer_events esista
CREATE TABLE IF NOT EXISTS fundops_loi_signer_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  signer_id UUID NOT NULL REFERENCES fundops_loi_signers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('invited', 'accepted', 'signed', 'revoked', 'expired', 'amount_set', 'expiry_override_set')),
  event_data JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255) NULL
);

CREATE INDEX IF NOT EXISTS idx_loi_signer_events_signer_id ON fundops_loi_signer_events(signer_id);
CREATE INDEX IF NOT EXISTS idx_loi_signer_events_created_at ON fundops_loi_signer_events(created_at);
CREATE INDEX IF NOT EXISTS idx_loi_signer_events_event_type ON fundops_loi_signer_events(event_type);

-- STEP 5: Migration dati - Crea signers per LOI esistenti che non hanno ancora signers
-- Questa migration è idempotente: crea signers solo se non esistono già
INSERT INTO fundops_loi_signers (
  loi_id,
  investor_id,
  status,
  soft_commitment_at,
  hard_signed_at,
  expires_at_override,
  indicative_amount,
  created_at,
  updated_at
)
SELECT 
  l.id AS loi_id,
  l.investor_id,
  -- Mappa status legacy a status signer
  CASE 
    WHEN l.status IN ('draft', 'sent') THEN 'invited'
    WHEN l.status = 'signed' THEN 'signed'
    WHEN l.status = 'expired' THEN 'expired'
    WHEN l.status IN ('cancelled', 'rejected', 'revoked') THEN 'revoked'
    ELSE 'invited'
  END AS status,
  -- Se signed, usa updated_at o created_at come proxy per le date
  CASE 
    WHEN l.status = 'signed' THEN COALESCE(l.updated_at, l.created_at)
    ELSE NULL
  END AS soft_commitment_at,
  -- hard_signed_at solo se signed (stesso timestamp)
  CASE 
    WHEN l.status = 'signed' THEN COALESCE(l.updated_at, l.created_at)
    ELSE NULL
  END AS hard_signed_at,
  -- Usa expiry_date come override
  l.expiry_date AS expires_at_override,
  -- Usa ticket_amount come indicative_amount (può essere nullo)
  l.ticket_amount AS indicative_amount,
  l.created_at,
  l.updated_at
FROM fundops_lois l
WHERE l.investor_id IS NOT NULL
  -- Solo se non esiste già un signer per questa LOI+investitore
  AND NOT EXISTS (
    SELECT 1 
    FROM fundops_loi_signers s 
    WHERE s.loi_id = l.id 
      AND s.investor_id = l.investor_id
  )
ON CONFLICT (loi_id, investor_id) DO NOTHING;

-- STEP 6: Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_fundops_loi_signers_updated_at ON fundops_loi_signers;
CREATE TRIGGER update_fundops_loi_signers_updated_at
  BEFORE UPDATE ON fundops_loi_signers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- STEP 7: Commenti per documentazione
COMMENT ON TABLE fundops_lois IS 'LOI master document - una per company/round. Gli investitori aderiscono tramite fundops_loi_signers.';
COMMENT ON COLUMN fundops_lois.round_name IS 'Nome del round/campagna di investimento';
COMMENT ON COLUMN fundops_lois.master_expires_at IS 'Scadenza default per tutti i signers (può essere sovrascritta per singolo signer)';
COMMENT ON COLUMN fundops_lois.recommended_min_signers IS 'Numero minimo consigliato di signers firmati per considerare il round pronto (default: 5)';
COMMENT ON COLUMN fundops_lois.recommended_target_signers IS 'Numero target consigliato di signers firmati per il round (default: 10)';
COMMENT ON COLUMN fundops_lois.ticket_amount IS 'Importo indicativo del round (opzionale, non usato per soglie)';

COMMENT ON TABLE fundops_loi_signers IS 'Investitori aderenti/firmatari di una LOI master. Source of truth per commitment.';
COMMENT ON COLUMN fundops_loi_signers.status IS 'Stato del commitment: invited, accepted (soft), signed (hard), expired, revoked';
COMMENT ON COLUMN fundops_loi_signers.soft_commitment_at IS 'Timestamp dell''accettazione soft commitment (accept in piattaforma)';
COMMENT ON COLUMN fundops_loi_signers.hard_signed_at IS 'Timestamp della firma hard (firma PDF registrata)';
COMMENT ON COLUMN fundops_loi_signers.expires_at_override IS 'Scadenza personalizzata per questo signer (sovrascrive master_expires_at se presente)';
COMMENT ON COLUMN fundops_loi_signers.indicative_amount IS 'Importo indicativo per questo investitore (facoltativo, non usato per soglie)';
