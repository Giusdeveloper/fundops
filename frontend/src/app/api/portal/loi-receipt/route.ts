import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { fetchCompanyBySlug } from "@/lib/portalHelpers";
import { generateLoiReceiptPdf } from "@/lib/loiReceiptPdf";

function err(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(request: NextRequest) {
  const supabase = supabaseServer;
  const supabaseAuth = await createSupabaseServerClient();

  if (!supabase) {
    return err("Configurazione server mancante", 500);
  }

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user?.id) {
    return err("Non autenticato", 401);
  }

  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  const loiId = request.nextUrl.searchParams.get("loi_id")?.trim();

  if (!slug && !loiId) {
    return err("slug o loi_id è richiesto", 400);
  }

  let company: { id: string; name: string; legal_name: string; public_slug: string | null } | null;
  let investorId: string | null;
  let signedName: string;
  let signedAt: string;
  let loiIdResolved: string;

  if (loiId) {
    const { data: loi } = await supabase
      .from("fundops_lois")
      .select("id, company_id")
      .eq("id", loiId)
      .maybeSingle();
    if (!loi) return err("LOI non trovata", 404);

    const { data: companyRow } = await supabase
      .from("fundops_companies")
      .select("id, name, legal_name, public_slug")
      .eq("id", loi.company_id)
      .maybeSingle();
    if (!companyRow) return err("Company non trovata", 404);
    company = companyRow;

    const { data: iu } = await supabaseAuth
      .from("fundops_investor_users")
      .select("investor_id")
      .eq("user_id", user.id)
      .maybeSingle();
    investorId = iu?.investor_id ?? null;
    if (!investorId) return err("Account investitore non trovato", 403);

    const { data: signer } = await supabase
      .from("fundops_loi_signers")
      .select("id, soft_commitment_at")
      .eq("loi_id", loiId)
      .eq("investor_id", investorId)
      .maybeSingle();
    if (!signer || !signer.soft_commitment_at) {
      return err("LOI non ancora firmata", 403);
    }

    const { data: acct } = await supabase
      .from("fundops_investor_accounts")
      .select("loi_signed_name")
      .eq("investor_id", investorId)
      .eq("company_id", company.id)
      .maybeSingle();
    signedName = acct?.loi_signed_name ?? "—";
    signedAt = new Date(signer.soft_commitment_at).toLocaleString("it-IT", {
      dateStyle: "long",
      timeStyle: "short",
    });
    loiIdResolved = loiId;
  } else {
    company = await fetchCompanyBySlug(supabase, slug!);
    if (!company) return err("Company non trovata", 404);

    const { data: iu } = await supabaseAuth
      .from("fundops_investor_users")
      .select("investor_id")
      .eq("user_id", user.id)
      .maybeSingle();
    investorId = iu?.investor_id ?? null;
    if (!investorId) return err("Account investitore non trovato", 403);

    const { data: account } = await supabase
      .from("fundops_investor_accounts")
      .select("lifecycle_stage, loi_signed_at, loi_signed_name")
      .eq("investor_id", investorId)
      .eq("company_id", company.id)
      .maybeSingle();
    if (!account || account.lifecycle_stage !== "loi_signed" || !account.loi_signed_at) {
      return err("LOI non ancora firmata", 403);
    }

    signedName = account.loi_signed_name ?? "—";
    signedAt = new Date(account.loi_signed_at).toLocaleString("it-IT", {
      dateStyle: "long",
      timeStyle: "short",
    });
    const { data: loiRow } = await supabase
      .from("fundops_lois")
      .select("id")
      .eq("company_id", company.id)
      .eq("status", "sent")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    loiIdResolved = loiRow?.id ?? "";
  }

  const { data: investor } = await supabase
    .from("fundops_investors")
    .select("email")
    .eq("id", investorId)
    .maybeSingle();

  const investorEmail = investor?.email ?? user.email ?? "—";
  const companyName = company.name ?? "—";
  const legalName = company.legal_name ?? company.name ?? "—";

  const pdfBytes = await generateLoiReceiptPdf({
    companyName,
    legalName,
    signedName,
    investorEmail,
    signedAt,
    loiId: loiIdResolved,
  });
  const slugForFilename = company.public_slug ?? company.id;
  const filename = `LOI-Ricevuta-${slugForFilename}.pdf`;

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
