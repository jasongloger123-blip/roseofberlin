import { errorResponse, json, readJson, requireAdmin, sameOrigin } from "../../../../lib/orders/http";
import { getSettings, saveSettings } from "../../../../lib/invoices/service";
import { orderDatabase } from "../../../../lib/orders/runtime";
import { hash, OrderError } from "../../../../lib/orders/domain";
import { importConfiguredArchive } from "../../../../lib/invoices/archive";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  try {
    const actor=requireAdmin(request); await importConfiguredArchive(actor); const url=new URL(request.url);
    const raw=url.searchParams.get("before"), before=raw===null?null:Number(raw);
    if(before!==null&&(!Number.isSafeInteger(before)||before<1)) throw new OrderError("invalid_page");
    const db=orderDatabase();
    const rows=await db.prepare(`SELECT i.id,i.number,i.order_id,i.sequence,i.issued_at,i.cancelled_at,o.order_number,o.customer_name,o.country,CAST(json_extract(i.snapshot,'$.order.total_cents') AS INTEGER) AS total_cents,o.status FROM invoices i JOIN orders o ON o.id=i.order_id WHERE (? IS NULL OR i.sequence<?) ORDER BY i.sequence DESC LIMIT 51`).bind(before,before).all();
    const stats=await db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(CASE WHEN i.cancelled_at IS NULL THEN CAST(json_extract(i.snapshot,'$.order.total_cents') AS INTEGER) ELSE 0 END),0) AS total,COALESCE(SUM(CASE WHEN i.cancelled_at IS NULL AND o.status='awaiting_payment' THEN CAST(json_extract(i.snapshot,'$.order.total_cents') AS INTEGER) ELSE 0 END),0) AS open FROM invoices i JOIN orders o ON o.id=i.order_id`).first();
    const archive=(await db.prepare("SELECT id,label,imported_at FROM invoice_archive ORDER BY imported_at DESC LIMIT 100").all()).results;
    return json({invoices:rows.results.slice(0,50),next:rows.results.length>50?rows.results[49].sequence:null,stats,archive,...await getSettings()});
  } catch(e) { return errorResponse(e); }
}
export async function POST(request:Request) {
  try {
    const actor=requireAdmin(request);sameOrigin(request);const d=await readJson(request);
    if(d.action==="settings") return json(await saveSettings(d));
    if(d.action==="archive") {
      if(typeof d.content!=="string"||!d.content.trim()||d.content.length>12000||typeof d.label!=="string"||!d.label.trim()||d.label.length>150) throw new OrderError("invalid_archive");
      const id=crypto.randomUUID();
      await orderDatabase().prepare("INSERT INTO invoice_archive(id,fingerprint,label,content,imported_at,imported_by) VALUES (?,?,?,?,?,?) ON CONFLICT(fingerprint) DO NOTHING").bind(id,await hash(d.content),d.label,d.content,new Date().toISOString(),actor).run();
      return json({saved:true});
    }
    throw new OrderError("invalid_action");
  } catch(e) { return errorResponse(e); }
}
