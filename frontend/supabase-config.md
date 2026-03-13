# Configurazione Supabase per il progetto

Questa guida descrive come configurare Supabase in locale senza inserire segreti nel repository.

## Variabili richieste

Crea un file `.env.local` nella cartella `frontend/` con queste chiavi:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Passaggi

1. Apri il progetto Supabase in dashboard.
2. Copia `Project URL`, `anon key` e `service role key` dalla sezione API.
3. Inserisci i valori nel tuo `frontend/.env.local`.
4. Riavvia il dev server.

## Note di sicurezza

- Non committare mai `SUPABASE_SERVICE_ROLE_KEY`.
- Non inserire chiavi reali in documentazione, esempi o script versionati.
- Usa la service role key solo lato server o in script amministrativi locali.

## Troubleshooting

Se vedi errori di connessione:

1. Verifica che `frontend/.env.local` esista.
2. Verifica che le chiavi siano aggiornate e non revocate.
3. Riavvia completamente il processo Next.js dopo ogni modifica alle env.
