# Test Generazione PDF LOI

## Prerequisiti

1. **Esegui la migration SQL**:
   ```sql
   -- Esegui in Supabase SQL Editor
   -- File: migrations/add_loi_text_fields.sql
   ```

2. **Verifica template PDF**:
   - Il template deve essere in `frontend/public/templates/`
   - Nome file: `TEMPLATE_Lettera Intenti SFP 2025.pdf` (o configura `pdf_template_key` nella LOI)

3. **Server dev attivo**:
   - Il server Next.js deve essere in esecuzione (`npm run dev`)

## Test Step-by-Step

### 1. Verifica Migration Database

Esegui questa query in Supabase SQL Editor:

```sql
-- Verifica che i campi testo esistano
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'fundops_lois'
  AND column_name IN ('premessa_text', 'modalita_text', 'condizioni_text', 'regolamento_ref');
```

**Risultato atteso**: 4 righe (uno per ogni campo)

### 2. Crea/Verifica LOI Master con Testi

**Opzione A: Via UI**
1. Vai su `/lois`
2. Clicca "+ Nuova LOI"
3. Compila:
   - Titolo: "Test LOI PDF"
   - Round name: "Round Test 2025"
   - Master expires at: (data futura)
4. Clicca "Crea LOI Master"

**Opzione B: Via SQL**
```sql
-- Crea LOI master di test (sostituisci {company_id} con un ID valido)
INSERT INTO fundops_lois (
  company_id,
  title,
  round_name,
  master_expires_at,
  premessa_text,
  modalita_text,
  condizioni_text,
  regolamento_ref,
  pdf_template_key,
  status
) VALUES (
  '{company_id}',
  'Test LOI PDF',
  'Round Test 2025',
  NOW() + INTERVAL '30 days',
  'Premessa di test: La presente Lettera di Intenti rappresenta un impegno non vincolante.',
  'Modalità di test: La sottoscrizione avverrà secondo il regolamento SFP.',
  'Condizioni di test: Le condizioni sono quelle previste dal regolamento.',
  'Regolamento SFP 2025',
  'TEMPLATE_Lettera Intenti SFP 2025.pdf',
  'draft'
) RETURNING id;
```

### 3. Crea Signer di Test

**Opzione A: Via UI**
1. Nella pagina LOI, sezione "Da fare ora"
2. Clicca "Aggiungi come signer" su un investitore
3. Oppure nella tabella signers, aggiungi manualmente

**Opzione B: Via SQL**
```sql
-- Crea signer di test (sostituisci {loi_id} e {investor_id})
INSERT INTO fundops_loi_signers (
  loi_id,
  investor_id,
  status,
  indicative_amount,
  soft_commitment_at
) VALUES (
  '{loi_id}',
  '{investor_id}',
  'signed',
  50000.00,
  NOW()
) RETURNING id;
```

### 4. Test Endpoint API Diretto

**Test con curl**:
```bash
# Sostituisci {loi_id} e {signer_id} con ID validi
curl -X GET "http://localhost:3001/api/lois/{loi_id}/signers/{signer_id}/pdf" \
  --output test-loi.pdf
```

**Test con browser**:
1. Vai su: `http://localhost:3001/api/lois/{loi_id}/signers/{signer_id}/pdf`
2. Il PDF dovrebbe scaricarsi automaticamente

### 5. Test Via UI

1. Vai su `/lois`
2. Nella tabella "Investitori aderenti alla LOI del round"
3. Trova un signer con status diverso da "revoked"
4. Clicca "📄 Scarica PDF"
5. Verifica che il PDF venga scaricato

### 6. Verifica Contenuto PDF

Il PDF generato deve contenere:

- ✅ Titolo: "Lettera di Intenti"
- ✅ Dati società (ragione sociale, sede, P.IVA)
- ✅ Premessa (da `premessa_text`)
- ✅ Modalità/Regolamento SFP (da `modalita_text` + `regolamento_ref`)
- ✅ Condizioni sintetiche (da `condizioni_text`)
- ✅ Frase soft commitment standard
- ✅ Sezione firma investitore:
  - Nome investitore
  - Email investitore
  - Importo indicativo (se presente)
  - Data firma
  - Stato firma

### 7. Test Casi Edge

**Test 1: Signer senza importo**
- Crea signer con `indicative_amount = NULL`
- Verifica che il PDF non mostri la sezione importo

**Test 2: Signer revoked**
- Crea signer con `status = 'revoked'`
- Verifica che il bottone "Scarica PDF" sia disabilitato/non presente

**Test 3: Template mancante**
- Cambia `pdf_template_key` a un file inesistente
- Verifica che l'endpoint restituisca errore 404 con messaggio chiaro

**Test 4: LOI senza testi**
- Crea LOI senza `premessa_text`, `modalita_text`, `condizioni_text`
- Verifica che il PDF venga comunque generato (sezioni vuote)

## Troubleshooting

### Errore: "Template PDF non trovato"
- Verifica che il file esista in `frontend/public/templates/`
- Verifica che `pdf_template_key` nella LOI corrisponda al nome file
- Verifica che il server dev sia riavviato dopo aver aggiunto il template

### Errore: "LOI non trovata" o "Signer non trovato"
- Verifica che `loi_id` e `signer_id` siano corretti
- Verifica che il signer appartenga alla LOI (`signer.loi_id = loi.id`)

### PDF generato ma vuoto/malformato
- Verifica che il template PDF sia valido
- Controlla i log del server per errori durante la generazione
- Verifica che `pdf-lib` sia installato correttamente

### Errore: "Cannot read property 'getForm'"
- Il template PDF potrebbe non avere form fields (AcroForm)
- L'endpoint dovrebbe usare automaticamente il posizionamento manuale
- Verifica i log per vedere se viene usato il fallback

## Query di Verifica Post-Test

```sql
-- Verifica LOI con testi
SELECT 
  id,
  title,
  round_name,
  premessa_text IS NOT NULL as has_premessa,
  modalita_text IS NOT NULL as has_modalita,
  condizioni_text IS NOT NULL as has_condizioni,
  regolamento_ref IS NOT NULL as has_regolamento,
  pdf_template_key
FROM fundops_lois
WHERE title LIKE '%Test%'
ORDER BY created_at DESC
LIMIT 5;

-- Verifica signers con dati completi
SELECT 
  s.id,
  s.status,
  s.indicative_amount,
  s.hard_signed_at,
  s.soft_commitment_at,
  i.full_name as investor_name,
  l.title as loi_title
FROM fundops_loi_signers s
JOIN fundops_investors i ON i.id = s.investor_id
JOIN fundops_lois l ON l.id = s.loi_id
WHERE l.title LIKE '%Test%'
ORDER BY s.created_at DESC
LIMIT 5;
```

## Note

- Il template PDF deve essere un PDF valido
- Se il template ha form fields (AcroForm), vengono compilati automaticamente
- Altrimenti, viene usato il posizionamento manuale (coordinate da regolare se necessario)
- Le coordinate del posizionamento manuale sono approssimative e potrebbero dover essere regolate in base al template specifico
