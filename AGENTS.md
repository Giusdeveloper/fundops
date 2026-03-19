# AGENTS.md

Linee guida per agenti AI che lavorano su questo repository.

## Obiettivo
- Mantenere velocita di sviluppo senza compromettere sicurezza, coerenza e manutenibilita.

## Stack e Struttura
- Frontend principale: `frontend/` (Next.js App Router + TypeScript + Supabase).
- Migrazioni SQL: `migrations/`.
- Documentazione: root e `docs/`.

## Regole Operative
- Esegui modifiche minimali e mirate al task richiesto.
- Non introdurre refactor estesi se non richiesti.
- Non modificare file non correlati.
- Mantieni naming e stile gia presenti nel progetto.
- Evita dipendenze nuove se non strettamente necessarie.

## Sicurezza (obbligatorio)
- Non esporre segreti o chiavi in codice o documentazione.
- Non usare `SUPABASE_SERVICE_ROLE_KEY` nel client.
- Per API server-side preferire il client Supabase legato alla sessione utente.
- Endpoint debug/test devono essere disabilitati in produzione.

## API e Autorizzazioni
- Ogni endpoint con `company_id` deve verificare esplicitamente membership/permessi.
- Evita fallback impliciti che bypassano RLS senza controllo autorizzativo.
- Non fidarti di parametri client per isolamento tenant.

## Frontend
- Tenere separate UI e logica dati (hook/service dove possibile).
- Ridurre polling inutili; preferire eventi o stato derivato.
- Standardizzare stati `loading`, `error`, `empty`.
- Non lasciare componenti debug visibili in produzione.

## Qualita del Codice
- Evitare `any` quando possibile; preferire tipi espliciti.
- Gestire errori con messaggi chiari lato server e lato UI.
- Aggiungere commenti solo quando necessari a chiarire logica non ovvia.

## Testing e Verifica
- Dopo modifiche rilevanti: lint/build/test locali se eseguibili.
- Se l'ambiente impedisce esecuzione comandi, dichiararlo esplicitamente nel report.

## Consegna
- Riassumere:
  - cosa e stato cambiato,
  - file toccati,
  - rischi residui,
  - prossimi passi consigliati.

## Changelog
- Formato entry: `YYYY-MM-DD | autore | modifica`
- 2026-02-17 | Codex | Creazione iniziale di `AGENTS.md` con regole operative, sicurezza, API, frontend e qualita.
- 2026-02-17 | Codex | Aggiunta sezione `Changelog` per tracciare aggiornamenti progressivi del file.
- 2026-02-17 | Codex | Primo hardening frontend: debug/test protetti in produzione e rimozione polling continuo in `AppShell`.
- 2026-02-17 | Codex | Validazione `activeCompanyId` in `CompanyContext` contro `/api/my_companies` per prevenire stato tenant stale.
- 2026-02-17 | Codex | Spostato `EnsureProfileWrapper` dal root layout ai layout delle sole route protette (`dashboard`, `companies`, `investor`, `investors`, `lois`, `admin`).
- 2026-02-17 | Codex | Introdotto helper `companyAccess` per controlli riusabili di ruolo, company membership e accesso tenant.
- 2026-02-17 | Codex | Hardened API `fundops_companies`, `fundops_investors`, `fundops_lois`: rimosso fallback `supabaseServer` nei read/write core e aggiunti controlli accesso company.
- 2026-02-17 | Codex | Allineato frontend investitori: chiamata API solo con `companyId` valido e reset stato quando non selezionata.
- 2026-02-17 | Codex | Hardened API KPI/process/dashboard (`fundops_dashboard`, `fundops_investors_kpi`, `fundops_lois_kpi`, `fundops_process_status`) con auth utente e controllo accesso company.
- 2026-02-17 | Codex | Hardened API documentali LOI (`fundops_documents/upload`, `fundops_documents/delete`, `fundops_documents/generate-loi-pdf`) con auth utente, controllo accesso company e tracciamento `created_by`.
- 2026-02-17 | Codex | Hardened API LOI dettagli/maintenance (`fundops_lois/[loiId]`, `fundops_lois/expire`) con auth utente, verifica tenant e auditing eventi.
- 2026-02-17 | Codex | Hardened API signers (`/api/lois/[id]/signers`, `invite`, `accept`, `revoke`, `sign`, `set_amount`) con auth utente, verifica tenant su company LOI e `created_by` negli eventi.
- 2026-02-17 | Codex | Hardened API lifecycle LOI (`send`, `reminder`, `duplicate`, `mark-signed`, `cancel`) con auth utente, controllo accesso company e auditing `created_by`.
- 2026-02-17 | Codex | Completato hardening documentale: rimosso fallback implicito `supabaseServer || supabase` in `fundops_documents/upload`, `generate-loi-pdf`, `signed-url`; aggiunti auth+check company espliciti in `signed-url` e `lois/[id]/booking-kpi`.
- 2026-02-17 | Codex | Hardening area portal: rimosso fallback implicito `supabaseServer ?? supabase` da `getPortalContext` e `api/portal/debug`, con comportamento esplicito fail-closed in assenza configurazione server.
- 2026-02-17 | Codex | Completata rimozione fallback impliciti residui: `app/lois/[id]/page.tsx` ora usa solo client auth (`createClient`) senza `supabaseServer ?? supabase`.
- 2026-03-03 | Codex | Snapshot avanzamento FundOps: OAuth/login redirect robusto, RBAC middleware/view mode, supporter UX copy, invio LOI via Resend, API documenti round, pagina Dossier e integrazione Google Drive MVP con migrazioni dedicate.
- 2026-03-17 | Codex | Fix onboarding ruolo (scelta startup/supporter), template CSV supporter con istruzioni, LOI: spinner numero round, draft sempre visibili, numero LOI generato e doppio prefisso evitato; migrazioni per policy insert LOI e allineamento schema (expiry_date/title/round_name).
- 2026-03-17 | Codex | Centralizzata notifica email FundOps via backend: helper Resend condiviso e nuova API interna `/api/fundops/notify` con `INTERNAL_API_SECRET`.
- 2026-03-17 | Codex | Validazioni email rafforzate in UI/API e trigger reset password da login per evitare invii Supabase con email invalide.
- 2026-03-18 | Codex | Root landing page: redirect verso `/auth/callback` quando presenti `code` o errori nel querystring per gestire magic link e conferme.
- 2026-03-18 | Codex | Adeguato typing Next.js 15: `searchParams` come Promise nella landing page per build vercel.
- 2026-03-18 | Codex | Forzato `emailRedirectTo` su signup e resend conferma verso `/auth/callback`.
- 2026-03-19 | Codex | Gestione errori `otp_expired` in callback auth: redirect a login con messaggio utente.
- 2026-03-18 | Codex | Documentata configurazione SMTP Supabase via Resend e template email brandizzati.
- 2026-03-18 | Codex | Auto-assegnazione role_global da metadata/presenza account e rimozione redirect forzato su onboarding choose-role.
- 2026-03-18 | Codex | Aggiunto reinvio email di conferma dal login per OTP scaduti.
