import { errorResponse, privateHeaders } from "../../../lib/orders/http";
import { orderDatabase } from "../../../lib/orders/runtime";
import { OrderError } from "../../../lib/orders/domain";
import { invoiceDocument } from "../../../lib/invoices/templates";
import type { Invoice } from "../../../lib/invoices/service";
import { orderBackendUrl } from "../../../lib/orders/backend";
export const dynamic="force-dynamic";
export async function GET(request:Request,ctx:{params:Promise<{token:string}>}) {
  try {
    const {token}=await ctx.params;if(!/^[a-f0-9]{64}$/.test(token))throw new OrderError("not_found",404);
    if(process.env.VERCEL==="1") return new Response(null,{status:307,headers:{...privateHeaders,Location:orderBackendUrl(`/invoice/${token}`)}});
    const invoice=await orderDatabase().prepare("SELECT * FROM invoices WHERE token=?").bind(token).first<Invoice>();
    if(!invoice)throw new OrderError("not_found",404);
    const nonce=crypto.randomUUID();
    return new Response(invoiceDocument(invoice,nonce),{headers:{...privateHeaders,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":`default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`}});
  }catch(e){return errorResponse(e);}
}
