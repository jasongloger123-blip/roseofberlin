"use client";

import { useMemo, useSyncExternalStore } from "react";
import { catalog, christmasOfferAvailable } from "./orders/domain";
import { products, type ProductKey } from "./storefront";

export type CartItem = { product: ProductKey; size: string; quantity: number };
const storageKey = "rose-of-berlin-cart-v1";
const eventName = "rose-of-berlin-cart-change";
let memory = "[]";
function read() {
  if (typeof window === "undefined") return "[]";
  try { return window.localStorage.getItem(storageKey) ?? memory; } catch { return memory; }
}
export function validateCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  const lines: CartItem[] = [];
  for (const raw of value.slice(0,12)) {
    if (!raw || typeof raw !== "object") continue;
    const { product, size, quantity } = raw;
    if (!Object.hasOwn(products, product) || typeof size !== "string" || !products[product as ProductKey].options.some(option => option.size === size) || !Number.isInteger(quantity) || quantity < 1 || quantity > 5) continue;
    const existing = lines.find(line => line.product === product && line.size === size);
    if (existing) existing.quantity = Math.min(5, existing.quantity + quantity);
    else lines.push({ product, size, quantity });
  }
  return lines;
}
function parse(raw: string): CartItem[] { try { return validateCart(JSON.parse(raw)); } catch { return []; } }
function write(items: CartItem[]) {
  memory = JSON.stringify(items);
  try { window.localStorage.setItem(storageKey, memory); } catch { /* Remain usable in memory when storage is disabled. */ }
  window.dispatchEvent(new Event(eventName));
}
function subscribe(callback: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === storageKey || event.key === null) { memory = "[]"; callback(); } };
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", storage);
  return () => { window.removeEventListener(eventName, callback); window.removeEventListener("storage", storage); };
}
export function unitCents(item: CartItem) { return (catalog[item.product].prices as Record<string, number>)[item.size]; }
export function cartSubtotal(items: CartItem[]) { return items.reduce((sum,item) => sum + unitCents(item) * item.quantity, 0); }
export function addToCart(item: CartItem): "added" | "limit" | "expired" {
  if (item.product === "christmas" && !christmasOfferAvailable()) return "expired";
  if (validateCart([item]).length !== 1) return "limit";
  const items = parse(read());
  const existing = items.find(line => line.product === item.product && line.size === item.size);
  if (existing && existing.quantity + item.quantity > 5) return "limit";
  if (existing) existing.quantity += item.quantity;
  else items.push({ ...item });
  write(items); return "added";
}
export function changeCartItem(product: ProductKey, size: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 5) return;
  write(parse(read()).flatMap(line => line.product === product && line.size === size ? (quantity ? [{ ...line, quantity }] : []) : [line]));
}
export function clearSubmittedCart(snapshot: string) { if (read() === snapshot) write([]); }
export function useCart() {
  const snapshot = useSyncExternalStore(subscribe, read, () => "__loading__");
  const items = useMemo(() => parse(snapshot), [snapshot]);
  return { items, snapshot, ready: snapshot !== "__loading__", count: items.reduce((sum,item) => sum + item.quantity, 0), subtotal: cartSubtotal(items) };
}
