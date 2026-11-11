import { errorResponse, json, readJson, requireAdmin, sameOrigin } from "../../../../../lib/orders/http";
import { cancelInvoice, getInvoice, invoiceForOrder, issueInvoice, queueInvoice } from "../../../../../lib/invoices/service";
import { OrderError } from "../../../../../lib/orders/domain";
import { sendOrderEmails } from "../../../../../lib/orders/mail";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,ctx:Context) {
  try {requireAdmin(request);const invoice=await invoiceForOrder((await ctx.params).id); return json({invoice:invoice?{id:invoice.id,number:invoice.number,cancelled_at:invoice.cancelled_at}:null});}catch(e){return errorResponse(e);}
}
export async function POST(request:Request,ctx:Context) {
  try {
    const actor=requireAdmin(request);sameOrigin(request);const d=await readJson(request),{id}=await ctx.params;
    const invoice=d.action==="issue"?await issueInvoice(id,d,actor):d.action==="cancel"?await cancelInvoice(id,d,actor):d.action==="send"?await getInvoice(id):null;
    if(!invoice) throw new OrderError("invalid_action");
    if(d.action==="send") {await queueInvoice(invoice);await sendOrderEmails(invoice.order_id);}
    return json({invoice:{id:invoice.id,number:invoice.number,cancelled_at:invoice.cancelled_at}});
  } catch(e) {return errorResponse(e);}
}
