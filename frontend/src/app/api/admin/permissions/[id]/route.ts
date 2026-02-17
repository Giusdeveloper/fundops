import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/adminAuth";
import { writeAdminAudit } from "@/lib/adminAudit";

const FLAG_KEYS = [
  "allow_dashboard",
  "allow_companies",
  "allow_investors",
  "allow_lois",
  "allow_issuance",
  "allow_onboarding",
  "allow_invites",
  "allow_broadcast",
  "allow_admin_panel",
] as const;

function errResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdminForApi();
  if (!ctx) return errResponse("Forbidden", 403);

  const { supabase, admin } = ctx;
  const { id: userId } = await params;

  const body = await request.json();

  const { data: beforeRow } = await supabase
    .from("fundops_user_permissions")
    .select("*")
    .eq("user_id", userId)
    .single();

  const merged: Record<string, unknown> = {
    user_id: userId,
    updated_by: admin.id,
    updated_at: new Date().toISOString(),
  };

  for (const key of FLAG_KEYS) {
    if (body[key] !== undefined) {
      const v = body[key];
      merged[key] = v === null || v === "inherit" ? null : v === true;
    } else if (beforeRow && key in beforeRow) {
      merged[key] = beforeRow[key];
    }
  }

  const { data: afterRow, error } = await supabase
    .from("fundops_user_permissions")
    .upsert(merged, { onConflict: "user_id" })
    .select()
    .single();

  if (error) return errResponse(error.message, 500);

  await writeAdminAudit(supabase, {
    actorUserId: admin.id,
    actorEmail: admin.email,
    targetUserId: userId,
    action: "permissions_update",
    entity: "permissions",
    entityId: afterRow?.id ?? userId,
    beforeData: beforeRow,
    afterData: afterRow,
  });

  return Response.json(afterRow);
}
