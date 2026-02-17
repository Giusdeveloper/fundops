# Configurazione Supabase per Smart Equity App

✅ **Il tuo progetto Supabase è già configurato!**

- **URL**: `https://bvqrovzrvmdhuehonfcq.supabase.co`
- **Project ID**: `bvqrovzrvmdhuehonfcq`

Questa guida ti aiuterà a completare la configurazione per utilizzare il database PostgreSQL invece del localStorage.

## 1. Configura le variabili d'ambiente

✅ **Le credenziali sono già configurate nel codice!**

Crea un file `.env.local` nella cartella `frontend/` con questo contenuto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://bvqrovzrvmdhuehonfcq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2cXJvdnpydm1kaHVlaG9uZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMDA0MzksImV4cCI6MjA2MzU3NjQzOX0.g8XwaSE8-IYv2vyt1W3iL0IFAbUgEC_pMy_oxdaLbxs
```

**Nota**: Il file `.env.local` non deve essere committato nel repository per motivi di sicurezza.

## 2. Crea le tabelle del database

1. Vai al tuo progetto Supabase: https://supabase.com/dashboard/project/bvqrovzrvmdhuehonfcq
2. Vai su **SQL Editor**
3. Copia tutto il contenuto del file `supabase-schema.sql`
4. Incollalo nell'editor SQL
5. Clicca su "Run" per eseguire lo script

Questo creerà le seguenti tabelle:
- `investors` - Dati degli investitori
- `lois` - Lettere d'intenti
- `investments` - Investimenti effettuati

## 3. Testa la connessione

1. Avvia l'applicazione con `npm run dev`
2. Vai alla pagina LOI
3. Dovresti vedere l'indicatore "Connesso a Supabase (https://bvqrovzrvmdhuehonfcq.supabase.co)" se tutto funziona correttamente
4. Se vedi "Modalità offline (dati locali)", controlla che:
   - Il file `.env.local` esista e contenga le credenziali corrette
   - Le tabelle siano state create nel database
   - Non ci siano errori nella console del browser

## 4. Configura le politiche di sicurezza (RLS)

Lo script SQL include già le politiche di base che permettono tutte le operazioni. Per un ambiente di produzione, dovresti personalizzare queste politiche secondo le tue esigenze di sicurezza.

## 6. Migrazione dei dati esistenti

Se hai già dati nel localStorage che vuoi migrare:

1. Usa la funzione "Esporta LOI" per salvare i dati come JSON
2. Usa la funzione "Importa LOI" per caricare i dati nel database Supabase
3. I dati verranno automaticamente salvati in Supabase se la connessione è attiva

## Funzionalità disponibili con Supabase

- **Persistenza dei dati**: I dati vengono salvati nel cloud PostgreSQL
- **Sincronizzazione**: I dati sono accessibili da qualsiasi dispositivo
- **Backup automatico**: Supabase gestisce automaticamente i backup
- **Scalabilità**: Il database può gestire migliaia di LOI e investitori
- **Sicurezza**: Autenticazione e autorizzazione integrate

## Risoluzione problemi

### Errore di connessione
- Verifica che le variabili d'ambiente siano corrette
- Controlla che il progetto Supabase sia attivo
- Assicurati che le tabelle siano state create correttamente

### Dati non salvati
- Controlla la console del browser per errori
- Verifica che le politiche RLS permettano le operazioni
- Assicurati che l'utente sia autenticato (se richiesto)

### Performance lente
- Considera di aggiungere più indici alle tabelle
- Ottimizza le query usando filtri appropriati
- Monitora l'uso delle risorse nel dashboard Supabase

## Supporto

Per problemi specifici di Supabase, consulta la [documentazione ufficiale](https://supabase.com/docs) o il supporto di Supabase.
