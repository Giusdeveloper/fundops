import type { TutorialRegistryEntry, TutorialStepContent, TutorialStepDefinition } from "./types";

export type IssuanceTutorialStep = "overview" | "kpis" | "table";

export const issuanceTutorialSteps: TutorialStepDefinition<IssuanceTutorialStep>[] = [
  {
    id: "overview",
    number: 1,
    label: "Contesto Issuance",
    title: "Capisci che tipo di lavoro stai facendo",
    description: "Issuance e la fase in cui il booking diventa pratica operativa: qui controlli investimenti, documenti e stato di avanzamento della singola pratica.",
  },
  {
    id: "kpis",
    number: 2,
    label: "KPI fase",
    title: "Leggi prima i volumi da processare",
    description: "I KPI iniziali servono a capire quante pratiche aspettano verifica, quante sono gia approvate e quanta raccolta e stata gia formalizzata.",
  },
  {
    id: "table",
    number: 3,
    label: "Lista investimenti",
    title: "Apri la pratica giusta e verifica i documenti",
    description: "La tabella e il pannello operativo dove leggi stato, documenti mancanti e data invio per decidere quale pratica toccare per prima.",
  },
];

export const issuanceTutorialContent: Record<IssuanceTutorialStep, TutorialStepContent> = {
  overview: {
    title: "Tutorial Issuance: leggi la fase corretta",
    intro: "Questa pagina serve quando il lavoro non e piu raccogliere interesse, ma verificare pratiche in ingresso. Qui conta la qualita operativa dell'investimento, non il suo interesse teorico.",
    checks: [
      "Verifica di essere sulla company giusta prima di leggere o modificare qualsiasi pratica.",
      "Usa questa vista per capire il carico operativo della fase di verifica.",
      "Ricorda che qui contano stato pratica, documenti presenti e passaggi ancora mancanti.",
    ],
    tip: "Issuance va letta come coda operativa: qui non stai cercando investitori, stai facendo avanzare pratiche.",
  },
  kpis: {
    title: "Tutorial Issuance: parti dai numeri di processo",
    intro: "I KPI iniziali servono a capire subito se la fase e sotto controllo o se si sta accumulando arretrato. Prima guarda i numeri, poi entra nei dettagli.",
    checks: [
      "Guarda prima quanti investimenti sono da verificare: e il KPI che misura il carico immediato.",
      "Controlla quanti sono gia approvati e il totale approvato per leggere il progresso della fase.",
      "Usa questi numeri per decidere se entrare subito nel dettaglio o fare prima una scansione generale della situazione.",
    ],
    tip: "Se la fase sembra bloccata, il primo segnale concreto e quasi sempre nel numero di pratiche ferme da verificare.",
  },
  table: {
    title: "Tutorial Issuance: verifica la singola pratica",
    intro: "La tabella finale e il posto giusto da cui aprire una pratica, controllare documenti mancanti e capire perche un investimento non sta avanzando.",
    checks: [
      "Leggi stato pratica e documenti insieme, non come informazioni separate.",
      "Controlla modulo e bonifico prima di considerare la pratica davvero completa.",
      "Apri il dettaglio solo dopo aver capito quali righe hanno priorita reale di lavorazione.",
    ],
    tip: "La colonna documenti e spesso la scorciatoia migliore per capire perche una pratica non avanza.",
  },
};

export const issuanceTutorialDefinition: TutorialRegistryEntry<IssuanceTutorialStep> = {
  storageKey: "issuance-tutorial-dismissed-v1",
  ariaLabel: "Tutorial della pagina Issuance",
  eyebrow: "Onboarding Issuance",
  steps: issuanceTutorialSteps,
  content: issuanceTutorialContent,
};
