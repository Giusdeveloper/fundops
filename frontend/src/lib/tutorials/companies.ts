import type { TutorialRegistryEntry, TutorialStepContent, TutorialStepDefinition } from "./types";

export type CompaniesTutorialStep = "context" | "create" | "select";

export const companiesTutorialSteps: TutorialStepDefinition<CompaniesTutorialStep>[] = [
  {
    id: "context",
    number: 1,
    label: "Contesto attivo",
    title: "Capisci quale startup stai gestendo",
    description: "Questa pagina governa il contesto attivo di FundOps: la company scelta qui condiziona dashboard, LOI, supporters, issuance, cap table e dossier.",
  },
  {
    id: "create",
    number: 2,
    label: "Crea company",
    title: "Crea una nuova startup",
    description: "Usa il form iniziale solo quando la startup non e gia presente: qui stai creando il contenitore operativo su cui poi lavorerai nei moduli.",
  },
  {
    id: "select",
    number: 3,
    label: "Seleziona e apri",
    title: "Seleziona la company e apri il workflow",
    description: "La lista finale ti permette di impostare la company attiva e saltare subito nel modulo giusto: dashboard, supporters o LOI.",
  },
];

export const companiesTutorialContent: Record<CompaniesTutorialStep, TutorialStepContent> = {
  context: {
    title: "Tutorial companies: imposta il contesto",
    intro: "Qui scegli la startup su cui lavorare davvero. Tutto FundOps legge la company attiva, quindi se questo contesto e sbagliato anche i moduli successivi lo saranno.",
    checks: [
      "Controlla se esiste gia una company attiva e se e quella corretta.",
      "Verifica che il nome della startup corrisponda davvero al contesto su cui vuoi lavorare ora.",
      "Ricorda che questa selezione influenza tutti gli oggetti operativi della piattaforma.",
    ],
    tip: "Se qualcosa sembra fuori contesto in piattaforma, la prima verifica da fare e sempre la company attiva.",
  },
  create: {
    title: "Tutorial companies: crea una nuova startup",
    intro: "Usa questo blocco solo quando la startup non e ancora presente. Bastano pochi dati per creare il contesto iniziale su cui attivare dashboard, LOI e workflow FundOps.",
    checks: [
      "Inserisci almeno il nome company in modo chiaro e riconoscibile.",
      "Aggiungi ragione sociale e P.IVA se sono gia disponibili, ma non bloccare il flusso se mancano.",
      "Dopo la creazione, torna subito sulla lista e imposta la nuova company come attiva.",
    ],
    tip: "Non serve completare tutto subito: l'obiettivo e creare il contesto corretto e iniziare a lavorare senza ambiguita.",
  },
  select: {
    title: "Tutorial companies: seleziona e apri il workflow",
    intro: "Questa lista chiude il giro: qui imposti la company attiva e poi entri subito nel modulo piu utile per il lavoro che devi fare adesso.",
    checks: [
      "Imposta come attiva la company su cui lavori davvero, non una qualsiasi disponibile.",
      "Usa i link rapidi per entrare subito in dashboard, supporters o LOI senza passaggi inutili.",
      "Se non trovi una company, usa prima ricerca e filtri: evita di crearne una duplicata.",
    ],
    tip: "Il flusso giusto e semplice: company corretta, contesto attivo, modulo corretto aperto.",
  },
};

export const companiesTutorialDefinition: TutorialRegistryEntry<CompaniesTutorialStep> = {
  storageKey: "companies-tutorial-dismissed-v1",
  ariaLabel: "Tutorial della pagina companies",
  eyebrow: "Onboarding companies",
  steps: companiesTutorialSteps,
  content: companiesTutorialContent,
};
