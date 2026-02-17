import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  fetchCompanyBySlug,
  getLoiActiveSentForCompany,
} from "@/lib/portalHelpers";
import { generateLoiReceiptPdf } from "@/lib/loiReceiptPdf";

const BUCKET = "fundops-documents";

function err(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: NextRequest) {
  const supabase = supabaseServer;
  const supabaseAuth = await createClient();

  if (!supabase) {
    return err("Configurazione server mancante", 500);
  }

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user?.id) {
    return err("Non autenticato", 401);
  }

  let body: { slug?: string; signed_name?: string };
  try {
    body = await request.json();
  } catch {
    return err("Body JSON non valido", 400);
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : null;
  const signedName = typeof body.signed_name === "string" ? body.signed_name.trim() : "";

  if (!slug) {
    return err("slug è richiesto", 400);
  }

  if (!signedName || signedName.length < 2) {
    return err("Nome completo richiesto (minimo 2 caratteri)", 400);
  }

  const company = await fetchCompanyBySlug(supabase, slug);
  if (!company) {
    return err("Company non trovata", 404);
  }

  const { data: iu } = await supabaseAuth
    .from("fundops_investor_users")
    .select("investor_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const investorId = iu?.investor_id ?? null;

  if (!investorId) {
    return err("Account investitore non trovato. Accedi al portal e riprova.", 403);
  }

  const loi = await getLoiActiveSentForCompany(supabase, company.id);
  if (!loi) {
    return err("Campagna non configurata (LOI master non pubblicata con status=sent)", 404);
  }

  const { data: account, error: fetchErr } = await supabase
    .from("fundops_investor_accounts")
    .select("id, lifecycle_stage")
    .eq("investor_id", investorId)
    .eq("company_id", company.id)
    .maybeSingle();

  if (fetchErr) {
    console.error("[portal/loi-sign] fetch account:", fetchErr);
    return err("Errore durante la verifica dello stato", 500);
  }

  if (!account) {
    return err("Account investitore non trovato per questa company", 404);
  }

  if (account.lifecycle_stage === "loi_signed") {
    return err("LOI già firmata", 409);
  }

  if (!["registered", "active"].includes(account.lifecycle_stage ?? "")) {
    return err(`Transizione non consentita da stato: ${account.lifecycle_stage}`, 403);
  }

  const signedAt = new Date().toISOString();
  const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null;
  const userAgent = request.headers.get("user-agent") ?? null;

  const { data: existingSigner } = await supabase
    .from("fundops_loi_signers")
    .select("id")
    .eq("loi_id", loi.id)
    .eq("investor_id", investorId)
    .maybeSingle();

  let signerId: string;

  if (existingSigner) {
    const { data: updated, error: upsertErr } = await supabase
      .from("fundops_loi_signers")
      .update({
        status: "signed",
        soft_commitment_at: signedAt,
        updated_at: signedAt,
      })
      .eq("id", existingSigner.id)
      .select("id")
      .single();

    if (upsertErr) {
      console.error("[portal/loi-sign] update signer:", upsertErr);
      return err("Errore durante la firma", 500);
    }
    signerId = updated!.id;
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("fundops_loi_signers")
      .insert({
        loi_id: loi.id,
        investor_id: investorId,
        status: "invited",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[portal/loi-sign] insert signer:", insertErr);
      return err("Errore durante la firma", 500);
    }
    signerId = inserted!.id;

    const { error: updateErr } = await supabase
      .from("fundops_loi_signers")
      .update({
        status: "signed",
        soft_commitment_at: signedAt,
        updated_at: signedAt,
      })
      .eq("id", signerId);

    if (updateErr) {
      console.error("[portal/loi-sign] update new signer:", updateErr);
      return err("Errore durante la firma", 500);
    }
  }

  await supabase.from("fundops_loi_signer_events").insert({
    signer_id: signerId,
    event_type: "signed",
    event_data: {
      full_name: signedName,
      ip: ip ?? undefined,
      user_agent: userAgent ?? undefined,
      company_id: company.id,
      loi_id: loi.id,
      signed_at: signedAt,
    },
  });

  const { error: updateErr } = await supabase
    .from("fundops_investor_accounts")
    .update({
      lifecycle_stage: "loi_signed",
      loi_signed_at: signedAt,
      loi_signed_name: signedName,
      updated_at: signedAt,
    })
    .eq("id", account.id);

  if (updateErr) {
    console.error("[portal/loi-sign] update account:", updateErr);
    return err(
      updateErr.message.includes("lifecycle")
        ? "Transizione non consentita dal sistema"
        : "Errore durante la firma",
      500
    );
  }

  // Crea documento ricevuta firma per download sicuro
  try {
    const { data: investor } = await supabase
      .from("fundops_investors")
      .select("email")
      .eq("id", investorId)
      .single();

    const companySlug = company.public_slug || company.id;
    const pdfBytes = await generateLoiReceiptPdf({
      companyName: company.name ?? "—",
      legalName: company.legal_name ?? company.name ?? "—",
      signedName,
      investorEmail: investor?.email ?? user.email ?? "—",
      signedAt: new Date(signedAt).toLocaleString("it-IT", {
        dateStyle: "long",
        timeStyle: "short",
      }),
    });

    const filePath = `portal/${company.id}/investors/${investorId}/loi_receipt/LOI-Ricevuta-${companySlug}.pdf`;

    const { error: uploadErr } = await supabaseServer!.storage
      .from(BUCKET)
      .upload(filePath, Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: true,
      });

    if (!uploadErr) {
      await supabase.from("fundops_documents").insert({
        company_id: company.id,
        loi_id: loi.id,
        investor_id: investorId,
        type: "loi_receipt",
        title: "Ricevuta firma LOI",
        file_path: filePath,
        mime_type: "application/pdf",
        size_bytes: pdfBytes.length,
        version: 1,
        status: "active",
        created_by: user.id,
      });
    }
  } catch (receiptErr) {
    console.warn("[portal/loi-sign] receipt document creation failed:", receiptErr);
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "LOI firmata con successo",
      signed_at: signedAt,
      signer_id: signerId,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
