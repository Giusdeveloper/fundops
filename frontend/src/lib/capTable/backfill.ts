import { normalizeSimulationResult } from "@/lib/capTable/normalize";
import type { CapTableScenarioInput } from "@/types/capTable";

interface ScenarioRow {
  id: string;
  draft_input: CapTableScenarioInput;
  latest_result: unknown;
}

export async function backfillCapTableScenarios(
  supabase: {
    from: (table: string) => any;
  },
  companyId?: string
) {
  let query = supabase
    .from("fundops_cap_table_scenarios")
    .select("id,draft_input,latest_result")
    .order("updated_at", { ascending: false });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message ?? "Failed to load cap table scenarios for backfill");
  }

  const rows = ((data ?? []) as ScenarioRow[]);
  let repairedCount = 0;

  for (const row of rows) {
    const normalized = normalizeSimulationResult(row.latest_result, row.draft_input);
    if (!normalized) continue;

    const alreadyModern =
      row.latest_result &&
      typeof row.latest_result === "object" &&
      Array.isArray((row.latest_result as { steps?: unknown[] }).steps) &&
      Array.isArray((row.latest_result as { scenarioPreviews?: unknown[] }).scenarioPreviews);

    if (alreadyModern) continue;

    const { error } = await supabase
      .from("fundops_cap_table_scenarios")
      .update({
        latest_result: normalized,
        latest_result_summary: normalized.summary,
      })
      .eq("id", row.id);

    if (!error) {
      repairedCount += 1;
    }
  }

  return { repairedCount, scannedCount: rows.length };
}
