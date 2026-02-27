import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AllowedRole = "investor" | "founder";

function isAllowedRole(value: unknown): value is AllowedRole {
  return value === "investor" || value === "founder";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const role = body?.role;
  if (!isAllowedRole(role)) {
    return NextResponse.json(
      { error: "Invalid role. Allowed values: investor, founder" },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role_global: role })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message, code: updateError.code ?? null },
      { status: 500 }
    );
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

  return NextResponse.json({ ok: true, homeRoute }, { status: 200 });
}

