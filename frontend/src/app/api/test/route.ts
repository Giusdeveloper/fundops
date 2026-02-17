// src/app/api/test/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const debugEnabled = process.env.ENABLE_DEBUG_ENDPOINTS === "true";
  if (process.env.NODE_ENV === "production" || !debugEnabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("fundops_companies")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}
