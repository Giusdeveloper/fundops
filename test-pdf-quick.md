# Test Rapido Generazione PDF LOI

## ✅ Checklist Pre-Test

- [x] Template PDF presente: `TEMPLATE_Lettera Intenti SFP 2025.pdf`
- [ ] Migration eseguita: `add_loi_text_fields.sql`
- [ ] Server dev attivo: `npm run dev`
- [ ] LOI master con testi creata
- [ ] Signer creato e collegato alla LOI

## 🚀 Test Rapido (5 minuti)

### Step 1: Verifica Migration (30 secondi)

Apri Supabase SQL Editor ed esegui:

```sql
-- Verifica campi testo LOI
SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'fundops_lois'
  AND column_name IN ('premessa_text', 'modalita_text', 'condizioni_text', 'regolamento_ref');
```

**Se restituisce 4 righe**: ✅ Migration OK  
**Se restituisce 0 righe**: ⚠️ Esegui migration `add_loi_text_fields.sql`

### Step 2: Crea LOI di Test (2 minuti)

**Via UI**:
1. Vai su `http://localhost:3001/lois`
2. Seleziona una company
3. Clicca "+ Nuova LOI"
4. Compila:
   - Titolo: "Test PDF LOI"
   - Round name: "Round Test"
   - Master expires at: (scegli data futura)
5. Clicca "Crea LOI Master"

**Via SQL** (alternativa):
```sql
-- Sostituisci {company_id} con un ID valido dalla tua tabella fundops_companies
INSERT INTO fundops_lois (
  company_id, title, round_name, master_expires_at,
  premessa_text, modalita_text, condizioni_text, regolamento_ref,
  pdf_template_key, status
) VALUES (
  '{company_id}',
  'Test PDF LOI',
  'Round Test',
  NOW() + INTERVAL '30 days',
  'Premessa: La presente Lettera di Intenti rappresenta un impegno non vincolante per la sottoscrizione di SFP.',
  'Modalità: La sottoscrizione avverrà secondo le modalità previste dal regolamento SFP e sarà effettuata tramite piattaforma autorizzata.',
  'Condizioni: Le condizioni di sottoscrizione sono quelle previste dal regolamento SFP 2025. L''investitore si impegna a rispettare i termini e le condizioni indicate.',
  'Regolamento SFP 2025',
  'TEMPLATE_Lettera Intenti SFP 2025.pdf',
  'draft'
) RETURNING id;
```

### Step 3: Aggiungi Signer (1 minuto)

**Via UI**:
1. Nella pagina LOI, sezione "Da fare ora"
2. Trova un investitore nella lista
3. Clicca "Aggiungi come signer" o "Crea LOI" (se non esiste LOI master)

**Via SQL** (alternativa):
```sql
-- Sostituisci {loi_id} e {investor_id} con ID validi
INSERT INTO fundops_loi_signers (
  loi_id, investor_id, status, indicative_amount, soft_commitment_at, hard_signed_at
) VALUES (
  '{loi_id}',
  '{investor_id}',
  'signed',
  50000.00,
  NOW(),
  NOW()
) RETURNING id;
```

### Step 4: Test Download PDF (1 minuto)

**Via UI**:
1. Nella tabella "Investitori aderenti alla LOI del round"
2. Trova il signer appena creato
3. Clicca "📄 Scarica PDF"
4. Verifica che il PDF venga scaricato

**Via Browser diretto**:
```
http://localhost:3001/api/lois/{loi_id}/signers/{signer_id}/pdf
```

### Step 5: Verifica PDF (30 secondi)

Apri il PDF scaricato e verifica:

- ✅ Titolo "Lettera di Intenti" presente
- ✅ Dati società (ragione sociale, sede, P.IVA)
- ✅ Premessa presente
- ✅ Modalità/Regolamento presente
- ✅ Condizioni presenti
- ✅ Frase soft commitment presente
- ✅ Dati investitore presenti
- ✅ Importo indicativo presente (se configurato)
- ✅ Data firma presente
- ✅ Stato firma presente

## 🐛 Troubleshooting Rapido

### Errore: "Template PDF non trovato"
- Verifica che il file esista: `frontend/public/templates/TEMPLATE_Lettera Intenti SFP 2025.pdf`
- Riavvia il server dev: `npm run dev`

### Errore: "LOI non trovata"
- Verifica che `loi_id` sia corretto
- Verifica che la LOI appartenga alla company selezionata

### Errore: "Signer non trovato"
- Verifica che `signer_id` sia corretto
- Verifica che il signer appartenga alla LOI (`signer.loi_id = loi.id`)

### PDF vuoto o malformato
- Controlla i log del server nella console
- Verifica che `pdf-lib` sia installato: `npm list pdf-lib`
- Verifica che il template PDF sia valido (aprilo manualmente)

### Bottone "Scarica PDF" non visibile
- Verifica che il signer non abbia status "revoked"
- Verifica che la tabella signers sia caricata correttamente

## 📊 Query di Verifica Rapida

```sql
-- Verifica LOI con testi
SELECT id, title, 
  premessa_text IS NOT NULL as has_premessa,
  modalita_text IS NOT NULL as has_modalita,
  condizioni_text IS NOT NULL as has_condizioni,
  pdf_template_key
FROM fundops_lois
ORDER BY created_at DESC
LIMIT 3;

-- Verifica signers
SELECT s.id, s.status, s.indicative_amount, i.full_name, l.title
FROM fundops_loi_signers s
JOIN fundops_investors i ON i.id = s.investor_id
JOIN fundops_lois l ON l.id = s.loi_id
ORDER BY s.created_at DESC
LIMIT 3;
```

## ✅ Criteri di Successo

Il test è riuscito se:
1. ✅ Il PDF viene scaricato senza errori
2. ✅ Il PDF contiene tutti i dati della LOI e del signer
3. ✅ Il PDF è leggibile e ben formattato
4. ✅ L'importo indicativo appare solo se presente
5. ✅ Il watermark appare per signer expired/revoked
