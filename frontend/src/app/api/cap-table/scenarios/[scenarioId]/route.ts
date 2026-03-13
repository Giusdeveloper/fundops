import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireCapTableScenarioAccess } from "@/lib/capTable/access";
import { normalizeSimulationResult } from "@/lib/capTable/normalize";
import { simulateCapTable } from "@/lib/capTable/simulate";
import type { CapTableScenarioInput } from "@/types/capTable";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function isMissingCapTableTable(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  const message = String(error.message ?? "").toLowerCase();
  return message.includes("fundops_cap_table_scenarios") || message.includes("fundops_cap_table_scenario_versions");
}

async function getScenario(accessAdmin: ReturnType<typeof createSupabaseAdmin>, scenarioId: string) {
  return accessAdmin
    .from("fundops_cap_table_scenarios")
    .select(
      "id,company_id,round_id,name,notes,is_baseline,version_count,draft_input,latest_result,latest_result_summary,created_at,updated_at"
    )
    .eq("id", scenarioId)
    .maybeSingle();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  const { scenarioId } = await params;
  const access = await requireCapTableScenarioAccess(scenarioId);
  if (!access.ok) return json(access.status, access.body);

  const { data: scenario, error } = await getScenario(access.admin, scenarioId);
  if (error) {
    if (isMissingCapTableTable(error)) {
      return json(503, {
        error: "Cap table setup missing. Run migration: migrations/create_fundops_cap_table_scenarios.sql",
        code: error.code ?? "42P01",
      });
    }
    return json(500, { error: error.message, code: error.code ?? null });
  }
  if (!scenario) return json(404, { error: "Scenario not found" });

  const { data: versions, error: versionsError } = await access.admin
    .from("fundops_cap_table_scenario_versions")
    .select("id,version_number,summary_snapshot,created_at")
    .eq("scenario_id", scenarioId)
    .order("version_number", { ascending: false })
    .limit(10);

  if (versionsError) {
    if (isMissingCapTableTable(versionsError)) {
      return json(503, {
        error: "Cap table setup missing. Run migration: migrations/create_fundops_cap_table_scenarios.sql",
        code: versionsError.code ?? "42P01",
      });
    }
    return json(500, { error: versionsError.message, code: versionsError.code ?? null });
  }

  return json(200, {
    scenario: {
      ...scenario,
      latest_result: normalizeSimulationResult(
        scenario.latest_result,
        scenario.draft_input as CapTableScenarioInput
      ),
    },
    versions: versions ?? [],
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  const { scenarioId } = await params;
  const body = (await request.json().catch(() => null)) as
    | { name?: string; notes?: string | null; draftInput?: CapTableScenarioInput; persistVersion?: boolean }
    | null;

  const access = await requireCapTableScenarioAccess(scenarioId);
  if (!access.ok) return json(access.status, access.body);

  const { data: existing, error: existingError } = await getScenario(access.admin, scenarioId);
  if (existingError) {
    if (isMissingCapTableTable(existingError)) {
      return json(503, {
        error: "Cap table setup missing. Run migration: migrations/create_fundops_cap_table_scenarios.sql",
        code: existingError.code ?? "42P01",
      });
    }
    return json(500, { error: existingError.message, code: existingError.code ?? null });
  }
  if (!existing) return json(404, { error: "Scenario not found" });

  const draftInput = body?.draftInput ?? (existing.draft_input as CapTableScenarioInput);
  const result = simulateCapTable(draftInput);
  const nextVersionCount = body?.persistVersion === false ? existing.version_count : existing.version_count + 1;

  const { data: updated, error: updateError } = await access.admin
    .from("fundops_cap_table_scenarios")
    .update({
      name: body?.name?.trim() || existing.name,
      notes: typeof body?.notes === "string" ? body.notes.trim() || null : existing.notes,
      draft_input: draftInput,
      latest_result: result,
      latest_result_summary: result.summary,
      version_count: nextVersionCount,
      updated_by: access.userId,
    })
    .eq("id", scenarioId)
    .select(
      "id,company_id,round_id,name,notes,is_baseline,version_count,draft_input,latest_result,latest_result_summary,created_at,updated_at"
    )
    .maybeSingle();

  if (updateError || !updated) {
    if (isMissingCapTableTable(updateError ?? null)) {
      return json(503, {
        error: "Cap table setup missing. Run migration: migrations/create_fundops_cap_table_scenarios.sql",
        code: updateError?.code ?? "42P01",
      });
    }
    return json(500, { error: updateError?.message ?? "Failed to update scenario" });
  }

  if (body?.persistVersion !== false) {
    const { error: versionError } = await access.admin.from("fundops_cap_table_scenario_versions").insert({
      scenario_id: scenarioId,
      version_number: nextVersionCount,
      input_snapshot: draftInput,
      result_snapshot: result,
      summary_snapshot: result.summary,
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
  }

  return json(200, { scenario: updated });
}
