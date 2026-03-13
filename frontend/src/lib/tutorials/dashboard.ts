import type { TutorialRegistryEntry, TutorialStepContent, TutorialStepDefinition } from "./types";

export type DashboardTutorialStep = "overview" | "process" | "objects";

export const dashboardTutorialSteps: TutorialStepDefinition<DashboardTutorialStep>[] = [
  {
    id: "overview",
    number: 1,
    label: "Overview operativa",
    title: "Parti da KPI e next action",
    description: "Apri la dashboard per capire in pochi secondi lo stato del round, cosa si sta muovendo e quale azione operativa ha davvero priorita oggi.",
  },
  {
    id: "process",
    number: 2,
    label: "Process map",
    title: "Leggi la fase del workflow",
    description: "La process map ti dice in quale fase si trova la company e, soprattutto, quali attivita appartengono a Booking, Issuance o Onboarding.",
  },
  {
    id: "objects",
    number: 3,
    label: "Oggetti FundOps",
    title: "Entra nel modulo giusto",
    description: "La griglia oggetti, le attivita recenti e il blocco Da fare ora trasformano la dashboard in un punto di ingresso concreto al lavoro operativo.",
  },
];

export const dashboardTutorialContent: Record<DashboardTutorialStep, TutorialStepContent> = {
  overview: {
    title: "Tutorial dashboard: parti dalla sintesi",
    intro: "Prima di entrare in LOI, Issuance o altri oggetti, fermati qui. In questo blocco capisci se il round ha bisogno di nuovi inviti, follow-up, attivazione Issuance o semplice monitoraggio.",
    checks: [
      "Controlla investitori attivi, LOI firmate, capitale prenotato e avanzamento booking.",
      "Leggi la next action come priorita operativa del momento, non come semplice alert.",
      "Verifica se la company e ancora in Booking o se ci sono gia le condizioni per passare a Issuance.",
    ],
    tip: "Usa la dashboard come cabina di regia: prima leggi il quadro generale, poi entri nel modulo che serve davvero.",
  },
  process: {
    title: "Tutorial dashboard: leggi la fase corrente",
    intro: "La process map ti dice dove si trova davvero la company nel workflow FundOps. Serve a evitare un errore tipico: fare attivita di Issuance quando la company e ancora in Booking, o viceversa.",
    checks: [
      "Individua la fase corrente evidenziata nella process map.",
      "Controlla cosa fai in quella fase, quali KPI contano e qual e la CTA proposta.",
      "Usa questa vista per non mescolare Booking, Issuance e Onboarding nello stesso momento operativo.",
    ],
    tip: "Se il team si disallinea sul processo, la chiarezza da recuperare e quasi sempre qui.",
  },
  objects: {
    title: "Tutorial dashboard: passa dal quadro generale all'azione",
    intro: "Dopo aver letto KPI e fase, qui scegli dove entrare. La griglia oggetti ti porta nel modulo giusto, mentre attivita recenti e Da fare ora ti indicano dove intervenire subito.",
    checks: [
      "Apri l'oggetto coerente con la fase corrente del processo, non quello che ti e piu familiare.",
      "Usa Attivita recenti per recuperare contesto senza dover cercare manualmente una pratica.",
      "Controlla Da fare ora per le azioni piu urgenti e ad alto impatto operativo.",
    ],
    tip: "Questa parte serve a passare dalla lettura alla decisione: capito il quadro, entra nel modulo corretto e lavora li.",
  },
};

export const dashboardTutorialDefinition: TutorialRegistryEntry<DashboardTutorialStep> = {
  storageKey: "dashboard-tutorial-dismissed-v1",
  ariaLabel: "Tutorial della dashboard FundOps",
  eyebrow: "Onboarding dashboard",
  steps: dashboardTutorialSteps,
  content: dashboardTutorialContent,
};
