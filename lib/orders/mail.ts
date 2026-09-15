import type { EmailEvent } from "../../db/schema";
import { orderDatabase, orderEnvironment } from "./runtime";
import { emailPayload, type MailPayload } from "./templates";
import { getOrder, getItems, getEvents } from "./repository";

// Database lease + durable payload + provider key. Resend retains keys for 24h.
// An uncertain result outside that window requires reconciliation, never a blind resend.
export async function sendEvent(eventId: string): Promise<void> {
  const db = orderDatabase(), now = new Date().toISOString(), lease = crypto.randomUUID();
  const claimed = await db.prepare(`UPDATE order_email_events SET status='sending', lease_id=?, lease_until=?, attempts=attempts+1, last_attempt_at=?
    WHERE id=? AND (status IN ('pending','failed') OR (status='sending' AND lease_until < ?)) RETURNING *`)
    .bind(lease, new Date(Date.now() + 60000).toISOString(), now, eventId, now).first<EmailEvent>();
  if (!claimed) return;
  let outcome = "failed", code: string | null = null, providerId: string | null = null;
  try {
    if (claimed.first_attempt_at && Date.now() - Date.parse(claimed.first_attempt_at) > 23 * 3600000) {
      outcome = "manual_review";
      throw new Error("DELIVERY_UNCERTAIN_CHECK_RESEND");
    }
    const env = orderEnvironment();
    if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY_MISSING");
    let payload: MailPayload;
    if (claimed.payload_json) payload = JSON.parse(claimed.payload_json) as MailPayload;
    else {
      const order = await getOrder(claimed.order_id);
      payload = emailPayload(claimed, order, await getItems(order.id));
      await db.prepare("UPDATE order_email_events SET payload_json=? WHERE id=? AND lease_id=?").bind(JSON.stringify(payload), eventId, lease).run();
    }
    // Record before the network call: a crash cannot turn a possibly sent mail into a new send.
    await db.prepare("UPDATE order_email_events SET first_attempt_at=COALESCE(first_attempt_at,?) WHERE id=? AND lease_id=?").bind(now, eventId, lease).run();
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": claimed.dedupe_key },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      code = `PROVIDER_HTTP_${response.status}`;
      // An explicit rejection (except ambiguous timeouts/conflicts) cannot have sent a mail.
      if (response.status >= 400 && response.status < 500 && ![408, 409].includes(response.status)) {
        await db.prepare("UPDATE order_email_events SET first_attempt_at=NULL WHERE id=? AND lease_id=?").bind(eventId, lease).run();
      }
      throw new Error(code);
    }
    const result = await response.json() as { id?: string };
    if (!result.id) throw new Error("PROVIDER_INVALID_RESPONSE");
    providerId = result.id; outcome = "sent";
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    code ??= /^[A-Z_]+(?:_\d+)?$/.test(message) ? message : "PROVIDER_UNCERTAIN";
  }
  await db.batch([
    db.prepare(`UPDATE order_email_events SET status=?, error_code=?, provider_id=COALESCE(?,provider_id), sent_at=?, lease_id=NULL, lease_until=NULL WHERE id=? AND lease_id=?`)
      .bind(outcome, code, providerId, outcome === "sent" ? now : null, eventId, lease),
    db.prepare("INSERT INTO order_email_attempts (id,event_id,outcome,error_code,created_at) VALUES (?,?,?,?,?)")
      .bind(crypto.randomUUID(), eventId, outcome, code, now),
  ]);
}
export async function sendOrderEmails(orderId: string) {
  const events = await getEvents(orderId);
  // Sequential requests respect the provider's default low rate limit.
  for (const event of events) {
    if (["pending", "failed", "sending"].includes(event.status)) await sendEvent(event.id);
  }
}
