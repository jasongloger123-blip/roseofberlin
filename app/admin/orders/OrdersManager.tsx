"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EmailEvent, Order, OrderItem } from "../../../db/schema";
import { money, statuses, statusLabels, type OrderStatus } from "../../../lib/orders/domain";

type SafeOrder = Omit<Order, "payment_snapshot" | "public_token" | "request_hash" | "idempotency_key" | "mutation_id">;
type Row = Pick<Order, "id" | "order_number" | "customer_name" | "country" | "subtotal_cents" | "shipping_cents" | "total_cents" | "status" | "created_at"> & { email_attention: number };
type Detail = { order: SafeOrder; items: OrderItem[]; paymentPath: string | null; events: Omit<EmailEvent, "payload_json" | "lease_id" | "dedupe_key">[]; attempts: { id: string; event_id: string; outcome: string; error_code: string | null; created_at: string }[] };
const messages: Record<string, string> = {
  authentication_required: "Bitte erneut anmelden.", access_denied: "Dieses Konto ist nicht freigeschaltet.",
  stale_order: "Die Bestellung wurde inzwischen geändert. Bitte neu laden.", stale_or_sending: "Die Bestellung wurde geändert oder eine E-Mail wird gerade gesendet. Bitte neu laden.",
  payment_not_ready: "Verfügbarkeit und Versandkosten müssen zuerst bestätigt und gespeichert sein.", terms_locked: "Versandkosten können nach Zahlung nicht mehr geändert werden.",
  invalid_shipping: "Versandkosten zwischen 0 und 1.000 Euro mit höchstens zwei Nachkommastellen eingeben.", invalid_transition: "Dieser Statuswechsel ist nicht möglich.",
  service_unavailable: "Die Aktion ist derzeit nicht verfügbar. Bitte Einrichtung und Verbindung prüfen und erneut versuchen.",
};
async function api<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { cache: "no-store", signal, ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await res.json();
  if (!res.ok) throw new Error(messages[data.error] ?? "Die Aktion konnte nicht ausgeführt werden.");
  return data as T;
}
const displayMoney = (value: number | null) => value === null ? "Offen" : money(value);
const date = (value: string) => new Date(value).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
const mailNames = { received: "Eingangsbestätigung", internal: "Interne Benachrichtigung", payment: "Zahlungsanforderung", paid: "Zahlungsbestätigung", shipped: "Versandbestätigung" };
const mailStatus = { pending: "Ausstehend", sending: "Wird gesendet", sent: "An Mailanbieter übergeben", failed: "Fehlgeschlagen", manual_review: "Zustellung prüfen", cancelled: "Ersetzt / storniert" };

export default function OrdersManager() {
  const [filter, setFilter] = useState("");
  const [rows, setRows] = useState<Row[]>([]), [next, setNext] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [shipping, setShipping] = useState(""), [available, setAvailable] = useState(false), [note, setNote] = useState(""), [tracking, setTracking] = useState("");
  const [providerId, setProviderId] = useState("");
  const selectedRef = useRef<string | null>(null), busyRef = useRef(false);
  const updateDetail = useCallback((data: Detail) => {
    setDetail(data); setShipping(data.order.shipping_cents === null ? "" : (data.order.shipping_cents / 100).toFixed(2));
    setAvailable(Boolean(data.order.availability_confirmed)); setNote(data.order.seller_note); setTracking(data.order.tracking_number ?? "");
  }, []);
  const open = useCallback(async (id: string) => {
    selectedRef.current = id; setBusy(true); setError(""); setNotice("");
    try { const data = await api<Detail>(`/api/admin/orders/${id}`); if (selectedRef.current === id) updateDetail(data); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }, [updateDetail]);
  const load = useCallback(async (before?: number, signal?: AbortSignal) => {
    const params = new URLSearchParams(); if (filter) params.set("status", filter); if (before) params.set("before", String(before));
    const data = await api<{ orders: Row[]; next: number | null }>(`/api/admin/orders?${params}`, undefined, signal);
    setRows(current => before ? [...current, ...data.orders] : data.orders); setNext(data.next);
  }, [filter]);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(); if (filter) params.set("status", filter);
    api<{ orders: Row[]; next: number | null }>(`/api/admin/orders?${params}`, undefined, controller.signal)
      .then(data => { setRows(data.orders); setNext(data.next); })
      .catch(e => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filter]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("order");
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) return;
    const controller = new AbortController(); selectedRef.current = id;
    api<Detail>(`/api/admin/orders/${id}`, undefined, controller.signal)
      .then(data => { if (selectedRef.current === id) updateDetail(data); })
      .catch(e => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [updateDetail]);
  async function action(body: Record<string, unknown>) {
    if (!detail || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const data = await api<Detail>(`/api/admin/orders/${detail.order.id}`, { version: detail.order.version, ...body });
      updateDetail(data); await load();
      setNotice(data.events.some(e => ["failed", "manual_review"].includes(e.status)) ? "Bestellung gespeichert. Mindestens eine E-Mail benötigt Aufmerksamkeit." : "Gespeichert.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); busyRef.current = false; }
  }
  function save() {
    const amount = shipping.trim().replace(",", ".");
    if (amount && !/^\d{1,4}(\.\d{1,2})?$/.test(amount)) { setError(messages.invalid_shipping); return; }
    void action({ action: "edit", shippingCents: amount ? Math.round(Number(amount) * 100) : null, availabilityConfirmed: available, sellerNote: note });
  }
  const order = detail?.order;
  const termsEditable = order && ["received", "needs_review", "awaiting_payment"].includes(order.status);
  const storedShipping = order?.shipping_cents === null ? "" : ((order?.shipping_cents ?? 0) / 100).toFixed(2);
  const unsaved = Boolean(order && (shipping !== storedShipping || available !== Boolean(order.availability_confirmed) || note !== order.seller_note));
  const canPay = order && ["received", "needs_review"].includes(order.status) && order.availability_confirmed === 1 && order.shipping_cents !== null && !unsaved;
  const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = { received: "needs_review", awaiting_payment: "paid", paid: "processing", processing: "shipped" };
  const actionLabels: Partial<Record<OrderStatus, string>> = { received: "Prüfung beginnen", awaiting_payment: "Zahlungseingang bestätigen", paid: "Vorbereitung starten", processing: "Als versendet markieren" };
  return <>
    <div className="admin-heading"><h1>Bestellungen</h1><label>Status<select value={filter} onChange={e => setFilter(e.target.value)}><option value="">Alle Bestellungen</option>{statuses.map(s => <option value={s} key={s}>{statusLabels.de[s]}</option>)}</select></label><button className="button outline" onClick={() => load().catch(e => setError(e.message))}>Aktualisieren</button></div>
    {error && <p role="alert" className="admin-alert error">{error}</p>}{notice && <p role="status" className="admin-alert">{notice}</p>}
    <div className="admin-workspace"><section className="admin-card order-list" aria-label="Bestellübersicht">
      {loading ? <p>Bestellungen werden geladen…</p> : !rows.length ? <p>Keine Bestellungen in dieser Auswahl.</p> : <div className="admin-table-wrap"><table><thead><tr><th>Bestellung</th><th>Kunde / Land</th><th>Warenwert</th><th>Versand</th><th>Gesamt</th><th>Status</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className={order?.id === row.id ? "selected" : ""}><td><button disabled={busy} className="order-link" onClick={() => open(row.id)}>{row.order_number}</button><small>{date(row.created_at)}</small></td><td>{row.customer_name}<small>{row.country}</small></td><td>{money(row.subtotal_cents)}</td><td>{displayMoney(row.shipping_cents)}</td><td>{displayMoney(row.total_cents)}</td><td><span className={`status-badge ${row.status}`}>{statusLabels.de[row.status]}</span>{row.email_attention > 0 && <small className="email-attention">E-Mails prüfen</small>}</td></tr>)}</tbody></table></div>}
      {next !== null && <button className="button outline" onClick={() => load(next).catch(e => setError(e.message))}>Weitere Bestellungen laden</button>}
    </section>
    {detail && order ? <section className="admin-card order-detail" aria-busy={busy}><div className="detail-heading"><div><p className="admin-muted">{date(order.created_at)}</p><h2>{order.order_number}</h2><span className={`status-badge ${order.status}`}>{statusLabels.de[order.status]}</span></div><button className="order-link" disabled={busy} onClick={() => open(order.id)}>Neu laden</button></div>
      <h3>Kontakt & Lieferung</h3><address>{order.customer_name}<br />{order.address_line1}<br />{order.address_line2 && <>{order.address_line2}<br /></>}{order.postal_code} {order.city}<br />{order.country}</address><p><a href={`mailto:${order.email}`}>{order.email}</a>{order.phone && <><br />{order.phone}</>}</p>
      <h3>Auswahl</h3>{detail.items.map(item => <div className="detail-item" key={item.id}><span>{item.product_label}<small>{item.size} · {item.quantity} × {money(item.unit_price_cents)}</small></span><strong>{money(item.line_total_cents)}</strong></div>)}
      <fieldset disabled={busy} className="admin-fields"><label>Versandkosten in EUR<input inputMode="decimal" placeholder="Noch offen" value={shipping} disabled={!termsEditable} onChange={e => setShipping(e.target.value)} /></label><label className="admin-check"><input type="checkbox" checked={available} disabled={!termsEditable} onChange={e => setAvailable(e.target.checked)} />Verfügbarkeit bestätigt</label><label>Interne Notizen<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={4000} rows={3} /></label>
      {order.status === "awaiting_payment" && unsaved && <p className="admin-alert">Änderungen an Versand oder Verfügbarkeit machen die bisherige Zahlungsanforderung und ihren Link ungültig. Danach erneut senden.</p>}
      <div className="admin-total"><span>Gesamt (gespeichert)</span><strong>{displayMoney(order.total_cents)}</strong></div><button className="button outline" disabled={!unsaved} onClick={save}>Änderungen speichern</button>
      {["received", "needs_review"].includes(order.status) && <><button className="button primary" disabled={!canPay} onClick={() => action({ action: "payment" })}>Zahlungsanforderung senden</button>{!canPay && <p className="admin-muted">Verfügbarkeit bestätigen und Versandkosten speichern. Kostenloser Versand: 0,00 Euro.</p>}</>}
      {order.status === "processing" && <label>Trackingnummer (optional)<input value={tracking} onChange={e => setTracking(e.target.value)} maxLength={150} /></label>}
      {nextStatus[order.status] && <button className="button primary" disabled={unsaved} onClick={() => { if (order.status === "awaiting_payment" && !window.confirm("Ist der vollständige Betrag tatsächlich auf dem Bank- oder PayPal-Konto eingegangen?")) return; void action({ action: "status", status: nextStatus[order.status], trackingNumber: tracking || null }); }}>{actionLabels[order.status]}</button>}
      {["received", "needs_review", "awaiting_payment"].includes(order.status) && <button className="order-link danger" onClick={() => { if (window.confirm("Bestellung stornieren? Die Zahlungsübersicht wird als storniert markiert.")) void action({ action: "status", status: "cancelled" }); }}>Bestellung stornieren</button>}
      </fieldset>
      {order.paid_at && <p className="admin-muted">Bezahlt am {date(order.paid_at)}</p>}{order.shipped_at && <p className="admin-muted">Versendet am {date(order.shipped_at)}{order.tracking_number && ` · ${order.tracking_number}`}</p>}
      {detail.paymentPath && <p><a className="order-link" href={detail.paymentPath} target="_blank" rel="noreferrer">Zahlungsübersicht / PDF öffnen</a></p>}
      <h3>E-Mails</h3><ul className="email-events">{detail.events.map(event => <li key={event.id}><strong>{mailNames[event.kind]}{event.revision > 1 ? ` · Version ${event.revision}` : ""}</strong><span>{mailStatus[event.status]} · {event.attempts} Versuch(e)</span>{event.error_code && <small>{event.error_code}</small>}{event.status === "manual_review" && <div><p>Die Zustellung ist unklar. Im Resend-Dashboard prüfen, bevor eine weitere E-Mail versendet wird.</p><label>Bestätigte Resend-E-Mail-ID<input value={providerId} onChange={e => setProviderId(e.target.value)} /></label><button className="button outline" disabled={busy || !providerId.trim()} onClick={() => action({ action: "reconcile_email", eventId: event.id, providerId })}>Versand als bestätigt erfassen</button><button className="order-link" disabled={busy} onClick={() => { if (window.confirm("Im Resend-Dashboard geprüft und sicher nicht versendet? Bei falscher Bestätigung kann eine doppelte E-Mail entstehen.")) void action({ action: "reconcile_not_sent", eventId: event.id }); }}>Im Anbieter geprüft: nicht versendet – erneut senden</button></div>}</li>)}</ul>
      <button className="button outline" disabled={busy || !detail.events.some(e => ["pending", "failed", "sending"].includes(e.status))} onClick={() => action({ action: "retry_emails" })}>Ausstehende / fehlgeschlagene E-Mails erneut versuchen</button>
      <details><summary>Versandprotokoll</summary>{detail.attempts.length ? detail.attempts.map(a => <p className="admin-muted" key={a.id}>{date(a.created_at)} · {a.outcome}{a.error_code ? ` · ${a.error_code}` : ""}</p>) : <p className="admin-muted">Noch keine Versuche protokolliert.</p>}</details>
    </section> : <section className="admin-card detail-empty"><h2>Bestellung auswählen</h2><p>Öffne eine Bestellnummer, um Lieferung, Zahlungsanforderung und Versand zu verwalten.</p></section>}
    </div>
  </>;
}
