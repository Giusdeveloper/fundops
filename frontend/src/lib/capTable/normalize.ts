import { simulateCapTable } from "@/lib/capTable/simulate";
import type { CapTableScenarioInput, SimulationResult } from "@/types/capTable";

function hasModernSimulationShape(value: unknown): value is SimulationResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SimulationResult>;
  return Array.isArray(candidate.participants) &&
    Array.isArray(candidate.steps) &&
    Array.isArray(candidate.scenarioPreviews) &&
    candidate.summary != null;
}

export function normalizeSimulationResult(
  result: unknown,
  draftInput: CapTableScenarioInput | null | undefined
): SimulationResult | null {
  if (hasModernSimulationShape(result)) {
    return result;
  }
  if (!draftInput) {
    return null;
  }
  return simulateCapTable(draftInput);
}
