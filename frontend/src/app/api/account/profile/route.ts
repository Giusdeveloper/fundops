import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

export async function PATCH(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return json(401, { error: "Unauthorized" });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        fullName?: string;
      }
    | null;

  const fullName = body?.fullName?.trim() ?? "";
  if (fullName.length < 2) {
    return json(400, { error: "Inserisci un nome valido" });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id)
    .select("full_name")
    .maybeSingle();

  if (error) {
    return json(500, { error: error.message });
  }

  return json(200, {
    fullName: data?.full_name ?? fullName,
  });
}
