import { Resend } from "resend";

type SendEmailArgs = {
  to: string | string[];
  subject: string;
  text: string;
  from?: string;
  replyTo?: string;
};

type SendEmailResult = {
  ok: boolean;
  error?: unknown;
};

const DEFAULT_RESEND_FROM = "onboarding@resend.dev";

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "Missing RESEND_API_KEY" };
  }

  const resend = new Resend(apiKey);
  const fromEmail =
    args.from?.trim() || process.env.RESEND_FROM?.trim() || DEFAULT_RESEND_FROM;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: args.to,
      subject: args.subject,
      text: args.text,
      ...(args.replyTo ? { reply_to: args.replyTo } : {}),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
