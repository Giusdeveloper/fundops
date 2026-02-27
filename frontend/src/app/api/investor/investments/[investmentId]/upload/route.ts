import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";

const BUCKET = "fundops-documents";
const ALLOWED_TYPES = ["investment_form", "bank_transfer_proof"] as const;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra ?? {}) }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ investmentId: string }> }
) {
  try {
    const { investmentId } = await params;
    if (!investmentId || !UUID_RE.test(investmentId)) {
      return jsonError("investmentId non valido", 400);
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user?.id) return jsonError("Non autenticato", 401);

    const formData = await request.formData();
    const typeRaw = String(formData.get("type") ?? "").trim();
    const file = formData.get("file");

    if (!ALLOWED_TYPES.includes(typeRaw as (typeof ALLOWED_TYPES)[number])) {
      return jsonError("type non valido", 400);
    }
    if (!(file instanceof File)) {
      return jsonError("file mancante", 400);
    }

    const { data: investorUser, error: iuErr } = await supabase
      .from("fundops_investor_users")
      .select("investor_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (iuErr) return jsonError(iuErr.message, 500, { code: iuErr.code });
    if (!investorUser?.investor_id) return jsonError("Investitore non autorizzato", 403);
    const investorId = investorUser.investor_id;

    const { data: investment, error: invErr } = await supabase
      .from("fundops_investments")
      .select("id, company_id, investor_id, status")
      .eq("id", investmentId)
      .eq("investor_id", investorId)
      .maybeSingle();
    if (invErr) return jsonError(invErr.message, 500, { code: invErr.code });
    if (!investment) return jsonError("Investimento non trovato", 404);
    if (investment.status !== "draft") return jsonError("Investimento non modificabile", 409);

    if (!supabaseServer) {
      return jsonError("Configurazione server mancante", 500);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `investor/${investment.company_id}/${investorId}/${investment.id}/${typeRaw}/${Date.now()}_${safeName}`;

    const { error: uploadErr } = await supabaseServer.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadErr) return jsonError(uploadErr.message, 500);

    const { data: doc, error: docErr } = await supabaseServer
      .from("fundops_documents")
      .insert({
        company_id: investment.company_id,
        investor_id: investorId,
        investment_id: investment.id,
        loi_id: null,
        type: typeRaw,
        title: file.name,
        file_path: path,
        mime_type: file.type || "application/octet-stream",
        size_bytes: bytes.length,
        version: 1,
        status: "active",
        created_by: user.id,
      })
      .select("id,type,created_at")
      .single();

    if (docErr) {
      await supabaseServer.storage.from(BUCKET).remove([path]);
      return jsonError(docErr.message, 500, { code: docErr.code });
    }

    return NextResponse.json(
      { documentId: doc.id, type: doc.type, created_at: doc.created_at },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto";
    return jsonError(message, 500);
  }
}
