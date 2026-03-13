type FundopsEventPayload = {
  event: string;
  companyId?: string | null;
  roundId?: string | null;
  userId?: string | null;
  actorRole?: string | null;
  timestamp?: string;
  data?: Record<string, unknown>;
};

const WEBHOOK_TIMEOUT_MS = 4000;

export async function publishFundopsEvent(payload: FundopsEventPayload): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const webhookSecret = process.env.N8N_WEBHOOK_SECRET?.trim();
    if (webhookSecret) {
      headers["X-Fundops-Webhook-Secret"] = webhookSecret;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        event: payload.event,
        companyId: payload.companyId ?? null,
        roundId: payload.roundId ?? null,
        userId: payload.userId ?? null,
        actorRole: payload.actorRole ?? null,
        timestamp: payload.timestamp ?? new Date().toISOString(),
        data: payload.data ?? {},
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn("[fundops-event] webhook failed", response.status, text);
    }
  } catch (error) {
    console.warn("[fundops-event] webhook error", error);
  } finally {
    clearTimeout(timeout);
  }
}
