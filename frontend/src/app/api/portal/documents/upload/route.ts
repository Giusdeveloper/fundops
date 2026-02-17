import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  resolveCompanyBySlug,
  hasSignedLoiForCompany,
  getPhaseForCompany,
} from "@/lib/portalHelpers";

const BUCKET = "fundops-documents";
const PORTAL_DOC_TYPES = ["notary_deed", "investment_form", "wire_proof"] as const;

function err(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(request: Request) {
  const supabaseAuth = await createClient();
  const supabase = supabaseServer;

  if (!supabase) {
    return err("Configurazione server mancante", 500);
  }

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user?.id) {
    return err("Non autenticato", 401);
  }

  const { data: profile } = await supabaseAuth
    .from("profiles")
    .select("role_global, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || profile.is_active === false) {
    return err("Accesso disabilitato", 403);
  }

  let slug: string;
  let type: string;
  let fileBase64: string | null = null;
  let file: File | null = null;

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    slug = formData.get("slug") as string;
    type = formData.get("type") as string;
    file = formData.get("file") as File;
  } else {
    const body = await request.json();
    slug = body.slug;
    type = body.type;
    fileBase64 = body.fileBase64 ?? null;
  }

  if (!slug || !type) {
    return err("slug e type sono richiesti", 400);
  }

  if (!PORTAL_DOC_TYPES.includes(type as (typeof PORTAL_DOC_TYPES)[number])) {
    return err("type deve essere notary_deed, investment_form o wire_proof", 400);
  }

  const company = await resolveCompanyBySlug(supabase, slug);
  if (!company) {
    return err("Company non trovata", 404);
  }

  const phase = await getPhaseForCompany(supabase, company.id);
  const hasSignedLoi = await hasSignedLoiForCompany(supabase, company.id);

  if (phase === "issuing" || phase === "onboarding") {
    if (!hasSignedLoi) {
      return err(
        "Non puoi caricare documenti: la LOI deve essere firmata prima di procedere",
        403
      );
    }
  }

  let investorId: string | null = null;

  if (type === "notary_deed") {
    const isAdmin = profile.role_global === "imment_admin" || profile.role_global === "imment_operator";
    const { data: seat } = await supabaseAuth
      .from("fundops_company_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", company.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!isAdmin && !seat) {
      return err("Solo admin Imment o utenti con seat attivo possono caricare il notary deed", 403);
    }
  } else {
    const { data: iu } = await supabaseAuth
      .from("fundops_investor_users")
      .select("investor_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!iu) {
      return err("Devi essere un investitore per caricare questo documento", 403);
    }

    const { data: acc } = await supabaseAuth
      .from("fundops_investor_accounts")
      .select("id")
      .eq("investor_id", iu.investor_id)
      .eq("company_id", company.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!acc) {
      return err("Nessun account investitore attivo per questa company", 403);
    }

    investorId = iu.investor_id;
  }

  let buffer: Buffer;
  let filename: string;
  let mimeType: string;

  if (file) {
    buffer = Buffer.from(await file.arrayBuffer());
    filename = file.name;
    mimeType = file.type || "application/pdf";
  } else if (fileBase64) {
    buffer = Buffer.from(fileBase64, "base64");
    filename = `document-${type}-${Date.now()}.pdf`;
    mimeType = "application/pdf";
  } else {
    return err("file o fileBase64 è richiesto", 400);
  }

  const timestamp = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const subPath = type === "notary_deed"
    ? `portal/${company.id}/notary_deed`
    : `portal/${company.id}/investors/${investorId}/${type}`;
  const filePath = `${subPath}/${timestamp}_${sanitized}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    return err(`Errore upload: ${uploadError.message}`, 500);
  }

  const { data: maxVersion } = await supabase
    .from("fundops_documents")
    .select("version")
    .eq("company_id", company.id)
    .is("investor_id", investorId)
    .eq("type", type)
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (maxVersion?.version ?? 0) + 1;

  const { data: doc, error: docError } = await supabase
    .from("fundops_documents")
    .insert({
      company_id: company.id,
      loi_id: null,
      investor_id: investorId,
      type,
      title: filename,
      file_path: filePath,
      mime_type: mimeType,
      size_bytes: buffer.length,
      version: nextVersion,
      status: "active",
      created_by: user.id,
    })
    .select()
    .single();

  if (docError) {
    await supabase.storage.from(BUCKET).remove([filePath]);
    return err(`Errore salvataggio: ${docError.message}`, 500);
  }

  return NextResponse.json({ data: doc }, { status: 201 });
}
