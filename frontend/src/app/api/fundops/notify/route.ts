import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/sendEmail";

type NotifyBody = {
  type?: string;
  companyId?: string;
  roundId?: string;
  data?: {
    phase?: string;
    title?: string;
    mimeType?: string;
    sizeBytes?: number;
  };
};

const ADMIN_EMAIL = "admin@imment.it";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.INTERNAL_API_SECRET?.trim();
  const providedSecret = request.headers.get("x-internal-secret")?.trim();

  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return json(401, { error: "Unauthorized" });
  }

  let body: NotifyBody;
  try {
    body = (await request.json()) as NotifyBody;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  if (body.type === "round_document_uploaded") {
    const text = [
      "New document uploaded in FundOps",
      "",
      `Company ID: ${body.companyId ?? ""}`,
      `Round ID: ${body.roundId ?? ""}`,
      `Phase: ${body.data?.phase ?? ""}`,
      `Title: ${body.data?.title ?? ""}`,
      `MIME Type: ${body.data?.mimeType ?? ""}`,
      `Size: ${body.data?.sizeBytes ?? ""}`,
    ].join("\n");

    const result = await sendEmail({
      to: ADMIN_EMAIL,
      subject: "FundOps | Documento caricato nel Dossier",
      text,
    });

    if (!result.ok) {
      console.error("[fundops/notify] email failed", result.error);
    }
  } else {
    console.warn("[fundops/notify] unsupported type", body.type);
  }

  return json(200, { ok: true });
}
