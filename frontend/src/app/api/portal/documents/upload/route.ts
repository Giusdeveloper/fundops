import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  resolveCompanyBySlug,
  hasSignedLoiForCompany,
} from "@/lib/portalHelpers";

const BUCKET = "fundops-documents";
const PORTAL_DOC_TYPES = [
  "notary_deed",
  "investment_form",
  "privacy_notice",
  "wire_proof",
  "investment_form_signed",
  "bank_transfer_proof",
  "investment_module",
  "privacy_investor",
  "id_document",
  "tax_code",
  "bank_transfer_receipt",
] as const;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function err(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(request: Request) {
  const supabaseAuth = await createSupabaseServerClient();
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
  let investmentId: string | null = null;
  let fileBase64: string | null = null;
  let file: File | null = null;

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    slug = formData.get("slug") as string;
    type = formData.get("type") as string;
    investmentId = (formData.get("investmentId") as string | null)?.trim() ?? null;
    file = formData.get("file") as File;
  } else {
    const body = await request.json();
    slug = body.slug;
    type = body.type;
    investmentId = typeof body.investmentId === "string" ? body.investmentId.trim() : null;
    fileBase64 = body.fileBase64 ?? null;
  }

  if (!slug || !type) {
    return err("slug e type sono richiesti", 400);
  }

  if (!PORTAL_DOC_TYPES.includes(type as (typeof PORTAL_DOC_TYPES)[number])) {
    return err(
      "type non valido",
      400
    );
  }
  if (investmentId && !UUID_RE.test(investmentId)) {
    return err("investmentId non valido", 400);
  }

  const company = await resolveCompanyBySlug(supabase, slug);
  if (!company) {
    return err("Company non trovata", 404);
  }

  const phaseRaw = (company.phase ?? "").toLowerCase();
  const phase =
    phaseRaw === "issuance" || phaseRaw === "issuing"
      ? "issuance"
      : phaseRaw === "onboarding"
      ? "onboarding"
      : "booking";
  const hasSignedLoi = await hasSignedLoiForCompany(supabase, company.id);

  if (phase === "issuance" || phase === "onboarding") {
    if (!hasSignedLoi) {
      return err(
        "Non puoi caricare documenti: la LOI deve essere firmata prima di procedere",
        403
      );
    }
  }

  let investorId: string | null = null;
  let investmentRecord:
    | { id: string; status: string | null }
    | null = null;

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

    if (!investmentId) {
      return err("investmentId richiesto per documenti investitore", 400);
    }

    const { data: investment, error: investmentError } = await supabase
      .from("fundops_investments")
      .select("id, status")
      .eq("id", investmentId)
      .eq("company_id", company.id)
      .eq("investor_id", investorId)
      .maybeSingle();

    if (investmentError) {
      return err(`Errore lookup investimento: ${investmentError.message}`, 500);
    }
    if (!investment) {
      return err("Investimento non trovato", 404);
    }
    if (investment.status !== "draft" && investment.status !== "rejected") {
      return err("Investimento non modificabile", 409);
    }
    investmentRecord = investment;
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
    : `portal/${company.id}/investors/${investorId}/investments/${investmentRecord?.id}/${type}`;
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

  const maxVersionQuery = supabase
    .from("fundops_documents")
    .select("version")
    .eq("type", type)
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1);

  if (investmentRecord?.id) {
    maxVersionQuery.eq("investment_id", investmentRecord.id);
  } else {
    maxVersionQuery.eq("company_id", company.id).is("investor_id", null);
  }

  const { data: maxVersion } = await maxVersionQuery.maybeSingle();

  const nextVersion = (maxVersion?.version ?? 0) + 1;

  const { data: doc, error: docError } = await supabase
    .from("fundops_documents")
    .insert({
      company_id: company.id,
      loi_id: null,
      investor_id: investorId,
      investment_id: investmentRecord?.id ?? null,
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
