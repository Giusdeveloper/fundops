import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/adminAuth";
import { backfillCapTableScenarios } from "@/lib/capTable/backfill";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdminForApi();
  if (!ctx) {
    return json(403, { error: "Forbidden" });
  }

  const companyId = request.nextUrl.searchParams.get("companyId")?.trim() || undefined;
  const result = await backfillCapTableScenarios(ctx.supabase as never, companyId);

  return json(200, {
    ok: true,
    companyId: companyId ?? null,
    scannedCount: result.scannedCount,
    repairedCount: result.repairedCount,
  });
}
