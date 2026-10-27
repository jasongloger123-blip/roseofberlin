export const currencies = ["EUR", "USD", "AUD", "NZD", "TOP", "GBP", "CHF", "CAD"] as const;
export type Currency = typeof currencies[number];
export type ExchangeRates = Partial<Record<Currency, number>>;
export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && currencies.includes(value as Currency);
}
export function validRates(value: unknown): ExchangeRates {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rates: ExchangeRates = { EUR: 1 };
  for (const code of currencies) {
    const rate = source[code];
    if (code !== "EUR" && typeof rate === "number" && Number.isFinite(rate) && rate > 0) rates[code] = rate;
  }
  return rates;
}
export function displayPrice(value: number, language: "de" | "en", currency: Currency, rates: ExchangeRates) {
  const selected = rates[currency] ? currency : "EUR";
  const amount = new Intl.NumberFormat(language === "de" ? "de-DE" : "en-IE", { style: "currency", currency: selected, currencyDisplay: selected === "EUR" ? "symbol" : "code" }).format(value * (rates[selected] ?? 1));
  return selected === "EUR" ? amount : `≈ ${amount}`;
}
