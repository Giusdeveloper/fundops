-- Aggiungi colonne per import CSV a fundops_investors
-- Esegui questo script nel SQL Editor di Supabase

-- Aggiungi colonne se non esistono già
DO $$ 
BEGIN
    -- investor_type: enum normalizzato
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fundops_investors' AND column_name = 'investor_type'
    ) THEN
        ALTER TABLE fundops_investors 
        ADD COLUMN investor_type VARCHAR(50) CHECK (investor_type IN (
            'customer', 'exit', 'business_development', 'influencer', 
            'professionals', 'other'
        ));
    END IF;

    -- source_type: testo raw dal CSV
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fundops_investors' AND column_name = 'source_type'
    ) THEN
        ALTER TABLE fundops_investors 
        ADD COLUMN source_type TEXT;
    END IF;

    -- source: segnalatore
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fundops_investors' AND column_name = 'source'
    ) THEN
        ALTER TABLE fundops_investors 
        ADD COLUMN source TEXT;
    END IF;

    -- client_company_id: FK a fundops_companies (Cliente Imment)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fundops_investors' AND column_name = 'client_company_id'
    ) THEN
        ALTER TABLE fundops_investors 
        ADD COLUMN client_company_id UUID REFERENCES fundops_companies(id);
    END IF;

    -- client_name: cliente Imment (fallback se non trovato in fundops_companies)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fundops_investors' AND column_name = 'client_name'
    ) THEN
        ALTER TABLE fundops_investors 
        ADD COLUMN client_name TEXT;
    END IF;

    -- investor_company_name: ragione sociale investitore (solo se investor è azienda)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fundops_investors' AND column_name = 'investor_company_name'
    ) THEN
        ALTER TABLE fundops_investors 
        ADD COLUMN investor_company_name TEXT;
    END IF;

    -- linkedin: se non esiste già
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fundops_investors' AND column_name = 'linkedin'
    ) THEN
        ALTER TABLE fundops_investors 
        ADD COLUMN linkedin VARCHAR(255);
    END IF;
END $$;

-- Crea indice per deduplica su email + company_id
CREATE INDEX IF NOT EXISTS idx_fundops_investors_email_company 
ON fundops_investors(company_id, email) 
WHERE email IS NOT NULL AND email != '';

-- Crea indice per deduplica su full_name + company_id
CREATE INDEX IF NOT EXISTS idx_fundops_investors_name_company 
ON fundops_investors(company_id, full_name);
