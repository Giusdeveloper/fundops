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

const ALLOWED_ROLES = new Set(["imment_admin", "imment_operator", "founder"]);
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
    if (recipients.length === 0 || recipients.some((email) => !email.includes("@"))) {
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
    const emailSubject = subject || `Firma la LOI – ${companyLabel}`;
    const safeMessage = message ? `<p>${escapeHtml(message)}</p>` : "";

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5;">
        <h2 style="margin:0 0 12px;">Firma la LOI</h2>
        <p style="margin:0 0 12px;">Company: <strong>${escapeHtml(companyLabel)}</strong></p>
        ${safeMessage}
        <p style="margin:20px 0;">
          <a href="${portalUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;">
            Firma la LOI
          </a>
        </p>
        <p style="margin:12px 0 0;color:#6b7280;font-size:14px;">
          Se hai già firmato, puoi ignorare questa email.
        </p>
      </div>
    `.trim();

    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    const fromEmail = process.env.RESEND_FROM?.trim() || DEFAULT_RESEND_FROM;
    if (!resendApiKey) {
      return json(500, { error: "Missing RESEND_API_KEY" });
    }

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
