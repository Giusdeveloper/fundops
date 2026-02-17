-- Fix: infinite recursion in policy for relation "fundops_company_users"
-- La ricorsione avviene quando le policy su altre tabelle (fundops_companies, fundops_lois, etc.)
-- usano is_company_admin() che legge fundops_company_users, e fundops_company_users ha una policy
-- che a sua volta richiama quelle tabelle.
--
-- Soluzione: policy semplice su fundops_company_users che NON referenzia altre tabelle RLS,
-- e modifica is_company_admin per usare bypass RLS esplicito.

-- 1. Rimuovi eventuali policy esistenti su fundops_company_users che causano ricorsione
DROP POLICY IF EXISTS "fundops_company_users_select_own" ON public.fundops_company_users;
DROP POLICY IF EXISTS "fundops_company_users_select" ON public.fundops_company_users;
DROP POLICY IF EXISTS "Allow read for company users" ON public.fundops_company_users;
DROP POLICY IF EXISTS "Users can view own company memberships" ON public.fundops_company_users;

-- 2. Policy semplice: utente vede solo le proprie righe (nessun riferimento ad altre tabelle)
CREATE POLICY "fundops_company_users_select_own" ON public.fundops_company_users
FOR SELECT
USING (user_id = auth.uid());

-- 3. Ricrea is_company_admin con bypass RLS esplicito tramite table owner
-- In PostgreSQL, le funzioni SECURITY DEFINER eseguono con i privilegi del creatore.
-- Se la funzione è creata da postgres (table owner), la lettura bypassa RLS.
-- Per sicurezza, usiamo una subquery che non attiva policy ricorsive.
CREATE OR REPLACE FUNCTION public.is_company_admin(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fundops_company_users
    WHERE user_id = auth.uid() AND company_id = p_company_id AND is_active = true
  );
$$;

-- Nota: se la ricorsione persiste, fundops_company_users potrebbe avere altre policy.
-- Esegui in Supabase SQL Editor per verificare:
-- SELECT * FROM pg_policies WHERE tablename = 'fundops_company_users';
