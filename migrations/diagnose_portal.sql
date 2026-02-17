-- DIAGNOSTICA PORTAL - Esegui nel SQL Editor di Supabase
-- Sostituisci 'pistoia702@gmail.com' e 'imment-srl' se diversi

-- 1. Company con public_slug (deve esserci imment-srl)
SELECT '1_COMPANIES' as step, id, name, public_slug FROM fundops_companies WHERE public_slug IS NOT NULL;

-- 2. Company Imment
SELECT '2_IMMENT' as step, id, name, public_slug FROM fundops_companies WHERE public_slug = 'imment-srl';

-- 3. Utente auth
SELECT '3_USER' as step, id, email FROM auth.users WHERE LOWER(email) = 'pistoia702@gmail.com';

-- 4. Investitore
SELECT '4_INVESTOR' as step, id, email, client_company_id FROM fundops_investors WHERE LOWER(TRIM(email)) = 'pistoia702@gmail.com';

-- 5. Link user->investor
SELECT '5_LINK' as step, iu.user_id, iu.investor_id, u.email
FROM fundops_investor_users iu
JOIN auth.users u ON u.id = iu.user_id
WHERE LOWER(u.email) = 'pistoia702@gmail.com';

-- 6. Investor account
SELECT '6_ACCOUNT' as step, ia.investor_id, ia.company_id, c.name
FROM fundops_investor_accounts ia
JOIN fundops_companies c ON c.id = ia.company_id
JOIN fundops_investors i ON i.id = ia.investor_id
WHERE LOWER(i.email) = 'pistoia702@gmail.com';

-- 7. LOI sent (solo colonne base: id, status)
SELECT '7_LOI' as step, l.id, l.status FROM fundops_lois l
JOIN fundops_companies c ON c.id = l.company_id
WHERE c.public_slug = 'imment-srl' AND l.status = 'sent';

-- 8. Riepilogo
DO $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_investor_id UUID;
  v_has_account BOOLEAN;
  v_has_iu BOOLEAN;
  v_loi_count INT;
BEGIN
  SELECT id INTO v_company_id FROM fundops_companies WHERE public_slug = 'imment-srl' LIMIT 1;
  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = 'pistoia702@gmail.com' LIMIT 1;
  SELECT id INTO v_investor_id FROM fundops_investors WHERE LOWER(TRIM(email)) = 'pistoia702@gmail.com' LIMIT 1;
  
  SELECT EXISTS(SELECT 1 FROM fundops_investor_users WHERE user_id = v_user_id) INTO v_has_iu;
  SELECT EXISTS(SELECT 1 FROM fundops_investor_accounts WHERE investor_id = v_investor_id AND company_id = v_company_id) INTO v_has_account;
  SELECT COUNT(*) INTO v_loi_count FROM fundops_lois WHERE company_id = v_company_id AND status = 'sent';

  RAISE NOTICE 'Company (imment-srl): %', CASE WHEN v_company_id IS NOT NULL THEN 'OK' ELSE 'MANCA - imposta public_slug' END;
  RAISE NOTICE 'User auth: %', CASE WHEN v_user_id IS NOT NULL THEN 'OK' ELSE 'MANCA - utente deve fare login' END;
  RAISE NOTICE 'Investitore: %', CASE WHEN v_investor_id IS NOT NULL THEN 'OK' ELSE 'MANCA - esegui seed_portal_access_manual' END;
  RAISE NOTICE 'Link user->investor: %', CASE WHEN v_has_iu THEN 'OK' ELSE 'MANCA - esegui seed_portal_access_manual' END;
  RAISE NOTICE 'Investor account: %', CASE WHEN v_has_account THEN 'OK' ELSE 'MANCA - esegui seed_portal_access_manual' END;
  RAISE NOTICE 'LOI status=sent: %', CASE WHEN v_loi_count > 0 THEN 'OK (' || v_loi_count || ')' ELSE 'MANCA - esegui seed_portal_loi_imment' END;
END $$;
