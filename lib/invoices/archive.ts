import { hash } from "../orders/domain";
import { orderDatabase, orderEnvironment } from "../orders/runtime";
// Optional one-time import supplied through private deployment secrets, never
// tracked source. Only called after a verified administrator has authenticated.
export async function importConfiguredArchive(actor:string) {
  const env=orderEnvironment() as Record<string,unknown>,db=orderDatabase();
  const statements=[];
  for(let i=1;i<=8;i++) {
    const raw=env[`INVOICE_ARCHIVE_${i}`];if(typeof raw!=="string"||!raw)continue;
    const d=JSON.parse(raw) as {label?:unknown;content?:unknown};
    if(typeof d.label!=="string"||!d.label||d.label.length>150||typeof d.content!=="string"||d.content.length>12000)throw new Error("INVALID_ARCHIVE_IMPORT");
    statements.push(db.prepare("INSERT INTO invoice_archive(id,fingerprint,label,content,imported_at,imported_by) VALUES (?,?,?,?,?,?) ON CONFLICT(fingerprint) DO NOTHING").bind(crypto.randomUUID(),await hash(d.content),d.label,d.content,new Date().toISOString(),actor));
  }
  if(statements.length)await db.batch(statements);
}
