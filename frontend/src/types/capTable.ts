export type CapTableParticipantType =
  | "founder"
  | "shareholder"
  | "investor"
  | "pool"
  | "convertible_holder";

export type CapTableInstrumentType = "sfp";

export type CapTablePoolMode = "pre_money" | "post_money";

export interface CapTableParticipantInput {
  id: string;
  name: string;
  type: CapTableParticipantType;
  className: string;
  amount: number;
}

export interface ConvertibleHolderInput {
  id: string;
  name: string;
  instrumentType: CapTableInstrumentType;
  className: string;
  amountEur: number;
  discount: number;
}

export interface CapTableRoundInput {
  preMoney: number;
  conversionValuation?: number;
  raiseAmount: number;
  floor: number;
  cap: number;
  defaultDiscount: number;
  optionPoolAmount: number;
  optionPoolMode: CapTablePoolMode;
}

export interface CapTableScenarioInput {
  participants: CapTableParticipantInput[];
  convertibles: ConvertibleHolderInput[];
  round: CapTableRoundInput;
}

export interface ParticipantOutcome {
  id: string;
  name: string;
  type: CapTableParticipantType | CapTableInstrumentType;
  className: string;
  cashAmountEur: number;
  preNominalAmount: number;
  roundNominalAmount: number;
  conversionNominalAmount: number;
  postNominalAmount: number;
  preOwnershipPct: number;
  postOwnershipPct: number;
  dilutionPct: number;
  premiumAmountEur: number;
  scenarioCase: "A" | "B" | "C" | null;
}

export interface ConvertibleScenarioOutcome {
  caseId: "A" | "B" | "C";
  discountedValuation: number;
  appliedConversionBase: number;
  conversionNominalAmount: number;
  premiumAmountEur: number;
  postOwnershipPct: number;
}

export interface ConvertibleOutcomeDetail {
  id: string;
  name: string;
  className: string;
  amountEur: number;
  discount: number;
  finalCase: "A" | "B" | "C";
  finalConversionNominalAmount: number;
  finalPremiumAmountEur: number;
  finalPostOwnershipPct: number;
  scenarios: ConvertibleScenarioOutcome[];
}

export interface SimulationSummaryKpi {
  preMoney: number;
  raiseAmount: number;
  postMoney: number;
  preCapitalNominal: number;
  roundCapitalNominal: number;
  optionPoolNominal: number;
  conversionCapitalNominal: number;
  postCapitalNominal: number;
  postRoundPreConversionNominal: number;
  totalPremiumEur: number;
  totalDilutionPct: number;
}

export interface SimulationStep {
  id: "initial" | "round_pre_conversion" | "conversion" | "post_conversion";
  label: string;
  capitalNominal: number;
  ownershipBaseNominal: number;
  cashEur: number;
  premiumEur: number;
}

export interface ScenarioPreview {
  caseId: "A" | "B" | "C";
  label: string;
  valuation: number;
  discountedValuation: number;
  appliedConversionBase: number;
  roundNominal: number;
  conversionNominalPerTicket: number;
  conversionNominalTotal: number;
  premiumPerTicketEur: number;
  premiumTotalEur: number;
  postCapitalNominal: number;
  participants: Array<{
    id: string;
    name: string;
    preNominalAmount: number;
    postNominalAmount: number;
    postOwnershipPct: number;
  }>;
}

export interface SimulationResult {
  summary: SimulationSummaryKpi;
  caseSummary: {
    caseA: number;
    caseB: number;
    caseC: number;
  };
  steps: SimulationStep[];
  scenarioPreviews: ScenarioPreview[];
  participants: ParticipantOutcome[];
  convertibleDetails: ConvertibleOutcomeDetail[];
}

export interface CapTableScenarioRecord {
  id: string;
  company_id: string;
  round_id: string | null;
  name: string;
  notes: string | null;
  is_baseline: boolean;
  version_count: number;
  draft_input: CapTableScenarioInput;
  latest_result: SimulationResult | null;
  latest_result_summary: SimulationSummaryKpi | null;
  created_at: string;
  updated_at: string;
}
