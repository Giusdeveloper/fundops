-- Aggiungi colonne mancanti per import CSV a fundops_companies
-- Esegui questo script nel SQL Editor di Supabase
-- Questo script aggiunge TUTTE le colonne necessarie per l'import CSV

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

    -- settore: settore aziendale
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fundops_companies' AND column_name = 'settore'
    ) THEN
        ALTER TABLE fundops_companies 
        ADD COLUMN settore VARCHAR(255);
    END IF;

    -- website: sito web azienda
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fundops_companies' AND column_name = 'website'
    ) THEN
        ALTER TABLE fundops_companies 
        ADD COLUMN website VARCHAR(500);
    END IF;

    -- profilo_linkedin: profilo LinkedIn azienda
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fundops_companies' AND column_name = 'profilo_linkedin'
    ) THEN
        ALTER TABLE fundops_companies 
        ADD COLUMN profilo_linkedin VARCHAR(500);
    END IF;
END $$;

-- Commenti per documentazione
COMMENT ON COLUMN fundops_companies.email IS 'Email aziendale';
COMMENT ON COLUMN fundops_companies.pec IS 'PEC aziendale';
COMMENT ON COLUMN fundops_companies.city IS 'Città';
COMMENT ON COLUMN fundops_companies.notes IS 'Note aggiuntive';
COMMENT ON COLUMN fundops_companies.settore IS 'Settore aziendale';
COMMENT ON COLUMN fundops_companies.website IS 'Sito web aziendale';
COMMENT ON COLUMN fundops_companies.profilo_linkedin IS 'Profilo LinkedIn aziendale';
