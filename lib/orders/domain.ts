export const statuses = ["received", "needs_review", "awaiting_payment", "paid", "processing", "shipped", "cancelled"] as const;
export type OrderStatus = typeof statuses[number];
export type Language = "de" | "en";
export const catalog = {
  parfum: { label: "Rose of Berlin · Eau de Parfum", prices: { "20 ml": 1990, "30 ml": 2490, "50 ml": 3490, "100 ml": 4990 } },
  oil: { label: "Rose of Berlin · Skin & Body Oil / Haut- & Körperöl", prices: { "20 ml": 900, "100 ml": 1500 } },
} as const;
export class OrderError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OrderError("invalid_input");
  return value as Record<string, unknown>;
}
function field(data: Record<string, unknown>, name: string, max: number, optional = false): string {
  const value = data[name];
  if (optional && (value === undefined || value === null || value === "")) return "";
  if (typeof value !== "string") throw new OrderError(`invalid_${name}`);
  const result = value.trim();
  if ((!optional && !result) || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) throw new OrderError(`invalid_${name}`);
  return result;
}
export function validEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email);
}
export function parseOrder(value: unknown) {
  const data = record(value);
  // Reject payment inputs instead of silently accepting a tampered checkout.
  for (const key of ["price", "unitPriceCents", "subtotalCents", "shippingCents", "totalCents", "total", "displayedTotal", "currency", "status", "payment", "bank"]) {
    if (key in data) throw new OrderError("server_pricing_only");
  }
  const product = field(data, "product", 30);
  if (!Object.hasOwn(catalog, product)) throw new OrderError("invalid_product");
  const item = catalog[product as keyof typeof catalog];
  const size = field(data, "size", 20);
  if (!Object.hasOwn(item.prices, size)) throw new OrderError("invalid_size");
  const unitPriceCents = (item.prices as Record<string, number>)[size];
  const quantity = data.quantity;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 5) throw new OrderError("invalid_quantity");
  const email = field(data, "email", 254).toLowerCase();
  if (!validEmail(email)) throw new OrderError("invalid_email");
  const country = field(data, "country", 2).toUpperCase();
  const countries = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
  if (!/^[A-Z]{2}$/.test(country) || !countries.of(country) || ["ZZ", "EU", "UN", "EZ", "QO"].includes(country)) throw new OrderError("invalid_country");
  if (data.language !== "de" && data.language !== "en") throw new OrderError("invalid_language");
  const firstName = field(data, "firstName", 80);
  const lastName = field(data, "lastName", 80);
  return {
    customerName: `${firstName} ${lastName}`, email,
    phone: field(data, "phone", 40, true),
    addressLine1: field(data, "addressLine1", 200), addressLine2: field(data, "addressLine2", 200, true),
    postalCode: field(data, "postalCode", 20), city: field(data, "city", 100), country,
    language: data.language as Language, product, productLabel: item.label, size, quantity,
    unitPriceCents, subtotalCents: unitPriceCents * quantity,
  };
}
export function idempotencyKey(value: string | null): string {
  if (!value || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) throw new OrderError("invalid_idempotency_key");
  return value;
}
export async function hash(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), b => b.toString(16).padStart(2, "0")).join("");
}
export function secureToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
}
export function shippingCents(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 100000) throw new OrderError("invalid_shipping");
  return value;
}
const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  received: ["needs_review", "cancelled"], needs_review: ["cancelled"],
  awaiting_payment: ["paid", "cancelled"], paid: ["processing"], processing: ["shipped"], shipped: [], cancelled: [],
};
export function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!transitions[from]?.includes(to)) throw new OrderError("invalid_transition", 409);
}
export const statusLabels: Record<Language, Record<OrderStatus, string>> = {
  de: { received: "Eingegangen", needs_review: "In Prüfung", awaiting_payment: "Zahlung ausstehend", paid: "Bezahlt", processing: "In Vorbereitung", shipped: "Versendet", cancelled: "Storniert" },
  en: { received: "Received", needs_review: "Under review", awaiting_payment: "Awaiting payment", paid: "Paid", processing: "Preparing shipment", shipped: "Shipped", cancelled: "Cancelled" },
};
export function money(cents: number, language: Language = "de") {
  return new Intl.NumberFormat(language === "de" ? "de-DE" : "en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
}
