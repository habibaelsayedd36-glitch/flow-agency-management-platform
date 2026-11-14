type EmailInput = { to: string; subject: string; html: string };

export function isEmailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.FLOW_EMAIL_FROM);
}

export async function sendFlowEmail(input: EmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FLOW_EMAIL_FROM;
  if (!apiKey || !from) return { delivered: false as const, reason: "not_configured" as const };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("FLOW email provider rejected a message", response.status);
    return { delivered: false as const, reason: "provider_error" as const };
  }
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("id" in result)) {
    return { delivered: false as const, reason: "provider_error" as const };
  }
  return { delivered: true as const, providerId: String(result.id) };
}

export function safeEmailText(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character] ?? character;
  });
}
