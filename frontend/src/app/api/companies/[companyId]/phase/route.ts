import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type PhaseValue = "booking" | "issuance" | "onboarding";

const ALLOWED_PHASES: PhaseValue[] = ["booking", "issuance", "onboarding"];

interface RouteParams {
  params: Promise<{
    companyId: string;
  }>;
}

function jsonError(
  error: string,
  status: number,
  detail?: string | null,
  code?: string | null
) {
  return NextResponse.json(
    {
      error,
      detail: detail ?? null,
      code: code ?? null,
    },
    { status }
  );
}

export async function POST(
  request: Request,
  { params }: RouteParams
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("[company-phase] missing env", {
        hasUrl: Boolean(supabaseUrl),
        hasAnon: Boolean(anonKey),
        hasServiceRole: Boolean(serviceRoleKey),
      });
      return jsonError("Configurazione server mancante", 500);
    }

    const { companyId: companyIdRaw } = await params;
    const companyId = companyIdRaw?.trim();
    if (!companyId) {
      return jsonError("companyId mancante", 400);
    }

    const body = await request.json().catch(() => null);
    const phase = body?.phase as PhaseValue | undefined;

    if (!phase || !ALLOWED_PHASES.includes(phase)) {
      return jsonError(
        "phase non valida. Valori ammessi: booking, issuance, onboarding",
        400
      );
    }

    const cookieStore = await cookies();
    const userClient = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // no-op in route context
          }
        },
      },
    });

    const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError) {
      console.error("[company-phase] auth error", { companyId, phase, authError });
      return jsonError("Errore autenticazione", 401, authError.message, authError.name ?? null);
    }

    if (!user?.id) {
      return jsonError("Non autenticato", 401);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role_global, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[company-phase] profile lookup error", {
        companyId,
        phase,
        userId: user.id,
        profileError,
      });
      return jsonError("Errore verifica profilo", 500, profileError.message, profileError.code);
    }

    if (profile?.is_active === false) {
      return jsonError("Accesso disabilitato", 403);
    }

    const roleGlobal = profile?.role_global ?? null;
    let authorized =
      roleGlobal === "imment_admin" || roleGlobal === "imment_operator";

    if (!authorized) {
      const { data: seat, error: seatError } = await adminClient
        .from("fundops_company_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("company_id", companyId)
        .eq("role", "company_admin")
        .eq("is_active", true)
        .maybeSingle();

      if (seatError) {
        console.error("[company-phase] seat check error", {
          companyId,
          phase,
          userId: user.id,
          seatError,
        });
        return jsonError("Errore verifica autorizzazioni", 500, seatError.message, seatError.code);
      }

      authorized = Boolean(seat);
    }

    if (!authorized) {
      return jsonError("Forbidden", 403);
    }

    const { data, error } = await adminClient
      .from("fundops_companies")
      .update({ phase })
      .eq("id", companyId)
      .select("id, phase")
      .maybeSingle();

    if (error) {
      console.error("[company-phase] update error", {
        companyId,
        phase,
        userId: user.id,
        error,
      });
      return jsonError("Errore update fase", 500, error.message, error.code);
    }

    if (!data) {
      return jsonError("Company non trovata", 404);
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto";
    console.error("[company-phase] unexpected error", { error });
    return jsonError("Errore interno", 500, message);
  }
}
