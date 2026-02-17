import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createHash, randomBytes } from "crypto";

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

  let body: { email?: string; company_id?: string };
  try {
    body = await request.json();
  } catch {
    return err("Body JSON non valido", 400);
  }

  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  const companyId = typeof body.company_id === "string" ? body.company_id.trim() : null;

  if (!emailRaw || emailRaw.length < 3) {
    return err("Email richiesta e valida", 400);
  }

  if (!companyId) {
    return err("company_id è richiesto (company attiva)", 400);
  }

  const email = emailRaw.toLowerCase();

  const { data: membership } = await supabase
    .from("fundops_company_users")
    .select("id")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    return err("Non sei membro di questa company", 403);
  }

  const { data: loiMaster } = await supabase
    .from("fundops_lois")
    .select("id, updated_at")
    .eq("company_id", companyId)
    .eq("is_master", true)
    .eq("status", "sent")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!loiMaster) {
    return new Response(
      JSON.stringify({
        error:
          "LOI master non pubblicata: imposta LOI master e metti status=sent prima di invitare investitori.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: company } = await supabase
    .from("fundops_companies")
    .select("id, name, public_slug")
    .eq("id", companyId)
    .single();

  if (!company) {
    return err("Company non trovata", 404);
  }

  const companySlug = company.public_slug || company.id;

  let investorId: string;

  const { data: existingInvestor } = await supabase
    .from("fundops_investors")
    .select("id")
    .ilike("email", email)
    .or(`company_id.eq.${companyId},client_company_id.eq.${companyId}`)
    .limit(1)
    .maybeSingle();

  if (existingInvestor) {
    investorId = existingInvestor.id;
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("fundops_investors")
      .insert({
        email,
        full_name: "",
        company_id: companyId,
        client_company_id: companyId,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[invites/create] insert investor:", insertErr);
      return err("Errore creazione investitore", 500);
    }
    investorId = inserted!.id;
  }

  const { data: existingAccount } = await supabase
    .from("fundops_investor_accounts")
    .select("id, lifecycle_stage")
    .eq("investor_id", investorId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!existingAccount) {
    const { error: accErr } = await supabase.from("fundops_investor_accounts").insert({
      investor_id: investorId,
      company_id: companyId,
      lifecycle_stage: "lead",
      source: "link",
      registered_at: new Date().toISOString(),
      is_active: true,
    });
    if (accErr) {
      console.error("[invites/create] insert investor_account:", accErr);
      return err("Errore creazione account investitore", 500);
    }
  } else {
    await supabase
      .from("fundops_investor_accounts")
      .update({ source: "link", updated_at: new Date().toISOString() })
      .eq("investor_id", investorId)
      .eq("company_id", companyId);
  }

  let signerId: string | null = null;
  const { data: insertedSigner, error: signerInsertErr } = await supabase
    .from("fundops_loi_signers")
    .insert({ loi_id: loiMaster.id, investor_id: investorId, status: "invited" })
    .select("id")
    .maybeSingle();

  if (insertedSigner) {
    signerId = insertedSigner.id;
  } else if (signerInsertErr?.code === "23505") {
    const { data: existingSigner } = await supabase
      .from("fundops_loi_signers")
      .select("id")
      .eq("loi_id", loiMaster.id)
      .eq("investor_id", investorId)
      .maybeSingle();
    signerId = existingSigner?.id ?? null;
  }

  if (signerId) {
    await supabase.from("fundops_loi_signer_events").insert({
      signer_id: signerId,
      event_type: "invited",
      event_data: { source: "invite_link" },
      created_by: user.id,
    });
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { error: inviteErr } = await supabase.from("fundops_invites").insert({
    email,
    role: "investor",
    company_id: companyId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    created_by: user.id,
  });

  if (inviteErr) {
    console.error("[invites/create] insert invite:", inviteErr);
    return err("Errore creazione invito", 500);
  }

  const invite_url = `/signup?token=${encodeURIComponent(rawToken)}&redirect=${encodeURIComponent(`/portal/${companySlug}`)}`;

  return new Response(
    JSON.stringify({
      success: true,
      invite_url,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
