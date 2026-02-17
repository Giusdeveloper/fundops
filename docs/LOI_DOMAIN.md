# Dominio LOI (Letter of Intent) - FundOps

## Principi di Dominio

### 1. LOI Master Document
- **Una LOI per company/round**: La LOI è un documento master unico per company e round/campagna
- **Non una LOI per investitore**: Gli investitori aderiscono alla LOI master tramite `fundops_loi_signers`
- **Appartenenza**: La LOI appartiene a:
  - (a) La company (`fundops_lois.company_id`)
  - (b) Il round/campaign (`fundops_lois.round_name`)
  - (c) Il sistema FundOps

### 2. Signers (Investitori Aderenti)
- **Source of Truth**: `fundops_loi_signers` è la fonte di verità per i commitment degli investitori
- **Stati**: `invited` → `accepted` (soft commitment) → `signed` (hard signature) → `expired`/`revoked`
- **Scadenze**: Ogni signer può avere `expires_at_override`, altrimenti usa `fundops_lois.master_expires_at`

### 3. Soglia per Fase Successiva (Issuing)
- **Metrica**: Numero di LOI firmate (`signers.status = 'signed'`)
- **Soglia consigliata**: 5-10 LOI firmate
- **NON basata su importi**: Gli importi (`indicative_amount`) sono facoltativi e non usati per soglie

### 4. Importi
- **Facoltativi**: `indicative_amount` può essere NULL
- **Non vincolanti**: Non usati per calcolare soglie o readiness
- **Solo informativi**: Utili per visualizzazione e reporting, ma non per decisioni di business

## Schema Database

### `fundops_lois` (LOI Master)
```sql
- id (UUID, PK)
- company_id (UUID, FK) - Company di riferimento
- investor_id (UUID, FK, NULLABLE, DEPRECATO) - Mantenuto solo per compatibilità legacy
- round_name (VARCHAR, NULL) - Nome round/campagna
- title (VARCHAR) - Titolo LOI master
- master_expires_at (TIMESTAMPTZ, NULL) - Scadenza default per signers
- recommended_min_signers (INTEGER, DEFAULT 5) - Minimo consigliato
- recommended_target_signers (INTEGER, DEFAULT 10) - Target consigliato
- ticket_amount (NUMERIC, NULL) - Importo indicativo round (opzionale)
- currency (VARCHAR, DEFAULT 'EUR')
- pdf_template_key (VARCHAR, NULL)
- pdf_template_version (VARCHAR, NULL)
- status (VARCHAR) - Status legacy (draft/sent/signed/expired/cancelled)
- notes (TEXT, NULL)
- created_at, updated_at
```

**Note**: `investor_id` è deprecato. Non usarlo nelle nuove query/UX. Source of truth per investitori è `fundops_loi_signers`.

### `fundops_loi_signers` (Investitori Aderenti)
```sql
- id (UUID, PK)
- loi_id (UUID, FK) - Riferimento LOI master
- investor_id (UUID, FK) - Investitore aderente
- status (TEXT) - invited | accepted | signed | expired | revoked
- soft_commitment_at (TIMESTAMPTZ, NULL) - Timestamp accettazione soft
- hard_signed_at (TIMESTAMPTZ, NULL) - Timestamp firma hard
- expires_at_override (TIMESTAMPTZ, NULL) - Scadenza personalizzata (sovrascrive master_expires_at)
- indicative_amount (NUMERIC, NULL) - Importo indicativo (facoltativo)
- notes (TEXT, NULL)
- created_at, updated_at
- UNIQUE(loi_id, investor_id)
```

**Source of Truth**: Questa tabella è la fonte di verità per:
- Commitment degli investitori
- Stati (invited/accepted/signed)
- Scadenze effettive
- Importi indicativi

### `fundops_loi_signer_events` (Audit Trail)
```sql
- id (UUID, PK)
- signer_id (UUID, FK)
- event_type (TEXT) - invited | accepted | signed | revoked | expired | amount_set | expiry_override_set
- event_data (JSONB, NULL)
- created_at (TIMESTAMPTZ)
- created_by (VARCHAR, NULL)
```

## API Endpoints

### KPI per Company
**GET** `/api/fundops_lois_kpi?companyId={id}`

Ritorna:
```json
{
  "total_signers": 15,
  "signed_signers_count": 7,  // Metrica principale per soglia fase
  "accepted_signers_count": 3,
  "active_lois_count": 1,      // Numero LOI master attive
  "expiringLois": 2,
  "pipelineCapital": 500000,   // Somma indicative_amount (solo se non nullo)
  "committedCapital": 300000
}
```

**Metrica per soglia**: `signed_signers_count` (5-10 consigliati)

### Lista LOI Master
**GET** `/api/fundops_lois?companyId={id}`

Ritorna LOI master con aggregati signers:
```json
{
  "data": [
    {
      "id": "...",
      "title": "Round A 2025",
      "round_name": "Round A 2025",
      "signers_count": 10,
      "signed_count": 5,
      "accepted_count": 3,
      "invited_count": 2,
      "next_expiry": "2025-12-31T00:00:00Z"
    }
  ]
}
```

### Dettaglio LOI con Signers
**GET** `/api/lois/{id}/signers`

Ritorna LOI master + lista signers con dati investitore e scadenza effettiva.

### Creazione LOI Master
**POST** `/api/fundops_lois`

Body:
```json
{
  "company_id": "...",
  "round_name": "Round A 2025",  // Opzionale
  "title": "Round A 2025",       // Obbligatorio
  "master_expires_at": "...",     // Opzionale
  "recommended_min_signers": 5,   // Opzionale (default 5)
  "recommended_target_signers": 10, // Opzionale (default 10)
  "ticket_amount": 100000,        // Opzionale
  "currency": "EUR",              // Opzionale
  "notes": "..."                  // Opzionale
}
```

**Nota**: `investor_id` NON è più richiesto. Gli investitori vengono aggiunti come signers dopo la creazione.

### Aggiunta Signer
**POST** `/api/lois/{id}/signers/invite`

Body:
```json
{
  "investor_ids": ["id1", "id2", ...]
}
```

Crea signers con `status='invited'` e registra evento `'invited'`.

## Workflow Utente

### Creazione LOI Master
1. Utente clicca "+ Nuova LOI"
2. Compila form LOI master (titolo obbligatorio, resto opzionale)
3. Sistema crea `fundops_lois` record (senza `investor_id`)
4. Utente può ora aggiungere investitori come signers

### Aggiunta Investitore
1. Se LOI master esiste:
   - Clicca "Aggiungi come signer" accanto a investitore
   - Sistema chiama `POST /api/lois/{id}/signers/invite`
   - Signer creato con `status='invited'`
2. Se LOI master NON esiste:
   - Sistema propone di creare LOI master prima
   - Dopo creazione, aggiunge investitore come signer

### Gestione Signers
- **Invited** → Bottone "Registra accettazione" → `status='accepted'`, `soft_commitment_at=now()`
- **Accepted** → Bottone "Registra firma" → `status='signed'`, `hard_signed_at=now()`
- **Sempre** → Bottone "Revoca" → `status='revoked'`

## Migration Dati

La migration `harden_loi_domain.sql`:
1. Rende `investor_id` nullable in `fundops_lois`
2. Crea signers per LOI esistenti che hanno `investor_id`:
   - Mappa status legacy a status signer
   - Usa `expiry_date` come `expires_at_override`
   - Usa `ticket_amount` come `indicative_amount`
3. Dopo migration, tutte le query devono usare `fundops_loi_signers` come source of truth

## Testing Manuale

### Test End-to-End
1. **Crea LOI Master**:
   - Clicca "+ Nuova LOI"
   - Compila solo titolo (obbligatorio)
   - Clicca "Crea LOI Master"
   - Verifica: LOI creata senza errori

2. **Aggiungi Signer**:
   - Nella sezione "Da fare ora", clicca "Aggiungi come signer" accanto a un investitore
   - Verifica: Signer creato con `status='invited'` nella tabella

3. **Registra Accettazione**:
   - Clicca "Registra accettazione" su signer invited
   - Verifica: `status='accepted'`, `soft_commitment_at` valorizzato

4. **Registra Firma**:
   - Clicca "Registra firma" su signer accepted
   - Verifica: `status='signed'`, `hard_signed_at` valorizzato, KPI `signed_signers_count` aggiornato

5. **Verifica Soglia**:
   - Aggiungi 5 signers e registra firma per tutti
   - Verifica: Dashboard mostra "Valuta passaggio a Issuing" quando `signed_signers_count >= 5`

## Note Implementative

- **Non usare `investor_id`** in `fundops_lois` per nuove query
- **Source of truth**: `fundops_loi_signers` per commitment investitori
- **KPI**: Basati su `signed_signers_count`, NON su importi
- **Copy UI**: Enfatizzare "5-10 LOI firmate" come soglia, NON importi
