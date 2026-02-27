import { createServerClient } from "@/lib/supabase/server";

type EffectiveArea = "startup" | "investor";

export interface UserUiContext {
  isLoggedIn: boolean;
  roleGlobal: string | null;
  viewMode: string | null;
  effectiveArea: EffectiveArea;
  canAccessStartup: boolean;
  canAccessInvestor: boolean;
  isImmentAdmin: boolean;
  isImmentOperator: boolean;
  isFounder: boolean;
  isInvestor: boolean;
}

function getEffectiveArea(roleGlobal: string | null, viewMode: string | null): EffectiveArea {
  if (roleGlobal === "investor") return "investor";
  if (roleGlobal === "founder" || roleGlobal === "imment_operator") return "startup";
  if (roleGlobal === "imment_admin") {
    return viewMode === "investor" ? "investor" : "startup";
  }
  return "startup";
}

export async function getUserUiContext(): Promise<UserUiContext> {
  const fallback: UserUiContext = {
    isLoggedIn: false,
    roleGlobal: null,
    viewMode: null,
    effectiveArea: "startup",
    canAccessStartup: false,
    canAccessInvestor: false,
    isImmentAdmin: false,
    isImmentOperator: false,
    isFounder: false,
    isInvestor: false,
  };

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return fallback;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role_global, is_active, view_mode")
      .eq("id", user.id)
      .maybeSingle();

    const roleGlobal = profile?.role_global?.trim() ?? null;
    const viewMode = profile?.view_mode?.trim() ?? null;
    const effectiveArea = getEffectiveArea(roleGlobal, viewMode);

    const isImmentAdmin = roleGlobal === "imment_admin";
    const isImmentOperator = roleGlobal === "imment_operator";
    const isFounder = roleGlobal === "founder";
    const isInvestor = roleGlobal === "investor";
    const isProfileActive = profile?.is_active !== false;

    return {
      isLoggedIn: true,
      roleGlobal,
      viewMode,
      effectiveArea,
      canAccessStartup: isProfileActive && effectiveArea === "startup",
      canAccessInvestor: isProfileActive && effectiveArea === "investor",
      isImmentAdmin,
      isImmentOperator,
      isFounder,
      isInvestor,
    };
  } catch {
    return fallback;
  }
}

