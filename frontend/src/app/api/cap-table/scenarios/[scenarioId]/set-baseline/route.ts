import { NextRequest, NextResponse } from "next/server";
import { requireCapTableScenarioAccess } from "@/lib/capTable/access";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function isMissingCapTableTable(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  const message = String(error.message ?? "").toLowerCase();
  return message.includes("fundops_cap_table_scenarios");
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  const { scenarioId } = await params;

  const access = await requireCapTableScenarioAccess(scenarioId);
  if (!access.ok) return json(access.status, access.body);

  let resetQuery = access.admin
    .from("fundops_cap_table_scenarios")
    .update({ is_baseline: false, updated_by: access.userId })
    .eq("company_id", access.scenario.company_id);
  resetQuery =
    access.scenario.round_id == null
      ? resetQuery.is("round_id", null)
      : resetQuery.eq("round_id", access.scenario.round_id);
  await resetQuery;

  const { data: updated, error: updateError } = await access.admin
    .from("fundops_cap_table_scenarios")
    .update({ is_baseline: true, updated_by: access.userId })
    .eq("id", scenarioId)
    .select("id,is_baseline")
    .maybeSingle();

  if (updateError || !updated) {
    if (isMissingCapTableTable(updateError ?? null)) {
      return json(503, {
        error: "Cap table setup missing. Run migration: migrations/create_fundops_cap_table_scenarios.sql",
        code: updateError?.code ?? "42P01",
      });
    }
    return json(500, { error: updateError?.message ?? "Failed to set baseline" });
  }

  return json(200, { scenario: updated });
}
