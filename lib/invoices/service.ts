import type { Order, OrderItem } from "../../db/schema";
import { OrderError, record, secureToken } from "../orders/domain";
import { orderDatabase, orderEnvironment, publicBaseUrl } from "../orders/runtime";
import { getOrder, getItems } from "../orders/repository";
import { defaultSettings, invoiceTotals, parseSettings, type InvoiceSettings } from "./domain";
import { invoiceDocument } from "./templates";

export interface InvoiceSnapshot { order: Order; items: OrderItem[]; settings: InvoiceSettings; deliveryDate: string; dueDate: string; }
export interface Invoice { sequence: number; id: string; number: string; order_id: string; token: string; snapshot: string; issued_at: string; issued_by: string; cancelled_at: string | null; cancelled_by: string | null; cancellation_reason: string | null }
export async function getSettings() {
  const row = await orderDatabase().prepare("SELECT version,payload FROM invoice_settings WHERE id=1").first<{version:number;payload:string}>();
  return { version: row?.version ?? 0, settings: row ? parseSettings(JSON.parse(row.payload)) : structuredClone(defaultSettings) };
}
export async function saveSettings(input: unknown) {
  const d = record(input), settings = parseSettings(d.settings);
  if (!Number.isSafeInteger(d.version) || Number(d.version) < 0) throw new OrderError("invalid_settings");
  const row = await orderDatabase().prepare(`INSERT INTO invoice_settings(id,version,payload) SELECT 1,1,? WHERE ?=0 ON CONFLICT(id) DO UPDATE SET version=invoice_settings.version+1,payload=excluded.payload WHERE invoice_settings.version=? RETURNING version`).bind(JSON.stringify(settings),d.version,d.version).first();
  // Existing settings update separately when version > 0 (the INSERT SELECT has no row).
  if (!row && Number(d.version)>0) {
    const result=await orderDatabase().prepare("UPDATE invoice_settings SET payload=?,version=version+1 WHERE id=1 AND version=? RETURNING version").bind(JSON.stringify(settings),d.version).first();
    if (!result) throw new OrderError("stale_settings",409);
  } else if (!row) throw new OrderError("stale_settings",409);
  return getSettings();
}
export async function invoiceForOrder(orderId: string) { return orderDatabase().prepare("SELECT * FROM invoices WHERE order_id=? ORDER BY sequence DESC LIMIT 1").bind(orderId).first<Invoice>(); }
export async function getInvoice(id: string) {
  const row=await orderDatabase().prepare("SELECT * FROM invoices WHERE id=?").bind(id).first<Invoice>();
  if (!row) throw new OrderError("not_found",404); return row;
}
function date(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value) throw new OrderError("invalid_delivery_date"); return value;
}
export async function previewInvoice(orderId:string) {
  const [order,items,{settings},invoice]=await Promise.all([getOrder(orderId),getItems(orderId),getSettings(),invoiceForOrder(orderId)]);
  return { order, items, settings, invoice };
}
export async function issueInvoice(orderId: string, input: unknown, actor: string) {
  const d=record(input), existing=await invoiceForOrder(orderId);
  if (existing && !existing.cancelled_at) return existing;
  const {order,items,settings}=await previewInvoice(orderId);
  if (order.version!==d.version) throw new OrderError("stale_order",409);
  if (!d.addressConfirmed || d.addressConfirmed!==true || !settings.taxConfirmed || !settings.sellerName || !settings.sellerAddress || !settings.taxId || !settings.taxNote) throw new OrderError("invoice_setup_required",409);
  if (!["awaiting_payment","paid","processing","shipped"].includes(order.status) || !order.availability_confirmed || order.shipping_cents===null || !order.payment_snapshot) throw new OrderError("invoice_not_ready",409);
  const totals=invoiceTotals(items,order.shipping_cents);
  if(totals.total!==order.total_cents || totals.subtotal!==order.subtotal_cents) throw new OrderError("invalid_invoice",409);
  const deliveryDate=date(d.deliveryDate), now=new Date().toISOString();
  const dueDate=new Date(Date.now()+settings.paymentDays*86400000).toISOString().slice(0,10);
  const snapshot:InvoiceSnapshot={order,items,settings,deliveryDate,dueDate};
  const id=crypto.randomUUID(), db=orderDatabase();
  await db.batch([
    db.prepare(`INSERT INTO invoices(id,order_id,token,snapshot,issued_at,issued_by) SELECT ?,id,?,?,?,? FROM orders WHERE id=? AND version=? AND status IN ('awaiting_payment','paid','processing','shipped') ON CONFLICT DO NOTHING`).bind(id,secureToken(),JSON.stringify(snapshot),now,actor,orderId,order.version),
    db.prepare("UPDATE invoices SET number='ROB-RE-' || ? || '-' || printf('%06d',sequence) WHERE id=? AND number IS NULL").bind(now.slice(0,4),id),
  ]);
  const invoice=await invoiceForOrder(orderId);
  if(!invoice || invoice.cancelled_at) throw new OrderError("stale_order",409);
  return invoice;
}
export async function queueInvoice(invoice:Invoice) {
  if(invoice.cancelled_at) throw new OrderError("invoice_cancelled",409);
  const snapshot=JSON.parse(invoice.snapshot) as InvoiceSnapshot, env=orderEnvironment();
  if(!env.ORDER_FROM_EMAIL || !env.ORDER_NOTIFICATION_EMAIL) throw new OrderError("mail_not_configured",409);
  const link=publicBaseUrl()+`/invoice/${invoice.token}`;
  const title=snapshot.order.language==="de" ? "Deine Rechnung" : "Your invoice";
  const html=invoiceDocument(invoice,undefined,false).replace('</main>',`<p><a href="${link}">${title} / PDF</a></p></main>`);
  const text=`${title} ${invoice.number}\n${snapshot.order.customer_name}\nEUR ${(snapshot.order.total_cents!/100).toFixed(2)}\n${link}`;
  const payload={from:env.ORDER_FROM_EMAIL,to:[snapshot.order.email],reply_to:env.ORDER_NOTIFICATION_EMAIL,subject:`${title} ${invoice.number}`,html,text};
  await orderDatabase().prepare("INSERT INTO order_email_events(id,order_id,kind,dedupe_key,payload_json,created_at) VALUES (?,?,'invoice',?,?,?) ON CONFLICT(dedupe_key) DO NOTHING").bind(crypto.randomUUID(),invoice.order_id,`invoice/${invoice.id}`,JSON.stringify(payload),new Date().toISOString()).run();
}
export async function cancelInvoice(id:string,input:unknown,actor:string) {
  const d=record(input), invoice=await getInvoice(id);
  if(invoice.cancelled_at) return invoice;
  if(typeof d.reason!=="string" || d.reason.trim().length<3 || d.reason.length>500) throw new OrderError("invalid_cancellation_reason");
  const db=orderDatabase(), now=new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE invoices SET cancelled_at=?,cancelled_by=?,cancellation_reason=? WHERE id=? AND cancelled_at IS NULL AND NOT EXISTS(SELECT 1 FROM order_email_events WHERE order_id=? AND kind='invoice' AND status IN ('sending','manual_review'))`).bind(now,actor,d.reason.trim(),id,invoice.order_id),
    db.prepare("UPDATE order_email_events SET status='cancelled' WHERE order_id=? AND kind='invoice' AND status IN ('pending','failed') AND EXISTS(SELECT 1 FROM invoices WHERE id=? AND cancelled_at IS NOT NULL)").bind(invoice.order_id,id),
  ]);
  const result=await getInvoice(id);
  if(!result.cancelled_at) throw new OrderError("stale_or_sending",409);
  return result;
}
