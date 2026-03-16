import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRoleContext, canAccessCompany } from "@/lib/companyAccess";

const BUCKET_NAME = "company-profile-attachments";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const formData = await request.formData();
  const companyId = formData.get("company_id");
  const type = formData.get("type");
  const file = formData.get("file");

  if (!companyId || typeof companyId !== "string" || !companyId.trim()) {
    return NextResponse.json({ error: "company_id richiesto" }, { status: 400 });
  }
  if (!type || (type !== "deck" && type !== "registry")) {
    return NextResponse.json({ error: "type non valido" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file richiesto" }, { status: 400 });
  }

  const hasAccess = await canAccessCompany(supabase, user.id, companyId, await getUserRoleContext(supabase, user.id));
  if (!hasAccess) {
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
  }

  const extension = file.name.split(".").pop() ?? "bin";
  const timestamp = Date.now();
  const filename = `${companyId}/${type}/${timestamp}-${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filename, new Uint8Array(arrayBuffer), { upsert: true });

  if (uploadError) {
    console.error("[company-profiles/attachments/upload] storage error", uploadError);
    return NextResponse.json({ error: "Impossibile caricare il file" }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filename);
  const url = urlData?.publicUrl;
  if (!url) {
    return NextResponse.json({ error: "Impossibile ottenere l'URL pubblico" }, { status: 500 });
  }

  const { error: dbError } = await supabase.from("company_profile_attachments").insert({
    company_id: companyId,
    type,
    url,
    metadata: {
      filename: file.name,
      extension,
      size: file.size,
    },
    source: "profiling",
    uploaded_by: user.id,
  });

  if (dbError) {
    console.error("[company-profiles/attachments/upload] db error", dbError);
    return NextResponse.json({ error: "Errore salvataggio allegato" }, { status: 500 });
  }

  const { data: attachments, error: listError } = await supabase
    .from("company_profile_attachments")
    .select("id, type, url, metadata, source, uploaded_at, uploaded_by")
    .eq("company_id", companyId)
    .order("uploaded_at", { ascending: false });

  if (listError) {
    return NextResponse.json({ error: "Errore lettura allegati" }, { status: 500 });
  }

  return NextResponse.json({ data: attachments ?? [], url });
}
