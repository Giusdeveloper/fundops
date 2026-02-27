import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ViewMode = "startup" | "investor";

function isValidViewMode(value: unknown): value is ViewMode {
  return value === "startup" || value === "investor";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const viewMode = body?.view_mode;
  if (!isValidViewMode(viewMode)) {
    return NextResponse.json(
      { error: "view_mode non valido. Usa 'startup' o 'investor'" },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role_global, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const canSwitch = profile?.role_global === "imment_admin" && profile?.is_active === true;
  if (!canSwitch) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ view_mode: viewMode, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, view_mode: viewMode });
}

