import type { TutorialRegistryEntry, TutorialStepContent, TutorialStepDefinition } from "./types";

export type LoiTutorialStep = "overview" | "filters" | "list";

export const loiTutorialSteps: TutorialStepDefinition<LoiTutorialStep>[] = [
  {
    id: "overview",
    number: 1,
    label: "Contesto LOI",
    title: "Capisci per quale company stai lavorando",
    description: "Questa pagina e la lista operativa delle LOI della company attiva: qui verifichi contesto, stato generale e accesso al portal investitore.",
  },
  {
    id: "filters",
    number: 2,
    label: "Filtri e modalita",
    title: "Distingui draft e LOI operative",
    description: "Il filtro draft ti aiuta a separare bozze interne da documenti che stanno gia entrando nel flusso di firma o follow-up.",
  },
  {
    id: "list",
    number: 3,
    label: "Lista e azioni",
    title: "Apri la LOI e fai l'azione giusta",
    description: "La lista finale e il pannello operativo da cui apri la LOI, testi il portal o inviti l'investitore solo quando il documento e davvero pronto.",
  },
];

export const loiTutorialContent: Record<LoiTutorialStep, TutorialStepContent> = {
  overview: {
    title: "Tutorial LOI: parti dal contesto",
    intro: "Prima di aprire una singola LOI, verifica di essere sulla startup corretta. Questo blocco serve a evitare errori di contesto e a capire se il portal che userai e quello giusto.",
    checks: [
      "Controlla il nome della company attiva prima di leggere o inviare qualsiasi documento.",
      "Verifica se il portal mostrato e il contesto corretto da usare per test e firma.",
      "Tratta questa pagina come lista operativa delle LOI, non come editor del singolo documento.",
    ],
    tip: "Se trovi documenti inattesi o investitori sbagliati, il primo controllo da fare e sempre il contesto company attivo.",
  },
  filters: {
    title: "Tutorial LOI: distingui draft e LOI operative",
    intro: "Questo filtro evita una confusione tipica: scambiare una bozza interna per una LOI gia pronta all'invio o alla firma.",
    checks: [
      "Attiva i draft solo quando stai preparando o revisionando documenti ancora non operativi.",
      "Lascia il filtro spento se vuoi concentrarti su LOI gia inviate, attive o prossime alla firma.",
      "Usa questa distinzione per non invitare un investitore su un documento incompleto o non ancora validato.",
    ],
    tip: "Molti errori operativi sulle LOI nascono proprio dal confondere una bozza con un documento pronto.",
  },
  list: {
    title: "Tutorial LOI: usa la lista come pannello operativo",
    intro: "Qui leggi stato, signer e azioni disponibili per ogni LOI. Ogni riga deve aiutarti a capire subito se aprire il dettaglio, verificare il portal o inviare un invito.",
    checks: [
      "Apri il dettaglio LOI quando devi lavorare sul documento, sui signer o sul lifecycle.",
      "Apri il portal per verificare l'esperienza lato investitore e il contesto di firma.",
      "Usa Invia invito solo quando lo stato della LOI consente davvero l'attivazione dell'investitore.",
    ],
    tip: "La lista e il ponte tra amministrazione documento e azione verso l'investitore: leggi prima lo stato, poi fai la mossa giusta.",
  },
};

export const loiTutorialDefinition: TutorialRegistryEntry<LoiTutorialStep> = {
  storageKey: "loi-tutorial-dismissed-v1",
  ariaLabel: "Tutorial della pagina LOI",
  eyebrow: "Onboarding LOI",
  steps: loiTutorialSteps,
  content: loiTutorialContent,
};
