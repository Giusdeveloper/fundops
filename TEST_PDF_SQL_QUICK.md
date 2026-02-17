# Test PDF LOI - Setup SQL Rapido

## 🚀 Esecuzione Rapida

### 1. Esegui Migration Campi Testo (se non già fatto)

```sql
-- File: migrations/add_loi_text_fields.sql
ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS premessa_text TEXT NULL;

ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS modalita_text TEXT NULL;

ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS condizioni_text TEXT NULL;

ALTER TABLE fundops_lois
ADD COLUMN IF NOT EXISTS regolamento_ref VARCHAR(255) NULL;
```

### 2. Esegui Script Setup Test

```sql
-- File: migrations/test_pdf_loi_setup.sql
-- Copia e incolla tutto il contenuto del file in Supabase SQL Editor
-- Lo script creerà automaticamente:
--   - Una LOI master con testi completi
--   - Un signer collegato con status 'signed'
--   - Tutti i dati necessari per il test
```

### 3. Verifica Output

Dopo l'esecuzione, lo script mostrerà:
- Company ID utilizzata
- LOI ID creata
- Signer ID creato
- Investor ID utilizzato
- URL diretto per testare il PDF

### 4. Test Download PDF

**Opzione A: Via Browser**
```
http://localhost:3001/api/lois/{loi_id}/signers/{signer_id}/pdf
```
(Sostituisci `{loi_id}` e `{signer_id}` con i valori mostrati nello script)

**Opzione B: Via UI**
1. Vai su `http://localhost:3001/lois`
2. Seleziona la company mostrata nello script
3. Nella tabella "Investitori aderenti alla LOI del round"
4. Clicca "📄 Scarica PDF" sul signer creato

## 🔍 Verifica Dati Creati

```sql
-- Verifica LOI creata
SELECT 
  id, title, round_name,
  premessa_text IS NOT NULL as has_premessa,
  modalita_text IS NOT NULL as has_modalita,
  condizioni_text IS NOT NULL as has_condizioni,
  pdf_template_key,
  master_expires_at
FROM fundops_lois
WHERE title = 'Test PDF LOI - Generazione Automatica'
ORDER BY created_at DESC
LIMIT 1;

-- Verifica Signer creato
SELECT 
  s.id,
  s.status,
  s.indicative_amount,
  s.hard_signed_at,
  i.full_name as investor_name,
  i.email as investor_email,
  l.title as loi_title
FROM fundops_loi_signers s
JOIN fundops_investors i ON i.id = s.investor_id
JOIN fundops_lois l ON l.id = s.loi_id
WHERE l.title = 'Test PDF LOI - Generazione Automatica'
ORDER BY s.created_at DESC
LIMIT 1;
```

## 🧹 Pulizia Dati Test (opzionale)

Se vuoi rimuovere i dati di test:

```sql
-- Rimuovi signer di test
DELETE FROM fundops_loi_signer_events
WHERE signer_id IN (
  SELECT s.id
  FROM fundops_loi_signers s
  JOIN fundops_lois l ON l.id = s.loi_id
  WHERE l.title = 'Test PDF LOI - Generazione Automatica'
);

-- Rimuovi signer
DELETE FROM fundops_loi_signers
WHERE loi_id IN (
  SELECT id FROM fundops_lois
  WHERE title = 'Test PDF LOI - Generazione Automatica'
);

-- Rimuovi LOI
DELETE FROM fundops_lois
WHERE title = 'Test PDF LOI - Generazione Automatica';
```

## ✅ Criteri di Successo

Il test è riuscito se:
1. ✅ Lo script SQL viene eseguito senza errori
2. ✅ LOI master viene creata con tutti i testi
3. ✅ Signer viene creato con status 'signed'
4. ✅ Il PDF viene scaricato senza errori
5. ✅ Il PDF contiene tutti i dati (premessa, modalità, condizioni, dati investitore, importo, data firma)
