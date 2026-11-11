import { errorResponse, privateHeaders, requireAdmin } from "../../../../../../lib/orders/http";
import { previewInvoice } from "../../../../../../lib/invoices/service";
import { invoiceDocument } from "../../../../../../lib/invoices/templates";
export const dynamic="force-dynamic";
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}) {
  try{requireAdmin(request);const {order,items,settings}=await previewInvoice((await ctx.params).id),nonce=crypto.randomUUID();const now=new Date().toISOString();const html=invoiceDocument({id:"draft",sequence:0,number:"ENTWURF",order_id:order.id,token:"",snapshot:JSON.stringify({order,items,settings,deliveryDate:"Noch festzulegen",dueDate:"Noch festzulegen"}),issued_at:now,issued_by:"",cancelled_at:null,cancelled_by:null,cancellation_reason:null},nonce);return new Response(html,{headers:{...privateHeaders,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":`default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`}});}catch(e){return errorResponse(e);}
}
