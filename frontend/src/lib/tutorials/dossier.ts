import type { TutorialRegistryEntry, TutorialStepContent, TutorialStepDefinition } from "./types";

export type DossierTutorialStep = "connection" | "vault" | "round";

export const dossierTutorialSteps: TutorialStepDefinition<DossierTutorialStep>[] = [
  {
    id: "connection",
    number: 1,
    label: "Connessione Drive",
    title: "Attiva la base documentale",
    description: "Il dossier parte dalla connessione Google Drive e dalla root FundOps della company attiva: senza questa base, il resto del workflow documentale non esiste.",
  },
  {
    id: "vault",
    number: 2,
    label: "Vault principale",
    title: "Leggi e popola il vault principale",
    description: "Qui controlli i documenti generali della startup e carichi file nella root FundOps, separandoli dai materiali specifici di round.",
  },
  {
    id: "round",
    number: 3,
    label: "Dossier round",
    title: "Gestisci il dossier round per fase",
    description: "Il blocco round organizza i file per Booking, Issuance e Onboarding e ti dice subito quanto il dossier e completo o dove manca ancora documentazione.",
  },
];

export const dossierTutorialContent: Record<DossierTutorialStep, TutorialStepContent> = {
  connection: {
    title: "Tutorial dossier: attiva prima la base documentale",
    intro: "Il dossier funziona bene solo se la connessione Drive e la root FundOps della company sono gia pronte. Questo blocco e il prerequisito tecnico di tutto il resto.",
    checks: [
      "Verifica che la company attiva sia quella giusta prima di toccare cartelle o file.",
      "Controlla se Google Drive e gia connesso e se la root FundOps esiste davvero.",
      "Se manca la root FundOps, inizializzala prima di provare qualsiasi upload o apertura cartella.",
    ],
    tip: "Se il dossier sembra vuoto, incoerente o incompleto, il primo controllo tecnico da fare e sempre qui.",
  },
  vault: {
    title: "Tutorial dossier: usa la root come archivio generale",
    intro: "La root FundOps raccoglie i documenti generali della startup. Qui dovrebbero vivere i file trasversali, non quelli che appartengono a una specifica emissione o fase di round.",
    checks: [
      "Guarda se la root contiene gia documenti esistenti prima di caricare duplicati.",
      "Usa l'upload root solo per file generali e non per documenti round-specifici.",
      "Controlla naming e data ultimo aggiornamento prima di caricare una nuova versione.",
    ],
    tip: "Questa sezione e il vault generale della startup, non il dossier di una singola emissione.",
  },
  round: {
    title: "Tutorial dossier: leggi il round come checklist",
    intro: "Il blocco round e il vero cuore operativo del dossier. Qui capisci cosa manca in Booking, Issuance e Onboarding e carichi il documento giusto nella cartella giusta.",
    checks: [
      "Seleziona il round corretto prima di interpretare avanzamento o checklist.",
      "Controlla stato dossier, completamento fase e documenti mancanti nello stesso punto.",
      "Usa gli upload di fase per mantenere separati i documenti di Booking, Issuance e Onboarding.",
    ],
    tip: "Questa parte va letta come checklist operativa: fase corretta, cartella corretta, documento mancante corretto.",
  },
};

export const dossierTutorialDefinition: TutorialRegistryEntry<DossierTutorialStep> = {
  storageKey: "dossier-tutorial-dismissed-v1",
  ariaLabel: "Tutorial della pagina Dossier",
  eyebrow: "Onboarding dossier",
  steps: dossierTutorialSteps,
  content: dossierTutorialContent,
};
