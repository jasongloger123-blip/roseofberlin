import { validRates } from "../../../lib/currencies";
import snapshot from "../../../lib/exchange-rates-snapshot.json";
export async function GET() {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/EUR", { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Rates unavailable");
    const data = await response.json();
    if (data.result !== "success" || data.base_code !== "EUR" || typeof data.time_last_update_unix !== "number" || Date.now() - data.time_last_update_unix * 1000 > 7 * 86400000) throw new Error("Invalid rates");
    const rates = validRates(data.rates);
    if (!rates.USD) throw new Error("Missing rates");
    return Response.json({ rates, updatedAt: new Date(data.time_last_update_unix * 1000).toISOString() }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } });
  } catch {
    if (Date.now() - snapshot.time_last_update_unix * 1000 <= 7 * 86400000) {
      return Response.json({ rates: validRates(snapshot.rates), updatedAt: new Date(snapshot.time_last_update_unix * 1000).toISOString() }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
    }
    return Response.json({ rates: { EUR: 1 }, updatedAt: null }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
