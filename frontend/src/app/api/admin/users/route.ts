import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/adminAuth";

export async function GET(request: NextRequest) {
  const ctx = await requireAdminForApi();
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { supabase } = ctx;
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, role_global, is_active")
    .order("email", { ascending: true });

  if (q) {
    query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return Response.json(data ?? []);
}
