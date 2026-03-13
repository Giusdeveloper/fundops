# Piano di miglioramento landing FundOps

**Data**: 2026-03-11  
**Riferimento**: landing attuale in `frontend/src/components/landing/` e root `/`

---

## 1. Analisi dello stato attuale

### Cosa funziona già
- **Hero**: headline chiara, sottotitolo con value prop, doppia CTA (primaria + scroll).
- **Features**: 4 card con icone, titoli e descrizioni; griglia responsive.
- **How it works**: 3 step semplici e leggibili.
- **CTA finale** e **Footer** minimali ma coerenti.
- **Design**: dark theme, variabili CSS, Poppins, gradient CTA.
- **Navigazione**: solo "Accedi" in nav e footer; nessuna sidebar sulla root.

### Cosa manca (gap rispetto alle best practice)
- **Social proof**: nessun testimonial, nessun logo cliente, nessun numero (utenti, LOI gestite, ecc.).
- **Trust**: nessun badge (GDPR, sicurezza, uptime), nessun riferimento a compliance.
- **Prova visiva del prodotto**: nessuno screenshot, mockup o video della dashboard/LOI.
- **FAQ**: nessuna sezione domande frequenti per ridurre obiezioni.
- **Hero**: nessun trust signal above the fold; headline lunga (> 8 parole); nessun proof point quantificato.
- **Performance/SEO**: metadata della landing non specifici per la home (il layout usa titolo generico "Smart Equity Dashboard").
- **Micro-interazioni**: nessuna animazione leggera su scroll o su CTA (opzionale ma migliora percezione qualità).
- **Footer**: manca link Privacy (se esiste route); "Vai all'app" per utenti già registrati non presente.

---

## 2. Ricerca: best practice sintetizzate

### Hero e above the fold
- **3–5 secondi** per far capire cosa fa il prodotto e perché serve; **50 ms** per la prima impressione visiva.
- Headline **breve** (sotto le 8 parole / ~44 caratteri), **outcome-focused** (beneficio, non feature).
- **Un solo CTA primario** above the fold per evitare decision paralysis; CTA con verbo d’azione (Es. "Inizia", "Prova", "Richiedi demo").
- **Trust signal** subito sotto o accanto alla CTA: loghi clienti, numero utenti, o badge.
- **Product visual**: screenshot, mockup o video breve (< 90 s) aumenta conversioni (fino a +86% con video in hero).

### Conversioni
- **Social proof** può aumentare conversioni del **34–90%** (fino a ~340% in alcuni casi); testimonial con nome, ruolo e azienda sono più credibili.
- **Una sola azione primaria** per pagina; CTA ripetuta in 5–8 sezioni.
- **Velocità**: ogni secondo in più di caricamento può ridurre conversioni del ~7%; **mobile-first** (oltre il 50% del traffico).
- **Form**: meno campi = meno attrito; per "Prova" o "Accedi" il link a `/login` è già a basso attrito.

### Contenuti che convertono
- **Testimonial** specifici (risultato concreto, es. "Ridotto il tempo di gestione LOI del 40%").
- **Loghi clienti** (anche 3–5) sopra la fold o vicino al CTA.
- **Numeri**: "Oltre X LOI gestite", "X team attivi", "X documenti all’anno".
- **FAQ**: risponde a obiezioni (sicurezza, integrazioni, onboarding) e supporta SEO.
- **Video demo** sotto i 90 secondi: spiega il prodotto e aumenta signup (fino a +127% in alcuni studi).

### Trust e compliance
- Badge **GDPR**, **SOC 2**, certificazioni, "Dati in Europa".
- Link **Privacy** e **Cookie** in footer dove si raccolgono dati.

---

## 3. Piano di miglioramento prioritizzato

### Fase 1 – Quick win (impatto alto, sforzo basso)

| # | Intervento | Descrizione | File/note |
|---|------------|-------------|-----------|
| 1.1 | **Metadata e titolo** | Titolo e description specifici per la home (es. "FundOps – Il fundraising sotto controllo \| Smart Equity"). | `layout.tsx` o `page.tsx` (metadata), oppure `layout` del gruppo che serve la root |
| 1.2 | **Trust sotto l’hero** | Una riga sotto le CTA: "Usato da team di fund raising" + eventuale numero (es. "Oltre X LOI gestite") o 3–5 loghi placeholder. | Nuovo blocco in `Hero` o componente `TrustStrip` |
| 1.3 | **Footer completo** | Aggiungere link "Privacy" (se esiste `/privacy` o route equivalente) e "Vai all'app" → `/dashboard`. | `Footer.tsx` |
| 1.4 | **Headline più corta (A/B)** | Variante headline sotto le 8 parole, es. "FundOps – Fundraising sotto controllo" o "Tutto il fundraising in un’unica piattaforma". | `Hero.tsx` (copy) |

### Fase 2 – Social proof e contenuti

| # | Intervento | Descrizione | File/note |
|---|------------|-------------|-----------|
| 2.1 | **Sezione Social proof** | Blocco tra Hero e Features: "Chi usa FundOps" con 2–3 testimonial (testo, nome, ruolo/azienda) o loghi clienti. Se non ci sono clienti reali: placeholder "Fund raising team", "VC operativi", ecc. | Nuovo componente `SocialProof.tsx` + CSS |
| 2.2 | **Proof point in hero** | Sotto il subhead o sotto le CTA: una riga con numero (es. "Oltre 1.000 LOI gestite" o "Team in tutta Italia"). Aggiornabile quando si hanno dati reali. | `Hero.tsx` |
| 2.3 | **CTA ripetuta** | Mantenere la stessa CTA "Prova FundOps" / "Inizia ora" in CtaBlock e eventualmente in barra sticky (opzionale). | Già presente; eventuale sticky CTA in `Hero` o layout |

### Fase 3 – Prova visiva e obiezioni

| # | Intervento | Descrizione | File/note |
|---|------------|-------------|-----------|
| 3.1 | **Product screenshot / mockup** | Immagine della dashboard o della lista LOI (screenshot reale o mockup) in hero (a lato) o in una sezione "Vedi FundOps in azione" tra Features e How it works. | Nuovo componente `ProductShowcase.tsx`; asset in `public/` |
| 3.2 | **Sezione FAQ** | 4–6 domande (A cosa serve FundOps? È adatto al nostro team? Dove sono i dati? Come funziona l’onboarding? Integrazioni? Costi?) con risposte brevi. Accordion o lista. | Nuovo componente `Faq.tsx` + CSS |
| 3.3 | **Trust badge** | In footer o sotto CTA: testo "Dati al sicuro" / "Conforme GDPR" e link a privacy. | `Footer` o `CtaBlock` |

### Fase 4 – Optional / nice-to-have

| # | Intervento | Descrizione |
|---|------------|-------------|
| 4.1 | **Video demo** | Video breve (< 90 s) che mostra flusso LOI o dashboard; in hero o in ProductShowcase. |
| 4.2 | **Animazioni leggere** | Fade-in on scroll per Features/How it works; hover su card. Solo se non si sacrifica performance. |
| 4.3 | **Sticky CTA** | Barra sottile dopo scroll con "Prova FundOps" che appare dopo che l’hero esce dalla viewport. |
| 4.4 | **A/B test** | Test su headline, colore CTA o posizione social proof (es. con Vercel Edge o strumento esterno). |

---

## 4. Checklist implementativa (ordine suggerito)

- [ ] **1.1** Metadata e titolo pagina per `/`
- [ ] **1.2** Trust strip sotto hero (testo + eventuale numero o loghi placeholder)
- [ ] **1.3** Footer: link Privacy, "Vai all'app" → `/dashboard`
- [ ] **1.4** (Opzionale) Headline alternativa più corta
- [ ] **2.1** Sezione Social proof (testimonial o loghi)
- [ ] **2.2** Proof point numerico in hero
- [ ] **3.1** Product screenshot / mockup (sezione dedicata)
- [ ] **3.2** Sezione FAQ (4–6 domande)
- [ ] **3.3** Trust badge (GDPR / privacy) in footer o sotto CTA
- [ ] **4.x** Elementi optional (video, animazioni, sticky CTA, A/B test) in base a priorità

---

## 5. Riferimenti

- Landing attuale: `frontend/src/components/landing/` (Hero, Features, HowItWorks, CtaBlock, Footer, LandingPage).
- AppShell: root `/` già esclusa da sidebar/header.
- Design: variabili in `frontend/src/app/globals.css`; nessuna nuova dipendenza richiesta per Fasi 1–3.
- Copy e numeri (proof point, testimonial): da adattare quando si hanno dati reali; si possono usare placeholder generici per struttura e layout.
