"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TutorialModal from "@/components/onboarding/TutorialModal";
import { useTutorial } from "@/components/onboarding/useTutorial";
import RequireCompany from "@/components/RequireCompany";
import { useCompany } from "@/context/CompanyContext";
import { useToast } from "@/components/ToastProvider";
import { normalizeSimulationResult } from "@/lib/capTable/normalize";
import { capTableFlowSteps, capTableTutorialContent, capTableTutorialDefinition, type CapTableTutorialStep } from "@/lib/tutorials/capTable";
import type { TutorialStepState } from "@/lib/tutorials/types";
import type { CapTableParticipantInput, CapTableScenarioInput, CapTableScenarioRecord, ConvertibleHolderInput, SimulationResult } from "@/types/capTable";
import styles from "./capTable.module.css";

interface ScenarioDetailResponse {
  scenario: CapTableScenarioRecord;
  versions: Array<{ id: string; version_number: number; summary_snapshot: SimulationResult["summary"] | null; created_at: string }>;
}

type ResultsTab = "overview" | "strumentisti" | "scenarios" | "capTable";
type FlowStep = CapTableTutorialStep;

const chartPalette = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ef4444"];

function eur(amount: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(amount ?? 0));
}

function nominal(amount: number) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(Number(amount ?? 0));
}

function pct(value: number) {
  return `${(Number(value ?? 0) * 100).toFixed(2)}%`;
}

function createParticipant(): CapTableParticipantInput {
  return { id: crypto.randomUUID(), name: "", type: "founder", className: "A", amount: 0 };
}

function createConvertible(): ConvertibleHolderInput {
  return { id: crypto.randomUUID(), name: "", instrumentType: "sfp", className: "B", amountEur: 0, discount: 0.2 };
}

const emptyInput: CapTableScenarioInput = {
  participants: [],
  convertibles: [],
  round: { preMoney: 0, conversionValuation: 0, raiseAmount: 0, floor: 0, cap: 0, defaultDiscount: 0.2, optionPoolAmount: 0, optionPoolMode: "pre_money" },
};

function buildScenarioSignature(name: string, notes: string, input: CapTableScenarioInput) {
  return JSON.stringify({ name, notes, input });
}

const flowSteps = capTableFlowSteps;

export default function CapTableClient() {
  const { activeCompanyId: companyId } = useCompany();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scenarios, setScenarios] = useState<CapTableScenarioRecord[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioNotes, setScenarioNotes] = useState("");
  const [draftInput, setDraftInput] = useState<CapTableScenarioInput>(emptyInput);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [versions, setVersions] = useState<ScenarioDetailResponse["versions"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [setupWarning, setSetupWarning] = useState<string | null>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [simulatedSignature, setSimulatedSignature] = useState<string | null>(null);
  const [resultsTab, setResultsTab] = useState<ResultsTab>("overview");
  const [activeStep, setActiveStep] = useState<FlowStep>("capTable");
  const stepRefs = useRef<Record<FlowStep, HTMLElement | null>>({
    capTable: null,
    convertibles: null,
    round: null,
    results: null,
  });

  const currentScenarioSignature = useMemo(() => buildScenarioSignature(scenarioName, scenarioNotes, draftInput), [scenarioName, scenarioNotes, draftInput]);
  const sortedOutcomes = useMemo(() => [...(result?.participants ?? [])].sort((left, right) => right.postNominalAmount - left.postNominalAmount), [result]);
  const hasUnsavedChanges = Boolean(savedSignature && currentScenarioSignature !== savedSignature);
  const isSimulationStale = Boolean(result && simulatedSignature && simulatedSignature !== currentScenarioSignature);
  const participantCount = draftInput.participants.length;
  const convertibleCount = draftInput.convertibles.length;
  const totalConvertibleAmount = useMemo(
    () => draftInput.convertibles.reduce((sum, item) => sum + Number(item.amountEur || 0), 0),
    [draftInput.convertibles]
  );
  const averageConvertibleTicket = useMemo(
    () => (convertibleCount > 0 ? totalConvertibleAmount / convertibleCount : 0),
    [convertibleCount, totalConvertibleAmount]
  );
  const enteringHolders = useMemo(
    () => sortedOutcomes.filter((outcome) => outcome.type === "sfp" || outcome.conversionNominalAmount > 0),
    [sortedOutcomes]
  );
  const mostDilutedHolder = useMemo(
    () =>
      [...sortedOutcomes]
        .filter((outcome) => outcome.type !== "sfp")
        .sort((left, right) => right.dilutionPct - left.dilutionPct)[0] ?? null,
    [sortedOutcomes]
  );
  const topOwners = useMemo(() => sortedOutcomes.slice(0, 3), [sortedOutcomes]);
  const strumentistiConversionRows = useMemo(() => {
    return draftInput.convertibles.map((instrument, index) => {
      const outcome =
        sortedOutcomes.find((item) => item.id === instrument.id) ??
        sortedOutcomes.find((item) => item.name === instrument.name && item.type === "sfp") ??
        null;

      return {
        id: instrument.id,
        index: index + 1,
        name: instrument.name || `Strumentista ${index + 1}`,
        className: instrument.className,
        amountEur: Number(instrument.amountEur || 0),
        discount: Number(instrument.discount || 0),
        scenarioCase: outcome?.scenarioCase ?? null,
        conversionNominalAmount: outcome?.conversionNominalAmount ?? 0,
        premiumAmountEur: outcome?.premiumAmountEur ?? 0,
        postOwnershipPct: outcome?.postOwnershipPct ?? 0,
      };
    });
  }, [draftInput.convertibles, sortedOutcomes]);
  const strumentistiConversionSummary = useMemo(() => {
    return {
      count: strumentistiConversionRows.length,
      totalNominal: strumentistiConversionRows.reduce((sum, row) => sum + row.conversionNominalAmount, 0),
      totalPremium: strumentistiConversionRows.reduce((sum, row) => sum + row.premiumAmountEur, 0),
    };
  }, [strumentistiConversionRows]);
  const topConvertedStrumentisti = useMemo(
    () =>
      [...strumentistiConversionRows]
        .sort((left, right) => right.postOwnershipPct - left.postOwnershipPct)
        .slice(0, 3),
    [strumentistiConversionRows]
  );
  const convertedStrumentistaIds = useMemo(
    () => new Set(strumentistiConversionRows.map((row) => row.id)),
    [strumentistiConversionRows]
  );
  const ownershipChartData = useMemo(
    () =>
      sortedOutcomes.slice(0, 6).map((outcome) => ({
        name: outcome.name,
        preOwnershipPct: Number((outcome.preOwnershipPct * 100).toFixed(2)),
        postOwnershipPct: Number((outcome.postOwnershipPct * 100).toFixed(2)),
      })),
    [sortedOutcomes]
  );
  const compositionChartData = useMemo(
    () =>
      sortedOutcomes
        .filter((outcome) => outcome.postOwnershipPct > 0)
        .slice(0, 6)
        .map((outcome) => ({
          name: outcome.name,
          value: Number((outcome.postOwnershipPct * 100).toFixed(2)),
        })),
    [sortedOutcomes]
  );
  const capitalBridgeChartData = useMemo(
    () => [
      { name: "Capitale iniziale", value: result?.summary.preCapitalNominal ?? 0 },
      { name: "Nuovo round", value: result?.summary.roundCapitalNominal ?? 0 },
      { name: "Option pool", value: result?.summary.optionPoolNominal ?? 0 },
      { name: "Conversione SFP", value: result?.summary.conversionCapitalNominal ?? 0 },
    ],
    [result]
  );
  const ownershipChartMax = useMemo(
    () => Math.max(1, ...ownershipChartData.flatMap((item) => [item.preOwnershipPct, item.postOwnershipPct])),
    [ownershipChartData]
  );
  const compositionChartTotal = useMemo(
    () => compositionChartData.reduce((sum, item) => sum + item.value, 0),
    [compositionChartData]
  );
  const capitalBridgeChartMax = useMemo(
    () => Math.max(1, ...capitalBridgeChartData.map((item) => item.value)),
    [capitalBridgeChartData]
  );
  const roundValidationMessages = useMemo(() => {
    const messages: string[] = [];
    if (draftInput.round.preMoney <= 0) messages.push("La pre-money deve essere maggiore di zero per calcolare il prezzo di conversione.");
    if (draftInput.round.conversionValuation != null && draftInput.round.conversionValuation < 0) messages.push("La valutazione evento di conversione non puo essere negativa.");
    if (draftInput.round.raiseAmount < 0) messages.push("L'aumento di capitale non puo essere negativo.");
    if (draftInput.round.floor < 0 || draftInput.round.cap < 0) messages.push("Floor e cap devono essere valori positivi o nulli.");
    if (draftInput.round.cap > 0 && draftInput.round.floor > 0 && draftInput.round.floor > draftInput.round.cap) {
      messages.push("Il floor non dovrebbe superare il cap, altrimenti i casi A/B/C diventano poco leggibili.");
    }
    if (draftInput.round.defaultDiscount < 0 || draftInput.round.defaultDiscount > 1) {
      messages.push("Il discount default SFP va espresso tra 0 e 1, per esempio 0.20 per il 20%.");
    }
    if (draftInput.round.optionPoolAmount < 0) {
      messages.push("L'option pool non puo essere negativo.");
    }
    return messages;
  }, [draftInput.round]);
  const participantValidationMessages = useMemo(() => {
    const messages: string[] = [];
    if (draftInput.participants.some((participant) => !participant.name.trim())) {
      messages.push("Ogni riga della cap table iniziale dovrebbe avere un nome soggetto riconoscibile.");
    }
    if (draftInput.participants.some((participant) => Number(participant.amount || 0) < 0)) {
      messages.push("Gli importi nominali della cap table iniziale non possono essere negativi.");
    }
    return messages;
  }, [draftInput.participants]);
  const convertibleValidationMessages = useMemo(() => {
    const messages: string[] = [];
    if (draftInput.convertibles.some((instrument) => !instrument.name.trim())) {
      messages.push("Ogni strumentista dovrebbe avere un nome per poter leggere correttamente la conversione finale.");
    }
    if (draftInput.convertibles.some((instrument) => Number(instrument.amountEur || 0) < 0)) {
      messages.push("I ticket SFP non possono essere negativi.");
    }
    if (draftInput.convertibles.some((instrument) => Number(instrument.discount || 0) < 0 || Number(instrument.discount || 0) > 1)) {
      messages.push("Il discount di ogni strumentista va espresso tra 0 e 1.");
    }
    return messages;
  }, [draftInput.convertibles]);
  const dominantCase = useMemo(() => {
    if (!result) return null;
    const entries = [
      { id: "A", count: result.caseSummary.caseA, label: "floor" },
      { id: "B", count: result.caseSummary.caseB, label: "cap" },
      { id: "C", count: result.caseSummary.caseC, label: "valuation scontata" },
    ] as const;
    return [...entries].sort((left, right) => right.count - left.count)[0];
  }, [result]);
  const caseExplanations = useMemo(() => {
    if (!result) return [];
    return result.scenarioPreviews.map((preview) => {
      let reason = "";
      if (preview.caseId === "A") {
        reason = `Si applica il floor perche la valuation scontata (${eur(preview.discountedValuation)}) scende sotto la soglia minima di conversione.`;
      } else if (preview.caseId === "B") {
        reason = `Si applica il cap perche la valuation scontata (${eur(preview.discountedValuation)}) supera il tetto massimo previsto dalla conversione.`;
      } else {
        reason = `Si applica la valuation scontata perche resta compresa tra floor e cap, quindi non interviene alcun limite correttivo.`;
      }

      return {
        ...preview,
        reason,
      };
    });
  }, [result]);
  const activeStepIndex = flowSteps.findIndex((step) => step.id === activeStep);
  const currentStep = flowSteps[activeStepIndex] ?? flowSteps[0];
  const tutorialStates = useMemo<Record<FlowStep, TutorialStepState>>(() => {
    const participantsReady =
      draftInput.participants.length > 0 &&
      draftInput.participants.every((participant) => participant.name.trim() && Number(participant.amount || 0) >= 0);
    const convertiblesReady =
      draftInput.convertibles.length > 0 &&
      draftInput.convertibles.every(
        (instrument) =>
          instrument.name.trim() &&
          Number(instrument.amountEur || 0) >= 0 &&
          Number(instrument.discount || 0) >= 0 &&
          Number(instrument.discount || 0) <= 1
      );
    const roundReady =
      draftInput.round.preMoney > 0 &&
      draftInput.round.raiseAmount >= 0 &&
      draftInput.round.floor >= 0 &&
      draftInput.round.cap >= 0 &&
      draftInput.round.defaultDiscount >= 0 &&
      draftInput.round.defaultDiscount <= 1 &&
      !(draftInput.round.cap > 0 && draftInput.round.floor > 0 && draftInput.round.floor > draftInput.round.cap);
    const resultsReady = Boolean(result);

    return {
      capTable: participantsReady
        ? {
            status: "complete",
            statusLabel: "Completo",
            smartMessage: `Hai ${draftInput.participants.length} soggetti nella base iniziale. La fotografia pre-round e leggibile.`,
            ctaLabel: "Controlla la base iniziale",
            ctaIntent: "focus",
          }
        : {
            status: draftInput.participants.length > 0 ? "attention" : "pending",
            statusLabel: draftInput.participants.length > 0 ? "Da rifinire" : "Da iniziare",
            smartMessage:
              draftInput.participants.length > 0
                ? "Hai gia iniziato la cap table iniziale, ma ci sono ancora righe da completare o verificare."
                : "Inserisci prima i soggetti gia presenti in cap table. Senza questa base la dilution finale non e affidabile.",
            ctaLabel:
              draftInput.participants.length === 0
                ? "Aggiungi almeno un partecipante"
                : participantValidationMessages[0] ?? "Completa la cap table iniziale",
            ctaIntent: "focus",
          },
      convertibles: convertiblesReady
        ? {
            status: "complete",
            statusLabel: "Completo",
            smartMessage: `Il registro contiene ${draftInput.convertibles.length} strumentisti. Ticket e discount risultano pronti per la conversione.`,
            ctaLabel: "Rivedi il registro strumentisti",
            ctaIntent: "focus",
          }
        : {
            status: draftInput.convertibles.length > 0 ? "attention" : "pending",
            statusLabel: draftInput.convertibles.length > 0 ? "Da rifinire" : "Da iniziare",
            smartMessage:
              draftInput.convertibles.length > 0
                ? "Il registro strumentisti esiste, ma ci sono ancora campi mancanti o discount da correggere."
                : "Compila il registro sottoscrittori SFP: e il ponte tra workbook e conversione finale.",
            ctaLabel:
              draftInput.convertibles.length === 0
                ? "Aggiungi almeno uno strumentista"
                : convertibleValidationMessages[0] ?? "Compila il registro strumentisti",
            ctaIntent: "focus",
          },
      round: roundReady
        ? {
            status: "complete",
            statusLabel: "Completo",
            smartMessage: "I parametri round sono coerenti. Il simulatore puo leggere bene i casi A/B/C.",
            ctaLabel: "Rivedi i parametri round",
            ctaIntent: "focus",
          }
        : {
            status: draftInput.round.preMoney > 0 || draftInput.round.raiseAmount > 0 ? "attention" : "pending",
            statusLabel: draftInput.round.preMoney > 0 || draftInput.round.raiseAmount > 0 ? "Da rifinire" : "Da iniziare",
            smartMessage:
              draftInput.round.preMoney > 0 || draftInput.round.raiseAmount > 0
                ? "Hai gia impostato parte dello scenario, ma c'e ancora qualche parametro da chiarire o validare."
                : "Imposta pre-money, aumento di capitale, floor, cap e option pool per generare uno scenario leggibile.",
            ctaLabel:
              roundValidationMessages[0] ??
              (draftInput.round.preMoney <= 0 ? "Inserisci la pre-money valuation" : "Configura il round"),
            ctaIntent: "focus",
          },
      results: resultsReady
        ? {
            status: "complete",
            statusLabel: "Disponibile",
            smartMessage: "Lo scenario e gia simulato. Puoi leggere sintesi, conversione strumentisti e cap table post.",
            ctaLabel: "Apri i risultati",
            ctaIntent: "focus",
          }
        : {
            status: "pending",
            statusLabel: "In attesa",
            smartMessage: "I risultati compariranno dopo la simulazione. Prima completa i parametri round e lancia il calcolo.",
            ctaLabel: roundReady ? "Lancia la simulazione adesso" : "Completa prima il round",
            ctaIntent: roundReady ? "simulate" : "focus",
          },
    };
  }, [draftInput, result, participantValidationMessages, convertibleValidationMessages, roundValidationMessages]);
  const tutorial = useTutorial<FlowStep>({
    storageKey: capTableTutorialDefinition.storageKey,
    steps: flowSteps.map((step) => step.id),
    initialStepId: "capTable",
    onStepChange: setActiveStep,
  });
  const tutorialOpen = tutorial.isOpen;
  const tutorialStep = tutorial.currentStepId;
  const tutorialStepIndex = tutorial.currentIndex;
  const currentTutorial = capTableTutorialContent[tutorialStep];
  const currentTutorialState = tutorialStates[tutorialStep];

  const loadScenarios = useCallback(async (nextCompanyId: string, preferredScenarioId?: string | null) => {
    setLoading(true);
    setError(null);
    setSetupWarning(null);
    try {
      const response = await fetch(`/api/cap-table/scenarios?companyId=${encodeURIComponent(nextCompanyId)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { scenarios?: CapTableScenarioRecord[]; error?: string; warning?: string; setupRequired?: boolean } | null;
      if (!response.ok) throw new Error(payload?.error || "Errore caricamento scenari");
      if (payload?.setupRequired && payload.warning) setSetupWarning(payload.warning);
      const nextScenarios = payload?.scenarios ?? [];
      setScenarios(nextScenarios);
      if (nextScenarios.length === 0) return resetEditor();
      const preferred =
        nextScenarios.find((item) => item.id === preferredScenarioId) ??
        nextScenarios.find((item) => item.id === selectedScenarioId) ??
        nextScenarios.find((item) => item.is_baseline) ??
        nextScenarios[0];
      await loadScenarioDetail(preferred.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento scenari");
    } finally {
      setLoading(false);
    }
  }, [selectedScenarioId, showToast]);

  useEffect(() => {
    if (!companyId) return;
    void loadScenarios(companyId);
  }, [companyId, loadScenarios]);

  function resetEditor() {
    setSelectedScenarioId(null);
    setScenarioName("");
    setScenarioNotes("");
    setDraftInput(emptyInput);
    setResult(null);
    setVersions([]);
    setSavedSignature(null);
    setSimulatedSignature(null);
    setResultsTab("overview");
    setActiveStep("capTable");
  }

  async function loadScenarioDetail(scenarioId: string) {
    setLoading(true);
    setError(null);
    setSetupWarning(null);
    try {
      const response = await fetch(`/api/cap-table/scenarios/${encodeURIComponent(scenarioId)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as ScenarioDetailResponse | { error?: string } | null;
      if (!response.ok || !payload || !("scenario" in payload)) throw new Error((payload as { error?: string } | null)?.error || "Errore caricamento scenario");
      const normalizedResult = normalizeSimulationResult(payload.scenario.latest_result, payload.scenario.draft_input);
      const nextSignature = buildScenarioSignature(payload.scenario.name, payload.scenario.notes ?? "", payload.scenario.draft_input);
      setSelectedScenarioId(payload.scenario.id);
      setScenarioName(payload.scenario.name);
      setScenarioNotes(payload.scenario.notes ?? "");
      setDraftInput(payload.scenario.draft_input);
      setResult(normalizedResult);
      setVersions(payload.versions ?? []);
      setSavedSignature(nextSignature);
      setSimulatedSignature(normalizedResult ? nextSignature : null);
      setResultsTab("overview");
      setActiveStep("capTable");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento scenario");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateScenario() {
    if (!companyId) return;
    setSaving(true);
    try {
      const response = await fetch("/api/cap-table/scenarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Errore creazione scenario");
      showToast("Scenario creato", "success");
      await loadScenarios(companyId, payload?.scenario?.id ?? null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Errore creazione scenario", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSimulate() {
    if (!selectedScenarioId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/cap-table/scenarios/${encodeURIComponent(selectedScenarioId)}/simulate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftInput }) });
      const payload = (await response.json().catch(() => null)) as { result?: SimulationResult; error?: string } | null;
      if (!response.ok || !payload?.result) throw new Error(payload?.error || "Errore simulazione");
      setResult(payload.result);
      setSimulatedSignature(currentScenarioSignature);
      setResultsTab("overview");
      setActiveStep("results");
      showToast("Simulazione aggiornata", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Errore simulazione", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!selectedScenarioId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/cap-table/scenarios/${encodeURIComponent(selectedScenarioId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: scenarioName, notes: scenarioNotes, draftInput, persistVersion: true }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Errore salvataggio scenario");
      showToast("Scenario salvato", "success");
      if (companyId) await loadScenarios(companyId, selectedScenarioId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Errore salvataggio scenario", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate() {
    if (!selectedScenarioId || !companyId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/cap-table/scenarios/${encodeURIComponent(selectedScenarioId)}/duplicate`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Errore duplicazione scenario");
      showToast("Scenario duplicato", "success");
      await loadScenarios(companyId, payload?.scenario?.id ?? null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Errore duplicazione scenario", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetBaseline() {
    if (!selectedScenarioId || !companyId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/cap-table/scenarios/${encodeURIComponent(selectedScenarioId)}/set-baseline`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Errore aggiornamento baseline");
      showToast("Baseline aggiornata", "success");
      await loadScenarios(companyId, selectedScenarioId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Errore aggiornamento baseline", "error");
    } finally {
      setSaving(false);
    }
  }

  function updateParticipant(index: number, patch: Partial<CapTableParticipantInput>) {
    setDraftInput((current) => ({ ...current, participants: current.participants.map((item, currentIndex) => currentIndex === index ? { ...item, ...patch } : item) }));
  }

  function updateConvertible(index: number, patch: Partial<ConvertibleHolderInput>) {
    setDraftInput((current) => ({ ...current, convertibles: current.convertibles.map((item, currentIndex) => currentIndex === index ? { ...item, ...patch } : item) }));
  }

  function removeParticipant(index: number) {
    setDraftInput((current) => ({ ...current, participants: current.participants.filter((_, currentIndex) => currentIndex !== index) }));
  }

  function removeConvertible(index: number) {
    setDraftInput((current) => ({ ...current, convertibles: current.convertibles.filter((_, currentIndex) => currentIndex !== index) }));
  }

  function goToStep(nextStep: FlowStep) {
    setActiveStep(nextStep);
  }

  function goToPreviousStep() {
    if (activeStepIndex <= 0) return;
    setActiveStep(flowSteps[activeStepIndex - 1].id);
  }

  function goToNextStep() {
    if (activeStepIndex >= flowSteps.length - 1) return;
    setActiveStep(flowSteps[activeStepIndex + 1].id);
  }

  function reopenTutorial() {
    tutorial.reopen(activeStep);
  }

  function focusStep(step: FlowStep) {
    const node = stepRefs.current[step];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goToTutorialStep(nextStep: FlowStep) {
    tutorial.goToStep(nextStep);
    setTimeout(() => focusStep(nextStep), 60);
  }

  function goToPreviousTutorialStep() {
    tutorial.goToPreviousStep();
    const previousStep = flowSteps[tutorialStepIndex - 1]?.id;
    if (previousStep) setTimeout(() => focusStep(previousStep), 60);
  }

  function goToNextTutorialStep() {
    if (tutorialStepIndex < flowSteps.length - 1) {
      const nextStep = flowSteps[tutorialStepIndex + 1]?.id;
      tutorial.goToNextStep();
      if (nextStep) setTimeout(() => focusStep(nextStep), 60);
      return;
    }
    tutorial.goToNextStep();
  }

  function handleTutorialCta() {
    tutorial.close(false);
    if (currentTutorialState.ctaIntent === "simulate") {
      setTimeout(() => {
        void handleSimulate();
      }, 120);
      return;
    }
    goToStep(tutorialStep);
    setTimeout(() => focusStep(tutorialStep), 120);
  }

  return (
    <RequireCompany missingSelectionTitle="Seleziona una company per simulare la cap table" missingSelectionDescription="Apri una company attiva per lavorare su round, dilution, option pool e conversione SFP nello stesso flusso." missingSelectionCtaLabel="Scegli una company">
      <section className={styles.container}>
        {tutorial.clientReady ? (
          <TutorialModal
            isOpen={tutorialOpen}
            ariaLabel={capTableTutorialDefinition.ariaLabel}
            eyebrow={capTableTutorialDefinition.eyebrow}
            steps={flowSteps}
            currentStepId={tutorialStep}
            currentIndex={tutorialStepIndex}
            content={currentTutorial}
            states={tutorialStates}
            smartState={currentTutorialState}
            onClose={() => tutorial.close(false)}
            onSkip={() => tutorial.close(true)}
            onStepSelect={goToTutorialStep}
            onPrevious={goToPreviousTutorialStep}
            onNext={goToNextTutorialStep}
            onAction={handleTutorialCta}
          />
        ) : null}
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Cap Table Simulator</h1>
            <p className={styles.subtitle}>Simula round, dilution, option pool e conversione SFP per la company attiva.</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.primaryButton} onClick={handleCreateScenario} disabled={!companyId || saving}>Crea nuovo scenario</button>
            <button className={styles.secondaryButton} onClick={handleDuplicate} disabled={!selectedScenarioId || saving}>Duplica scenario</button>
            <button className={styles.secondaryButton} onClick={handleSetBaseline} disabled={!selectedScenarioId || saving}>Usa come baseline</button>
            <button className={styles.secondaryButton} onClick={handleSimulate} disabled={!selectedScenarioId || saving}>Aggiorna simulazione</button>
            <button className={styles.primaryButton} onClick={handleSave} disabled={!selectedScenarioId || saving}>Salva scenario</button>
          </div>
        </header>

        <div className={styles.statusBar}>
          <div className={styles.statusGroup}>
            <span className={styles.statusPill}>{participantCount} partecipanti</span>
            <span className={styles.statusPill}>{convertibleCount} convertibili</span>
            <span className={styles.statusPill}>{selectedScenarioId ? `Scenario attivo: ${scenarioName || "senza nome"}` : "Nessuno scenario selezionato"}</span>
          </div>
          <div className={styles.statusGroup}>
            <span className={`${styles.statusPill} ${hasUnsavedChanges ? styles.statusPillWarning : styles.statusPillSuccess}`}>{hasUnsavedChanges ? "Modifiche non salvate" : "Salvataggio allineato"}</span>
            <span className={`${styles.statusPill} ${isSimulationStale ? styles.statusPillWarning : styles.statusPillNeutral}`}>{isSimulationStale ? "Simulazione da aggiornare" : "Simulazione allineata"}</span>
            {loading || saving ? <span className={styles.statusPill}>Aggiornamento in corso...</span> : null}
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {setupWarning && <p className={styles.warning}>{setupWarning}</p>}

        <div className={styles.grid}>
          <aside className={styles.sidebar}>
            <h2 className={styles.sectionTitle}>Scenari</h2>
            {loading && scenarios.length === 0 ? <p className={styles.empty}>Caricamento...</p> : null}
            {scenarios.length === 0 ? <p className={styles.empty}>Nessuno scenario disponibile.</p> : null}
            <div className={styles.scenarioList}>
              {scenarios.map((scenario) => (
                <button key={scenario.id} type="button" className={`${styles.scenarioCard} ${selectedScenarioId === scenario.id ? styles.scenarioCardActive : ""}`} onClick={() => void loadScenarioDetail(scenario.id)}>
                  <span className={styles.scenarioHeader}>
                    <strong>{scenario.name}</strong>
                    {scenario.is_baseline ? <span className={styles.badge}>Baseline</span> : null}
                  </span>
                  <span className={styles.meta}>{scenario.version_count} versioni</span>
                  <span className={styles.meta}>{new Date(scenario.updated_at).toLocaleString("it-IT")}</span>
                </button>
              ))}
            </div>
            <div className={styles.versionPanel}>
              <h3 className={styles.subsectionTitle}>Versioni recenti</h3>
              {versions.length === 0 ? <p className={styles.empty}>Nessuna versione storica.</p> : null}
              {versions.map((version) => (
                <div key={version.id} className={styles.versionRow}>
                  <span>v{version.version_number}</span>
                  <span>{new Date(version.created_at).toLocaleString("it-IT")}</span>
                </div>
              ))}
            </div>
          </aside>

          <div className={styles.content}>
            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Scenario</h2>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Nome scenario</span>
                  <input value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Note</span>
                  <textarea value={scenarioNotes} onChange={(event) => setScenarioNotes(event.target.value)} rows={3} />
                </label>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.flowHeader}>
                <div>
                  <p className={styles.flowEyebrow}>Percorso guidato</p>
                  <h2 className={styles.flowTitle}>{currentStep.title}</h2>
                  <p className={styles.flowDescription}>{currentStep.description}</p>
                </div>
                <div className={styles.flowActions}>
                  <button type="button" className={styles.secondaryButton} onClick={reopenTutorial}>
                    Apri tutorial
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={goToPreviousStep} disabled={activeStepIndex === 0}>
                    Step precedente
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={goToNextStep} disabled={activeStepIndex === flowSteps.length - 1}>
                    Step successivo
                  </button>
                </div>
              </div>
              <div className={styles.stepper}>
                {flowSteps.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    className={`${styles.stepperItem} ${activeStep === step.id ? styles.stepperItemActive : ""}`}
                    onClick={() => goToStep(step.id)}
                  >
                    <span className={styles.stepperNumber}>{step.number}</span>
                    <span className={styles.stepperText}>
                      <strong>{step.label}</strong>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {activeStep === "capTable" ? (
            <section
              ref={(node) => { stepRefs.current.capTable = node; }}
              className={`${styles.card} ${tutorialOpen && tutorialStep === "capTable" ? styles.tutorialFocusCard : ""}`}
            >
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Cap table iniziale</h2>
                <button type="button" className={styles.secondaryButton} onClick={() => setDraftInput((current) => ({ ...current, participants: [...current.participants, createParticipant()] }))}>Aggiungi partecipante</button>
              </div>
              <p className={styles.helperText}>Cosa guardare: verifica chi e gia socio, in quale classe e con quale ammontare nominale prima del round.</p>
              {participantValidationMessages.length > 0 ? (
                <div className={styles.inlineWarning}>
                  {participantValidationMessages.map((message) => (
                    <p key={message} className={styles.inlineWarningText}>{message}</p>
                  ))}
                </div>
              ) : null}
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Nome</th><th>Tipo</th><th>Classe</th><th>Importo nominale</th><th /></tr>
                  </thead>
                  <tbody>
                    {draftInput.participants.map((participant, index) => (
                      <tr key={participant.id}>
                        <td><input placeholder="Es. Founder 01" value={participant.name} onChange={(event) => updateParticipant(index, { name: event.target.value })} /></td>
                        <td>
                          <select value={participant.type} onChange={(event) => updateParticipant(index, { type: event.target.value as CapTableParticipantInput["type"] })}>
                            <option value="founder">Founder</option>
                            <option value="shareholder">Shareholder</option>
                            <option value="investor">Investor</option>
                            <option value="pool">Pool</option>
                          </select>
                        </td>
                        <td><input placeholder="Es. A" value={participant.className} onChange={(event) => updateParticipant(index, { className: event.target.value })} /></td>
                        <td><input type="number" placeholder="Es. 1000" value={participant.amount} onChange={(event) => updateParticipant(index, { amount: Number(event.target.value) })} /></td>
                        <td><button type="button" className={styles.ghostButton} onClick={() => removeParticipant(index)}>Rimuovi</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.helperText}>Tipo ti aiuta a leggere il ruolo del soggetto nello scenario. L&apos;importo nominale e la base da cui parte la dilution.</p>
              <div className={styles.stepFooter}>
                <button type="button" className={styles.primaryButton} onClick={() => goToStep("convertibles")}>Vai al registro strumentisti</button>
              </div>
            </section>
            ) : null}

            {activeStep === "convertibles" ? (
            <section
              ref={(node) => { stepRefs.current.convertibles = node; }}
              className={`${styles.card} ${tutorialOpen && tutorialStep === "convertibles" ? styles.tutorialFocusCard : ""}`}
            >
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Registro strumentisti</h2>
                <button type="button" className={styles.secondaryButton} onClick={() => setDraftInput((current) => ({ ...current, convertibles: [...current.convertibles, createConvertible()] }))}>Aggiungi convertibile</button>
              </div>
              <p className={styles.helperText}>Cosa guardare: qui stai definendo il registro degli strumentisti. Se manca anche un sottoscrittore, la conversione finale non riflette il workbook.</p>
              {convertibleValidationMessages.length > 0 ? (
                <div className={styles.inlineWarning}>
                  {convertibleValidationMessages.map((message) => (
                    <p key={message} className={styles.inlineWarningText}>{message}</p>
                  ))}
                </div>
              ) : null}
              <div className={styles.summaryGrid}>
                <article className={styles.summaryCard}>
                  <p className={styles.summaryLabel}>Strumentisti</p>
                  <p className={styles.summaryValue}>{convertibleCount}</p>
                  <p className={styles.summaryText}>Numero totale di sottoscrittori convertibili registrati nello scenario.</p>
                </article>
                <article className={styles.summaryCard}>
                  <p className={styles.summaryLabel}>Raccolta SFP</p>
                  <p className={styles.summaryValue}>{eur(totalConvertibleAmount)}</p>
                  <p className={styles.summaryText}>Somma dei ticket presenti nel registro strumentisti.</p>
                </article>
                <article className={styles.summaryCard}>
                  <p className={styles.summaryLabel}>Ticket medio</p>
                  <p className={styles.summaryValue}>{eur(averageConvertibleTicket)}</p>
                  <p className={styles.summaryText}>Valore medio per strumentista, utile per verificare la coerenza del registro.</p>
                </article>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>#</th><th>Strumentista</th><th>Classe</th><th>Ticket EUR</th><th>Discount</th><th /></tr>
                  </thead>
                  <tbody>
                    {draftInput.convertibles.map((instrument, index) => (
                      <tr key={instrument.id}>
                        <td>{index + 1}</td>
                        <td><input placeholder="Es. Investor 01" value={instrument.name} onChange={(event) => updateConvertible(index, { name: event.target.value })} /></td>
                        <td><input placeholder="Es. B" value={instrument.className} onChange={(event) => updateConvertible(index, { className: event.target.value })} /></td>
                        <td><input type="number" placeholder="Es. 25000" value={instrument.amountEur} onChange={(event) => updateConvertible(index, { amountEur: Number(event.target.value) })} /></td>
                        <td><input type="number" step="0.01" min="0" max="1" placeholder="Es. 0.20" value={instrument.discount} onChange={(event) => updateConvertible(index, { discount: Number(event.target.value) })} /></td>
                        <td><button type="button" className={styles.ghostButton} onClick={() => removeConvertible(index)}>Rimuovi</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.helperText}>Il ticket e l&apos;importo investito nello strumento. Il discount e la condizione economica che puo spostare il caso A, B o C in conversione.</p>
              <div className={styles.stepFooter}>
                <button type="button" className={styles.secondaryButton} onClick={() => goToStep("capTable")}>Rivedi la cap table iniziale</button>
                <button type="button" className={styles.primaryButton} onClick={() => goToStep("round")}>Vai ai parametri round</button>
              </div>
            </section>
            ) : null}

            {activeStep === "round" ? (
            <section
              ref={(node) => { stepRefs.current.round = node; }}
              className={`${styles.card} ${tutorialOpen && tutorialStep === "round" ? styles.tutorialFocusCard : ""}`}
            >
              <h2 className={styles.sectionTitle}>Parametri round</h2>
              <p className={styles.helperText}>Cosa guardare: questo e il blocco che determina il prezzo economico di ingresso dei convertibili e la nuova dilution.</p>
              {roundValidationMessages.length > 0 ? (
                <div className={styles.inlineWarning}>
                  {roundValidationMessages.map((message) => (
                    <p key={message} className={styles.inlineWarningText}>{message}</p>
                  ))}
                </div>
              ) : null}
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Pre-money valuation</span>
                  <input type="number" placeholder="Es. 5000000" value={draftInput.round.preMoney} onChange={(event) => setDraftInput((current) => ({ ...current, round: { ...current.round, preMoney: Number(event.target.value) } }))} />
                  <small className={styles.fieldHint}>Valuation pre round usata come base economica dello scenario.</small>
                </label>
                <label className={styles.field}>
                  <span>Valutazione evento di conversione</span>
                  <input type="number" placeholder="Es. 2887500" value={draftInput.round.conversionValuation ?? 0} onChange={(event) => setDraftInput((current) => ({ ...current, round: { ...current.round, conversionValuation: Number(event.target.value) } }))} />
                  <small className={styles.fieldHint}>Valuation effettiva usata per determinare il caso finale A/B/C degli SFP. Se la lasci pari alla pre-money, il motore usa quel valore.</small>
                </label>
                <label className={styles.field}>
                  <span>Aumento di capitale</span>
                  <input type="number" placeholder="Es. 1000000" value={draftInput.round.raiseAmount} onChange={(event) => setDraftInput((current) => ({ ...current, round: { ...current.round, raiseAmount: Number(event.target.value) } }))} />
                  <small className={styles.fieldHint}>Nuova raccolta equity del round che diluisce la base iniziale.</small>
                </label>
                <label className={styles.field}>
                  <span>Floor</span>
                  <input type="number" placeholder="Es. 3000000" value={draftInput.round.floor} onChange={(event) => setDraftInput((current) => ({ ...current, round: { ...current.round, floor: Number(event.target.value) } }))} />
                  <small className={styles.fieldHint}>Soglia minima di conversione: se la valuation scontata scende sotto, prevale il caso A.</small>
                </label>
                <label className={styles.field}>
                  <span>Cap</span>
                  <input type="number" placeholder="Es. 7000000" value={draftInput.round.cap} onChange={(event) => setDraftInput((current) => ({ ...current, round: { ...current.round, cap: Number(event.target.value) } }))} />
                  <small className={styles.fieldHint}>Tetto massimo di conversione: se la valuation scontata lo supera, prevale il caso B.</small>
                </label>
                <label className={styles.field}>
                  <span>Discount default SFP</span>
                  <input type="number" step="0.01" min="0" max="1" placeholder="Es. 0.20" value={draftInput.round.defaultDiscount} onChange={(event) => setDraftInput((current) => ({ ...current, round: { ...current.round, defaultDiscount: Number(event.target.value) } }))} />
                  <small className={styles.fieldHint}>Espresso tra 0 e 1. Esempio: 0.20 corrisponde a uno sconto del 20%.</small>
                </label>
                <label className={styles.field}>
                  <span>Option pool top-up</span>
                  <input type="number" placeholder="Es. 50000" value={draftInput.round.optionPoolAmount} onChange={(event) => setDraftInput((current) => ({ ...current, round: { ...current.round, optionPoolAmount: Number(event.target.value) } }))} />
                  <small className={styles.fieldHint}>Quota nominale aggiunta al pool per simulare il top-up nello scenario.</small>
                </label>
                <label className={styles.field}>
                  <span>Timing option pool</span>
                  <select value={draftInput.round.optionPoolMode} onChange={(event) => setDraftInput((current) => ({ ...current, round: { ...current.round, optionPoolMode: event.target.value as CapTableScenarioInput["round"]["optionPoolMode"] } }))}>
                    <option value="pre_money">Pre-money</option>
                    <option value="post_money">Post-money</option>
                  </select>
                  <small className={styles.fieldHint}>Definisce se il top-up entra prima o dopo il round ai fini della dilution.</small>
                </label>
              </div>
              <div className={styles.stepFooter}>
                <button type="button" className={styles.secondaryButton} onClick={() => goToStep("convertibles")}>Rivedi il registro strumentisti</button>
                <button type="button" className={styles.primaryButton} onClick={handleSimulate} disabled={!selectedScenarioId || saving}>Calcola i risultati</button>
              </div>
            </section>
            ) : null}

            {activeStep === "results" ? (
            <section
              ref={(node) => { stepRefs.current.results = node; }}
              className={`${styles.card} ${tutorialOpen && tutorialStep === "results" ? styles.tutorialFocusCard : ""}`}
            >
              <h2 className={styles.sectionTitle}>Risultati</h2>
              {!result ? (
                <div className={styles.emptyState}>
                  <p className={styles.empty}>Per leggere l&apos;esito finale devi prima simulare il round.</p>
                  <div className={styles.stepFooter}>
                    <button type="button" className={styles.secondaryButton} onClick={() => goToStep("round")}>Torna al round</button>
                    <button type="button" className={styles.primaryButton} onClick={handleSimulate} disabled={!selectedScenarioId || saving}>Genera i risultati</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className={styles.helperText}>Cosa guardare: prima leggi i KPI sintetici, poi controlla quale caso A/B/C si applica e infine osserva la cap table finale.</p>
                  <div className={styles.summaryGrid}>
                    <article className={styles.summaryCard}>
                      <p className={styles.summaryLabel}>Chi entra</p>
                      <p className={styles.summaryValue}>
                        {enteringHolders.length > 0 ? enteringHolders.map((holder) => holder.name).slice(0, 3).join(", ") : "Nessun nuovo ingresso"}
                      </p>
                      <p className={styles.summaryText}>
                        {enteringHolders.length > 0
                          ? `${enteringHolders.length} soggetti convertono o entrano nel round.`
                          : "Il round non produce conversioni o nuovi ingressi rilevati."}
                      </p>
                    </article>
                    <article className={styles.summaryCard}>
                      <p className={styles.summaryLabel}>Chi si diluisce di piu</p>
                      <p className={styles.summaryValue}>
                        {mostDilutedHolder ? `${mostDilutedHolder.name} (${pct(mostDilutedHolder.dilutionPct)})` : "Nessuna dilution"}
                      </p>
                      <p className={styles.summaryText}>
                        {mostDilutedHolder
                          ? `Ownership post round: ${pct(mostDilutedHolder.postOwnershipPct)}.`
                          : "Non ci sono soggetti diluiti in questo scenario."}
                      </p>
                    </article>
                    <article className={styles.summaryCard}>
                      <p className={styles.summaryLabel}>Regola prevalente</p>
                      <p className={styles.summaryValue}>
                        {dominantCase ? `Caso ${dominantCase.id}` : "Nessun caso applicato"}
                      </p>
                      <p className={styles.summaryText}>
                        {dominantCase
                          ? `La conversione si appoggia principalmente a ${dominantCase.label}. Occorrenze: ${dominantCase.count}.`
                          : "Serve una simulazione valida per leggere quale regola prevale."}
                      </p>
                    </article>
                  </div>
                  <div className={styles.reasonGrid}>
                    {caseExplanations.map((item) => (
                      <article key={item.caseId} className={styles.reasonCard}>
                        <p className={styles.reasonLabel}>Perche si applica il caso {item.caseId}</p>
                        <p className={styles.reasonText}>{item.reason}</p>
                        <p className={styles.reasonMeta}>
                          Base di conversione: {eur(item.appliedConversionBase)}. Quota nominale totale: {nominal(item.conversionNominalTotal)}.
                        </p>
                      </article>
                    ))}
                  </div>
                  <div className={styles.resultsReadingGuide}>
                    <p className={styles.resultsReadingTitle}>Ordine consigliato di lettura</p>
                    <div className={styles.resultsReadingSteps}>
                      <span className={`${styles.readingStep} ${resultsTab === "overview" ? styles.readingStepActive : ""}`}>1. Overview: cosa succede nello scenario</span>
                      <span className={`${styles.readingStep} ${resultsTab === "strumentisti" ? styles.readingStepActive : ""}`}>2. Conversione strumentisti: chi converte e con quale esito</span>
                      <span className={`${styles.readingStep} ${resultsTab === "capTable" ? styles.readingStepActive : ""}`}>3. Cap table post: effetto finale sui soggetti</span>
                      <span className={`${styles.readingStep} ${resultsTab === "scenarios" ? styles.readingStepActive : ""}`}>4. Scenari A/B/C: dettaglio della regola applicata</span>
                    </div>
                  </div>
                  <div className={styles.resultsTabs} role="tablist" aria-label="Sezioni risultati">
                    <button type="button" className={`${styles.resultsTab} ${resultsTab === "overview" ? styles.resultsTabActive : ""}`} onClick={() => setResultsTab("overview")}>Overview consigliata</button>
                    <button type="button" className={`${styles.resultsTab} ${resultsTab === "strumentisti" ? styles.resultsTabActive : ""}`} onClick={() => setResultsTab("strumentisti")}>Conversione strumentisti</button>
                    <button type="button" className={`${styles.resultsTab} ${resultsTab === "capTable" ? styles.resultsTabActive : ""}`} onClick={() => setResultsTab("capTable")}>Cap table post</button>
                    <button type="button" className={`${styles.resultsTab} ${resultsTab === "scenarios" ? styles.resultsTabActive : ""}`} onClick={() => setResultsTab("scenarios")}>Scenari A/B/C</button>
                  </div>

                  <div className={styles.kpiRow}>
                    <article className={styles.kpiCard}><p className={styles.kpiLabel}>Pre-money</p><p className={styles.kpiValue}>{eur(result.summary.preMoney)}</p></article>
                    <article className={styles.kpiCard}><p className={styles.kpiLabel}>Post-money</p><p className={styles.kpiValue}>{eur(result.summary.postMoney)}</p></article>
                    <article className={styles.kpiCard}><p className={styles.kpiLabel}>Cap. nominale post</p><p className={styles.kpiValue}>{nominal(result.summary.postCapitalNominal)}</p></article>
                    <article className={styles.kpiCard}><p className={styles.kpiLabel}>Dilution founders/shareholders</p><p className={styles.kpiValue}>{pct(result.summary.totalDilutionPct)}</p></article>
                  </div>

                  <div className={styles.caseRow}>
                    <span className={styles.caseBadge}>Caso A: {result.caseSummary.caseA}</span>
                    <span className={styles.caseBadge}>Caso B: {result.caseSummary.caseB}</span>
                    <span className={styles.caseBadge}>Caso C: {result.caseSummary.caseC}</span>
                  </div>

                  <div className={styles.chartGrid}>
                    <article className={styles.chartCard}>
                      <div className={styles.chartHeader}>
                        <div>
                          <p className={styles.chartEyebrow}>Ownership</p>
                          <h3 className={styles.chartTitle}>Pre vs post round</h3>
                        </div>
                        <p className={styles.chartHint}>Leggi subito chi cresce, chi entra e chi si diluisce.</p>
                      </div>
                      <div className={styles.miniChartList}>
                        {ownershipChartData.map((item) => (
                          <div key={item.name} className={styles.miniChartRow}>
                            <div className={styles.miniChartTopline}>
                              <span className={styles.miniChartName}>{item.name}</span>
                              <span className={styles.miniChartMeta}>Pre {pct(item.preOwnershipPct / 100)} · Post {pct(item.postOwnershipPct / 100)}</span>
                            </div>
                            <div className={styles.dualBarGroup}>
                              <div className={styles.dualBarTrack}>
                                <div className={styles.dualBarPre} style={{ width: `${(item.preOwnershipPct / ownershipChartMax) * 100}%` }} />
                              </div>
                              <div className={styles.dualBarTrack}>
                                <div className={styles.dualBarPost} style={{ width: `${(item.postOwnershipPct / ownershipChartMax) * 100}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className={styles.chartLegend}>
                        <span className={styles.legendItem}>
                          <span className={styles.legendSwatch} style={{ backgroundColor: "#64748b" }} />
                          Pre round
                        </span>
                        <span className={styles.legendItem}>
                          <span className={styles.legendSwatch} style={{ backgroundColor: "#3b82f6" }} />
                          Post round
                        </span>
                      </div>
                    </article>

                    <article className={styles.chartCard}>
                      <div className={styles.chartHeader}>
                        <div>
                          <p className={styles.chartEyebrow}>Composizione</p>
                          <h3 className={styles.chartTitle}>Cap table post round</h3>
                        </div>
                        <p className={styles.chartHint}>Mostra il peso relativo dei soggetti principali dopo la conversione.</p>
                      </div>
                      <div className={styles.stackBar}>
                        {compositionChartData.map((entry, index) => (
                          <span
                            key={entry.name}
                            className={styles.stackBarSegment}
                            style={{
                              width: `${compositionChartTotal > 0 ? (entry.value / compositionChartTotal) * 100 : 0}%`,
                              backgroundColor: chartPalette[index % chartPalette.length],
                            }}
                          />
                        ))}
                      </div>
                      <div className={styles.chartLegend}>
                        {compositionChartData.map((entry, index) => (
                          <span key={entry.name} className={styles.legendItem}>
                            <span className={styles.legendSwatch} style={{ backgroundColor: chartPalette[index % chartPalette.length] }} />
                            {entry.name} ({pct(entry.value / 100)})
                          </span>
                        ))}
                      </div>
                    </article>

                    <article className={styles.chartCard}>
                      <div className={styles.chartHeader}>
                        <div>
                          <p className={styles.chartEyebrow}>Capitale</p>
                          <h3 className={styles.chartTitle}>Da dove nasce il post round</h3>
                        </div>
                        <p className={styles.chartHint}>Scompone il capitale nominale finale nelle sue componenti principali.</p>
                      </div>
                      <div className={styles.miniChartList}>
                        {capitalBridgeChartData.map((entry, index) => (
                          <div key={entry.name} className={styles.miniChartRow}>
                            <div className={styles.miniChartTopline}>
                              <span className={styles.miniChartName}>{entry.name}</span>
                              <span className={styles.miniChartMeta}>{nominal(entry.value)}</span>
                            </div>
                            <div className={styles.singleBarTrack}>
                              <div
                                className={styles.singleBarFill}
                                style={{
                                  width: `${(entry.value / capitalBridgeChartMax) * 100}%`,
                                  backgroundColor: chartPalette[index % chartPalette.length],
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>

                  {resultsTab === "overview" ? (
                    <>
                      <p className={styles.helperText}>Parti da qui: questa vista ti riassume il percorso del round prima di scendere nel dettaglio di strumentisti e cap table finale.</p>
                      <div className={styles.stepGrid}>
                        {result.steps.map((step) => (
                          <article key={step.id} className={styles.stepCard}>
                            <p className={styles.stepLabel}>{step.label}</p>
                            <p className={styles.stepValue}>Cap. nominale {nominal(step.capitalNominal)}</p>
                            <p className={styles.stepMeta}>Cash {eur(step.cashEur)}</p>
                            <p className={styles.stepMeta}>Sovrapprezzo {eur(step.premiumEur)}</p>
                          </article>
                        ))}
                      </div>
                    </>
                  ) : null}

                  {resultsTab === "strumentisti" ? (
                    <>
                      <p className={styles.helperText}>Secondo passaggio: usa questa tab per collegare il registro sottoscrittori alla conversione che ritroverai nella cap table finale.</p>
                      <div className={styles.summaryGrid}>
                        <article className={styles.summaryCard}>
                          <p className={styles.summaryLabel}>Strumentisti convertiti</p>
                          <p className={styles.summaryValue}>{strumentistiConversionSummary.count}</p>
                          <p className={styles.summaryText}>Numero di sottoscrittori presenti nel registro che entrano nella conversione finale.</p>
                        </article>
                        <article className={styles.summaryCard}>
                          <p className={styles.summaryLabel}>Nominale da conversione</p>
                          <p className={styles.summaryValue}>{nominal(strumentistiConversionSummary.totalNominal)}</p>
                          <p className={styles.summaryText}>Quota nominale complessiva generata dagli SFP nel post conversione.</p>
                        </article>
                        <article className={styles.summaryCard}>
                          <p className={styles.summaryLabel}>Sovrapprezzo totale</p>
                          <p className={styles.summaryValue}>{eur(strumentistiConversionSummary.totalPremium)}</p>
                          <p className={styles.summaryText}>Differenza aggregata tra ticket raccolti e nominale assegnato in conversione.</p>
                        </article>
                      </div>
                      <p className={styles.helperText}>
                        Questa vista collega direttamente il registro strumentisti all&apos;esito finale: per ogni sottoscrittore vedi ticket, regola applicata e quota che entra in cap table.
                      </p>
                      <div className={styles.summaryGrid}>
                        {topConvertedStrumentisti.map((row, index) => (
                          <article key={row.id} className={styles.summaryCard}>
                            <p className={styles.summaryLabel}>Strumentista rilevante #{index + 1}</p>
                            <p className={styles.summaryValue}>{row.name}</p>
                            <p className={styles.summaryText}>
                              Ownership post: {pct(row.postOwnershipPct)}. Ritrovalo anche nella tab <strong>Cap table post</strong> come ingresso da registro.
                            </p>
                          </article>
                        ))}
                      </div>
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead>
                            <tr><th>#</th><th>Strumentista</th><th>Classe</th><th>Ticket EUR</th><th>Discount</th><th>Caso</th><th>Quota nominale</th><th>Sovrapprezzo EUR</th><th>Ownership post</th></tr>
                          </thead>
                          <tbody>
                            {strumentistiConversionRows.map((row) => (
                              <tr key={row.id}>
                                <td>{row.index}</td>
                                <td>{row.name}</td>
                                <td>{row.className}</td>
                                <td>{eur(row.amountEur)}</td>
                                <td>{pct(row.discount)}</td>
                                <td>{row.scenarioCase ?? "-"}</td>
                                <td>{nominal(row.conversionNominalAmount)}</td>
                                <td>{eur(row.premiumAmountEur)}</td>
                                <td>{pct(row.postOwnershipPct)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead>
                            <tr><th>Strumentista</th><th>Scenario</th><th>Valuation scontata</th><th>Base conversione</th><th>Quota nominale</th><th>Sovrapprezzo EUR</th><th>Ownership post</th></tr>
                          </thead>
                          <tbody>
                            {result.convertibleDetails.flatMap((detail) =>
                              detail.scenarios.map((scenario) => (
                                <tr key={`${detail.id}-${scenario.caseId}`}>
                                  <td>
                                    <div className={styles.nameCell}>
                                      <span>{detail.name}</span>
                                      {detail.finalCase === scenario.caseId ? <span className={styles.inlineBadgeInfo}>Caso finale</span> : null}
                                    </div>
                                  </td>
                                  <td>{scenario.caseId}</td>
                                  <td>{eur(scenario.discountedValuation)}</td>
                                  <td>{eur(scenario.appliedConversionBase)}</td>
                                  <td>{nominal(scenario.conversionNominalAmount)}</td>
                                  <td>{eur(scenario.premiumAmountEur)}</td>
                                  <td>{pct(scenario.postOwnershipPct)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : null}

                  {resultsTab === "scenarios" ? (
                    <>
                      <p className={styles.helperText}>Usa questa tab come approfondimento finale: qui capisci perche il motore ha applicato A, B o C e con quali basi di conversione.</p>
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead>
                            <tr><th>Scenario</th><th>Valuation</th><th>Valuation scontata</th><th>Base conversione</th><th>Quota nominale ticket</th><th>Quota nominale totale</th><th>Sovrapprezzo ticket</th><th>Cap. nominale post</th></tr>
                          </thead>
                          <tbody>
                            {result.scenarioPreviews.map((preview) => (
                              <tr key={preview.caseId}>
                                <td>{preview.caseId} - {preview.label}</td>
                                <td>{eur(preview.valuation)}</td>
                                <td>{eur(preview.discountedValuation)}</td>
                                <td>{eur(preview.appliedConversionBase)}</td>
                                <td>{nominal(preview.conversionNominalPerTicket)}</td>
                                <td>{nominal(preview.conversionNominalTotal)}</td>
                                <td>{eur(preview.premiumPerTicketEur)}</td>
                                <td>{nominal(preview.postCapitalNominal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className={styles.summaryGrid}>
                        {result.scenarioPreviews.map((preview) => (
                          <article key={`${preview.caseId}-summary`} className={styles.summaryCard}>
                            <p className={styles.summaryLabel}>Cap table scenario {preview.caseId}</p>
                            <p className={styles.summaryValue}>{nominal(preview.postCapitalNominal)}</p>
                            <p className={styles.summaryText}>Capitale nominale post nel caso {preview.caseId}. Utile per confrontare direttamente i tre scenari del workbook.</p>
                          </article>
                        ))}
                      </div>
                      {result.scenarioPreviews.map((preview) => (
                        <div key={`${preview.caseId}-table`} className={styles.scenarioBlock}>
                          <p className={styles.helperText}>Scenario {preview.caseId}: cap table sintetica pre/post conversione.</p>
                          <div className={styles.tableWrap}>
                            <table className={styles.table}>
                              <thead>
                                <tr><th>Soggetto</th><th>Pre nominale</th><th>Post nominale</th><th>Ownership post</th></tr>
                              </thead>
                              <tbody>
                                {preview.participants.map((participant) => (
                                  <tr key={`${preview.caseId}-${participant.id}`}>
                                    <td>{participant.name}</td>
                                    <td>{nominal(participant.preNominalAmount)}</td>
                                    <td>{nominal(participant.postNominalAmount)}</td>
                                    <td>{pct(participant.postOwnershipPct)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : null}

                  {resultsTab === "capTable" ? (
                    <>
                      <p className={styles.helperText}>Terzo passaggio: qui chiudi la lettura dello scenario e vedi l&apos;effetto finale su ownership, dilution e nuovi ingressi.</p>
                      <div className={styles.summaryGrid}>
                        {topOwners.map((owner, index) => (
                          <article key={owner.id} className={styles.summaryCard}>
                            <p className={styles.summaryLabel}>Top owner #{index + 1}</p>
                            <p className={styles.summaryValue}>{owner.name}</p>
                            <p className={styles.summaryText}>
                              Ownership post: {pct(owner.postOwnershipPct)}. Nominale post: {nominal(owner.postNominalAmount)}.
                            </p>
                          </article>
                        ))}
                      </div>
                      <p className={styles.helperText}>
                        La tabella e ordinata per nominale post conversione. Le righe evidenziate ti aiutano a distinguere nuovi ingressi, soggetti piu diluiti e nomi che arrivano dal registro strumentisti.
                      </p>
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr><th>Soggetto</th><th>Tipo</th><th>Classe</th><th>Cash EUR</th><th>Pre nominale</th><th>Post nominale</th><th>Ownership post</th><th>Dilution</th><th>Premio EUR</th><th>Scenario</th></tr>
                        </thead>
                        <tbody>
                          {sortedOutcomes.map((outcome) => (
                            <tr
                              key={outcome.id}
                              className={
                                outcome.type === "sfp" || outcome.conversionNominalAmount > 0
                                  ? styles.tableRowEntering
                                  : outcome.dilutionPct > 0
                                    ? styles.tableRowDiluted
                                    : ""
                              }
                            >
                              <td>
                                <div className={styles.nameCell}>
                                  <span>{outcome.name}</span>
                                  {outcome.type === "sfp" || outcome.conversionNominalAmount > 0 ? (
                                    <span className={styles.inlineBadge}>Nuovo ingresso</span>
                                  ) : null}
                                  {convertedStrumentistaIds.has(outcome.id) ? (
                                    <span className={styles.inlineBadgeInfo}>Da registro</span>
                                  ) : null}
                                  {mostDilutedHolder?.id === outcome.id ? (
                                    <span className={styles.inlineBadgeWarning}>Dilution maggiore</span>
                                  ) : null}
                                </div>
                              </td>
                              <td>{outcome.type}</td>
                              <td>{outcome.className}</td>
                              <td>{eur(outcome.cashAmountEur)}</td>
                              <td>{nominal(outcome.preNominalAmount)}</td>
                              <td>{nominal(outcome.postNominalAmount)}</td>
                              <td>{pct(outcome.postOwnershipPct)}</td>
                              <td>{pct(outcome.dilutionPct)}</td>
                              <td>{eur(outcome.premiumAmountEur)}</td>
                              <td>{outcome.scenarioCase ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    </>
                  ) : null}
                </>
              )}
            </section>
            ) : null}
          </div>
        </div>
      </section>
    </RequireCompany>
  );
}
