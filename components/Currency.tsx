"use client";
import { useSyncExternalStore } from "react";
import { currencies, displayPrice, isCurrency, validRates, type Currency, type ExchangeRates } from "../lib/currencies";
import type { ShopLanguage } from "../lib/storefront";
import savedRates from "../lib/exchange-rates-snapshot.json";
const key = "rose-of-berlin-currency-v1";
type State = { currency: Currency; rates: ExchangeRates; updatedAt: string | null; status: "loading" | "ready" | "error" };
const initial: State = { currency: "EUR", rates: { EUR: 1 }, updatedAt: null, status: "loading" };
let state = initial;
function recentSnapshot(): State {
  return Date.now() - savedRates.time_last_update_unix * 1000 <= 7 * 86400000
    ? { currency: "EUR", rates: validRates(savedRates.rates), updatedAt: new Date(savedRates.time_last_update_unix * 1000).toISOString(), status: "ready" }
    : initial;
}
let started = false;
const listeners = new Set<() => void>();
function emit(next: State) { state = next; listeners.forEach(listener => listener()); }
function storedCurrency(): Currency {
  try { const saved = localStorage.getItem(key); return isCurrency(saved) ? saved : "EUR"; } catch { return state.currency; }
}
function start() {
  if (started) return;
  started = true;
  emit({ ...recentSnapshot(), currency: storedCurrency() });
  fetch("/api/exchange-rates").then(async response => {
    if (!response.ok) throw new Error("Rates unavailable");
    const data = await response.json();
    const rates = validRates(data.rates);
    if (!rates.USD || typeof data.updatedAt !== "string") throw new Error("Invalid rates");
    emit({ ...state, rates, updatedAt: data.updatedAt, status: "ready" });
  }).catch(() => { if (state.status !== "ready") emit({ ...state, rates: { EUR: 1 }, status: "error" }); });
}
function storage(event: StorageEvent) { if (event.key === key || event.key === null) emit({ ...state, currency: storedCurrency() }); }
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", storage);
  start();
  return () => { listeners.delete(listener); if (!listeners.size) window.removeEventListener("storage", storage); };
}
function snapshot() { return state; }
function serverSnapshot() { return initial; }
function useCurrency() { return useSyncExternalStore(subscribe, snapshot, serverSnapshot); }
function selectCurrency(value: string) {
  if (!isCurrency(value) || !state.rates[value]) return;
  try { localStorage.setItem(key, value); } catch { /* Keep selection in memory. */ }
  emit({ ...state, currency: value });
}
export function Price({ amount, language }: { amount: number; language: ShopLanguage }) {
  const { currency, rates } = useCurrency();
  return <>{displayPrice(amount, language, currency, rates)}</>;
}
export function CurrencySelector({ language }: { language: ShopLanguage }) {
  const { currency, rates, status } = useCurrency();
  return <label className="currency-selector"><span className="sr-only">{language === "de" ? "Währung auswählen" : "Choose currency"}</span><select aria-label={language === "de" ? "Währung auswählen" : "Choose currency"} value={rates[currency] ? currency : "EUR"} onChange={event => selectCurrency(event.target.value)}>{currencies.map(code => <option key={code} value={code} disabled={!rates[code]}>{code}</option>)}</select>{status === "loading" ? <span className="sr-only" role="status">{language === "de" ? "Wechselkurse werden geladen" : "Loading exchange rates"}</span> : null}</label>;
}
