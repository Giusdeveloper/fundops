import type { SupabaseClient } from "@supabase/supabase-js";

type RoleGlobal = "imment_admin" | "imment_operator" | string | null;

export interface UserRoleContext {
  role: RoleGlobal;
  isActive: boolean;
}

export async function getUserRoleContext(
  supabase: SupabaseClient,
  userId: string
): Promise<UserRoleContext> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role_global, is_active")
    .eq("id", userId)
    .maybeSingle();

  return {
    role: (profile?.role_global ?? null) as RoleGlobal,
    isActive: profile?.is_active !== false,
  };
}

export function isGlobalFundopsRole(role: RoleGlobal): boolean {
  return role === "imment_admin" || role === "imment_operator";
}

export async function getAccessibleCompanyIds(
  supabase: SupabaseClient,
  userId: string,
  roleContext?: UserRoleContext
): Promise<string[]> {
  const ctx = roleContext ?? (await getUserRoleContext(supabase, userId));

  if (!ctx.isActive) {
    return [];
  }

  if (isGlobalFundopsRole(ctx.role)) {
    const { data: companies } = await supabase
      .from("fundops_companies")
      .select("id");
    return (companies ?? []).map((company) => company.id);
  }

  const companyIds = new Set<string>();

  const { data: seats } = await supabase
    .from("fundops_company_users")
    .select("company_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  for (const seat of seats ?? []) {
    companyIds.add(seat.company_id);
  }

  const { data: investorLinks } = await supabase
    .from("fundops_investor_users")
    .select("investor_id")
    .eq("user_id", userId);

  const investorIds = (investorLinks ?? []).map((row) => row.investor_id);
  if (investorIds.length > 0) {
    const { data: accounts } = await supabase
      .from("fundops_investor_accounts")
      .select("company_id")
      .in("investor_id", investorIds)
      .eq("is_active", true);

    for (const account of accounts ?? []) {
      companyIds.add(account.company_id);
    }
  }

  return Array.from(companyIds);
}

export async function canAccessCompany(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  roleContext?: UserRoleContext
): Promise<boolean> {
  const ctx = roleContext ?? (await getUserRoleContext(supabase, userId));

  if (!ctx.isActive) {
    return false;
  }

  if (isGlobalFundopsRole(ctx.role)) {
    return true;
  }

  const { data: seat } = await supabase
    .from("fundops_company_users")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (seat) {
    return true;
  }

  const { data: investorLinks } = await supabase
    .from("fundops_investor_users")
    .select("investor_id")
    .eq("user_id", userId);

  const investorIds = (investorLinks ?? []).map((row) => row.investor_id);
  if (investorIds.length === 0) {
    return false;
  }

  const { data: investorAccount } = await supabase
    .from("fundops_investor_accounts")
    .select("id")
    .in("investor_id", investorIds)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return !!investorAccount;
}
