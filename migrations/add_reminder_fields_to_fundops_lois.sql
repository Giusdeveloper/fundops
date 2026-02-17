-- Migration: Aggiungi campi reminder a fundops_lois
-- Data: 2025-01-XX
-- Descrizione: Aggiunge campi per tracciare reminder inviati alle LOI

-- Aggiungi campo last_reminder_at (timestamp dell'ultimo reminder inviato)
ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ NULL;

-- Aggiungi campo reminder_count (contatore reminder inviati)
ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0;

-- Aggiungi campo next_reminder_at (timestamp del prossimo reminder programmato, opzionale)
ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS next_reminder_at TIMESTAMPTZ NULL;

-- Aggiorna i record esistenti per impostare reminder_count a 0 se NULL
UPDATE fundops_lois
SET reminder_count = 0
WHERE reminder_count IS NULL;

-- Aggiungi commenti ai campi per documentazione
COMMENT ON COLUMN fundops_lois.last_reminder_at IS 'Timestamp dell''ultimo reminder inviato per questa LOI';
COMMENT ON COLUMN fundops_lois.reminder_count IS 'Numero totale di reminder inviati per questa LOI';
COMMENT ON COLUMN fundops_lois.next_reminder_at IS 'Timestamp del prossimo reminder programmato (opzionale, per automazioni future)';
