# Setup Documenti LOI

## 1. Database Migration

Esegui la migration SQL per creare la tabella `fundops_documents`:

```sql
-- Esegui il file: migrations/create_fundops_documents_table.sql
```

## 2. Supabase Storage Setup

1. Vai su Supabase Dashboard → Storage
2. Crea un nuovo bucket chiamato: `fundops-documents`
3. Imposta come **Private** (non pubblico)

## 3. Configura Service Role Key (IMPORTANTE)

Le API routes usano la **Service Role Key** per bypassare RLS su Storage.

1. Vai su Supabase Dashboard → Settings → API
2. Copia la **Service Role Key** (secret, non la anon key!)
3. Aggiungi al file `.env.local` nella cartella `frontend/`:

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**IMPORTANTE**: 
- La Service Role Key bypassa RLS e ha accesso completo
- **NON** esporre mai questa chiave nel client (non usare `NEXT_PUBLIC_`)
- Aggiungi `.env.local` al `.gitignore`

**Alternativa (se non vuoi usare Service Role Key)**:

Configura le policy RLS nel SQL Editor:

```sql
-- Policy per permettere INSERT (upload) nel bucket fundops-documents
CREATE POLICY "Allow anon to upload documents"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'fundops-documents' AND
  (storage.foldername(name))[1] = 'fundops'
);

-- Policy per permettere SELECT (read/download)
CREATE POLICY "Allow anon to read documents"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'fundops-documents' AND
  (storage.foldername(name))[1] = 'fundops'
);
```

**NOTA**: Se usi le policy RLS invece della service role key, rimuovi `supabaseServer` dalle API routes e usa solo `supabase`.

## 3. Opzionale: PDF Generation avanzata

Se vuoi PDF più avanzati con layout migliore, installa pdfkit:

```bash
cd frontend
npm install pdfkit
npm install --save-dev @types/pdfkit
```

Se pdfkit non è installato, il sistema userà automaticamente un PDF minimale (fallback).

## 4. Verifica

Dopo il setup:
- Vai al dettaglio di una LOI
- Verifica che la sezione "Documenti" sia visibile
- Prova a generare un PDF LOI
- Prova a caricare un documento

## Note

- I file vengono salvati con path: `fundops/<companyId>/lois/<loiId>/<type>/<filename>`
- Le signed URL scadono dopo 60 minuti
- I documenti eliminati vengono soft-deleted (status='deleted')
- Ogni azione documentale crea un evento nella timeline LOI
