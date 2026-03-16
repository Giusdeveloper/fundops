import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRoleContext, canAccessCompany } from "@/lib/companyAccess";

type AttachmentType = "deck" | "registry";
const allowedTypes: AttachmentType[] = ["deck", "registry"];

async function handleAccess(companyId: string, userId: string) {
  const supabase = await createClient();
  const roleContext = await getUserRoleContext(supabase, userId);
  const canAccess = await canAccessCompany(supabase, userId, companyId, roleContext);
  return canAccess;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  let body: { company_id?: string; type?: string; url?: string; metadata?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const companyId = typeof body.company_id === "string" ? body.company_id : null;
  const type = typeof body.type === "string" ? body.type.toLowerCase() : null;
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!companyId) {
    return NextResponse.json({ error: "company_id richiesto" }, { status: 400 });
  }
  if (!type || !allowedTypes.includes(type as AttachmentType)) {
    return NextResponse.json({ error: "type non valido" }, { status: 400 });
  }
  if (!url) {
    return NextResponse.json({ error: "url richiesto" }, { status: 400 });
  }

  const hasAccess = await handleAccess(companyId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
  }

  const insertPayload = {
    company_id: companyId,
    type,
    url,
    metadata: body.metadata || {},
    source: "profiling",
    uploaded_by: user.id,
  };

  const { error } = await supabase.from("company_profile_attachments").insert(insertPayload);
  if (error) {
    console.error("[company-profiles/attachments] insert error", error);
    return NextResponse.json({ error: "Impossibile salvare l'allegato" }, { status: 500 });
  }

  const { data: attachments, error: listError } = await supabase
    .from("company_profile_attachments")
    .select("id, type, url, metadata, source, uploaded_at, uploaded_by")
    .eq("company_id", companyId)
    .order("uploaded_at", { ascending: false });

  if (listError) {
    return NextResponse.json({ error: "Errore lettura allegati" }, { status: 500 });
  }

  return NextResponse.json({ data: attachments ?? [] });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId mancante" }, { status: 400 });
  }

  const hasAccess = await handleAccess(companyId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
  }

  const { data: attachments, error } = await supabase
    .from("company_profile_attachments")
    .select("id, type, url, metadata, source, uploaded_at, uploaded_by")
    .eq("company_id", companyId)
    .order("uploaded_at", { ascending: false });
  if (error) {
    console.error("[company-profiles/attachments] list error", error.message);
    if (error.code === "42P01" || /relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ data: [] });
    }
    return NextResponse.json({ error: "Errore lettura allegati" }, { status: 500 });
  }

  return NextResponse.json({ data: attachments ?? [] });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const companyId = request.nextUrl.searchParams.get("companyId");
  const id = request.nextUrl.searchParams.get("id");
  if (!companyId || !id) {
    return NextResponse.json({ error: "companyId e id sono richiesti" }, { status: 400 });
  }

  const hasAccess = await handleAccess(companyId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
  }

  const { error } = await supabase
    .from("company_profile_attachments")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) {
    return NextResponse.json({ error: "Errore eliminazione allegato" }, { status: 500 });
  }

  const { data: attachments, error: listError } = await supabase
    .from("company_profile_attachments")
    .select("id, type, url, metadata, source, uploaded_at, uploaded_by")
    .eq("company_id", companyId)
    .order("uploaded_at", { ascending: false });

  if (listError) {
    return NextResponse.json({ error: "Errore lettura allegati" }, { status: 500 });
  }

  return NextResponse.json({ data: attachments ?? [] });
}
