import { OrderError, record } from "../orders/domain";
import type { OrderItem } from "../../db/schema";

export type Currency = "EUR" | "USD" | "AUD" | "NZD";
export interface Tariff { id: string; label: string; country: string; basket: "single" | "multiple" | "set"; cents: number; currency: Currency; eurRate: number; checkedOn: string }
export interface InvoiceSettings {
  sellerName: string; sellerAddress: string; taxId: string; taxNote: string; taxConfirmed: boolean;
  paymentDays: number; tariffs: Tariff[];
}
// These are historical seller examples, never a carrier quote. EUR rates are derived
// from the product prices in those examples and must be explicitly checked before use.
export const defaultSettings: InvoiceSettings = {
  sellerName: "Selesitina Gloger", sellerAddress: "Angerweg 15\n31249 Hohenhameln\nGermany", taxId: "", taxNote: "", taxConfirmed: false, paymentDays: 14,
  tariffs: [
    { id: "us-single", label: "USA · einzelnes Produkt", country: "US", basket: "single", cents: 2500, currency: "USD", eurRate: 1.116, checkedOn: "2026-11-10" },
    { id: "us-set", label: "USA · Set / mehrere Produkte", country: "US", basket: "set", cents: 3368, currency: "USD", eurRate: 1.115, checkedOn: "2026-11-10" },
    { id: "au-single", label: "Australien · einzelnes Produkt", country: "AU", basket: "single", cents: 2500, currency: "AUD", eurRate: 1.6193, checkedOn: "2026-11-10" },
    { id: "au-multiple", label: "Australien · mehrere Produkte", country: "AU", basket: "multiple", cents: 3338, currency: "AUD", eurRate: 1.6193, checkedOn: "2026-11-10" },
    { id: "nz-single", label: "Neuseeland · einzelne / mehrere Produkte", country: "NZ", basket: "single", cents: 4000, currency: "NZD", eurRate: 1.9945, checkedOn: "2026-11-10" },
    { id: "nz-set", label: "Neuseeland · Set", country: "NZ", basket: "set", cents: 5975, currency: "NZD", eurRate: 1.9945, checkedOn: "2026-11-10" },
  ],
};
const text = (v: unknown, max: number) => { if (typeof v !== "string" || v.length > max || /[\u0000-\u0008\u000b-\u001f]/.test(v)) throw new OrderError("invalid_settings"); return v.trim(); };
export function parseSettings(value: unknown): InvoiceSettings {
  const d = record(value);
  if (typeof d.taxConfirmed !== "boolean" || !Number.isInteger(d.paymentDays) || Number(d.paymentDays) < 1 || Number(d.paymentDays) > 90 || !Array.isArray(d.tariffs) || d.tariffs.length > 30) throw new OrderError("invalid_settings");
  const tariffs = d.tariffs.map(raw => {
    const t = record(raw);
    if (!Number.isSafeInteger(t.cents) || Number(t.cents) < 0 || Number(t.cents) > 100000 || typeof t.eurRate !== "number" || !Number.isFinite(t.eurRate) || t.eurRate < 0.01 || t.eurRate > 10000 || !["EUR","USD","AUD","NZD"].includes(String(t.currency)) || !["single","multiple","set"].includes(String(t.basket)) || !/^[A-Z]{2}$/.test(String(t.country)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(t.checkedOn)) || (t.currency === "EUR" && t.eurRate !== 1)) throw new OrderError("invalid_settings");
    return { id: text(t.id,60), label: text(t.label,120), country: t.country as string, basket: t.basket as Tariff["basket"], cents: t.cents as number, currency: t.currency as Currency, eurRate: t.eurRate, checkedOn: t.checkedOn as string };
  });
  if (new Set(tariffs.map(t=>t.id)).size !== tariffs.length) throw new OrderError("invalid_settings");
  return { sellerName: text(d.sellerName,150), sellerAddress: text(d.sellerAddress,500), taxId: text(d.taxId,100), taxNote: text(d.taxNote,500), taxConfirmed: d.taxConfirmed, paymentDays: d.paymentDays as number, tariffs };
}
export function tariffEurCents(tariff: Tariff) { return Math.round(tariff.cents / tariff.eurRate); }
export function suggestTariff(country: string, items: Pick<OrderItem,"product_key"|"quantity">[], tariffs: Tariff[]) {
  const basket = items.some(i=>i.product_key === "christmas") ? "set" : items.reduce((n,i)=>n+i.quantity,0) > 1 ? "multiple" : "single";
  return tariffs.find(t=>t.country === country && t.basket === basket) ?? null;
}
export function invoiceTotals(items: Pick<OrderItem,"quantity"|"unit_price_cents"|"line_total_cents">[], shipping: number) {
  if (!items.length || !Number.isSafeInteger(shipping) || shipping < 0 || shipping > 100000 || items.some(i=>!Number.isSafeInteger(i.quantity) || i.quantity < 1 || !Number.isSafeInteger(i.unit_price_cents) || i.unit_price_cents <= 0 || i.line_total_cents !== i.quantity*i.unit_price_cents)) throw new OrderError("invalid_invoice",409);
  const subtotal = items.reduce((n,i)=>n+i.line_total_cents,0);
  return { subtotal, shipping, total: subtotal+shipping };
}
