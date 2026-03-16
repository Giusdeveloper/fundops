# Verifica OAuth Gmail per invio email

## Obiettivo
Abilitare la richiesta di autorizzazione `gmail.send` tramite il Google OAuth consent screen in modo da consentire agli utenti di connettere il proprio account Gmail come canale di invio. La verifica Google deve essere fatta una sola volta dal team (per l’app intera) e poi ogni utente può concedere l’autorizzazione semplicemente “cliccando Consenti”.

## 1. Informazioni da inserire in Google Cloud Console
- **Nome app:** `FundOps Platform` (o identico a quello usato per Drive)
- **Email supporto:** `support@fundops.com` (o indirizzo usato per Drive)
- **Logo / branding:** riutilizzare i materiali già approvati
- **Banner** (se richiesto) e descrizione dell’app: “FundOps aiuta team e founder a gestire cap table, LOI e comunicazioni con investitori.”
- **Dominio verificato:** il dominio primario (es. `fundops.io`) deve essere già verificato in Google Search Console.
- **URL privacy/term:** /privacy e /terms (gli stessi già in uso per Drive).
- **Scope richiesti:** `https://www.googleapis.com/auth/gmail.send` (+ `openid profile email` se serve per recuperare nome/account)

## 2. Redirect URI
- Inserire il callback OAuth già usato per Google Drive (es. `https://<host>/api/dossier/oauth/callback`) oppure estenderlo (ma mantenerlo nel campo "Authorized redirect URIs").

## 3. Testo e screenshot per la recensione
- **Descrizione breve:** “Invio automatizzato di LOI/inviti e promemoria a nome degli utenti FundOps.”
- **Dettaglio d’uso:** “Utilizziamo solo il permesso `gmail.send` lato server per inviare messaggi, non leggiamo la posta in arrivo né manteniamo l’accesso alle email ricevute. Il refresh token viene salvato sul server e l’utente può revocare l’accesso dal profilo Google.”
- **Screenshot richiesti:**
  1. Pulsante “Connetti Gmail” dentro FundOps.
 2. Prompt Google “Consenti a FundOps Platform di inviare email”.
 3. Redirect finale con conferma (o messaggio interno).

## 4. Checklist per la submission
1. Dominio verificato e link privacy nel form.
2. Scope `gmail.send` dichiarato con descrizione.
3. Screenshot del flow (consenso e redirect).
4. Indicazione di chi è contact point per le review (es. `tech@fundops.com`).
5. Copia del testo da mostrare all’utente nel prompt (“Invio dalla tua Gmail personal”) per la sezione “Utilizzo previsto”.

## 5. UX e messaggi agli utenti
- Nella UI indicare chiaramente “Invia da [account connesso]” e fornire link “Disconnetti Gmail”.
- Spiegare che le email inviate da Gmail usano la quota personale (non Resend) e che possono revocare l’accesso quando vogliono.
- Offrire il pulsante alternativo “Usa Resend” se non vogliono connettere Gmail.

## 6. Passi successivi
1. Compilare la Google Cloud Console con i dati sopra e inviare per verifica.
2. Dopo approvazione, esporre il flow “Connessione Gmail” lato UI (stesso meccanismo OAuth già usato per Drive).
3. Conservare i refresh token lato server (service role) e loggare le invocate, così da avere un fallback se un utente revoca l’accesso.

Una volta completata la verifica, possiamo lasciare il progetto “in standby” come richiesto. Quando sei pronto, riprendiamo il flow Google/Resend e integriamo la scelta utente. 
