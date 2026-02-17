-- Script per creare/pubblicare una LOI per il portal Imment
-- Esegui nel SQL Editor di Supabase dopo seed_portal_access_manual.sql
-- Così l'investitore vedrà il form di firma su /portal/imment-srl

DO $$
DECLARE
  v_company_id UUID;
  v_loi_id UUID;
  v_exists BOOLEAN;
BEGIN
  -- 1. Trova company Imment Srl
  SELECT id INTO v_company_id
  FROM fundops_companies
  WHERE public_slug = 'imment-srl'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company con slug imment-srl non trovata. Verifica public_slug.';
  END IF;

  -- 2. Assicura che is_master esista (alcuni setup potrebbero non averlo)
  ALTER TABLE fundops_lois ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT true;

  -- 3. Cerca LOI esistente per la company (qualsiasi status)
  SELECT id INTO v_loi_id
  FROM fundops_lois
  WHERE company_id = v_company_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_loi_id IS NOT NULL THEN
    -- Aggiorna LOI esistente a status=sent e is_master=true
    UPDATE fundops_lois
    SET
      status = 'sent',
      is_master = true,
      updated_at = NOW()
    WHERE id = v_loi_id;
    RAISE NOTICE 'LOI esistente aggiornata a status=sent: %', v_loi_id;
  ELSE
    -- 4. Crea nuova LOI di test per il portal
    INSERT INTO fundops_lois (
      company_id,
      title,
      round_name,
      master_expires_at,
      recommended_min_signers,
      recommended_target_signers,
      ticket_amount,
      currency,
      status,
      is_master,
      created_at,
      updated_at
    )
    VALUES (
      v_company_id,
      'Lettera di Intenti - Round Imment',
      'Round Imment 2025',
      NOW() + INTERVAL '30 days',
      5,
      10,
      100000.00,
      'EUR',
      'sent',
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_loi_id;
    RAISE NOTICE 'LOI creata e pubblicata: %', v_loi_id;
  END IF;

  RAISE NOTICE 'Portal pronto. Vai su /portal/imment-srl con un investitore configurato.';
END $$;
