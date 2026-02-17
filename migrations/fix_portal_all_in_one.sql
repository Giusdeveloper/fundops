-- FIX PORTAL - All-in-one: imposta public_slug, crea investor/account/link, crea LOI sent
-- Esegui nel SQL Editor di Supabase
-- Modifica v_email e v_slug se necessario

DO $$
DECLARE
  v_company_id UUID;
  v_investor_id UUID;
  v_user_id UUID;
  v_loi_id UUID;
  v_email TEXT := 'pistoia702@gmail.com';
  v_slug TEXT := 'imment-srl';
BEGIN
  -- 1. Trova o imposta company con public_slug
  SELECT id INTO v_company_id FROM fundops_companies WHERE public_slug = v_slug LIMIT 1;
  
  IF v_company_id IS NULL THEN
    -- Prova a trovare company "Imment" e impostare slug
    SELECT id INTO v_company_id
    FROM fundops_companies
    WHERE LOWER(name) LIKE '%imment%'
    LIMIT 1;
    
    IF v_company_id IS NOT NULL THEN
      UPDATE fundops_companies SET public_slug = v_slug WHERE id = v_company_id;
      RAISE NOTICE 'Company trovata, public_slug impostato a %', v_slug;
    ELSE
      RAISE EXCEPTION 'Nessuna company trovata. Crea una company con nome contenente "Imment" o imposta manualmente public_slug.';
    END IF;
  END IF;

  -- 2. User
  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = LOWER(v_email) LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utente % non trovato. L''utente deve aver fatto almeno un login.', v_email;
  END IF;

  -- 3. Investitore
  SELECT id INTO v_investor_id FROM fundops_investors WHERE LOWER(TRIM(email)) = LOWER(v_email) LIMIT 1;
  IF v_investor_id IS NULL THEN
    INSERT INTO fundops_investors (email, full_name, company_id, client_company_id)
    VALUES (v_email, NULL, v_company_id, v_company_id)
    RETURNING id INTO v_investor_id;
    RAISE NOTICE 'Investitore creato: %', v_investor_id;
  END IF;

  -- 4. Assicura colonne su fundops_investor_accounts
  ALTER TABLE fundops_investor_accounts ADD COLUMN IF NOT EXISTS source TEXT;
  ALTER TABLE fundops_investor_accounts ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ;

  -- 5. Investor account
  INSERT INTO fundops_investor_accounts (investor_id, company_id, lifecycle_stage, source, registered_at, is_active)
  VALUES (v_investor_id, v_company_id, 'registered', 'manual', NOW(), true)
  ON CONFLICT (investor_id, company_id) DO NOTHING;

  -- 6. Link user -> investor
  INSERT INTO fundops_investor_users (user_id, investor_id)
  VALUES (v_user_id, v_investor_id)
  ON CONFLICT (user_id, investor_id) DO NOTHING;

  -- 7. LOI: aggiungi is_master se manca
  ALTER TABLE fundops_lois ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT true;

  -- 8. LOI sent
  SELECT id INTO v_loi_id FROM fundops_lois WHERE company_id = v_company_id ORDER BY created_at DESC LIMIT 1;
  IF v_loi_id IS NOT NULL THEN
    UPDATE fundops_lois SET status = 'sent', is_master = true, updated_at = NOW() WHERE id = v_loi_id;
    RAISE NOTICE 'LOI aggiornata a sent: %', v_loi_id;
  ELSE
    INSERT INTO fundops_lois (company_id, title, round_name, master_expires_at, recommended_min_signers, recommended_target_signers, ticket_amount, currency, status, is_master, created_at, updated_at)
    VALUES (v_company_id, 'Lettera di Intenti', 'Round 2025', NOW() + INTERVAL '30 days', 5, 10, 100000, 'EUR', 'sent', true, NOW(), NOW())
    RETURNING id INTO v_loi_id;
    RAISE NOTICE 'LOI creata: %', v_loi_id;
  END IF;

  RAISE NOTICE 'Fix completato. Vai su /portal/%', v_slug;
END $$;
