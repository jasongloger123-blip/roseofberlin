export const runtime = "nodejs";

const catalog = {
  parfum: { label: "Rose of Berlin · Eau de Parfum", prices: { "20 ml": 1990, "30 ml": 2490, "50 ml": 3490, "100 ml": 4990 } },
  oil: { label: "Rose of Berlin · Haut- & Körperöl", prices: { "20 ml": 900, "100 ml": 1500 } },
} as const;

function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; product?: keyof typeof catalog; size?: string; quantity?: number; website?: string; currency?: string; displayedTotal?: string; language?: string };
    if (body.website) return Response.json({ ok: true }, { status: 201 });
    const email = body.email?.trim().toLowerCase() ?? "";
    const item = body.product ? catalog[body.product] : undefined;
    const quantity = Number(body.quantity);
    const price = item && body.size ? item.prices[body.size as keyof typeof item.prices] : undefined;

    if (!validEmail(email) || !item || !body.size || !price || !Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
      return Response.json({ error: "Bitte prüfe deine Auswahl und E-Mail-Adresse." }, { status: 400 });
    }

    let notificationStatus = "failed";
    try {
      const notification = await fetch("https://formsubmit.co/ajax/wagloger@web.de", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `Neue Kaufanfrage: ${item.label} ${body.size}`,
          Produkt: item.label,
          Größe: body.size,
          Menge: String(quantity),
          Einzelpreis: `${(price / 100).toFixed(2).replace(".", ",")} €`,
          Gesamt: `${((price * quantity) / 100).toFixed(2).replace(".", ",")} €`,
          "Angezeigte Währung": body.currency ?? "EUR",
          "Angezeigter Gesamtbetrag": body.displayedTotal ?? "–",
          Sprache: body.language ?? "en",
          "Kunden-E-Mail": email,
          _replyto: email,
          _template: "table",
          _captcha: "false",
        }),
      });
      notificationStatus = notification.ok ? "sent" : "failed";
    } catch { notificationStatus = "failed"; }

    if (notificationStatus !== "sent") {
      return Response.json({ error: "Die Benachrichtigung konnte nicht gesendet werden. Bitte versuche es später erneut." }, { status: 502 });
    }

    return Response.json({ ok: true, notificationStatus }, { status: 201 });
  } catch (error) {
    console.error("[api/interesse] Kaufanfrage fehlgeschlagen", error);
    return Response.json({ error: "Die Anfrage konnte nicht gesendet werden. Bitte versuche es später erneut." }, { status: 500 });
  }
}
