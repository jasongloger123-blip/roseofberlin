import type { Order, OrderItem, EmailEvent } from "../../db/schema";
import { money, statusLabels } from "./domain";
import { orderEnvironment, publicBaseUrl } from "./runtime";

export interface PaymentDetails { accountName: string; iban: string; bic: string; paypal: string }
export function paymentDetails(): PaymentDetails {
  const env = orderEnvironment();
  const details = { accountName: env.BANK_ACCOUNT_NAME?.trim() ?? "", iban: env.BANK_IBAN?.replace(/\s/g, "") ?? "", bic: env.BANK_BIC?.trim() ?? "", paypal: env.PAYPAL_ADDRESS?.trim() ?? "" };
  if (!(details.accountName && details.iban && details.bic) && !details.paypal) throw new Error("PAYMENT_METHOD_MISSING");
  if ((details.accountName || details.iban || details.bic) && !(details.accountName && details.iban && details.bic)) throw new Error("BANK_DETAILS_INCOMPLETE");
  return details;
}
export const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function paymentPath(token: string) { return `/order/${token}/payment`; }
const style = `body{margin:0;background:#f6eeeb;color:#38251f;font:16px/1.6 Arial,Helvetica,sans-serif}.sheet{max-width:760px;margin:40px auto;background:#fff;padding:48px;box-sizing:border-box;border-top:5px solid #9b5a60}.brand{font:32px Georgia,serif;margin:0;color:#63373d}.kicker{font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#785d57}h1{font:30px Georgia,serif;margin:28px 0 12px}h2{font:22px Georgia,serif}p{overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;margin:28px 0}th,td{text-align:left;border-bottom:1px solid #e7d9d3;padding:12px 8px;vertical-align:top}th{font-size:13px}th:first-child,td:first-child{padding-left:0}.num{text-align:right;white-space:nowrap}.totals{margin-left:auto;max-width:340px}.totals p{display:flex;justify-content:space-between;align-items:baseline;margin:8px 0}.totals p span{min-width:0}.totals p strong{margin-left:auto;padding-left:36px;text-align:right;white-space:nowrap}.grand{font-size:22px;border-top:2px solid #9b5a60;padding-top:12px}.muted{color:#725d56;font-size:14px}.payment{background:#f8f1ef;padding:20px;margin:28px 0}.button{display:inline-block;background:#63373d;color:white!important;border:0;padding:14px 20px;text-decoration:none;font:16px Arial;cursor:pointer}.footer{border-top:1px solid #e7d9d3;margin-top:36px;padding-top:18px;font-size:13px;color:#725d56}.address{white-space:pre-line}.status{padding:10px 14px;background:#f8f1ef}.table-wrap{overflow-x:auto}@media(max-width:600px){.sheet{margin:0;padding:26px 18px}h1{font-size:26px}table{font-size:14px}th,td{padding:10px 4px}.num{white-space:normal}.totals p strong{padding-left:18px;white-space:normal;text-align:right}.grand{font-size:20px}}@media print{@page{size:A4;margin:15mm}body{background:white}.sheet{margin:0;padding:12px 0;max-width:none;border:0}.no-print{display:none!important}tr,.payment,.totals{break-inside:avoid}.table-wrap{overflow:visible}a{color:inherit!important;text-decoration:none}}`;
export function documentShell(title: string, content: string, language: string, nonce?: string) {
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${escapeHtml(title)} · Rose of Berlin</title><style>${style}</style></head><body><main class="sheet"><p class="brand">Rose of Berlin</p><p class="kicker">Handmade by Selesitina</p>${content}<div class="footer">Selesitina Gloger · Angerweg 15 · 31249 Hohenhameln · Germany<br>Rose of Berlin</div></main>${nonce ? `<script nonce="${nonce}">document.getElementById('print')?.addEventListener('click',()=>window.print())</script>` : ""}</body></html>`;
}
export function orderSummary(order: Order, items: OrderItem[], final: boolean): string {
  const de = order.language === "de";
  const e = escapeHtml;
  const address = [order.customer_name, order.address_line1, order.address_line2, `${order.postal_code} ${order.city}`, new Intl.DisplayNames([order.language], { type: "region" }).of(order.country)].filter(Boolean).join("\n");
  return `<p><strong>${e(order.order_number)}</strong><br>${new Date(order.created_at).toLocaleDateString(de ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin" })}</p><p class="address">${e(address)}</p><div class="table-wrap"><table><thead><tr><th>${de ? "Produkt / Größe" : "Product / Size"}</th><th class="num">${de ? "Menge" : "Qty"}</th><th class="num">${de ? "Einzelpreis" : "Unit price"}</th><th class="num">${de ? "Gesamt" : "Amount"}</th></tr></thead><tbody>${items.map(i => `<tr><td>${e(i.product_label)}<br><span class="muted">${e(i.size)}</span></td><td class="num">${i.quantity}</td><td class="num">${money(i.unit_price_cents, order.language)}</td><td class="num">${money(i.line_total_cents, order.language)}</td></tr>`).join("")}</tbody></table></div><div class="totals"><p><span>${de ? "Warenwert" : "Subtotal"}</span><strong>${money(order.subtotal_cents, order.language)}</strong></p><p><span>${de ? "Versand" : "Shipping"}</span><strong>${final && order.shipping_cents !== null ? money(order.shipping_cents, order.language) : de ? "Wird bestätigt" : "To be confirmed"}</strong></p>${final && order.total_cents !== null ? `<p class="grand"><span>${de ? "Gesamtbetrag" : "Total"}</span><strong>${money(order.total_cents, order.language)}</strong></p>` : ""}</div><p class="muted">${de ? "Preisbasis: EUR. Es wird keine Mehrwertsteuer berechnet." : "All amounts payable in EUR. No VAT is charged."}</p>`;
}
function bankBlock(order: Order) {
  if (!order.payment_snapshot) return "";
  const details = JSON.parse(order.payment_snapshot) as PaymentDetails;
  const de = order.language === "de", e = escapeHtml;
  return `<section class="payment"><h2>${de ? "Zahlungsmöglichkeiten" : "Payment options"}</h2>${details.iban ? `<p><strong>${de ? "Banküberweisung" : "Bank transfer"}</strong><br>${e(details.accountName)}<br>IBAN: ${e(details.iban)}<br>BIC: ${e(details.bic)}</p>` : ""}${details.paypal ? `<p><strong>PayPal</strong><br>${e(details.paypal)}</p>` : ""}<p>${de ? "Verwendungszweck bei jeder Zahlung:" : "Payment reference for every payment:"}<br><strong>${e(order.order_number)}</strong></p></section>`;
}
export function paymentDocument(order: Order, items: OrderItem[], nonce: string): string {
  const de = order.language === "de";
  const payable = order.status === "awaiting_payment";
  const title = de ? "Zahlungsübersicht" : "Payment summary";
  const content = `<h1>${title}</h1><p class="status">${statusLabels[order.language][order.status]}</p>${order.status === "cancelled" ? `<p>${de ? "Diese Zahlungsanforderung wurde storniert. Bitte nicht bezahlen." : "This payment request has been cancelled. Please do not pay."}</p>` : ""}${orderSummary(order, items, true)}${payable ? bankBlock(order) : ""}${order.paid_at ? `<p>${de ? "Zahlung eingegangen am" : "Payment received on"} ${new Date(order.paid_at).toLocaleDateString(de ? "de-DE" : "en-GB")}</p>` : ""}${order.tracking_number ? `<p>Tracking: ${escapeHtml(order.tracking_number)}</p>` : ""}<button id="print" class="button no-print">${de ? "Drucken / als PDF speichern" : "Print / save as PDF"}</button>`;
  return documentShell(title, content, order.language, nonce);
}
export interface MailPayload { from: string; to: string[]; subject: string; html: string; text: string }
export function emailPayload(event: EmailEvent, order: Order, items: OrderItem[]): MailPayload {
  const env = orderEnvironment();
  if (!env.ORDER_FROM_EMAIL || !env.ORDER_NOTIFICATION_EMAIL) throw new Error("MAIL_SENDER_MISSING");
  const de = event.kind === "internal" || order.language === "de";
  const titles = {
    received: de ? "Wir haben deine Bestellung erhalten" : "We have received your order",
    internal: "Neue Kaufanfrage",
    payment: de ? "Deine Zahlungsanforderung" : "Your payment request",
    paid: de ? "Zahlung erhalten – vielen Dank" : "Payment received – thank you",
    shipped: de ? "Deine Bestellung wurde versendet" : "Your order has shipped",
  };
  const title = titles[event.kind];
  const intro = event.kind === "received" ? (de ? "Wir prüfen Verfügbarkeit und Versandkosten. Du erhältst anschließend eine gesonderte Zahlungsanforderung. Bitte noch nichts überweisen. Deine Kaufanfrage ist unverbindlich." : "We are checking availability and shipping costs. You will receive a separate payment request. Please do not pay yet. Your purchase enquiry is non-binding.")
    : event.kind === "internal" ? "Bitte Verfügbarkeit und Versandkosten prüfen und anschließend die Zahlungsanforderung senden."
    : event.kind === "payment" ? (de ? "Deine Auswahl ist verfügbar. Bitte verwende für die Zahlung immer deine Bestellnummer. Frühere Zahlungsanforderungen zu dieser Bestellung werden durch diese ersetzt." : "Your selection is available. Please use your order number as the payment reference. This payment request replaces any previous request for this order.")
    : event.kind === "paid" ? (de ? "Deine Zahlung ist eingegangen. Wir bereiten deine Bestellung vor." : "Your payment has arrived. We are preparing your order.")
    : (de ? "Deine Bestellung ist auf dem Weg zu dir." : "Your order is on its way to you.");
  const link = `${publicBaseUrl()}${event.kind === "internal" ? `/admin/orders?order=${order.id}` : paymentPath(order.public_token)}`;
  const content = `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p>${orderSummary(order, items, !["received", "internal"].includes(event.kind))}${event.kind === "payment" ? bankBlock(order) : ""}${event.kind === "shipped" && order.tracking_number ? `<p>Tracking: ${escapeHtml(order.tracking_number)}</p>` : ""}${event.kind !== "received" ? `<p><a class="button" href="${escapeHtml(link)}">${event.kind === "internal" ? "Bestellung verwalten" : de ? "Zahlungsübersicht / PDF" : "Payment summary / PDF"}</a></p>` : ""}`;
  return {
    from: env.ORDER_FROM_EMAIL, to: [event.kind === "internal" ? env.ORDER_NOTIFICATION_EMAIL : order.email],
    subject: `${title} – ${order.order_number}`,
    html: documentShell(title, content, de ? "de" : "en"),
    text: `${title}\n${order.order_number}\n${intro}\n${order.customer_name}\n${[order.address_line1, order.address_line2, order.postal_code, order.city, order.country].filter(Boolean).join("\n")}\n${items.map(i => `${i.product_label} ${i.size} × ${i.quantity}: ${money(i.line_total_cents, order.language)}`).join("\n")}\n${de ? "Warenwert" : "Subtotal"}: ${money(order.subtotal_cents, order.language)}\n${["received", "internal"].includes(event.kind) ? (de ? "Versandkosten werden bestätigt." : "Shipping costs to be confirmed.") : `${de ? "Versand" : "Shipping"}: ${money(order.shipping_cents ?? 0, order.language)}\n${de ? "Gesamt" : "Total"}: ${money(order.total_cents ?? 0, order.language)}`}\n${event.kind === "payment" ? Object.values(JSON.parse(order.payment_snapshot!) as PaymentDetails).filter(Boolean).join("\n") : ""}\n${event.kind === "shipped" ? order.tracking_number ?? "" : ""}\n${event.kind !== "received" ? link : ""}\nSelesitina Gloger · Angerweg 15 · 31249 Hohenhameln`,
  };
}
