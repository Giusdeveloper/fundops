import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type SendLoiBody = {
  companyId?: string;
  companySlug?: string;
  to?: string[];
  subject?: string;
  message?: string;
  redirect?: string;
};

type CompanyRow = {
  public_slug: string | null;
  name: string | null;
  legal_name: string | null;
};

type RoundState = {
  booking_open: boolean | null;
  issuance_open: boolean | null;
};

const ALLOWED_ROLES = new Set(["imment_admin", "imment_operator", "founder"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_RESEND_FROM = "onboarding@resend.dev";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function isValidRelativePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function withSourceParam(urlString: string): string {
  const url = new URL(urlString);
  url.searchParams.set("source", "loi_email");
  return url.toString();
}

function getTemplateVariant(round: RoundState | null): {
  title: string;
  intro: string;
  cta: string;
  phaseLabel: string;
  whyItems: string[];
  afterItems: string[];
  subjectPrefix: string;
} {
  if (round?.issuance_open) {
    return {
      title: "Completa il tuo investimento",
      intro: "La fase Issuance è attiva: puoi completare importo, privacy e documenti dal portale.",
      cta: "Completa investimento",
      phaseLabel: "Issuance",
      whyItems: [
        "formalizzi la partecipazione al round",
        "carichi i documenti richiesti in modo tracciato",
        "consenti al team di procedere con la verifica",
      ],
      afterItems: [
        "ricevi aggiornamenti sullo stato della revisione",
        "resti allineato su prossimi step e scadenze",
      ],
      subjectPrefix: "Completa investimento",
    };
  }

  if (round?.booking_open ?? true) {
    return {
      title: "Firma la LOI per completare la prenotazione",
      intro: "Manca solo un passaggio per completare la tua prenotazione: la firma della LOI (Lettera di Intenti).",
      cta: "Firma ora la LOI",
      phaseLabel: "Booking",
      whyItems: [
        "conferma formalmente il tuo interesse",
        "abilita l'accesso alla fase successiva (Issuance) quando sarà attiva",
        "ti permette di monitorare documenti e stato dell'operazione",
      ],
      afterItems: [
        "rendiamo disponibile l'attestazione",
        "ricevi aggiornamenti sui prossimi step e sulle scadenze del round",
      ],
      subjectPrefix: "Firma la LOI",
    };
  }

  return {
    title: "Accedi al portale FundOps",
    intro: "Accedi al portale per verificare lo stato della campagna e i prossimi passaggi disponibili.",
    cta: "Apri il portale",
    phaseLabel: "Aggiornamenti campagna",
    whyItems: [
      "hai una vista aggiornata sullo stato del round",
      "puoi consultare documenti e prossime attività",
    ],
    afterItems: ["ricevi notifiche quando si apre una nuova fase operativa"],
    subjectPrefix: "Accedi al portale",
  };
}

function buildLoiInviteHtml(params: {
  companyLabel: string;
  portalUrl: string;
  message?: string;
  supportContact: string;
  privacyUrl: string;
  roundState: RoundState | null;
}) {
  const variant = getTemplateVariant(params.roundState);
  const safeMessage = params.message ? `<p style="margin:0 0 10px;font-size:15px;line-height:24px;">${escapeHtml(params.message)}</p>` : "";
  const whyList = variant.whyItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const afterList = variant.afterItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `
    <div style="margin:0;padding:0;background:#f3f4f6;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:28px 24px 12px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                  <p style="margin:0 0 12px;font-size:16px;line-height:24px;">Ciao,</p>
                  <p style="margin:0 0 10px;">
                    <span style="display:inline-block;background:#eef2ff;color:#312e81;border:1px solid #c7d2fe;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;">
                      Fase: ${escapeHtml(variant.phaseLabel)}
                    </span>
                  </p>
                  <h1 style="margin:0 0 12px;font-size:24px;line-height:30px;">${escapeHtml(variant.title)}</h1>
                  <p style="margin:0 0 10px;font-size:15px;line-height:24px;">
                    Su <strong>${escapeHtml(params.companyLabel)}</strong>: ${escapeHtml(variant.intro)}
                  </p>
                  ${safeMessage}
                </td>
              </tr>
              <tr>
                <td style="padding:8px 24px 4px 24px;">
                  <a href="${params.portalUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;">
                    ${escapeHtml(variant.cta)}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                  <p style="margin:0 0 6px;font-size:14px;line-height:22px;">
                    Se il bottone non funziona, copia e incolla questo link nel browser:
                  </p>
                  <p style="margin:0 0 14px;font-size:14px;line-height:22px;word-break:break-all;">
                    <a href="${params.portalUrl}" style="color:#0f172a;">${params.portalUrl}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 24px 2px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                  <p style="margin:0 0 6px;font-size:14px;font-weight:700;">Perché è importante</p>
                  <ul style="margin:0 0 12px 18px;padding:0;font-size:14px;line-height:22px;">
                    ${whyList}
                  </ul>
                  <p style="margin:0 0 6px;font-size:14px;font-weight:700;">Dopo questo passaggio</p>
                  <ul style="margin:0 0 12px 18px;padding:0;font-size:14px;line-height:22px;">
                    ${afterList}
                  </ul>
                </td>
              </tr>
              <tr>
                <td style="padding:0 24px 14px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                  <p style="margin:0 0 10px;font-size:14px;line-height:22px;">
                    Per supporto: <a href="mailto:${escapeHtml(params.supportContact)}" style="color:#0f172a;">${escapeHtml(params.supportContact)}</a>
                  </p>
                  <p style="margin:0;font-size:14px;line-height:22px;">
                    Grazie,<br/>Il team FundOps
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 24px 20px 24px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;color:#6b7280;">
                  <p style="margin:0 0 6px;font-size:12px;line-height:18px;font-weight:700;">Privacy</p>
                  <p style="margin:0;font-size:12px;line-height:18px;">
                    Trattiamo i tuoi dati per gestire il processo di investimento e la documentazione.
                    <a href="${params.privacyUrl}" style="color:#374151;">Dettagli completi</a>.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `.trim();
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return json(401, { error: "Unauthorized" });
    }

    const userId = session.user.id;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role_global, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return json(500, { error: "Profile read failed", detail: profileError.message, code: profileError.code });
    }

    const roleGlobal = profile?.role_global ?? null;
    const isActive = profile?.is_active === true;
    if (!isActive || !ALLOWED_ROLES.has(roleGlobal)) {
      return json(403, { error: "Forbidden" });
    }

    const body = (await request.json().catch(() => null)) as SendLoiBody | null;
    const companyId = body?.companyId?.trim() ?? "";
    const to = Array.isArray(body?.to) ? body.to : [];
    const subject = body?.subject?.trim() ?? "";
    const message = body?.message?.trim() ?? "";
    const redirect = body?.redirect?.trim() ?? "";

    if (!UUID_RE.test(companyId)) {
      return json(400, { error: "Invalid companyId" });
    }
    if (to.length === 0 || to.length > 50) {
      return json(400, { error: "Invalid recipients list" });
    }

    const recipients = to
      .map((email) => email.trim())
      .filter((email) => email.length > 0);
    if (recipients.length === 0 || recipients.some((email) => !EMAIL_RE.test(email))) {
      return json(400, { error: "Invalid recipient email" });
    }

    const { data: company, error: companyError } = await supabase
      .from("fundops_companies")
      .select("public_slug, name, legal_name")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      return json(500, {
        error: "Company read failed",
        detail: companyError.message,
        code: companyError.code,
      });
    }
    if (!company) {
      return json(404, { error: "Company not found" });
    }

    const companyRow = company as CompanyRow;
    const slug = body?.companySlug?.trim() || companyRow.public_slug || "";
    if (!slug) {
      return json(400, { error: "Company slug not available" });
    }

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin;
    const fallbackPath = `/portal/${slug}`;
    const rawPath = redirect && isValidRelativePath(redirect) ? redirect : fallbackPath;
    const portalUrl = withSourceParam(new URL(rawPath, appBaseUrl).toString());

    const companyLabel = companyRow.name || companyRow.legal_name || "FundOps";
    const { data: round } = await supabase
      .from("fundops_rounds")
      .select("booking_open, issuance_open")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const roundState: RoundState | null = round
      ? { booking_open: round.booking_open ?? null, issuance_open: round.issuance_open ?? null }
      : null;
    const variant = getTemplateVariant(roundState);
    const emailSubject = subject || `${variant.subjectPrefix} – ${companyLabel}`;
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    const fromEmail = process.env.RESEND_FROM?.trim() || DEFAULT_RESEND_FROM;
    if (!resendApiKey) {
      return json(500, { error: "Missing RESEND_API_KEY" });
    }
    const supportContact = process.env.SUPPORT_CONTACT?.trim() || fromEmail;
    const privacyUrl = process.env.PRIVACY_URL?.trim() || new URL("/privacy", appBaseUrl).toString();
    const html = buildLoiInviteHtml({
      companyLabel,
      portalUrl,
      message,
      supportContact,
      privacyUrl,
      roundState,
    });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipients,
        subject: emailSubject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const resendBody = await resendResponse.text().catch(() => "");
      console.error("[lois/send] resend failed", {
        status: resendResponse.status,
        body: resendBody,
        companyId,
        recipientsCount: recipients.length,
      });
      return json(502, { error: "Email provider error", detail: resendBody || "Resend request failed" });
    }

    return json(200, { ok: true, sentCount: recipients.length, portalUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json(500, { error: message });
  }
}
