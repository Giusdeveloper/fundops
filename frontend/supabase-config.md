# Configurazione Supabase per il tuo progetto

## Credenziali del tuo progetto Supabase

- **URL**: `https://bvqrovzrvmdhuehonfcq.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2cXJvdnpydm1kaHVlaG9uZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMDA0MzksImV4cCI6MjA2MzU3NjQzOX0.g8XwaSE8-IYv2vyt1W3iL0IFAbUgEC_pMy_oxdaLbxs`

## Passaggi per configurare l'applicazione

### 1. Crea il file .env.local

Crea un file chiamato `.env.local` nella cartella `frontend/` con questo contenuto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://bvqrovzrvmdhuehonfcq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2cXJvdnpydm1kaHVlaG9uZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMDA0MzksImV4cCI6MjA2MzU3NjQzOX0.g8XwaSE8-IYv2vyt1W3iL0IFAbUgEC_pMy_oxdaLbxs
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhdWJocHB3eXBreW1zaXhzcmNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIxOTA4NywiZXhwIjoyMDc2Nzk1MDg3fQ._N3ILjcWaX7hte-8bSnuck475UeY4oUh1fhFNU3U0Ng
```

### 2. Configura il database

1. Vai al tuo progetto Supabase: https://supabase.com/dashboard/project/bvqrovzrvmdhuehonfcq
2. Vai su **SQL Editor**
3. Copia e incolla il contenuto del file `supabase-schema.sql`
4. Esegui lo script per creare le tabelle

### 3. Testa la connessione

1. Riavvia l'applicazione con `npm run dev`
2. Vai alla pagina LOI
3. Dovresti vedere "Connesso a Supabase" se tutto funziona

## Note di sicurezza

- Non condividere mai le tue credenziali Supabase
- Il file `.env.local` non deve essere committato nel repository
- Le chiavi anon sono sicure da usare nel frontend

## Risoluzione problemi

Se vedi "Modalità offline (dati locali)", controlla che:
1. Il file `.env.local` esista e contenga le credenziali corrette
2. Le tabelle siano state create nel database
3. Non ci siano errori nella console del browser
