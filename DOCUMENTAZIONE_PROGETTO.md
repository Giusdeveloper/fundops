# Smart Equity - Documentazione Progetto

## Panoramica del Progetto

**Smart Equity** è un'applicazione web moderna sviluppata per la gestione intelligente dell'equity e degli investimenti. L'applicazione fornisce una dashboard completa per monitorare fondi raccolti, gestire investitori, tracciare LOI (Letter of Intent) e visualizzare l'andamento finanziario in tempo reale.

## Architettura Tecnica

### Stack Tecnologico

- **Frontend Framework**: Next.js 15.4.1 con React 19.1.0
- **Linguaggio**: TypeScript 5
- **Styling**: CSS personalizzato (senza Tailwind CSS)
- **Icone**: Lucide React
- **Grafici**: Recharts per visualizzazioni dati
- **Font**: Poppins (Google Fonts)
- **Build Tool**: Turbopack per sviluppo rapido

### Struttura del Progetto

```
web app smart equity/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (app)/              # Route protette dell'applicazione
│   │   │   │   ├── dashboard.css   # Stili principali dashboard
│   │   │   │   ├── globals.css     # Stili globali
│   │   │   │   ├── layout.tsx      # Layout dell'app
│   │   │   │   └── page.tsx        # Pagina dashboard principale
│   │   │   ├── (auth)/             # Route di autenticazione
│   │   │   │   └── login/
│   │   │   │       ├── login.css   # Stili pagina login
│   │   │   │       └── page.tsx    # Pagina login
│   │   │   ├── layout.tsx          # Layout root
│   │   │   └── favicon.ico
│   │   └── components/
│   │       ├── ActivityFeed.tsx    # Feed attività recenti
│   │       ├── Header.tsx          # Header applicazione
│   │       ├── MainChart.tsx       # Grafico principale
│   │       ├── MainChart.css       # Stili grafico
│   │       ├── Sidebar.tsx         # Barra laterale navigazione
│   │       └── Sidebar.css         # Stili sidebar
│   ├── public/                     # Asset statici
│   ├── package.json               # Dipendenze e script
│   ├── next.config.ts             # Configurazione Next.js
│   ├── tailwind.config.js         # Configurazione Tailwind (non utilizzato)
│   └── tsconfig.json              # Configurazione TypeScript
```

## Funzionalità Principali

### 1. Sistema di Autenticazione

- **Pagina Login**: Interfaccia moderna con effetto typewriter e animazioni canvas
- **Credenziali Demo**: 
  - Email: `pistoia702@gmail.com`
  - Password: `admin1234`
- **Effetti Visivi**: Rete neurale animata in background durante il login

### 2. Dashboard Principale

La dashboard è il cuore dell'applicazione e include:

#### Widget Informativi
- **Fondi Raccolti**: €1.2M (+€200K questo mese)
- **Investors Attivi**: 152 (+5 questa settimana)
- **LOI Firmate**: 12 su 20 inviate
- **Prossima Scadenza**: 25/07/2024 (LOI #13)

#### Visualizzazioni Dati
- **Grafico Andamento Fondi**: Area chart che mostra l'evoluzione mensile dei fondi raccolti
- **Feed Attività**: Lista delle attività recenti degli utenti

### 3. Navigazione e Layout

#### Sidebar
- **Dashboard**: Vista principale
- **Progetti**: Gestione progetti
- **Investitori**: Gestione investitori
- **Impostazioni**: Configurazioni sistema
- **Logout**: Disconnessione sicura

#### Header
- Titolo applicazione: "Smart Equity - Dashboard"
- Design minimalista e professionale

## Design System

### Palette Colori
- **Primary**: #2563eb (Blu)
- **Primary Light**: #3b82f6
- **Secondary**: #a21caf (Viola)
- **Secondary Light**: #c026d3
- **Accent**: #22d3ee (Ciano)
- **Background**: #18181b (Nero scuro)
- **Background Card**: #23272f (Grigio scuro)
- **Text Primary**: #f3f4f6 (Bianco)
- **Text Secondary**: #a1a1aa (Grigio chiaro)

### Tipografia
- **Font Family**: Poppins (Google Fonts)
- **Pesi**: 400 (Regular), 600 (SemiBold), 800 (ExtraBold)

### Componenti UI
- **Cards**: Bordi arrotondati (16px), ombre sottili, effetti hover
- **Bottoni**: Transizioni fluide, stati hover
- **Layout**: Grid responsive, gap consistenti

## Componenti Principali

### MainChart.tsx
- **Libreria**: Recharts
- **Tipo**: Area Chart con gradiente
- **Dati**: Andamento mensile fondi raccolti (Gen-Lug)
- **Interattività**: Tooltip, legenda, griglia

### ActivityFeed.tsx
- **Funzione**: Visualizzazione attività recenti
- **Contenuto**: Investimenti, progetti, commenti utenti
- **Stile**: Lista semplice con icone

### Sidebar.tsx
- **Navigazione**: Menu principale applicazione
- **Icone**: Lucide React
- **Stato**: Link attivi e inattivi

## Configurazione e Sviluppo

### Script Disponibili
```bash
npm run dev      # Sviluppo con Turbopack
npm run build    # Build produzione
npm run start    # Avvio produzione
npm run lint     # Linting ESLint
```

### Dipendenze Principali
- `@headlessui/react`: Componenti UI accessibili
- `@tanstack/react-table`: Gestione tabelle
- `lucide-react`: Icone moderne
- `recharts`: Libreria grafici
- `react-simple-typewriter`: Effetto typewriter

### Configurazione Next.js
- **App Router**: Utilizzo del nuovo sistema di routing
- **Turbopack**: Build tool veloce per sviluppo
- **TypeScript**: Configurazione completa
- **CSS Modules**: Stili modulari

## Caratteristiche Tecniche

### Performance
- **Turbopack**: Build time ridotto
- **CSS Ottimizzato**: Variabili CSS per consistenza
- **Componenti Modulari**: Riusabilità e manutenibilità

### Responsive Design
- **Grid Layout**: Adattivo per diverse dimensioni schermo
- **Breakpoints**: Supporto mobile e desktop
- **Touch Friendly**: Interfaccia ottimizzata per touch

### Accessibilità
- **Semantic HTML**: Struttura semantica corretta
- **Contrasti**: Colori ad alto contrasto
- **Navigazione**: Tastiera e screen reader friendly

## Stato Attuale del Progetto

### Funzionalità Implementate
✅ Sistema di login con credenziali demo  
✅ Dashboard principale con widget informativi  
✅ Grafico andamento fondi con dati mock  
✅ Feed attività recenti  
✅ Navigazione sidebar  
✅ Layout responsive  
✅ Design system completo  

### Funzionalità Future
🔄 Gestione progetti completa  
🔄 CRUD investitori  
🔄 Sistema LOI avanzato  
🔄 Notifiche e alert  
🔄 Export dati  
🔄 Integrazione API backend  

## Note di Sviluppo

- Il progetto utilizza CSS personalizzato invece di Tailwind CSS per maggiore controllo
- I dati attualmente sono mock data per dimostrazione
- L'applicazione è pronta per l'integrazione con un backend API
- Il design è ottimizzato per l'uso professionale in ambito finanziario

## Conclusione

Smart Equity rappresenta una soluzione moderna e professionale per la gestione dell'equity, con un'interfaccia intuitiva e funzionalità avanzate per il monitoraggio degli investimenti. L'architettura modulare e l'uso di tecnologie moderne garantiscono scalabilità e manutenibilità per future espansioni.
