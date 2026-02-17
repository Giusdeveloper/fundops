import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/adminAuth";
import { writeAdminAudit } from "@/lib/adminAudit";

function errResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const ctx = await requireAdminForApi();
  if (!ctx) return errResponse("Forbidden", 403);

  const { supabase, admin } = ctx;
  const { accountId } = await params;

  const body = await request.json();
  const { is_active, disabled_reason } = body;

  const updates: Record<string, unknown> = {};
  if (typeof is_active === "boolean") updates.is_active = is_active;
  if (disabled_reason !== undefined) updates.disabled_reason = disabled_reason;

  if (typeof is_active === "boolean") {
    if (is_active) {
      updates.disabled_at = null;
      updates.disabled_reason = null;
    } else {
      updates.disabled_at = new Date().toISOString();
    }
  }

  if (Object.keys(updates).length === 0) {
    return errResponse("Nessun campo da aggiornare", 400);
  }

  updates.updated_at = new Date().toISOString();

  const { data: beforeRow } = await supabase
    .from("fundops_investor_accounts")
    .select("id, investor_id, company_id, is_active, disabled_reason, disabled_at")
    .eq("id", accountId)
    .single();

  if (!beforeRow) return errResponse("Account non trovato", 404);

  const { data: iu } = await supabase
    .from("fundops_investor_users")
    .select("user_id")
    .eq("investor_id", beforeRow.investor_id)
    .single();

  const targetUserId = (iu?.user_id as string) ?? undefined;

  const { data: afterRow, error } = await supabase
    .from("fundops_investor_accounts")
    .update(updates)
    .eq("id", accountId)
    .select()
    .single();

  if (error) return errResponse(error.message, 500);

  await writeAdminAudit(supabase, {
    actorUserId: admin.id,
    actorEmail: admin.email,
    targetUserId,
    action: "investor_account_toggle",
    entity: "investor_account",
    entityId: accountId,
    beforeData: beforeRow,
    afterData: afterRow,
  });

  return Response.json(afterRow);
}
