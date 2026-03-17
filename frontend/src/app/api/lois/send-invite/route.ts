import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type SendInviteBody = {
  companyId?: string;
  companySlug?: string;
  toEmail?: string;
  investorName?: string;
  loiId?: string;
};

type CompanyRow = {
  id: string;
  public_slug: string | null;
  name: string | null;
  legal_name: string | null;
};

type RoundState = {
  booking_open: boolean | null;
  issuance_open: boolean | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  investorName?: string;
  companyLabel: string;
  portalUrl: string;
  supportContact: string;
  privacyUrl: string;
  roundState: RoundState | null;
}) {
  const greeting = params.investorName
    ? `Ciao ${escapeHtml(params.investorName)},`
    : "Ciao,";
  const variant = getTemplateVariant(params.roundState);
  const whyList = variant.whyItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const afterList = variant.afterItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `
    <div style="margin:0;padding:0;background:#f3f4f6;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:28px 24px 12px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                  <p style="margin:0 0 12px;font-size:16px;line-height:24px;">${greeting}</p>
                  <p style="margin:0 0 10px;">
                    <span style="display:inline-block;background:#eef2ff;color:#312e81;border:1px solid #c7d2fe;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;">
                      Fase: ${escapeHtml(variant.phaseLabel)}
                    </span>
                  </p>
                  <h1 style="margin:0 0 12px;font-size:24px;line-height:30px;">${escapeHtml(variant.title)}</h1>
                  <p style="margin:0 0 10px;font-size:15px;line-height:24px;">
                    Su <strong>${escapeHtml(params.companyLabel)}</strong>: ${escapeHtml(variant.intro)}
                  </p>
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return json(401, { error: "Unauthorized" });
    }

    const body = (await request.json().catch(() => null)) as SendInviteBody | null;
    const companyId = body?.companyId?.trim() ?? "";
    const companySlugFromBody = body?.companySlug?.trim() ?? "";
    const toEmail = body?.toEmail?.trim() ?? "";
    const investorName = body?.investorName?.trim() ?? "";
    const loiId = body?.loiId?.trim() ?? "";

    if (!UUID_RE.test(companyId)) {
      return json(400, { error: "Invalid companyId" });
    }
    if (!toEmail || !EMAIL_RE.test(toEmail)) {
      return json(400, { error: "Invalid toEmail" });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role_global, is_active")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileError) {
      return json(500, { error: "Failed to load profile", detail: profileError.message, code: profileError.code });
    }
    if (profile?.is_active !== true) {
      return json(403, { error: "Forbidden" });
    }

    const isStaff =
      profile.role_global === "imment_admin" || profile.role_global === "imment_operator";

    let isCompanyAdmin = false;
    if (!isStaff) {
      const { data: seat, error: seatError } = await supabase
        .from("fundops_company_users")
        .select("id")
        .eq("company_id", companyId)
        .eq("user_id", session.user.id)
        .eq("role", "company_admin")
        .eq("is_active", true)
        .maybeSingle();

      if (seatError) {
        return json(500, {
          error: "Failed to check company role",
          detail: seatError.message,
          code: seatError.code,
        });
      }
      isCompanyAdmin = Boolean(seat);
    }

    if (!isStaff && !isCompanyAdmin) {
      return json(403, { error: "Forbidden" });
    }

    const { data: company, error: companyError } = await supabase
      .from("fundops_companies")
      .select("id, public_slug, name, legal_name")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      return json(500, {
        error: "Failed to load company",
        detail: companyError.message,
        code: companyError.code,
      });
    }
    if (!company) {
      return json(404, { error: "Company not found" });
    }

    const companyRow = company as CompanyRow;
    const resolvedSlug = companyRow.public_slug || companySlugFromBody;
    if (!resolvedSlug) {
      return json(400, { error: "companySlug is required" });
    }

    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    const resendFrom = process.env.RESEND_FROM?.trim();
    if (!resendApiKey || !resendFrom) {
      return json(500, { error: "Missing RESEND_API_KEY or RESEND_FROM" });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;
    const basePortalUrl = new URL(`/portal/${resolvedSlug}`, baseUrl);
    if (loiId) {
      basePortalUrl.searchParams.set("loi", loiId);
    }
    const portalPathWithQuery = `${basePortalUrl.pathname}${basePortalUrl.search}`;
    const safePortalPath = isValidRelativePath(portalPathWithQuery)
      ? portalPathWithQuery
      : `/portal/${resolvedSlug}`;
    const portalUrl = new URL(safePortalPath, baseUrl).toString();
    const companyLabel = companyRow.name || companyRow.legal_name || resolvedSlug;
    const supportContact = process.env.SUPPORT_CONTACT?.trim() || resendFrom;
    const privacyUrl = process.env.PRIVACY_URL?.trim() || new URL("/privacy", baseUrl).toString();
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
    const html = buildLoiInviteHtml({
      investorName,
      companyLabel,
      portalUrl,
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
        from: resendFrom,
        to: [toEmail],
        subject: `${variant.subjectPrefix} — ${companyLabel}`,
        html,
      }),
    });

    const resendPayload = await resendResponse.json().catch(() => null);
    if (!resendResponse.ok) {
      return json(resendResponse.status, {
        error: "Resend error",
        detail: resendPayload,
      });
    }

    return json(200, {
      ok: true,
      portalUrl,
      resendId:
        resendPayload && typeof resendPayload === "object" && "id" in resendPayload
          ? (resendPayload as { id?: string }).id ?? null
          : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json(500, { error: message });
  }
}
