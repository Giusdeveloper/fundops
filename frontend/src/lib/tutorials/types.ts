export type TutorialStatusTone = "complete" | "attention" | "pending";

export interface TutorialStepDefinition<StepId extends string> {
  id: StepId;
  number: number;
  label: string;
  title: string;
  description: string;
}

export interface TutorialStepContent {
  title: string;
  intro: string;
  checks: string[];
  tip: string;
}

export interface TutorialStepState {
  status: TutorialStatusTone;
  statusLabel: string;
  smartMessage: string;
  ctaLabel: string;
  ctaIntent: "focus" | "simulate";
}

export interface TutorialRegistryEntry<StepId extends string> {
  storageKey: string;
  ariaLabel: string;
  eyebrow: string;
  steps: TutorialStepDefinition<StepId>[];
  content: Record<StepId, TutorialStepContent>;
}
