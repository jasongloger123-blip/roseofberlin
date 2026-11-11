import Link from "next/link";
import { redirect } from "next/navigation";
import { orderBackendUrl } from "../../../lib/orders/backend";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { chatGPTSignInPath, chatGPTSignOutPath } from "../../chatgpt-auth";
import { requireAdmin } from "../../../lib/orders/http";
import OrdersManager from "./OrdersManager";
import "./orders.css";
import "../invoices/invoices.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bestellungen", robots: { index: false, follow: false }, alternates: { canonical: null } };
export default async function OrdersPage({searchParams}:{searchParams:Promise<{order?:string}>}) {
  if(process.env.VERCEL==="1") {
    const query=await searchParams, selected=typeof query.order==="string"&&/^[a-f0-9-]{36}$/.test(query.order)?`?order=${query.order}`:"";
    redirect(orderBackendUrl(`/admin/orders${selected}`));
  }
  let allowed = false;
  try { requireAdmin(new Request("https://internal.invalid/admin/orders", { headers: await headers() })); allowed = true; } catch { /* Never render customer data before authorization. */ }
  return <main className="orders-admin"><header className="admin-header"><Link href="/" className="admin-brand">Rose of Berlin</Link><span>Bestellverwaltung</span><Link href="/admin/invoices">Rechnungen & Versand</Link>{allowed && <a href={chatGPTSignOutPath("/admin/orders")} target="_top">Abmelden</a>}</header>
    {allowed ? <OrdersManager /> : <section className="admin-card auth-card"><h1>Bestellungen verwalten</h1><p>Dieser Bereich ist ausschließlich für freigeschaltete Mitarbeitende.</p><a className="button primary" href={chatGPTSignInPath("/admin/orders")} target="_top">Mit ChatGPT anmelden</a><p className="admin-muted">Bereits angemeldet? Dein Konto muss für die Bestellverwaltung freigeschaltet sein.</p></section>}
  </main>;
}
