import { NextRequest, NextResponse } from "next/server";
import { requireCapTableScenarioAccess } from "@/lib/capTable/access";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function isMissingCapTableTable(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  const message = String(error.message ?? "").toLowerCase();
  return message.includes("fundops_cap_table_scenarios") || message.includes("fundops_cap_table_scenario_versions");
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  const { scenarioId } = await params;

  const access = await requireCapTableScenarioAccess(scenarioId);
  if (!access.ok) return json(access.status, access.body);

  const { data: existing, error } = await access.admin
    .from("fundops_cap_table_scenarios")
    .select("*")
    .eq("id", scenarioId)
    .maybeSingle();

  if (error) {
    if (isMissingCapTableTable(error)) {
      return json(503, {
        error: "Cap table setup missing. Run migration: migrations/create_fundops_cap_table_scenarios.sql",
        code: error.code ?? "42P01",
      });
    }
    return json(500, { error: error.message, code: error.code ?? null });
  }
  if (!existing) return json(404, { error: "Scenario not found" });

  const { data: duplicate, error: duplicateError } = await access.admin
    .from("fundops_cap_table_scenarios")
    .insert({
      company_id: existing.company_id,
      round_id: existing.round_id,
      name: `${existing.name} (copy)`,
      notes: existing.notes,
      is_baseline: false,
      version_count: 1,
      draft_input: existing.draft_input,
      latest_result: existing.latest_result,
      latest_result_summary: existing.latest_result_summary,
      created_by: access.userId,
      updated_by: access.userId,
    })
    .select(
      "id,company_id,round_id,name,notes,is_baseline,version_count,draft_input,latest_result,latest_result_summary,created_at,updated_at"
    )
    .maybeSingle();

  if (duplicateError || !duplicate) {
    if (isMissingCapTableTable(duplicateError ?? null)) {
      return json(503, {
        error: "Cap table setup missing. Run migration: migrations/create_fundops_cap_table_scenarios.sql",
        code: duplicateError?.code ?? "42P01",
      });
    }
    return json(500, { error: duplicateError?.message ?? "Failed to duplicate scenario" });
  }

  const { error: versionError } = await access.admin.from("fundops_cap_table_scenario_versions").insert({
    scenario_id: duplicate.id,
    version_number: 1,
    input_snapshot: existing.draft_input,
    result_snapshot: existing.latest_result,
    summary_snapshot: existing.latest_result_summary,
    created_by: access.userId,
  });

  if (versionError) {
    if (isMissingCapTableTable(versionError)) {
      return json(503, {
        error: "Cap table setup missing. Run migration: migrations/create_fundops_cap_table_scenarios.sql",
        code: versionError.code ?? "42P01",
      });
    }
    return json(500, { error: versionError.message, code: versionError.code ?? null });
  }

  return json(201, { scenario: duplicate });
}
