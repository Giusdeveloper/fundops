import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type SendInviteBody = {
  companyId?: string;
  companySlug?: string;
  toEmail?: string;
  investorName?: string;
  loiId?: string;
};

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
    const companySlug = body?.companySlug?.trim() ?? "";
    const toEmail = body?.toEmail?.trim() ?? "";
    const investorName = body?.investorName?.trim() ?? "";
    const loiId = body?.loiId?.trim() ?? "";

    if (!UUID_RE.test(companyId)) {
      return json(400, { error: "Invalid companyId" });
    }
    if (!companySlug) {
      return json(400, { error: "companySlug is required" });
    }
    if (!toEmail || !toEmail.includes("@")) {
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

    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    const resendFrom = process.env.RESEND_FROM?.trim();
    if (!resendApiKey || !resendFrom) {
      return json(500, { error: "Missing RESEND_API_KEY or RESEND_FROM" });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;
    const basePortalUrl = new URL(`/portal/${companySlug}`, baseUrl);
    if (loiId) {
      basePortalUrl.searchParams.set("loi", loiId);
    }
    const portalPathWithQuery = `${basePortalUrl.pathname}${basePortalUrl.search}`;
    const safePortalPath = isValidRelativePath(portalPathWithQuery)
      ? portalPathWithQuery
      : `/portal/${companySlug}`;
    const portalUrl = new URL(safePortalPath, baseUrl).toString();

    const greeting = investorName ? `Ciao ${escapeHtml(investorName)},` : "Ciao,";
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5;">
        <p style="margin:0 0 12px;">${greeting}</p>
        <h2 style="margin:0 0 12px;">Hai una LOI da firmare</h2>
        <p style="margin:0 0 16px;">
          Accedi al portale per visualizzare e firmare la LOI.
        </p>
        <p style="margin:20px 0;">
          <a href="${portalUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;">
            Apri e firma
          </a>
        </p>
        <p style="margin:12px 0 0;color:#6b7280;font-size:14px;">
          Se non hai richiesto tu, ignora questa email.
        </p>
      </div>
    `.trim();

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [toEmail],
        subject: `Firma la LOI — ${companySlug}`,
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

