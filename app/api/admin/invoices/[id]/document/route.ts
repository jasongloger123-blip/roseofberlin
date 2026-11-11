import { errorResponse, privateHeaders, requireAdmin } from "../../../../../../lib/orders/http";
import { getInvoice } from "../../../../../../lib/invoices/service";
import { invoiceDocument } from "../../../../../../lib/invoices/templates";
export const dynamic="force-dynamic";
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}) {
  try {
    requireAdmin(request);const invoice=await getInvoice((await ctx.params).id),nonce=crypto.randomUUID();
    const cancellation=new URL(request.url).searchParams.get("cancellation")==="1";
    return new Response(invoiceDocument(invoice,nonce,cancellation&&!!invoice.cancelled_at),{headers:{...privateHeaders,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":`default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`}});
  }catch(e){return errorResponse(e);}
}
