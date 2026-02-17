# Migration: Hardening Dominio LOI

## Scopo
Consolidare il dominio LOI da modello "one LOI per investitore" a modello "LOI master + signers".

## File Migration
- `harden_loi_domain.sql` - Migration completa con:
  - Deprecazione `investor_id` in `fundops_lois`
  - Creazione tabelle `fundops_loi_signers` e `fundops_loi_signer_events` (se non esistenti)
  - Migration dati: crea signers per LOI esistenti

## Esecuzione

### Prerequisiti
- Database Supabase accessibile
- Backup del database (consigliato)

### Passi

1. **Esegui migration SQL**:
   ```sql
   -- Copia e incolla il contenuto di harden_loi_domain.sql nel SQL Editor di Supabase
   ```

2. **Verifica migration dati**:
   ```sql
   -- Controlla che i signers siano stati creati
   SELECT COUNT(*) FROM fundops_loi_signers;
   
   -- Verifica che ogni LOI con investor_id abbia almeno un signer
   SELECT l.id, l.investor_id, COUNT(s.id) as signers_count
   FROM fundops_lois l
   LEFT JOIN fundops_loi_signers s ON s.loi_id = l.id
   WHERE l.investor_id IS NOT NULL
   GROUP BY l.id, l.investor_id
   HAVING COUNT(s.id) = 0;
   -- Dovrebbe restituire 0 righe
   ```

3. **Verifica KPI**:
   - Accedi alla pagina LOI
   - Verifica che i KPI mostrino `signed_signers_count` invece di conteggi LOI individuali

## Rollback (se necessario)

Se la migration causa problemi:

```sql
-- Rimuovi signers creati dalla migration (attenzione: cancella anche signers creati manualmente)
DELETE FROM fundops_loi_signer_events 
WHERE signer_id IN (
  SELECT id FROM fundops_loi_signers 
  WHERE created_at > '2025-01-XX' -- Data approssimativa della migration
);

DELETE FROM fundops_loi_signers 
WHERE created_at > '2025-01-XX';

-- Ripristina NOT NULL su investor_id (solo se necessario)
-- ALTER TABLE fundops_lois ALTER COLUMN investor_id SET NOT NULL;
```

## Testing Post-Migration

### Test Manuali

1. **Crea LOI Master**:
   - Vai su pagina LOI
   - Clicca "+ Nuova LOI"
   - Compila solo titolo (obbligatorio)
   - Clicca "Crea LOI Master"
   - ✅ Verifica: LOI creata senza errori

2. **Aggiungi Signer**:
   - Nella sezione "Da fare ora", clicca "Aggiungi come signer"
   - ✅ Verifica: Signer creato con `status='invited'`

3. **Registra Accettazione**:
   - Clicca "Registra accettazione" su signer invited
   - ✅ Verifica: `status='accepted'`, `soft_commitment_at` valorizzato

4. **Registra Firma**:
   - Clicca "Registra firma" su signer accepted
   - ✅ Verifica: `status='signed'`, `hard_signed_at` valorizzato
   - ✅ Verifica: KPI `signed_signers_count` aggiornato

5. **Verifica Soglia**:
   - Aggiungi 5 signers e registra firma per tutti
   - ✅ Verifica: Dashboard mostra "Valuta passaggio a Issuing" quando `signed_signers_count >= 5`

### Query di Verifica

```sql
-- Verifica che tutte le LOI con investor_id abbiano signer corrispondente
SELECT 
  l.id as loi_id,
  l.investor_id,
  COUNT(s.id) as signers_count
FROM fundops_lois l
LEFT JOIN fundops_loi_signers s ON s.loi_id = l.id AND s.investor_id = l.investor_id
WHERE l.investor_id IS NOT NULL
GROUP BY l.id, l.investor_id
HAVING COUNT(s.id) = 0;
-- Dovrebbe restituire 0 righe

-- Verifica KPI per una company
-- Sostituisci {company_id} con un ID valido
SELECT 
  COUNT(DISTINCT l.id) as active_lois_count,
  COUNT(s.id) as total_signers,
  COUNT(CASE WHEN s.status = 'signed' THEN 1 END) as signed_signers_count,
  COUNT(CASE WHEN s.status = 'accepted' THEN 1 END) as accepted_signers_count
FROM fundops_lois l
LEFT JOIN fundops_loi_signers s ON s.loi_id = l.id
WHERE l.company_id = '{company_id}'
  AND (s.status IS NULL OR s.status NOT IN ('expired', 'revoked'));
```

## Note Importanti

- **Non-breaking**: La migration è progettata per essere non-breaking
- **Legacy support**: `investor_id` rimane nella tabella per compatibilità, ma è deprecato
- **Source of truth**: Dopo la migration, `fundops_loi_signers` è la fonte di verità per commitment investitori
- **KPI**: Tutti i KPI devono essere basati su `fundops_loi_signers`, non su `fundops_lois.investor_id`

## Supporto

In caso di problemi:
1. Verifica i log di Supabase per errori SQL
2. Controlla che le tabelle `fundops_loi_signers` e `fundops_loi_signer_events` esistano
3. Verifica che gli indici siano stati creati correttamente
4. Consulta `docs/LOI_DOMAIN.md` per dettagli sul dominio
