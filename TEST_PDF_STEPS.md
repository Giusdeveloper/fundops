# Test Generazione PDF LOI - Passi Rapidi

## ✅ Stato Attuale
- ✅ Template PDF presente: `TEMPLATE_Lettera Intenti SFP 2025.pdf`
- ✅ Server dev attivo: `http://localhost:3001`
- ✅ Pagina LOI caricata: `/lois`
- ⚠️ Nessun signer presente per testare

## 🚀 Test Rapido (3 passi)

### Passo 1: Esegui Migration (se non già fatto)

Apri Supabase SQL Editor ed esegui:

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

### Passo 2: Crea LOI Master con Testi

**Opzione A: Via UI** (raccomandato)
1. Nella pagina LOI (`http://localhost:3001/lois`)
2. Clicca "+ Nuova LOI"
3. Compila il form:
   - **Titolo**: "Test PDF LOI"
   - **Round name**: "Round Test 2025"
   - **Master expires at**: (scegli una data futura, es. tra 30 giorni)
   - **Minimo Signers**: 5
   - **Target Signers**: 10
4. Clicca "Crea LOI Master"
5. **IMPORTANTE**: Dopo la creazione, aggiorna la LOI con i testi via SQL (vedi Opzione B)

**Opzione B: Via SQL** (per aggiungere testi)
```sql
-- Trova l'ID della LOI appena creata, poi esegui:
UPDATE fundops_lois
SET 
  premessa_text = 'Premessa: La presente Lettera di Intenti rappresenta un impegno non vincolante per la sottoscrizione di SFP.',
  modalita_text = 'Modalità: La sottoscrizione avverrà secondo le modalità previste dal regolamento SFP e sarà effettuata tramite piattaforma autorizzata.',
  condizioni_text = 'Condizioni: Le condizioni di sottoscrizione sono quelle previste dal regolamento SFP 2025. L''investitore si impegna a rispettare i termini e le condizioni indicate.',
  regolamento_ref = 'Regolamento SFP 2025',
  pdf_template_key = 'TEMPLATE_Lettera Intenti SFP 2025.pdf'
WHERE title = 'Test PDF LOI'
RETURNING id;
```

### Passo 3: Aggiungi Signer e Testa PDF

**Opzione A: Via UI**
1. Nella pagina LOI, sezione "Da fare ora"
2. Se ci sono investitori senza LOI, clicca "Aggiungi come signer"
3. Oppure nella tabella signers, aggiungi manualmente un signer
4. Nella tabella signers, trova il signer appena creato
5. Clicca "📄 Scarica PDF"
6. Verifica che il PDF venga scaricato e contenga tutti i dati

**Opzione B: Via SQL** (per creare signer di test)
```sql
-- Sostituisci {loi_id} e {investor_id} con ID validi
-- Per trovare un investor_id valido:
SELECT id, full_name FROM fundops_investors LIMIT 1;

-- Poi crea signer:
INSERT INTO fundops_loi_signers (
  loi_id,
  investor_id,
  status,
  indicative_amount,
  soft_commitment_at,
  hard_signed_at
) VALUES (
  '{loi_id}',  -- ID della LOI creata al Passo 2
  '{investor_id}',  -- ID di un investitore esistente
  'signed',
  50000.00,
  NOW(),
  NOW()
) RETURNING id;
```

**Test Download PDF**:
1. Vai su: `http://localhost:3001/api/lois/{loi_id}/signers/{signer_id}/pdf`
2. Oppure clicca "📄 Scarica PDF" nella tabella signers

## 🔍 Verifica Risultato

Il PDF scaricato deve contenere:
- ✅ Titolo "Lettera di Intenti"
- ✅ Dati società (ragione sociale, sede, P.IVA)
- ✅ Premessa (testo inserito)
- ✅ Modalità/Regolamento SFP (testo inserito)
- ✅ Condizioni sintetiche (testo inserito)
- ✅ Frase soft commitment standard
- ✅ Dati investitore (nome, email)
- ✅ Importo indicativo (50000.00 EUR)
- ✅ Data firma
- ✅ Stato firma ("Firmata")

## 🐛 Troubleshooting

### Errore: "Template PDF non trovato"
- Verifica: `frontend/public/templates/TEMPLATE_Lettera Intenti SFP 2025.pdf` esiste
- Riavvia server: `npm run dev`

### Errore: "LOI non trovata"
- Verifica che `loi_id` sia corretto
- Verifica che la LOI appartenga alla company selezionata

### PDF vuoto o malformato
- Controlla console del server per errori
- Verifica che `pdf-lib` sia installato: `npm list pdf-lib`

### Bottone "Scarica PDF" non visibile
- Verifica che il signer non abbia status "revoked"
- Ricarica la pagina dopo aver creato il signer

## 📝 Query Utili

```sql
-- Trova LOI con testi
SELECT id, title, 
  premessa_text IS NOT NULL as has_premessa,
  modalita_text IS NOT NULL as has_modalita,
  condizioni_text IS NOT NULL as has_condizioni,
  pdf_template_key
FROM fundops_lois
WHERE title LIKE '%Test%'
ORDER BY created_at DESC;

-- Trova signers per una LOI
SELECT s.id, s.status, s.indicative_amount, 
  i.full_name, l.title as loi_title
FROM fundops_loi_signers s
JOIN fundops_investors i ON i.id = s.investor_id
JOIN fundops_lois l ON l.id = s.loi_id
WHERE l.title LIKE '%Test%'
ORDER BY s.created_at DESC;
```
