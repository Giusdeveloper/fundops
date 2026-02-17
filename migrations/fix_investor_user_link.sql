-- Fix link user -> investor per pistoia702@gmail.com
-- Esegui nel SQL Editor di Supabase

-- 1. Verifica: user esiste?
SELECT id, email FROM auth.users WHERE LOWER(email) = 'pistoia702@gmail.com';

-- 2. Verifica: investitore esiste?
SELECT id, email FROM fundops_investors WHERE LOWER(TRIM(email)) = 'pistoia702@gmail.com';

-- 3. Esegui il fix (crea il link)
DO $$
DECLARE
  v_user_id UUID;
  v_investor_id UUID;
  v_email TEXT := 'pistoia702@gmail.com';
BEGIN
  -- 1. Trova user
  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = LOWER(v_email) LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utente % non trovato in auth.users', v_email;
  END IF;
  RAISE NOTICE 'User trovato: %', v_user_id;

  -- 2. Trova investor (prova match esatto e con TRIM)
  SELECT id INTO v_investor_id
  FROM fundops_investors
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email))
  LIMIT 1;
  IF v_investor_id IS NULL THEN
    RAISE EXCEPTION 'Investitore con email % non trovato in fundops_investors', v_email;
  END IF;
  RAISE NOTICE 'Investitore trovato: %', v_investor_id;

  -- 3. Inserisci link
  INSERT INTO fundops_investor_users (user_id, investor_id)
  VALUES (v_user_id, v_investor_id)
  ON CONFLICT (user_id, investor_id) DO NOTHING;

  RAISE NOTICE 'Link creato. Ricarica /portal/imment-srl';
END $$;
