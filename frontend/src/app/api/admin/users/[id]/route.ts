import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/adminAuth";
import { writeAdminAudit } from "@/lib/adminAudit";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errResponse(message: string, status: number) {
  return jsonResponse({ error: message }, status);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdminForApi();
  if (!ctx) return errResponse("Forbidden", 403);

  const { supabase } = ctx;
  const { id } = await params;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, role_global, is_active, disabled_reason, disabled_at")
    .eq("id", id)
    .single();

  if (profileErr || !profile) {
    return errResponse("Utente non trovato", 404);
  }

  const { data: permissions } = await supabase
    .from("fundops_user_permissions")
    .select("*")
    .eq("user_id", id)
    .single();

  const { data: seatsRows } = await supabase
    .from("fundops_company_users")
    .select("id, company_id, is_active, disabled_reason, disabled_at")
    .eq("user_id", id);

  const companyIds = [...new Set((seatsRows ?? []).map((s) => s.company_id))];
  const companiesMap: Record<string, { name?: string; legal_name?: string }> = {};
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("fundops_companies")
      .select("id, name, legal_name")
      .in("id", companyIds);
    for (const c of companies ?? []) {
      companiesMap[c.id] = { name: c.name, legal_name: c.legal_name };
    }
  }

  const seats = (seatsRows ?? []).map((s) => ({
    ...s,
    company_name: companiesMap[s.company_id]?.name ?? companiesMap[s.company_id]?.legal_name ?? "—",
  }));

  const { data: investorUserRows } = await supabase
    .from("fundops_investor_users")
    .select("investor_id")
    .eq("user_id", id);

  let investorAccounts: unknown[] = [];
  if (investorUserRows && investorUserRows.length > 0) {
    const investorIds = investorUserRows.map((r) => r.investor_id);
    const { data: accounts } = await supabase
      .from("fundops_investor_accounts")
      .select("id, investor_id, company_id, lifecycle_stage, is_active, disabled_reason, disabled_at")
      .in("investor_id", investorIds);

    const accCompanyIds = [...new Set((accounts ?? []).map((a) => a.company_id))];
    const accInvestorIds = [...new Set((accounts ?? []).map((a) => a.investor_id))];
    const { data: accCompanies } = await supabase
      .from("fundops_companies")
      .select("id, name")
      .in("id", accCompanyIds);
    const { data: accInvestors } = await supabase
      .from("fundops_investors")
      .select("id, full_name, email")
      .in("id", accInvestorIds);

    const cmpMap: Record<string, string> = {};
    for (const c of accCompanies ?? []) cmpMap[c.id] = c.name ?? "—";
    const invMap: Record<string, { full_name?: string; email?: string }> = {};
    for (const i of accInvestors ?? []) invMap[i.id] = { full_name: i.full_name, email: i.email };

    investorAccounts = (accounts ?? []).map((a) => ({
      ...a,
      company_name: cmpMap[a.company_id] ?? "—",
      investor_name: invMap[a.investor_id]?.full_name ?? invMap[a.investor_id]?.email ?? "—",
    }));
  }

  return jsonResponse({
    profile,
    permissions: permissions ?? null,
    seats,
    investor_accounts: investorAccounts,
    current_user_id: ctx.admin.id,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdminForApi();
  if (!ctx) return errResponse("Forbidden", 403);

  const { supabase, admin } = ctx;
  const { id } = await params;

  const body = await request.json();
  const {
    is_active,
    disabled_reason,
    role_global,
  }: {
    is_active?: boolean;
    disabled_reason?: string;
    role_global?: string | null;
  } = body;

  const updates: Record<string, unknown> = {};
  if (typeof is_active === "boolean") updates.is_active = is_active;
  if (disabled_reason !== undefined) updates.disabled_reason = disabled_reason;
  if (role_global !== undefined) updates.role_global = role_global;

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

  const { data: beforeRow } = await supabase
    .from("profiles")
    .select("id, email, full_name, role_global, is_active, disabled_reason, disabled_at")
    .eq("id", id)
    .single();

  if (!beforeRow) return errResponse("Utente non trovato", 404);

  const beforeRole = beforeRow.role_global as string | null;
  const targetIsSelf = id === admin.id;

  // SAFETY: Un admin non può disattivare se stesso
  if (targetIsSelf && typeof is_active === "boolean" && !is_active) {
    return errResponse("Non puoi disattivare il tuo account", 400);
  }

  // SAFETY: Cambio role da imment_admin ad altro – deve rimanere almeno un admin attivo
  if (
    role_global !== undefined &&
    role_global !== "imment_admin" &&
    beforeRole === "imment_admin"
  ) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role_global", "imment_admin")
      .eq("is_active", true)
      .neq("id", id);

    if ((count ?? 0) < 1) {
      return errResponse(
        "Deve rimanere almeno un super admin attivo. Impossibile rimuovere l'ultimo.",
        400
      );
    }
  }

  const { data: afterRow, error: updateError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select("id, email, full_name, role_global, is_active, disabled_reason, disabled_at")
    .single();

  if (updateError) {
    return errResponse(updateError.message, 500);
  }

  await writeAdminAudit(supabase, {
    actorUserId: admin.id,
    actorEmail: admin.email,
    targetUserId: id,
    action: "user_update",
    entity: "profile",
    entityId: id,
    beforeData: beforeRow,
    afterData: afterRow,
  });

  return jsonResponse(afterRow);
}
