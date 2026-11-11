import { errorResponse, privateHeaders, requireAdmin } from "../../../../../../lib/orders/http";
import { orderDatabase } from "../../../../../../lib/orders/runtime";
import { OrderError } from "../../../../../../lib/orders/domain";
export const dynamic="force-dynamic";
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}) {
  try{requireAdmin(request);const row=await orderDatabase().prepare("SELECT content FROM invoice_archive WHERE id=?").bind((await ctx.params).id).first<{content:string}>();if(!row)throw new OrderError("not_found",404);return new Response(row.content,{headers:{...privateHeaders,"Content-Type":"text/plain; charset=utf-8","Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'"}});}catch(e){return errorResponse(e);}
}
