import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminProfile {
  id: string;
  email: string | null;
}

export async function writeAdminAudit(
  supabase: SupabaseClient,
  params: {
    actorUserId: string;
    actorEmail: string | null;
    targetUserId?: string;
    action: string;
    entity: string;
    entityId?: string;
    beforeData?: unknown;
    afterData?: unknown;
  }
) {
  await supabase.from("fundops_admin_audit").insert({
    admin_id: params.actorUserId,
    admin_email: params.actorEmail,
    target_user_id: params.targetUserId,
    target_id: params.entityId ?? params.targetUserId,
    target_type: params.entity,
    entity: params.entity,
    entity_id: params.entityId,
    before_state: params.beforeData,
    after_state: params.afterData,
    action: params.action,
  });
}
