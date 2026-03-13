import type { TutorialRegistryEntry, TutorialStepContent, TutorialStepDefinition } from "./types";

export type PlatformTutorialStep = "sidebar" | "header" | "workspace";

export const platformTutorialSteps: TutorialStepDefinition<PlatformTutorialStep>[] = [
  {
    id: "sidebar",
    number: 1,
    label: "Navigazione",
    title: "Usa la sidebar come mappa del prodotto",
    description: "La sidebar e la struttura principale del workspace: da qui entri nei moduli FundOps, cambi area di lavoro e capisci dove trovare il pezzo di processo che ti serve.",
  },
  {
    id: "header",
    number: 2,
    label: "Contesto attivo",
    title: "Leggi pagina, company e profilo",
    description: "L'header ti mostra dove sei, su quale company stai lavorando e ti da accesso rapido al profilo: e il tuo controllo di contesto prima di fare azioni operative.",
  },
  {
    id: "workspace",
    number: 3,
    label: "Area di lavoro",
    title: "Lavora modulo per modulo",
    description: "Ogni pagina ha un tutorial specifico. Il workspace centrale e dove fai il lavoro vero, sempre a partire dalla company attiva e dalla fase corretta del processo.",
  },
];

export const platformTutorialContent: Record<PlatformTutorialStep, TutorialStepContent> = {
  sidebar: {
    title: "Tutorial piattaforma: orientati dalla sidebar",
    intro: "La sidebar non e solo menu: e la mappa del processo FundOps. Da qui passi tra Dashboard, Companies, LOI, Issuance, Cap Table e Dossier senza perdere il filo del workflow.",
    checks: [
      "Usa Dashboard come overview del round e punto di partenza decisionale.",
      "Entra in Companies quando devi cambiare startup o correggere il contesto attivo.",
      "Apri un oggetto solo dopo aver capito su quale company e su quale fase stai lavorando.",
    ],
    tip: "Se ti perdi nel prodotto, torna sempre alla sidebar: e il punto di orientamento principale di tutta la piattaforma.",
  },
  header: {
    title: "Tutorial piattaforma: controlla il contesto in alto",
    intro: "L'header ti dice sempre dove sei e quale company e attiva. E il punto piu rapido per verificare il contesto prima di modificare dati, documenti o simulazioni.",
    checks: [
      "Controlla il titolo pagina per capire in quale modulo ti trovi davvero.",
      "Verifica la company attiva prima di modificare dati, documenti o pratiche.",
      "Usa il menu profilo per account, impostazioni e uscita dalla sessione.",
    ],
    tip: "Molti errori di primo utilizzo nascono da un contesto pagina o company letto male.",
  },
  workspace: {
    title: "Tutorial piattaforma: entra nel modulo giusto",
    intro: "L'area centrale cambia in base al modulo. Qui trovi dashboard operative, liste, simulatori e dossier. Ogni pagina ha una guida contestuale pensata per aiutarti a leggere e agire.",
    checks: [
      "Segui il tutorial della pagina quando la apri per la prima volta o quando cambi workflow.",
      "Lavora sempre dentro il modulo piu coerente con la fase corrente del processo.",
      "Usa i tutorial per capire cosa guardare per primo e quale azione ha senso fare dopo.",
    ],
    tip: "La piattaforma rende meglio se la percorri come workflow operativo, non come insieme di pagine isolate.",
  },
};

export const platformTutorialDefinition: TutorialRegistryEntry<PlatformTutorialStep> = {
  storageKey: "platform-tutorial-dismissed-v1",
  ariaLabel: "Tutorial globale della piattaforma FundOps",
  eyebrow: "Onboarding piattaforma",
  steps: platformTutorialSteps,
  content: platformTutorialContent,
};
