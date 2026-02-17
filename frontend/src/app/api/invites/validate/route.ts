import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createHash } from "crypto";

export async function GET(request: NextRequest) {
  const supabase = supabaseServer;
  if (!supabase) {
    return new Response(
      JSON.stringify({ valid: false, error: "Configurazione server mancante" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const token = request.nextUrl.searchParams.get("token");
  const redirectParam = request.nextUrl.searchParams.get("redirect");
  const redirect =
    redirectParam &&
    redirectParam.startsWith("/") &&
    !redirectParam.startsWith("//")
      ? redirectParam
      : "/dashboard";

  if (!token || token.length < 10) {
    return new Response(
      JSON.stringify({ valid: false, error: "Invito non valido" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data: invite, error } = await supabase
    .from("fundops_invites")
    .select("id, expires_at")
    .eq("token_hash", tokenHash)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[invites/validate] lookup error:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Invito non valido" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!invite) {
    return new Response(
      JSON.stringify({ valid: false, error: "Invito non valido" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const now = new Date();
  const expiresAt = new Date(invite.expires_at);
  const expired = expiresAt < now;

  return new Response(
    JSON.stringify({
      valid: true,
      expired,
      redirect,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
