-- Script di Setup per Test Generazione PDF LOI
-- Esegui questo script in Supabase SQL Editor per creare dati di test

-- STEP 1: Verifica che la migration dei campi testo sia stata eseguita
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fundops_lois' 
    AND column_name = 'premessa_text'
  ) THEN
    RAISE EXCEPTION 'Migration add_loi_text_fields.sql non eseguita. Esegui prima quella migration.';
  END IF;
END $$;

-- STEP 2: Trova una company esistente (usa la prima disponibile)
DO $$
DECLARE
  v_company_id UUID;
  v_investor_id UUID;
  v_loi_id UUID;
  v_signer_id UUID;
BEGIN
  -- Trova una company esistente
  SELECT id INTO v_company_id
  FROM fundops_companies
  LIMIT 1;
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Nessuna company trovata. Crea prima una company.';
  END IF;
  
  RAISE NOTICE 'Company trovata: %', v_company_id;
  
  -- Trova un investitore esistente per questa company
  SELECT id INTO v_investor_id
  FROM fundops_investors
  WHERE company_id = v_company_id
  LIMIT 1;
  
  -- Se non c'è un investitore per questa company, cerca qualsiasi investitore
  IF v_investor_id IS NULL THEN
    SELECT id INTO v_investor_id
    FROM fundops_investors
    LIMIT 1;
  END IF;
  
  IF v_investor_id IS NULL THEN
    RAISE EXCEPTION 'Nessun investitore trovato. Crea prima un investitore.';
  END IF;
  
  RAISE NOTICE 'Investitore trovato: %', v_investor_id;
  
  -- STEP 3: Crea LOI master con testi completi
  INSERT INTO fundops_lois (
    company_id,
    title,
    round_name,
    master_expires_at,
    premessa_text,
    modalita_text,
    condizioni_text,
    regolamento_ref,
    pdf_template_key,
    pdf_template_version,
    recommended_min_signers,
    recommended_target_signers,
    ticket_amount,
    currency,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_company_id,
    'Test PDF LOI - Generazione Automatica',
    'Round Test 2025',
    NOW() + INTERVAL '30 days',
    'PREMESSA

La presente Lettera di Intenti rappresenta un impegno non vincolante da parte dell''Investitore per la sottoscrizione di Strumenti Finanziari Partecipativi (SFP) emessi dalla Società, nel rispetto delle condizioni e modalità previste dal presente documento e dal Regolamento SFP.

L''Investitore, previa verifica delle condizioni di investimento e della documentazione fornita, manifesta il proprio interesse a partecipare al round di investimento indicato.',
    'MODALITÀ DI SOTTOSCRIZIONE

La sottoscrizione degli SFP avverrà secondo le modalità previste dal Regolamento SFP e sarà effettuata tramite piattaforma autorizzata, previa:

- Verifica della documentazione societaria e finanziaria;
- Approvazione della domanda di sottoscrizione da parte della Società;
- Completamento della procedura di onboarding prevista dalla piattaforma;
- Versamento dell''importo di sottoscrizione secondo le modalità indicate.

L''Investitore si impegna a completare tutte le fasi procedurali necessarie entro i termini indicati dalla Società.',
    'CONDIZIONI SINTETICHE

1. Importo indicativo: L''importo indicato nella presente Lettera di Intenti è puramente indicativo e non vincolante. L''importo effettivo di sottoscrizione potrà essere modificato in base alle esigenze del round e alle disponibilità dell''Investitore.

2. Scadenza: La presente Lettera di Intenti ha validità fino alla data di scadenza indicata, salvo proroghe concordate tra le parti.

3. Condizioni di investimento: Le condizioni definitive di investimento saranno stabilite nel Regolamento SFP e nella documentazione di emissione degli SFP.

4. Riservatezza: L''Investitore si impegna a mantenere la massima riservatezza sulle informazioni ricevute nel corso delle trattative.',
    'Regolamento SFP 2025',
    'TEMPLATE_Lettera Intenti SFP 2025.pdf',
    '1.0',
    5,
    10,
    100000.00,
    'EUR',
    'draft',
    NOW(),
    NOW()
  ) RETURNING id INTO v_loi_id;
  
  RAISE NOTICE 'LOI master creata con ID: %', v_loi_id;
  
  -- STEP 4: Crea signer con dati completi
  INSERT INTO fundops_loi_signers (
    loi_id,
    investor_id,
    status,
    indicative_amount,
    soft_commitment_at,
    hard_signed_at,
    expires_at_override,
    notes,
    created_at,
    updated_at
  ) VALUES (
    v_loi_id,
    v_investor_id,
    'signed',
    50000.00,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day',
    NULL, -- Usa master_expires_at
    'Signer di test creato automaticamente per test generazione PDF',
    NOW(),
    NOW()
  ) RETURNING id INTO v_signer_id;
  
  RAISE NOTICE 'Signer creato con ID: %', v_signer_id;
  
  -- STEP 5: Output informazioni per test
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SETUP COMPLETATO CON SUCCESSO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Dati creati:';
  RAISE NOTICE '  - Company ID: %', v_company_id;
  RAISE NOTICE '  - LOI ID: %', v_loi_id;
  RAISE NOTICE '  - Signer ID: %', v_signer_id;
  RAISE NOTICE '  - Investor ID: %', v_investor_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Per testare il download PDF:';
  RAISE NOTICE '  1. Vai su: http://localhost:3001/lois';
  RAISE NOTICE '  2. Seleziona la company con ID: %', v_company_id;
  RAISE NOTICE '  3. Nella tabella signers, clicca "Scarica PDF"';
  RAISE NOTICE '  Oppure vai direttamente a:';
  RAISE NOTICE '  http://localhost:3001/api/lois/%/signers/%/pdf', v_loi_id, v_signer_id;
  RAISE NOTICE '';
  
END $$;

-- STEP 6: Query di verifica
SELECT 
  'LOI Master' as tipo,
  l.id,
  l.title,
  l.round_name,
  l.premessa_text IS NOT NULL as has_premessa,
  l.modalita_text IS NOT NULL as has_modalita,
  l.condizioni_text IS NOT NULL as has_condizioni,
  l.pdf_template_key,
  l.master_expires_at
FROM fundops_lois l
WHERE l.title = 'Test PDF LOI - Generazione Automatica'
ORDER BY l.created_at DESC
LIMIT 1;

SELECT 
  'Signer' as tipo,
  s.id,
  s.status,
  s.indicative_amount,
  s.hard_signed_at,
  s.soft_commitment_at,
  i.full_name as investor_name,
  i.email as investor_email,
  l.title as loi_title
FROM fundops_loi_signers s
JOIN fundops_investors i ON i.id = s.investor_id
JOIN fundops_lois l ON l.id = s.loi_id
WHERE l.title = 'Test PDF LOI - Generazione Automatica'
ORDER BY s.created_at DESC
LIMIT 1;
