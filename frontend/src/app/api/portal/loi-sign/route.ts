import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { generateLoiReceiptPdf } from "@/lib/loiReceiptPdf";
import { getLoiActiveSentForCompany } from "@/lib/portalHelpers";

const BUCKET = "fundops-documents";
const RECEIPT_TYPE = "loi_receipt";

interface ReceiptMeta {
  receipt_document_id: string;
  receipt_file_path: string;
  receipt_version: number;
}

function readStringField(payload: unknown, keys: string[]): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

async function persistLoiReceipt(params: {
  companyId: string;
  fullName: string;
  userId: string;
  userEmail: string | null;
  rpcPayload: unknown;
  supabaseAuth: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}): Promise<ReceiptMeta | null> {
  if (!supabaseServer) {
    console.warn("[loi-sign][receipt] supabaseServer non configurato");
    return null;
  }

  const { companyId, fullName, userId, userEmail, rpcPayload, supabaseAuth } = params;
  const supabaseService = supabaseServer;

  const rpcInvestorId = readStringField(rpcPayload, ["investor_id", "investorId"]);
  const rpcLoiId = readStringField(rpcPayload, ["loi_id", "loiId"]);
  const rpcSignedAt = readStringField(rpcPayload, ["signed_at", "signedAt"]);

  let investorId = rpcInvestorId;
  if (!investorId) {
    const { data: investorUser } = await supabaseAuth
      .from("fundops_investor_users")
      .select("investor_id")
      .eq("user_id", userId)
      .maybeSingle();
    investorId = investorUser?.investor_id ?? null;
  }

  if (!investorId) {
    console.error("[loi-sign][receipt] investor_id non trovato");
    return null;
  }

  const { data: company } = await supabaseService
    .from("fundops_companies")
    .select("id, name, legal_name, public_slug")
    .eq("id", companyId)
    .maybeSingle();

  if (!company) {
    console.error("[loi-sign][receipt] company non trovata", { companyId });
    return null;
  }

  let loiId = rpcLoiId;
  if (!loiId) {
    const loi = await getLoiActiveSentForCompany(supabaseService, companyId);
    loiId = loi.data?.id ?? null;
  }

  if (!loiId) {
    console.error("[loi-sign][receipt] loi_id non trovato", { companyId, investorId });
    return null;
  }

  const { data: investor } = await supabaseService
    .from("fundops_investors")
    .select("email")
    .eq("id", investorId)
    .maybeSingle();

  const { data: lastVersionRow } = await supabaseService
    .from("fundops_documents")
    .select("version")
    .eq("company_id", companyId)
    .eq("loi_id", loiId)
    .eq("investor_id", investorId)
    .eq("type", RECEIPT_TYPE)
    .order("version", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (lastVersionRow?.version ?? 0) + 1;
  const signedAtIso = rpcSignedAt ?? new Date().toISOString();

  const pdfBytes = await generateLoiReceiptPdf({
    companyName: company.name ?? "—",
    legalName: company.legal_name ?? company.name ?? "—",
    signedName: fullName,
    investorEmail: investor?.email ?? userEmail ?? "—",
    signedAt: new Date(signedAtIso).toLocaleString("it-IT", {
      dateStyle: "long",
      timeStyle: "short",
    }),
    loiId,
  });

  const filePath = `companies/${companyId}/investors/${investorId}/loi/${loiId}/receipts/loi_receipt_v${nextVersion}.pdf`;

  const { error: uploadErr } = await supabaseService.storage
    .from(BUCKET)
    .upload(filePath, Buffer.from(pdfBytes), {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadErr) {
    throw new Error(`upload failed: ${uploadErr.message}`);
  }

  const { data: insertedDoc, error: docErr } = await supabaseService
    .from("fundops_documents")
    .insert({
      company_id: companyId,
      loi_id: loiId,
      investor_id: investorId,
      type: RECEIPT_TYPE,
      title: "Attestazione firma LOI",
      file_path: filePath,
      mime_type: "application/pdf",
      size_bytes: pdfBytes.length,
      version: nextVersion,
      status: "active",
      created_by: userId,
    })
    .select("id")
    .single();

  if (docErr || !insertedDoc?.id) {
    await supabaseService.storage.from(BUCKET).remove([filePath]);
    throw new Error(`fundops_documents insert failed: ${docErr?.message ?? "unknown"}`);
  }

  console.log("[loi-sign][receipt] persisted", {
    company_id: companyId,
    investor_id: investorId,
    loi_id: loiId,
    version: nextVersion,
    file_path: filePath,
  });

  return {
    receipt_document_id: insertedDoc.id,
    receipt_file_path: filePath,
    receipt_version: nextVersion,
  };
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const body = (await req.json()) as { companyId?: string; fullName?: string };
    const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";

    if (!companyId || !fullName) {
      return NextResponse.json(
        { ok: false, error: "Missing companyId/fullName" },
        { status: 400 }
      );
    }

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { data: activeRound, error: roundErr } = await supabase
      .from("fundops_rounds")
      .select("id,status")
      .eq("company_id", companyId)
      .eq("status", "active")
      .maybeSingle();

    if (roundErr) {
      console.error("[loi-sign] round fetch error", roundErr);
      return NextResponse.json(
        { error: "ROUND_FETCH_FAILED", message: "Errore lettura round." },
        { status: 500 }
      );
    }

    if (!activeRound) {
      return NextResponse.json(
        { error: "ROUND_CLOSED", message: "Il round è chiuso: non è più possibile firmare." },
        { status: 409 }
      );
    }

    const { data, error } = await supabase.rpc("portal_sign_master_loi", {
      p_company_id: companyId,
      p_full_name: fullName,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: 400 }
      );
    }

    const payload =
      data && typeof data === "object" && !Array.isArray(data)
        ? data
        : { data };

    let receiptMeta: ReceiptMeta | null = null;
    try {
      receiptMeta = await persistLoiReceipt({
        companyId,
        fullName,
        userId: authData.user.id,
        userEmail: authData.user.email ?? null,
        rpcPayload: payload,
        supabaseAuth: supabase,
      });
    } catch (receiptErr) {
      console.error("[loi-sign][receipt]", receiptErr);
    }

    // Redirect post firma: welcome al primo accesso, dashboard ai successivi
    let redirectTo = "/investor/dashboard";
    if (supabaseServer) {
      const { data: profile } = await supabaseServer
        .from("profiles")
        .select("first_investor_login_at")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (!profile?.first_investor_login_at) {
        await supabaseServer
          .from("profiles")
          .update({ first_investor_login_at: new Date().toISOString() })
          .eq("id", authData.user.id);
        redirectTo = "/investor/welcome";
      }
    }

    return NextResponse.json(
      {
        ok: true,
        redirectTo,
        ...payload,
        ...(receiptMeta ?? {}),
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
