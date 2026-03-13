import { NextRequest, NextResponse } from "next/server";
import { backfillCapTableScenarios } from "@/lib/capTable/backfill";
import { requireCapTableAccess } from "@/lib/capTable/access";
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

function getDefaultInput(): CapTableScenarioInput {
  return {
    participants: [
      { id: crypto.randomUUID(), name: "Founder 1", type: "founder", className: "A", amount: 9900 },
      { id: crypto.randomUUID(), name: "Founder 2", type: "founder", className: "A", amount: 100 },
    ],
    convertibles: [
      {
        id: crypto.randomUUID(),
        name: "SFP Investors",
        instrumentType: "sfp",
        className: "B",
        amountEur: 150000,
        discount: 0.2,
      },
    ],
    round: {
      preMoney: 2887500,
      raiseAmount: 150000,
      floor: 1500000,
      cap: 3000000,
      defaultDiscount: 0.2,
      optionPoolAmount: 0,
      optionPoolMode: "pre_money",
    },
  };
}

export async function GET(request: NextRequest) {
  const companyId = new URL(request.url).searchParams.get("companyId")?.trim();
  if (!companyId) return json(400, { error: "Missing companyId" });

  const access = await requireCapTableAccess(companyId);
  if (!access.ok) return json(access.status, access.body);

  await backfillCapTableScenarios(access.admin as never, companyId);

  const { data, error } = await access.admin
    .from("fundops_cap_table_scenarios")
    .select(
      "id,company_id,round_id,name,notes,is_baseline,version_count,draft_input,latest_result,latest_result_summary,created_at,updated_at"
    )
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingCapTableTable(error)) {
      return json(200, {
        scenarios: [],
        setupRequired: true,
        warning: "Cap table setup missing. Run migration: migrations/create_fundops_cap_table_scenarios.sql",
      });
    }
    return json(500, { error: error.message, code: error.code ?? null });
  }

  return json(200, {
    scenarios: (data ?? []).map((scenario) => ({
      ...scenario,
      latest_result: normalizeSimulationResult(
        scenario.latest_result,
        scenario.draft_input as CapTableScenarioInput
      ),
    })),
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { companyId?: string; roundId?: string | null; name?: string; notes?: string | null; draftInput?: CapTableScenarioInput }
    | null;

  const companyId = body?.companyId?.trim();
  if (!companyId) return json(400, { error: "Missing companyId" });

  const access = await requireCapTableAccess(companyId);
  if (!access.ok) return json(access.status, access.body);

  let draftInput = body?.draftInput ?? getDefaultInput();
  let defaultName = body?.name?.trim() || "Nuovo scenario cap table";
  let resolvedRoundId = body?.roundId?.trim() || null;

  if (!body?.draftInput || resolvedRoundId) {
    const roundBaseSelect = "id,name,created_at";
    const buildRoundQuery = (selectClause: string) => {
      let query = access.admin
        .from("fundops_rounds")
        .select(selectClause)
        .eq("company_id", companyId);
      query = resolvedRoundId
        ? query.eq("id", resolvedRoundId)
        : query.order("created_at", { ascending: false }).limit(1);
      return query.maybeSingle();
    };

    const withTarget = await buildRoundQuery(`${roundBaseSelect},target_amount`);

    const roundResult =
      withTarget.error &&
      ((withTarget.error.code === "42703") ||
        String(withTarget.error.message ?? "").toLowerCase().includes("target_amount"))
        ? await buildRoundQuery(roundBaseSelect)
        : withTarget;

    const roundData = roundResult.data as { id?: string; name?: string | null; target_amount?: number | null } | null;
    if (roundData) {
      resolvedRoundId = roundData.id?.trim() || resolvedRoundId;
      draftInput = {
        ...draftInput,
        round: {
          ...draftInput.round,
          raiseAmount:
            roundData.target_amount != null && Number.isFinite(Number(roundData.target_amount))
              ? Number(roundData.target_amount)
              : draftInput.round.raiseAmount,
        },
      };
      defaultName = roundData.name?.trim()
        ? `Scenario ${roundData.name.trim()}`
        : defaultName;
    }
  }

  const result = simulateCapTable(draftInput);

  const insertPayload = {
    company_id: companyId,
    round_id: resolvedRoundId,
    name: defaultName,
    notes: body?.notes?.trim() || null,
    draft_input: draftInput,
    latest_result: result,
    latest_result_summary: result.summary,
    created_by: access.userId,
    updated_by: access.userId,
    version_count: 1,
  };

  const { data: scenario, error: scenarioError } = await access.admin
    .from("fundops_cap_table_scenarios")
    .insert(insertPayload)
    .select(
      "id,company_id,round_id,name,notes,is_baseline,version_count,draft_input,latest_result,latest_result_summary,created_at,updated_at"
    )
    .maybeSingle();

  if (scenarioError || !scenario) {
    if (isMissingCapTableTable(scenarioError ?? null)) {
      return json(503, {
        error: "Cap table setup missing. Run migration: migrations/create_fundops_cap_table_scenarios.sql",
        code: scenarioError?.code ?? "42P01",
      });
    }
    return json(500, { error: scenarioError?.message ?? "Failed to create scenario" });
  }

  const { error: versionError } = await access.admin.from("fundops_cap_table_scenario_versions").insert({
    scenario_id: scenario.id,
    version_number: 1,
    input_snapshot: draftInput,
    result_snapshot: result,
    summary_snapshot: result.summary,
    created_by: access.userId,
  });

  if (versionError) {
    if (isMissingCapTableTable(versionError)) {
      return json(503, {
        error: "Cap table versioning setup missing. Run migration: migrations/create_fundops_cap_table_scenarios.sql",
        code: versionError.code ?? "42P01",
      });
    }
    return json(500, { error: versionError.message, code: versionError.code ?? null });
  }

  return json(201, { scenario });
}
