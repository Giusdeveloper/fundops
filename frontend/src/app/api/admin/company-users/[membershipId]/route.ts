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
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const ctx = await requireAdminForApi();
  if (!ctx) return errResponse("Forbidden", 403);

  const { supabase, admin } = ctx;
  const { membershipId } = await params;

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
    .from("fundops_company_users")
    .select("id, user_id, company_id, is_active, disabled_reason, disabled_at")
    .eq("id", membershipId)
    .single();

  if (!beforeRow) return errResponse("Membership non trovata", 404);

  const { data: afterRow, error } = await supabase
    .from("fundops_company_users")
    .update(updates)
    .eq("id", membershipId)
    .select()
    .single();

  if (error) return errResponse(error.message, 500);

  await writeAdminAudit(supabase, {
    actorUserId: admin.id,
    actorEmail: admin.email,
    targetUserId: beforeRow.user_id as string,
    action: "seat_toggle",
    entity: "seat",
    entityId: membershipId,
    beforeData: beforeRow,
    afterData: afterRow,
  });

  return Response.json(afterRow);
}
