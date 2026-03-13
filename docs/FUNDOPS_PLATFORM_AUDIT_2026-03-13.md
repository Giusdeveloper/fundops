# FundOps Platform Audit - 2026-03-13

## Executive Summary

FundOps è in uno stato adatto a un test interno guidato, ma non ancora a un rilascio “pulito” senza una passata finale di hardening operativo. I punti più critici emersi sono la sicurezza dei segreti, la pulizia del worktree, alcuni residui di debug e l’assenza di una routine ufficiale di reset tenant/test data.

La base applicativa è solida su:

- typecheck frontend
- onboarding/tutorial cross-module
- modulo `Cap Table` molto avanzato
- profilo/account e navigazione workspace

I principali rischi residui stanno nella governance del rilascio, non in un singolo modulo bloccante.

## Critical Findings

### 1. Worktree sporco e troppo ampio direttamente su `main`
- Severità: Alta
- Evidenza: `git status --short` mostra numerose modifiche e molti file untracked
- Impatto: alto rischio di commit non intenzionali, storia poco leggibile, push difficili da revisionare
- Fix consigliato: branch dedicato + commit logici + esclusione file temporanei

### 2. Mancava una procedura riusabile di reset dati per tenant test
- Severità: Alta
- Evidenza: nessuno script unico di reset `Imment` nel repo
- Impatto: test founder ripetibili solo con interventi manuali su Supabase
- Fix consigliato: introdurre script admin locali per `soft reset` e creazione founder test
- Stato: corretto in questo intervento

## Medium Findings

### 3. Debug log ancora presenti in UI produzione
- Severità: Media
- Evidenza: `frontend/src/app/companies/page.tsx`
- Impatto: rumore console, percezione di poca pulizia, rischio leak dati strutturali
- Stato: corretto in questo intervento

### 4. File temporanei/locali non ignorati in modo esplicito
- Severità: Media
- Evidenza: `.cursor/`, `.playwright-cli/`, `artifacts/`, `output/`
- Impatto: possibile staging accidentale di artefatti locali
- Stato: corretto in questo intervento via `.gitignore`

### 5. Verifica tecnica concentrata soprattutto sul typecheck
- Severità: Media
- Evidenza:
  - `tsc --noEmit` passa
  - `pnpm build` e `pnpm test:integration` falliscono nell'ambiente corrente con `spawn EPERM`
- Impatto: regressioni runtime e integration non coperte in modo sistematico in questa sessione
- Fix consigliato: ripetere build e test integration in ambiente non bloccato da `EPERM` prima o subito dopo il push del branch

### 6. Presenza di artefatti sorgente duplicati / temporanei nel workspace
- Severità: Media
- Evidenza: `frontend/src/context/CompanyContext-A6.tsx` untracked
- Impatto: rischio di confusione futura e staging accidentale
- Fix consigliato: non includerlo nel branch; ripulire localmente dopo il push

## Low Findings

### 7. Alcuni file e commenti presentano encoding sporco
- Severità: Bassa
- Evidenza: vari file UI già esistenti mostrano caratteri corrotti in output shell
- Impatto: qualità percepita e manutenibilità, ma non blocco funzionale
- Fix consigliato: passata mirata di normalizzazione encoding

### 8. Alcune route legacy usano ancora `supabaseServer`
- Severità: Bassa/Media
- Evidenza: `frontend/src/lib/supabaseServer.ts` e route documentali/portal
- Impatto: approccio valido ma da monitorare rispetto a future policy RLS e sicurezza
- Fix consigliato: mantenere inventario chiaro dei casi in cui il service role è davvero necessario

## Module Observations

### Dashboard
- Buona leggibilità generale
- Dipende molto dal corretto stato della company attiva

### Companies
- Flusso chiaro
- Era presente debug console superfluo

### LOI / Supporters
- Dominio piuttosto ricco e con molte superfici legacy/compatibilità
- Merita smoke test dedicato dopo reset tenant

### Issuance
- Buona separazione auth/app-level + service role per evitare ricorsioni RLS
- Da validare con dati reali puliti post-reset

### Cap Table
- È il modulo più evoluto lato UX/onboarding
- Da testare con founder nuovo e scenario company pulito

### Dossier / Drive
- Integrazione sensibile a permessi e configurazioni esterne
- Da includere sempre nel test interno perché è una superficie di errore ad alta probabilità

### Account / Profile
- Molto avanzato rispetto alla baseline iniziale
- Non risulta bloccante per il test interno

## Recommended Next Actions

1. Eseguire `soft reset` di `Imment`.
2. Creare il founder test dedicato.
3. Eseguire smoke test team su:
   - `Companies -> Dashboard`
   - `LOI`
   - `Issuance`
   - `Cap Table`
   - `Dossier`
4. Eseguire `build` e `test:integration` in ambiente non bloccato da `spawn EPERM`.
5. Pushare su branch dedicato, non su `main`.
