import type { TutorialRegistryEntry, TutorialStepContent, TutorialStepDefinition } from "./types";

export type CapTableTutorialStep = "capTable" | "convertibles" | "round" | "results";

export const capTableFlowSteps: TutorialStepDefinition<CapTableTutorialStep>[] = [
  {
    id: "capTable",
    number: 1,
    label: "Situazione iniziale",
    title: "Definisci la base pre-round",
    description: "Inserisci chi possiede capitale prima del round. Questo blocco costruisce la fotografia iniziale da cui parte tutta la dilution.",
  },
  {
    id: "convertibles",
    number: 2,
    label: "Registro strumentisti",
    title: "Compila il registro sottoscrittori SFP",
    description: "Inserisci gli strumentisti uno per uno con ticket e condizioni economiche. Questo blocco e il registro reale che andra poi in conversione.",
  },
  {
    id: "round",
    number: 3,
    label: "Parametri round",
    title: "Configura l'evento di conversione",
    description: "Qui imposti pre-money, raccolta, floor, cap, discount e option pool. Sono i parametri che determinano il prezzo di conversione e la dilution finale.",
  },
  {
    id: "results",
    number: 4,
    label: "Esito post conversione",
    title: "Leggi l'esito del round",
    description: "Il simulatore ti mostra l'esito finale del round: casi A/B/C, nuova ownership, conversione strumentisti e cap table post operazione.",
  },
];

export const capTableTutorialContent: Record<CapTableTutorialStep, TutorialStepContent> = {
  capTable: {
    title: "Tutorial step 1: imposta la base di partenza",
    intro: "Qui stai ricostruendo la fotografia societaria prima del round. Se questa base e sbagliata, anche conversione e dilution finali saranno lette male.",
    checks: [
      "Inserisci tutti i soggetti che possiedono quota nominale prima dell'operazione.",
      "Controlla che nome, tipo e classe siano leggibili e coerenti con la struttura societaria reale.",
      "Verifica che l'importo nominale rappresenti davvero la base pre-round e non una stima approssimativa.",
    ],
    tip: "Pensa a questo blocco come alla colonna iniziale del workbook: chi c'e gia e con quanto capitale prima che accada il round.",
  },
  convertibles: {
    title: "Tutorial step 2: compila il registro strumentisti",
    intro: "Questo blocco rappresenta il registro dei sottoscrittori SFP che andra in conversione. Ogni riga deve essere leggibile da sola e riconducibile a un investitore reale.",
    checks: [
      "Inserisci uno strumentista per riga, senza aggregare soggetti diversi nello stesso record.",
      "Controlla ticket e discount perche influenzano direttamente il caso A, B o C della conversione.",
      "Verifica che non manchino sottoscrittori rilevanti rispetto al file Excel o al registro operativo.",
    ],
    tip: "Se uno strumentista manca qui, non lo ritroverai ne nella conversione ne nella cap table finale.",
  },
  round: {
    title: "Tutorial step 3: configura l'evento di conversione",
    intro: "Qui definisci i parametri economici che fanno scattare il calcolo. Questo e il blocco piu sensibile per capire perche si applica A, B o C.",
    checks: [
      "Pre-money e aumento di capitale devono rappresentare lo scenario round che vuoi davvero simulare.",
      "Floor, cap e discount devono essere coerenti tra loro, altrimenti il prezzo di conversione diventa poco leggibile.",
      "Decidi se l'option pool entra pre-money o post-money prima di interpretare la dilution finale.",
    ],
    tip: "Se vuoi capire un risultato anomalo, la spiegazione economica sta quasi sempre in questo step.",
  },
  results: {
    title: "Tutorial step 4: leggi l'esito nell'ordine giusto",
    intro: "Per evitare confusione, non partire dalla tabella finale. Leggi prima la sintesi del round, poi la conversione degli strumentisti e solo dopo la cap table post.",
    checks: [
      "Guarda prima chi entra, chi si diluisce e quale regola di conversione prevale.",
      "Usa la tab Conversione strumentisti per collegare il registro al risultato numerico.",
      "Chiudi la lettura sulla Cap table post per vedere l'effetto finale soggetto per soggetto.",
    ],
    tip: "Questo step funziona bene se lo leggi come una storia: regola applicata, conversione generata, cap table risultante.",
  },
};

export const capTableTutorialDefinition: TutorialRegistryEntry<CapTableTutorialStep> = {
  storageKey: "cap-table-tutorial-dismissed-v1",
  ariaLabel: "Tutorial del simulatore cap table",
  eyebrow: "Onboarding simulatore",
  steps: capTableFlowSteps,
  content: capTableTutorialContent,
};
