# BLUEPRINT PROGETTO FUNDOPS
## Smart Equity - Piattaforma di Gestione Equity e Investimenti

**Versione**: 1.0  
**Data**: Gennaio 2025  
**Stato**: In Produzione

---

## 📋 INDICE

1. [Panoramica Generale](#panoramica-generale)
2. [Architettura Tecnica](#architettura-tecnica)
3. [Database Schema](#database-schema)
4. [API Routes](#api-routes)
5. [Pagine e Componenti](#pagine-e-componenti)
6. [Flussi di Lavoro](#flussi-di-lavoro)
7. [Funzionalità Implementate](#funzionalità-implementate)
8. [Design System](#design-system)
9. [Configurazione e Setup](#configurazione-e-setup)

---

## 🎯 PANORAMICA GENERALE

### Scopo del Progetto
FundOps è una piattaforma web per la gestione completa del fundraising, con focus su:
- **Gestione Investitori**: CRUD completo, import CSV, riconciliazione con aziende
- **Gestione LOI (Letter of Intent)**: Creazione, tracking, documenti, eventi
- **Gestione Aziende**: Multi-company support, import CSV, filtri avanzati
- **Dashboard Analytics**: KPI, metriche, todo list, attività recenti

### Stack Tecnologico
- **Frontend**: Next.js 15.4.1 (App Router), React 19.1.0, TypeScript 5
- **Styling**: CSS Modules (NO Tailwind CSS)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (per documenti LOI)
- **Icons**: Lucide React
- **Charts**: Recharts (per dashboard)
- **Build**: Turbopack

---

## 🏗️ ARCHITETTURA TECNICA

### Struttura Directory

```
frontend/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (app)/                    # Route protette
│   │   │   ├── dashboard/            # Dashboard principale
│   │   │   ├── investitori/          # Lista investitori (legacy)
│   │   │   └── loi/                  # Lista LOI (legacy)
│   │   ├── (auth)/                   # Route autenticazione
│   │   │   └── login/                 # Pagina login
│   │   ├── api/                      # API Routes (Backend)
│   │   │   ├── fundops_companies/     # CRUD aziende
│   │   │   ├── fundops_companies_import/  # Import CSV aziende
│   │   │   ├── fundops_investors/     # CRUD investitori
│   │   │   ├── fundops_investors_import/ # Import CSV investitori
│   │   │   ├── fundops_investors_reconcile/ # Riconciliazione
│   │   │   ├── fundops_investors_kpi/ # KPI investitori
│   │   │   ├── fundops_lois/          # CRUD LOI
│   │   │   ├── fundops_lois_kpi/      # KPI LOI
│   │   │   ├── fundops_lois_todo/     # Todo LOI
│   │   │   ├── fundops_loi_events/    # Eventi LOI
│   │   │   ├── fundops_documents/     # Gestione documenti
│   │   │   └── fundops_dashboard/     # Dashboard aggregata
│   │   ├── companies/                # Pagina aziende (nuova)
│   │   ├── investors/                # Pagina investitori (nuova)
│   │   ├── lois/                     # Pagina LOI (nuova)
│   │   └── dashboard/                # Dashboard principale
│   ├── components/                   # Componenti riutilizzabili
│   │   ├── loi/                      # Componenti LOI
│   │   ├── investors/               # Componenti investitori
│   │   ├── AppShell.tsx             # Shell applicazione
│   │   ├── Sidebar.tsx               # Navigazione laterale
│   │   ├── Header.tsx                # Header applicazione
│   │   ├── CompanySwitcher.tsx       # Selettore azienda
│   │   └── ToastProvider.tsx         # Sistema notifiche
│   ├── context/                      # React Context
│   │   └── CompanyContext.tsx        # Context azienda attiva
│   ├── lib/                          # Librerie e utilities
│   │   ├── supabaseClient.ts         # Client Supabase (client-side)
│   │   ├── supabaseServer.ts         # Client Supabase (server-side)
│   │   ├── loiStatus.ts              # Utility status LOI
│   │   ├── loiExpiry.ts              # Utility scadenze LOI
│   │   └── loiEvents.ts              # Utility eventi LOI
│   ├── services/                     # Servizi business logic
│   │   ├── investorService.ts       # Servizio investitori
│   │   └── loiService.ts            # Servizio LOI
│   ├── types/                        # TypeScript types
│   │   ├── investor.ts              # Types investitori
│   │   └── loi.ts                   # Types LOI
│   └── utils/                        # Utility functions
│       ├── formatUtils.ts            # Formattazione dati
│       ├── pdfGenerator.ts           # Generazione PDF
│       └── loiTemplate.ts            # Template LOI
├── migrations/                       # SQL migrations
│   ├── create_fundops_documents_table.sql
│   ├── add_import_fields_to_fundops_companies.sql
│   ├── add_import_fields_to_fundops_investors.sql
│   ├── add_missing_fields_to_fundops_companies.sql
│   └── add_reminder_fields_to_fundops_lois.sql
└── public/                           # Asset statici
```

### Pattern Architetturali

1. **Multi-Company Architecture**
   - Context API per gestire `activeCompanyId` globalmente
   - Tutte le query filtrano per `company_id` o `client_company_id`
   - Company switcher in header per cambio contesto

2. **Server-Side Rendering (SSR)**
   - API Routes Next.js per backend logic
   - Supabase client server-side per query sicure
   - Client-side hydration per interattività

3. **Component-Based Architecture**
   - Componenti riutilizzabili in `/components`
   - CSS Modules per styling isolato
   - TypeScript per type safety

---

## 🗄️ DATABASE SCHEMA

### Tabelle Principali

#### `fundops_companies`
Gestisce le aziende/clienti del sistema.

**Campi principali**:
- `id` (UUID, PK)
- `name` (VARCHAR) - Nome azienda
- `legal_name` (VARCHAR) - Ragione sociale
- `vat_number` (VARCHAR) - Partita IVA
- `email`, `pec`, `city`, `notes`
- `settore`, `website`, `profilo_linkedin`
- `created_at`, `updated_at`

**Indici**:
- `idx_companies_name`
- `idx_companies_vat`

#### `fundops_investors`
Gestisce gli investitori.

**Campi principali**:
- `id` (UUID, PK)
- `company_id` (UUID, FK) - Azienda di origine
- `full_name`, `email`, `phone`
- `category`, `type`, `investor_type`
- `source_type`, `source`, `client_name`
- `linkedin`, `notes`
- `client_company_id` (UUID, FK) - Azienda riconciliata
- `client_company_match_type` (ENUM) - Tipo match: exact, normalized, manual
- `client_company_matched_at` (TIMESTAMP)
- `created_at`, `updated_at`

**Indici**:
- `idx_investors_company_id`
- `idx_investors_client_company_id`
- `idx_investors_email`

#### `fundops_lois`
Gestisce le Lettere d'Intenti.

**Campi principali**:
- `id` (UUID, PK)
- `investor_id` (UUID, FK) - Riferimento investitore
- `company_id` (UUID, FK) - Azienda di riferimento
- `loi_number` (VARCHAR) - Numero LOI univoco
- `title` (VARCHAR) - Titolo LOI
- `ticket_amount` (DECIMAL) - Importo ticket
- `currency` (VARCHAR) - Valuta (default: EUR)
- `status` (ENUM) - draft, sent, signed, expired, cancelled
- `subscription_date`, `expiry_date` - Date importanti
- `sfp_class` (VARCHAR) - Classe SFP (A, B, C)
- `reminder_enabled` (BOOLEAN) - Abilita reminder
- `last_reminder_at` (TIMESTAMP) - Ultimo reminder inviato
- `notes`, `internal_notes`
- `created_at`, `updated_at`

**Indici**:
- `idx_lois_investor_id`
- `idx_lois_company_id`
- `idx_lois_status`
- `idx_lois_expiry_date`

#### `fundops_loi_events`
Timeline eventi LOI.

**Campi principali**:
- `id` (UUID, PK)
- `loi_id` (UUID, FK)
- `event_type` (ENUM) - created, sent, signed, reminder, expired, etc.
- `event_data` (JSONB) - Dati aggiuntivi evento
- `created_at` (TIMESTAMP)
- `created_by` (VARCHAR)

**Indici**:
- `idx_loi_events_loi_id`
- `idx_loi_events_created_at`

#### `fundops_documents`
Gestione documenti LOI.

**Campi principali**:
- `id` (UUID, PK)
- `loi_id` (UUID, FK)
- `document_type` (ENUM) - loi_pdf, attachment, signed_copy, etc.
- `storage_path` (VARCHAR) - Path in Supabase Storage
- `file_name` (VARCHAR)
- `file_size` (INTEGER)
- `mime_type` (VARCHAR)
- `status` (VARCHAR) - active, deleted
- `created_at`, `updated_at`

**Indici**:
- `idx_documents_loi_id`
- `idx_documents_type`

### Relazioni

```
fundops_companies (1) ──< (N) fundops_investors (client_company_id)
fundops_companies (1) ──< (N) fundops_lois (company_id)
fundops_investors (1) ──< (N) fundops_lois (investor_id)
fundops_lois (1) ──< (N) fundops_loi_events (loi_id)
fundops_lois (1) ──< (N) fundops_documents (loi_id)
```

---

## 🔌 API ROUTES

### Companies API

#### `GET /api/fundops_companies`
**Descrizione**: Lista tutte le aziende  
**Query Params**: `companyId` (opzionale, filtra per ID)  
**Response**: Array di `Company` objects

#### `POST /api/fundops_companies`
**Descrizione**: Crea nuova azienda  
**Body**: `{ name, legal_name, vat_number, ... }`  
**Response**: `{ id, ... }`

#### `GET /api/fundops_companies_import`
**Descrizione**: Preview import CSV aziende  
**Query Params**: `file` (file CSV)  
**Response**: `{ preview: [...], mapping: {...} }`

#### `POST /api/fundops_companies_import`
**Descrizione**: Esegue import CSV aziende  
**Body**: `{ rows: [...], mapping: {...} }`  
**Response**: `{ success: boolean, results: [...], errors: [...] }`

### Investors API

#### `GET /api/fundops_investors`
**Descrizione**: Lista investitori  
**Query Params**: `companyId` (filtra per client_company_id)  
**Response**: Array di `Investor` objects

#### `POST /api/fundops_investors`
**Descrizione**: Crea nuovo investitore  
**Body**: `{ full_name, email, ... }`  
**Response**: `{ id, ... }`

#### `GET /api/fundops_investors_kpi`
**Descrizione**: KPI investitori per azienda  
**Query Params**: `companyId` (required)  
**Response**: 
```json
{
  "totalInvestors": 21,
  "activeLois": 5,
  "committedLois": 3,
  "pipelineCapital": 50000,
  "committedCapital": 30000
}
```

#### `GET /api/fundops_investors_reconcile/preview`
**Descrizione**: Preview riconciliazione investitori-aziende  
**Query Params**: `companyId` (required)  
**Response**:
```json
{
  "total": 25,
  "already_set": 5,
  "matched": 15,
  "not_found": 3,
  "ambiguous": 2,
  "results": [
    {
      "investor_id": "...",
      "investor_name": "...",
      "status": "matched|not_found|ambiguous",
      "match_type": "exact|normalized|partial",
      "proposed_companies": [...]
    }
  ]
}
```

#### `POST /api/fundops_investors_reconcile/apply`
**Descrizione**: Applica riconciliazione  
**Body**: 
```json
{
  "updates": [
    {
      "investor_id": "...",
      "company_id": "...",
      "match_type": "exact|normalized|manual"
    }
  ],
  "force": false
}
```
**Response**: `{ success: boolean, updated: number }`

### LOI API

#### `GET /api/fundops_lois`
**Descrizione**: Lista LOI  
**Query Params**: `companyId` (filtra per investor.client_company_id)  
**Response**: Array di `LOI` objects con join su `investors`

#### `POST /api/fundops_lois`
**Descrizione**: Crea nuova LOI  
**Body**: `{ investor_id, loi_number, title, ticket_amount, ... }`  
**Response**: `{ id, ... }`

#### `GET /api/fundops_lois/[loiId]`
**Descrizione**: Dettaglio LOI  
**Response**: `LOI` object completo con investor e events

#### `PATCH /api/fundops_lois/[loiId]`
**Descrizione**: Aggiorna LOI  
**Body**: Partial `LOI` object  
**Response**: Updated `LOI`

#### `POST /api/fundops_lois/[loiId]/send`
**Descrizione**: Invia LOI (cambia status a 'sent')  
**Response**: `{ success: boolean }`

#### `POST /api/fundops_lois/[loiId]/mark-signed`
**Descrizione**: Marca LOI come firmata  
**Response**: `{ success: boolean }`

#### `POST /api/fundops_lois/[loiId]/reminder`
**Descrizione**: Invia reminder LOI  
**Response**: `{ success: boolean }`

#### `POST /api/fundops_lois/[loiId]/cancel`
**Descrizione**: Annulla LOI  
**Response**: `{ success: boolean }`

#### `POST /api/fundops_lois/[loiId]/duplicate`
**Descrizione**: Duplica LOI  
**Response**: `{ id: "...", ... }`

#### `GET /api/fundops_lois_kpi`
**Descrizione**: KPI LOI per azienda  
**Query Params**: `companyId` (required)  
**Response**:
```json
{
  "activeLois": 10,
  "committedLois": 5,
  "expiringLois": 3,
  "pipelineCapital": 100000,
  "committedCapital": 50000
}
```

#### `GET /api/fundops_lois_todo`
**Descrizione**: Todo items LOI  
**Query Params**: `companyId` (required)  
**Response**:
```json
{
  "expiringLois": [...],
  "loisNeedingReminder": [...],
  "investorsWithoutLoi": [...],
  "investorsWithoutLoiCount": 21
}
```

#### `POST /api/fundops_lois/expire`
**Descrizione**: Marca LOI scadute automaticamente  
**Response**: `{ expired: number }`

### Documents API

#### `GET /api/fundops_documents`
**Descrizione**: Lista documenti LOI  
**Query Params**: `loiId` (required)  
**Response**: Array di `Document` objects

#### `POST /api/fundops_documents/upload`
**Descrizione**: Upload documento  
**Body**: FormData con `file`, `loiId`, `documentType`  
**Response**: `{ id, storage_path, ... }`

#### `GET /api/fundops_documents/signed-url`
**Descrizione**: Ottiene signed URL per download  
**Query Params**: `documentId` (required)  
**Response**: `{ url: "..." }`

#### `DELETE /api/fundops_documents/delete/[documentId]`
**Descrizione**: Elimina documento (soft delete)  
**Response**: `{ success: boolean }`

#### `POST /api/fundops_documents/generate-loi-pdf`
**Descrizione**: Genera PDF LOI  
**Body**: `{ loiId }`  
**Response**: `{ documentId, storage_path }`

### Dashboard API

#### `GET /api/fundops_dashboard`
**Descrizione**: Dati aggregati dashboard  
**Query Params**: `companyId` (required)  
**Response**:
```json
{
  "kpis": {
    "pipelineTotal": 100000,
    "committedTotal": 50000,
    "activeLois": 10,
    "committedLois": 5,
    "expiringLois": 3
  },
  "recentEvents": [...],
  "todoItems": [...]
}
```

---

## 📄 PAGINE E COMPONENTI

### Pagine Principali

#### `/dashboard`
**Descrizione**: Dashboard principale con KPI e grafici  
**Componenti**: `MainChart`, `ActivityFeed`, KPI cards  
**API**: `GET /api/fundops_dashboard`

#### `/companies`
**Descrizione**: Lista aziende con filtri e ricerca  
**Funzionalità**:
- Lista aziende con card dettagliate
- Filtri: email, VAT, website presence
- Sort: nome A-Z, Z-A, creazione desc
- Link a import CSV
- Visualizzazione: Partita IVA, Settore, Website, LinkedIn

**API**: `GET /api/fundops_companies`

#### `/companies/import`
**Descrizione**: Import CSV aziende  
**Funzionalità**:
- Upload CSV
- Preview e mapping campi
- Auto-detect mapping
- Validazione e deduplicazione client-side
- Report import con risultati

**API**: `GET/POST /api/fundops_companies_import`

#### `/investors`
**Descrizione**: Lista investitori con filtri avanzati  
**Funzionalità**:
- Lista investitori riconciliati per azienda attiva
- KPI cards: Total Investors, Active LOIs, Committed LOIs, Capital
- Filtri: categoria, tipo, source, client_name, linkedin, email, phone
- Sort: nome A-Z, Z-A, LOI count desc
- Badge riconciliazione (match type)
- Link a import CSV e riconciliazione
- Query param `only_missing_loi=1` per filtrare investitori senza LOI

**API**: `GET /api/fundops_investors`, `GET /api/fundops_investors_kpi`

#### `/investors/import`
**Descrizione**: Import CSV investitori  
**Funzionalità**: Simile a companies import

**API**: `GET/POST /api/fundops_investors_import`

#### `/investors/reconcile`
**Descrizione**: Riconciliazione investitori-aziende  
**Funzionalità**:
- Preview riconciliazione con contatori
- Tabella risultati con status badges
- Dropdown selezione manuale azienda
- Filtri per status
- Progress bar durante applicazione
- Applicazione batch con force overwrite

**API**: 
- `GET /api/fundops_investors_reconcile/preview`
- `POST /api/fundops_investors_reconcile/apply`

#### `/investors/[investorId]`
**Descrizione**: Dettaglio investitore  
**Componenti**: `InvestorDetailClient`  
**Funzionalità**: Dettagli investitore, LOI associate, timeline

#### `/lois`
**Descrizione**: Lista LOI con filtri e azioni  
**Funzionalità**:
- Lista LOI filtrate per azienda attiva
- KPI cards: Active LOIs, Committed LOIs, Expiring LOIs, Capital
- Sezione "Da fare ora":
  - LOI in scadenza (14 giorni)
  - LOI senza reminder recente
  - Investitori senza LOI (con conteggio corretto)
- Banner "Raccolta ferma" quando nessuna LOI attiva
- Filtri: status, ricerca, scadenza
- Sort: scadenza asc/desc, data creazione desc
- Quick actions: Invia reminder, Crea LOI
- Form creazione LOI inline
- Link "Vedi tutti" per investitori senza LOI

**API**: 
- `GET /api/fundops_lois`
- `GET /api/fundops_lois_kpi`
- `GET /api/fundops_lois_todo`

#### `/lois/[loiId]`
**Descrizione**: Dettaglio LOI  
**Componenti**: `LoiDetailClient`  
**Funzionalità**:
- Dettagli LOI completi
- Mini KPI: Ticket amount, Status, Scadenza
- Timeline eventi (`LoiTimeline`)
- Documenti (`LoiDocuments`)
- Azioni (`LoiActions`): Send, Mark Signed, Reminder, Cancel, Duplicate
- Generazione PDF

**API**: `GET /api/fundops_lois/[loiId]`, `GET /api/fundops_loi_events`

#### `/login`
**Descrizione**: Pagina autenticazione  
**Funzionalità**: Login form con animazioni canvas

### Componenti Riutilizzabili

#### `AppShell`
**Descrizione**: Shell principale applicazione  
**Componenti inclusi**: `Sidebar`, `Header`, `CompanySwitcher`

#### `Sidebar`
**Descrizione**: Navigazione laterale  
**Link**: Dashboard, Companies, Investors, LOIs, Logout

#### `CompanySwitcher`
**Descrizione**: Selettore azienda attiva  
**Funzionalità**: Dropdown con lista aziende, salvataggio in localStorage

#### `ToastProvider`
**Descrizione**: Sistema notifiche toast  
**Hook**: `useToast()` per mostrare notifiche

#### Componenti LOI

- **`LoiStatusBadge`**: Badge status LOI (draft, sent, signed, expired, cancelled)
- **`LoiActions`**: Bottoni azioni LOI (send, sign, reminder, cancel, duplicate)
- **`LoiTimeline`**: Timeline eventi LOI
- **`LoiDocuments`**: Gestione documenti LOI (upload, download, delete)
- **`LoiMiniKPI`**: Mini KPI card per LOI

#### Componenti Investitori

- **`InvestorForm`**: Form creazione/modifica investitore
- **`CsvPreviewTable`**: Tabella preview CSV import

---

## 🔄 FLUSSI DI LAVORO

### 1. Setup Iniziale

1. **Configurazione Supabase**
   - Crea progetto Supabase
   - Esegui migrations SQL
   - Configura Storage bucket `fundops-documents`
   - Imposta Service Role Key in `.env.local`

2. **Import Aziende**
   - Vai a `/companies/import`
   - Carica CSV con aziende
   - Mappa campi CSV → DB
   - Preview e conferma import

3. **Import Investitori**
   - Vai a `/investors/import`
   - Carica CSV con investitori
   - Mappa campi CSV → DB
   - Preview e conferma import

4. **Riconciliazione**
   - Vai a `/investors/reconcile`
   - Preview riconciliazione automatica
   - Verifica match proposti
   - Seleziona manualmente match ambigui
   - Applica riconciliazione

### 2. Workflow LOI

1. **Creazione LOI**
   - Vai a `/lois`
   - Clicca "+ Nuova LOI" o "Crea LOI" da todo
   - Compila form (investitore pre-selezionato se da todo)
   - Salva LOI (status: draft)

2. **Invio LOI**
   - Vai a dettaglio LOI `/lois/[loiId]`
   - Clicca "Invia LOI"
   - Status cambia a 'sent'
   - Evento creato in timeline

3. **Tracking LOI**
   - Monitora scadenze in dashboard
   - Invia reminder da lista o dettaglio
   - Marca come firmata quando ricevuta

4. **Gestione Documenti**
   - Genera PDF LOI da dettaglio
   - Carica documenti aggiuntivi
   - Download documenti via signed URL

### 3. Workflow Riconciliazione

1. **Preview Riconciliazione**
   - Algoritmo matching multi-livello:
     - Exact match (nome esatto)
     - Exact normalized (nome normalizzato)
     - Normalized match (nome senza suffissi)
     - Partial match (scoring)

2. **Normalizzazione Nome**
   - Lowercase
   - Rimozione punteggiatura
   - Rimozione suffissi italiani (SRL, SPA, etc.)
   - Collapse spazi

3. **Applicazione Riconciliazione**
   - Batch update `client_company_id`
   - Set `client_company_match_type`
   - Set `client_company_matched_at`
   - Opzione force overwrite

### 4. Workflow Multi-Company

1. **Selezione Azienda**
   - Usa `CompanySwitcher` in header
   - Salvataggio in localStorage
   - Context API propaga `activeCompanyId`

2. **Filtri Company-Scoped**
   - Tutte le query filtrano per `company_id` o `client_company_id`
   - KPI calcolati per azienda attiva
   - Todo items filtrati per azienda

---

## ✅ FUNZIONALITÀ IMPLEMENTATE

### Core Features

- ✅ **Autenticazione**: Login con credenziali
- ✅ **Multi-Company**: Context API, company switcher, filtri scoped
- ✅ **CRUD Companies**: Lista, creazione, import CSV
- ✅ **CRUD Investors**: Lista, creazione, import CSV, dettaglio
- ✅ **Riconciliazione**: Preview, matching automatico, applicazione batch
- ✅ **CRUD LOI**: Lista, creazione, modifica, dettaglio
- ✅ **LOI Workflow**: Send, Sign, Reminder, Cancel, Duplicate
- ✅ **LOI Documents**: Upload, download, generazione PDF
- ✅ **LOI Events**: Timeline eventi completa
- ✅ **Dashboard**: KPI aggregati, grafici, todo list
- ✅ **KPI System**: KPI per investors, LOI, dashboard
- ✅ **Todo System**: LOI in scadenza, reminder, investitori senza LOI
- ✅ **Filtri Avanzati**: Ricerca, filtri multipli, sorting
- ✅ **Import CSV**: Preview, mapping, validazione, deduplicazione

### UX Enhancements

- ✅ **Progress Bar**: Durante import e riconciliazione
- ✅ **Toast Notifications**: Feedback utente per azioni
- ✅ **Loading States**: Indicatori caricamento
- ✅ **Empty States**: Messaggi quando nessun dato
- ✅ **Error Handling**: Gestione errori con messaggi chiari
- ✅ **Responsive Design**: Layout adattivo mobile/desktop
- ✅ **Dark Theme**: Design system dark mode completo

### Recent Enhancements (Ultime implementazioni)

- ✅ **Fix Conteggio Investitori senza LOI**: Conteggio reale vs preview
- ✅ **Ordinamento Recency**: Investitori ordinati per updated_at desc
- ✅ **Link "Vedi tutti"**: Navigazione a lista investitori filtrata
- ✅ **Pre-filled LOI Creation**: Form pre-compilato da todo
- ✅ **Banner "Raccolta ferma"**: Alert quando nessuna LOI attiva
- ✅ **Filtro only_missing_loi**: Query param per investitori senza LOI

---

## 🎨 DESIGN SYSTEM

### Colori

```css
:root {
  --primary: #2563eb;           /* Blu principale */
  --primary-light: #3b82f6;     /* Blu chiaro */
  --secondary: #a21caf;         /* Viola */
  --accent: #22d3ee;            /* Ciano */
  --background: #18181b;        /* Nero scuro */
  --background-card: #23272f;   /* Grigio scuro */
  --text-primary: #f3f4f6;      /* Bianco */
  --text-secondary: #a1a1aa;   /* Grigio chiaro */
  --border-color: rgba(148, 163, 184, 0.2);
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
}
```

### Tipografia

- **Font**: Poppins (Google Fonts)
- **Scale**: 0.75rem, 0.875rem, 1rem, 1.125rem, 1.25rem, 1.5rem, 2rem, 2.5rem
- **Weights**: 400 (Regular), 600 (SemiBold), 700 (Bold), 800 (ExtraBold)

### Componenti UI

#### Cards
- Border-radius: 12px
- Background: `var(--background-card)`
- Border: `1px solid var(--border-color)`
- Padding: 1.5rem
- Shadow: subtle

#### Buttons
- Primary: `var(--primary)` background, white text
- Secondary: Border only, transparent background
- Hover: Transform translateY(-1px), shadow
- Transition: 0.2s ease

#### Badges/Pills
- Border-radius: 999px
- Padding: 0.2rem 0.6rem
- Font-size: 0.75rem
- Font-weight: 600

#### Forms
- Input: Border, padding, border-radius 8px
- Select: Styled come input
- Label: Font-weight 600, margin-bottom 0.5rem
- Error: Red text, border color

### Spacing

- **Scale**: 0.25rem, 0.5rem, 0.75rem, 1rem, 1.5rem, 2rem, 2.5rem, 3rem
- **Gap**: 0.5rem, 0.75rem, 1rem, 1.5rem, 2rem

---

## ⚙️ CONFIGURAZIONE E SETUP

### Variabili d'Ambiente

Crea `.env.local` in `frontend/`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Migrations SQL

Esegui in ordine:

1. `create_fundops_documents_table.sql`
2. `add_import_fields_to_fundops_companies.sql`
3. `add_import_fields_to_fundops_investors.sql`
4. `add_missing_fields_to_fundops_companies.sql`
5. `add_reminder_fields_to_fundops_lois.sql`

### Supabase Storage Setup

1. Crea bucket `fundops-documents` (Private)
2. Configura policy RLS (opzionale, se non usi Service Role Key)

### Script Disponibili

```bash
# Sviluppo
npm run dev

# Build produzione
npm run build

# Avvio produzione
npm run start

# Linting
npm run lint
```

### Dipendenze Principali

```json
{
  "next": "15.4.1",
  "react": "19.1.0",
  "typescript": "5.x",
  "@supabase/supabase-js": "^2.x",
  "lucide-react": "^0.x",
  "recharts": "^2.x"
}
```

---

## 📊 METRICHE E PERFORMANCE

### Performance Targets

- **Page Load**: < 2 secondi
- **API Response**: < 500ms
- **Database Queries**: Ottimizzate con indici
- **Client-Side Rendering**: Lazy loading componenti

### Ottimizzazioni Implementate

- ✅ **Indici Database**: Su campi frequentemente filtrati
- ✅ **Query Ottimizzate**: Join minimi, select solo campi necessari
- ✅ **Batch Operations**: Import e riconciliazione in batch
- ✅ **Client-Side Filtering**: Filtri applicati lato client quando possibile
- ✅ **Memoization**: `useMemo`, `useCallback` per calcoli pesanti

---

## 🔒 SICUREZZA

### Implementazioni

- ✅ **Row Level Security (RLS)**: Abilitato su tutte le tabelle
- ✅ **Service Role Key**: Solo server-side, mai esposta al client
- ✅ **Input Validation**: Validazione lato server per tutti gli input
- ✅ **SQL Injection Prevention**: Parametri query Supabase
- ✅ **XSS Prevention**: React escaping automatico

### Best Practices

- Service Role Key solo in API routes
- Validazione input server-side
- Sanitizzazione dati prima di salvare
- Signed URLs per documenti (scadenza 60 minuti)

---

## 🚀 ROADMAP FUTURA

### Fase 1 - Miglioramenti UX
- [ ] Export dati (Excel, PDF)
- [ ] Ricerca globale avanzata
- [ ] Notifiche email per scadenze
- [ ] Dashboard personalizzabile

### Fase 2 - Features Avanzate
- [ ] Firma digitale LOI
- [ ] Integrazione email (invio LOI via email)
- [ ] Template LOI personalizzabili
- [ ] Analytics avanzate (grafici trend)

### Fase 3 - Integrazioni
- [ ] Integrazione CRM (HubSpot, Salesforce)
- [ ] Integrazione contabilità
- [ ] API pubblica per integrazioni
- [ ] Webhook per eventi

### Fase 4 - Scale
- [ ] Multi-tenant avanzato
- [ ] Ruoli e permessi granulari
- [ ] Audit log completo
- [ ] Backup automatici

---

## 📝 NOTE TECNICHE

### Convenzioni Codice

- **Naming**: camelCase per variabili, PascalCase per componenti
- **File Structure**: Un componente per file, CSS Module associato
- **TypeScript**: Strict mode, tipi espliciti
- **Error Handling**: Try-catch in tutte le API routes
- **Logging**: Console.log per debug (rimuovere in produzione)

### Pattern Utilizzati

- **Context API**: Per stato globale (CompanyContext)
- **Custom Hooks**: Per logica riutilizzabile
- **Server Components**: Quando possibile per performance
- **Client Components**: Solo quando necessario (interattività)

---

## 📞 SUPPORTO

Per domande o problemi:
1. Controlla la documentazione
2. Verifica migrations SQL
3. Controlla variabili ambiente
4. Verifica log console browser/server

---

**Ultimo aggiornamento**: Gennaio 2025  
**Versione Blueprint**: 1.0  
**Stato Progetto**: ✅ In Produzione
