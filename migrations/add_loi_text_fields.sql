-- Migration: Aggiungi campi testo LOI per generazione PDF
-- Data: 2025-01-XX
-- Descrizione: Aggiunge campi per contenuto LOI (premessa, modalità, condizioni, regolamento)

-- STEP 1: Aggiungi campi testo alla tabella fundops_lois
ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS premessa_text TEXT NULL;

ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS modalita_text TEXT NULL;

ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS condizioni_text TEXT NULL;

ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS regolamento_ref VARCHAR(255) NULL;

-- Commenti per documentazione
COMMENT ON COLUMN fundops_lois.premessa_text IS 'Testo della premessa della LOI (sezione introduttiva)';
COMMENT ON COLUMN fundops_lois.modalita_text IS 'Testo delle modalità di sottoscrizione e regolamento SFP';
COMMENT ON COLUMN fundops_lois.condizioni_text IS 'Testo delle condizioni sintetiche della LOI';
COMMENT ON COLUMN fundops_lois.regolamento_ref IS 'Riferimento al regolamento SFP (es. "Regolamento SFP 2025")';
