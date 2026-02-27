import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Regola: solo imment_admin può switchare liberamente.
// Tutti gli altri: view_mode “bloccato” (investor -> investor, founder/operator -> startup).
function normalizeViewMode(roleGlobal: string | null, requested: string | null) {
  if (roleGlobal === "investor") return "investor";
  if (roleGlobal === "founder" || roleGlobal === "imment_operator") return "startup";
  if (roleGlobal === "imment_admin") {
    if (requested === "investor" || requested === "startup") return requested;
    return "startup";
  }
  // fallback
  return "startup";
}

export async function GET() {
  const supabase = await createServerClient();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, role_global, view_mode, is_active")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Profilo non trovato" }, { status: 404 });
  if (profile.is_active === false) return NextResponse.json({ error: "Profilo disattivato" }, { status: 403 });

  const effective = normalizeViewMode(profile.role_global ?? null, profile.view_mode ?? null);

  // se view_mode è null o incoerente, lo riallineo una volta
  if (profile.view_mode !== effective) {
    await supabase
      .from("profiles")
      .update({ view_mode: effective, updated_at: new Date().toISOString() })
      .eq("id", auth.user.id);
  }

  return NextResponse.json({
    role_global: profile.role_global,
    view_mode: effective,
    can_switch: profile.role_global === "imment_admin",
  });
}

export async function POST(req: Request) {
  const supabase = await createServerClient();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const requested = typeof body?.view_mode === "string" ? body.view_mode : null;

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, role_global, view_mode, is_active")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Profilo non trovato" }, { status: 404 });
  if (profile.is_active === false) return NextResponse.json({ error: "Profilo disattivato" }, { status: 403 });

  // Solo imment_admin può cambiare
  if (profile.role_global !== "imment_admin") {
    const enforced = normalizeViewMode(profile.role_global ?? null, requested);
    return NextResponse.json({
      role_global: profile.role_global,
      view_mode: enforced,
      can_switch: false,
      message: "Ruolo non autorizzato allo switch. View mode forzato.",
    });
  }

  const nextMode = normalizeViewMode(profile.role_global ?? null, requested);
  const { error: uErr } = await supabase
    .from("profiles")
    .update({ view_mode: nextMode, updated_at: new Date().toISOString() })
    .eq("id", auth.user.id);

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  return NextResponse.json({
    role_global: profile.role_global,
    view_mode: nextMode,
    can_switch: true,
  });
}
