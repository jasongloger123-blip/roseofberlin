import { currencies, validRates } from "../../../lib/currencies";

const endpoints = [
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json",
  "https://latest.currency-api.pages.dev/v1/currencies/eur.json",
];
const maximumAge = 7 * 86400000;

export async function GET() {
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) continue;

      const data = await response.json();
      if (typeof data?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) continue;
      const timestamp = Date.parse(data.date);
      const age = Date.now() - timestamp;
      if (!Number.isFinite(age) || age < 0 || age > maximumAge) continue;

      const rates = validRates(Object.fromEntries(
        currencies.map(code => [code, data.eur?.[code.toLowerCase()]]),
      ));
      if (!currencies.every(code => rates[code])) continue;

      return Response.json({ rates, updatedAt: new Date(timestamp).toISOString() }, {
        headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
      });
    } catch {
      // Try the mirror when the primary host is unavailable or returns invalid JSON.
    }
  }
  return Response.json({ rates: { EUR: 1 }, updatedAt: null }, {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}
