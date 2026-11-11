import Link from "next/link";
import { redirect } from "next/navigation";
import { orderBackendUrl } from "../../../lib/orders/backend";
import { headers } from "next/headers";
import { requireAdmin } from "../../../lib/orders/http";
import { chatGPTSignInPath, chatGPTSignOutPath } from "../../chatgpt-auth";
import InvoicesManager from "./InvoicesManager";
import "../orders/orders.css";
import "./invoices.css";
export const dynamic="force-dynamic";
export const metadata={title:"Rechnungen · Rose of Berlin",robots:{index:false,follow:false},alternates:{canonical:null}};
export default async function Page(){
  if(process.env.VERCEL==="1") redirect(orderBackendUrl("/admin/invoices"));
  let allowed=false;try{requireAdmin(new Request("https://internal.invalid/admin/invoices",{headers:await headers()}));allowed=true;}catch{}
  return <main className="orders-admin"><header className="admin-header"><Link href="/" className="admin-brand">Rose of Berlin</Link><Link href="/admin/orders">Bestellungen</Link><Link href="/admin/invoices">Rechnungen</Link>{allowed&&<a href={chatGPTSignOutPath("/admin/invoices")} target="_top">Abmelden</a>}</header>{allowed?<InvoicesManager/>:<section className="admin-card auth-card"><h1>Rechnungen & Versand</h1><p>Geschützter Bereich für Selesitina. Mit dem freigeschalteten Konto wagloger@web.de anmelden.</p><a className="button primary" target="_top" href={chatGPTSignInPath("/admin/invoices")}>Anmelden</a></section>}</main>;
}
