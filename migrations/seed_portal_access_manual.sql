-- Script per dare accesso al portal a un utente (test/manuale)
-- Sostituisci 'pistoia702@gmail.com' con l'email dell'utente
-- Esegui nel SQL Editor di Supabase

DO $$
DECLARE
  v_company_id UUID;
  v_investor_id UUID;
  v_user_id UUID;
  v_email TEXT := 'pistoia702@gmail.com';
BEGIN
  -- 1. Trova company Imment Srl
  SELECT id INTO v_company_id
  FROM fundops_companies
  WHERE public_slug = 'imment-srl'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company con slug imment-srl non trovata';
  END IF;

  -- 2. Trova user_id da auth.users per email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(v_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utente con email % non trovato in auth.users. L''utente deve aver fatto almeno un login.', v_email;
  END IF;

  -- 3. Trova o crea investitore
  SELECT id INTO v_investor_id
  FROM fundops_investors
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email))
  LIMIT 1;

  IF v_investor_id IS NULL THEN
    INSERT INTO fundops_investors (email, full_name, company_id, client_company_id)
    VALUES (v_email, NULL, v_company_id, v_company_id)
    RETURNING id INTO v_investor_id;
    RAISE NOTICE 'Investitore creato: %', v_investor_id;
  ELSE
    RAISE NOTICE 'Investitore esistente: %', v_investor_id;
  END IF;

  -- 4. Crea investor_account (se non esiste)
  INSERT INTO fundops_investor_accounts (investor_id, company_id, lifecycle_stage, source, registered_at, is_active)
  VALUES (v_investor_id, v_company_id, 'registered', 'manual', NOW(), true)
  ON CONFLICT (investor_id, company_id) DO NOTHING;

  -- 5. Collega user a investor
  INSERT INTO fundops_investor_users (user_id, investor_id)
  VALUES (v_user_id, v_investor_id)
  ON CONFLICT (user_id, investor_id) DO NOTHING;

  RAISE NOTICE 'Accesso portal configurato per %', v_email;
END $$;
