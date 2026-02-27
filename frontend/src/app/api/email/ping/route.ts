import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      from: process.env.RESEND_FROM ?? null,
      hasApiKey: Boolean(process.env.RESEND_API_KEY),
      nodeEnv: process.env.NODE_ENV,
    },
    { status: 200 }
  );
}

