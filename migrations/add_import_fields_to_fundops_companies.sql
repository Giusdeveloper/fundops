-- Aggiungi colonne per import CSV a fundops_companies
-- Esegui questo script nel SQL Editor di Supabase

-- Aggiungi colonne se non esistono già
DO $$ 
BEGIN
    -- email: email azienda
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fundops_companies' AND column_name = 'email'
    ) THEN
        ALTER TABLE fundops_companies 
        ADD COLUMN email VARCHAR(255);
    END IF;

    -- pec: PEC azienda
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fundops_companies' AND column_name = 'pec'
    ) THEN
        ALTER TABLE fundops_companies 
        ADD COLUMN pec VARCHAR(255);
    END IF;

    -- city: città
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fundops_companies' AND column_name = 'city'
    ) THEN
        ALTER TABLE fundops_companies 
        ADD COLUMN city VARCHAR(100);
    END IF;

    -- notes: note aggiuntive
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fundops_companies' AND column_name = 'notes'
    ) THEN
        ALTER TABLE fundops_companies 
        ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Crea indice per deduplica su vat_number
CREATE INDEX IF NOT EXISTS idx_fundops_companies_vat_number 
ON fundops_companies(vat_number) 
WHERE vat_number IS NOT NULL AND vat_number != '';

-- Crea indice per deduplica su legal_name
CREATE INDEX IF NOT EXISTS idx_fundops_companies_legal_name 
ON fundops_companies(legal_name) 
WHERE legal_name IS NOT NULL AND legal_name != '';
