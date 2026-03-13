import { NextRequest, NextResponse } from "next/server";
import { requireCapTableScenarioAccess } from "@/lib/capTable/access";
import { simulateCapTable } from "@/lib/capTable/simulate";
import type { CapTableScenarioInput } from "@/types/capTable";

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
  request: NextRequest,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  const { scenarioId } = await params;
  const body = (await request.json().catch(() => null)) as { draftInput?: CapTableScenarioInput } | null;

  const access = await requireCapTableScenarioAccess(scenarioId);
  if (!access.ok) return json(access.status, access.body);

  const { data: existing, error } = await access.admin
    .from("fundops_cap_table_scenarios")
    .select("id,company_id,draft_input")
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

  const draftInput = body?.draftInput ?? (existing.draft_input as CapTableScenarioInput);
  return json(200, { result: simulateCapTable(draftInput) });
}
