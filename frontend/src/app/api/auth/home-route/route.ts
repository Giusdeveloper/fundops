import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role_global")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message, code: profileError.code ?? null },
      { status: 500 }
    );
  }

  const roleGlobal = profile?.role_global?.trim() ?? null;
  if (!roleGlobal) {
    return NextResponse.json({ homeRoute: "/onboarding/choose-role" }, { status: 200 });
  }

  const { data: homeRouteData, error: rpcError } = await supabase.rpc("get_home_route");
  if (rpcError) {
    return NextResponse.json(
      { error: rpcError.message, code: rpcError.code ?? null },
      { status: 500 }
    );
  }

  const homeRoute =
    typeof homeRouteData === "string" && homeRouteData.startsWith("/")
      ? homeRouteData
      : "/dashboard";

  return NextResponse.json({ homeRoute }, { status: 200 });
}

