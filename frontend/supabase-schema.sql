-- Schema del database per Smart Equity App
-- Esegui questo script nel SQL Editor di Supabase

-- Abilita estensioni necessarie
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabella Investors
CREATE TABLE IF NOT EXISTS investors (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    company VARCHAR(255),
    position VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'inactive')),
    category VARCHAR(20) NOT NULL CHECK (category IN ('angel', 'vc', 'institutional', 'individual')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_invested DECIMAL(15,2) DEFAULT 0,
    number_of_investments INTEGER DEFAULT 0,
    last_contact_date DATE,
    preferred_contact_method VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (preferred_contact_method IN ('email', 'phone', 'meeting')),
    timezone VARCHAR(50),
    investor_type VARCHAR(50) CHECK (investor_type IN ('customer', 'supplier', 'business_development', 'professionals', 'member_get_member', 'exit', 'influencer', 'brand_awareness', 'recruiter')),
    motivation TEXT,
    linkedin VARCHAR(255)
);

-- Tabella LOIs (Lettere d'Intenti)
CREATE TABLE IF NOT EXISTS lois (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
    investor_name VARCHAR(255) NOT NULL,
    investor_email VARCHAR(255) NOT NULL,
    investor_company VARCHAR(255),
    loi_number VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL DEFAULT 'Lettera d''intenti SFP',
    company_name VARCHAR(255) NOT NULL,
    company_full_name VARCHAR(255) NOT NULL,
    sfp_class VARCHAR(1) NOT NULL CHECK (sfp_class IN ('A', 'B', 'C')),
    sfp_value DECIMAL(15,2) NOT NULL,
    discount_percentage DECIMAL(5,2) NOT NULL,
    conversion_date DATE NOT NULL,
    max_total_value DECIMAL(15,2) NOT NULL,
    ticket_size DECIMAL(15,2) NOT NULL,
    subscription_date DATE NOT NULL,
    subscription_deadline DATE NOT NULL,
    loi_expiry_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'expired', 'rejected')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    company_legal_address TEXT NOT NULL,
    company_cap VARCHAR(10) NOT NULL,
    company_city VARCHAR(100) NOT NULL,
    company_registration VARCHAR(100) NOT NULL,
    company_vat VARCHAR(20) NOT NULL,
    company_capital VARCHAR(100) NOT NULL,
    tax_benefit_percentage DECIMAL(5,2) DEFAULT 30,
    tax_benefit_value DECIMAL(15,2) DEFAULT 0,
    documents_provided JSONB DEFAULT '{"company_registration": false, "investor_deck": false, "regulation": false}',
    payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'crypto', 'other')),
    confidentiality_period INTEGER DEFAULT 24,
    competent_court VARCHAR(100) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL
);

-- Tabella Investments (opzionale, per tracking degli investimenti)
CREATE TABLE IF NOT EXISTS investments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
    loi_id UUID REFERENCES lois(id) ON DELETE SET NULL,
    amount DECIMAL(15,2) NOT NULL,
    date DATE NOT NULL,
    project_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'transferred', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_investors_email ON investors(email);
CREATE INDEX IF NOT EXISTS idx_investors_status ON investors(status);
CREATE INDEX IF NOT EXISTS idx_investors_category ON investors(category);
CREATE INDEX IF NOT EXISTS idx_lois_investor_id ON lois(investor_id);
CREATE INDEX IF NOT EXISTS idx_lois_status ON lois(status);
CREATE INDEX IF NOT EXISTS idx_lois_expiry_date ON lois(loi_expiry_date);
CREATE INDEX IF NOT EXISTS idx_investments_investor_id ON investments(investor_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);

-- Funzione per aggiornare automaticamente updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger per aggiornare updated_at automaticamente
CREATE TRIGGER update_investors_updated_at BEFORE UPDATE ON investors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lois_updated_at BEFORE UPDATE ON lois
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON investments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Funzione per aggiornare le statistiche dell'investitore
CREATE OR REPLACE FUNCTION update_investor_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Aggiorna le statistiche dell'investitore quando viene aggiunto un investimento
    IF TG_OP = 'INSERT' THEN
        UPDATE investors 
        SET 
            total_invested = total_invested + NEW.amount,
            number_of_investments = number_of_investments + 1,
            last_contact_date = NEW.date
        WHERE id = NEW.investor_id;
        RETURN NEW;
    END IF;
    
    -- Aggiorna le statistiche quando viene modificato un investimento
    IF TG_OP = 'UPDATE' THEN
        UPDATE investors 
        SET 
            total_invested = total_invested - OLD.amount + NEW.amount,
            last_contact_date = NEW.date
        WHERE id = NEW.investor_id;
        RETURN NEW;
    END IF;
    
    -- Aggiorna le statistiche quando viene eliminato un investimento
    IF TG_OP = 'DELETE' THEN
        UPDATE investors 
        SET 
            total_invested = total_invested - OLD.amount,
            number_of_investments = number_of_investments - 1
        WHERE id = OLD.investor_id;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Trigger per aggiornare le statistiche degli investitori
CREATE TRIGGER update_investor_stats_trigger 
    AFTER INSERT OR UPDATE OR DELETE ON investments
    FOR EACH ROW EXECUTE FUNCTION update_investor_stats();

-- RLS (Row Level Security) policies per sicurezza
ALTER TABLE investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE lois ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

-- Policy per permettere tutte le operazioni (da personalizzare secondo le esigenze)
CREATE POLICY "Enable all operations for authenticated users" ON investors
    FOR ALL USING (true);

CREATE POLICY "Enable all operations for authenticated users" ON lois
    FOR ALL USING (true);

CREATE POLICY "Enable all operations for authenticated users" ON investments
    FOR ALL USING (true);

-- Inserimento di dati di esempio (opzionale)
INSERT INTO investors (
    name, email, phone, company, position, status, category, 
    notes, total_invested, number_of_investments, preferred_contact_method,
    investor_type, motivation, linkedin
) VALUES 
(
    'Marco Rossi',
    'marco.rossi@venturecapital.it',
    '+39 333 123 4567',
    'Venture Capital Partners',
    'Managing Partner',
    'active',
    'vc',
    'Interessato a progetti fintech e AI. Molto reattivo.',
    500000,
    1,
    'email',
    'business_development',
    'Interessato a progetti innovativi nel settore fintech con potenziale di crescita internazionale.',
    'https://linkedin.com/in/marco-rossi-vc'
),
(
    'Anna Bianchi',
    'anna.bianchi@angelgroup.com',
    '+39 347 987 6543',
    'Angel Group Milano',
    'Angel Investor',
    'active',
    'angel',
    'Ex-founder di startup tech. Esperta in go-to-market.',
    300000,
    1,
    'meeting',
    'customer',
    'Vuole supportare startup tech italiane con la sua esperienza imprenditoriale e network.',
    'https://linkedin.com/in/anna-bianchi-angel'
);

-- Commenti per documentazione
COMMENT ON TABLE investors IS 'Tabella degli investitori con informazioni di contatto e preferenze';
COMMENT ON TABLE lois IS 'Tabella delle Lettere d''Intenti per Strumenti Finanziari Partecipativi';
COMMENT ON TABLE investments IS 'Tabella degli investimenti effettuati dagli investitori';

COMMENT ON COLUMN lois.sfp_class IS 'Classe dello SFP: A (20% sconto), B (15% sconto), C (10% sconto)';
COMMENT ON COLUMN lois.documents_provided IS 'JSON con stato dei documenti forniti';
COMMENT ON COLUMN investors.investor_type IS 'Tipo di investitore secondo la classificazione business';
