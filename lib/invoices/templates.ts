import { bankBlock, documentShell, escapeHtml as e, orderSummary } from "../orders/templates";
import type { Invoice, InvoiceSnapshot } from "./service";
export function invoiceDocument(invoice: Invoice, nonce?: string, cancellation = false) {
  const s = JSON.parse(invoice.snapshot) as InvoiceSnapshot, de = s.order.language === "de", draft = invoice.id === "draft";
  const title = draft ? (de ? "Rechnungsentwurf – keine Zahlungsaufforderung" : "Draft invoice – do not pay") : cancellation ? (de ? "Stornorechnung" : "Credit note") : de ? "Rechnung" : "Invoice";
  const number = cancellation ? invoice.number + "-S" : invoice.number;
  const order = cancellation ? { ...s.order, subtotal_cents: -s.order.subtotal_cents, shipping_cents: -s.order.shipping_cents!, total_cents: -s.order.total_cents! } : s.order;
  const items = cancellation ? s.items.map(i => ({ ...i, unit_price_cents: -i.unit_price_cents, line_total_cents: -i.line_total_cents })) : s.items;
  let content = "<h1>" + title + " " + e(number) + "</h1>";
  content += '<p class="address">' + e(s.settings.sellerName) + "\n" + e(s.settings.sellerAddress) + "\n" + e(s.settings.taxId) + "</p>";
  content += "<p>" + (de ? "Rechnungsdatum" : "Invoice date") + ": " + e((cancellation ? invoice.cancelled_at : invoice.issued_at)?.slice(0, 10));
  content += "<br>" + (de ? "Lieferdatum (voraussichtlich bei Vorauszahlung)" : "Delivery date (expected for advance payment)") + ": " + e(s.deliveryDate) + "</p>";
  if (invoice.cancelled_at) content += '<p class="status">' + (de ? "Storniert" : "Cancelled") + ": " + e(invoice.cancellation_reason) + ". " + (de ? "Bitte nicht bezahlen. Stornobeleg: " : "Do not pay. Credit note: ") + e(invoice.number) + "-S</p>";
  if (cancellation) content += "<p>" + (de ? "Vollständige Aufhebung der Rechnung " : "Full cancellation of invoice ") + e(invoice.number) + "</p>";
  content += orderSummary(order, items, true) + "<p>" + e(s.settings.taxNote) + "</p>";
  if (!draft && !invoice.cancelled_at && !cancellation) {
    content += "<p>" + (de ? "Zahlbar bis" : "Payment due") + ": " + e(s.dueDate) + " · EUR<br>";
    content += (de ? "Zahlungsreferenz" : "Payment reference") + ": " + e(s.order.order_number) + "<br>";
    content += (de ? "Bereits geleistete Zahlungen werden angerechnet. Nicht erneut bezahlen." : "Payments already made are credited. Do not pay again.") + "</p>" + bankBlock(s.order);
  }
  if (nonce) content += '<button id="print" class="button no-print">' + (de ? "Drucken / als PDF speichern" : "Print / save as PDF") + "</button>";
  return documentShell(title, content, s.order.language, nonce).replace(/<div class="footer">[\s\S]*?<\/div>/, '<div class="footer">' + e(s.settings.sellerName) + " · " + e(s.settings.sellerAddress).replace(/\n/g, " · ") + "</div>");
}
