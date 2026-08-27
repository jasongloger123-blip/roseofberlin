"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import RosePetalField from "../components/RosePetalField";

type Language = "en" | "de";
type Currency = "EUR" | "USD" | "AUD" | "NZD" | "TOP";
type ProductKey = "parfum" | "oil";

const products = {
  parfum: { image: "/small-batch.jpeg", options: [{ size: "20 ml", price: 19.9 }, { size: "30 ml", price: 24.9 }, { size: "50 ml", price: 34.9 }, { size: "100 ml", price: 49.9 }] },
  oil: { image: "/handmade-sprays.jpeg", options: [{ size: "20 ml", price: 9 }, { size: "100 ml", price: 15 }] },
} as const;

const fallbackRates: Record<Currency, number> = { EUR: 1, USD: 1.17, AUD: 1.8, NZD: 1.96, TOP: 2.75 };

const copy = {
  en: {
    nav: ["Products", "Craft", "Selesitina"], choose: "Choose", origin: "Hand-selected in Hohenhameln",
    hero: <>A fragrance that<br /><em>begins with the rose.</em></>, intro: "Rose of Berlin is created from home-grown roses and homemade rose water — handcrafted in small batches.",
    select: "Choose a product", story: "Our story", collection: "The collection", made: <>Made by hand.<br /><em>Bottled for you.</em></>, collectionText: "Every bottle belongs to a small batch. Choose your preferred size and send a purchase enquiry.",
    parfum: "Eau de Parfum", parfumTitle: "Rose of Berlin", parfumDesc: "A floral rose fragrance made with home-grown roses and our own rose water.", oil: "Skin & Body Oil", oilTitle: "Rose care", oilDesc: "A handmade rose-scented care oil for gentle everyday moments.",
    chooseProduct: "Choose this product", prices: "Prices", currency: "Currency", approximate: "Converted prices are estimates. The final amount is agreed in EUR.",
    enquiry: "Purchase enquiry", easy: <>Your selection,<br /><em>made simple.</em></>, orderText: "Choose a product, size and quantity. Selesitina will contact you by email about availability, payment and shipping.",
    shipping: "Shipping & additional costs", shippingText: "All prices exclude shipping. No VAT is charged. Currency conversion fees, payment-provider fees, import taxes and customs duties are not included and are paid by the customer.",
    product: "Product", size: "Size", quantity: "Quantity", email: "Your email address", selection: "Your selection", goods: "Product value", nonBinding: "This is a non-binding purchase enquiry, not a payment obligation.", send: "Send purchase enquiry", sending: "Sending…", success: "Thank you. We will contact you about your order by email.", error: "Please try again later.",
    garden: "From garden to bottle", grown: <>Grown with<br /><em>time and care.</em></>, steps: [["Home-grown roses", "Red and yellow roses grow in the family garden."], ["Homemade rose water", "Freshly harvested petals are carefully processed into rose water."], ["Filled by hand", "Perfume and care oils are prepared in small batches."]],
    maker: "The maker", makerLead: "Born and raised in Tonga. At home in Germany for more than 30 years.", makerText: "Selesitina combines her love of flowers, natural scents and careful craftsmanship in Rose of Berlin. She personally oversees every step, from growing the roses to filling each bottle.",
    footer: "Handmade fragrances and oils from Hohenhameln.", imprint: "Legal notice", privacy: "Privacy policy", imprintText: <>Selesitina Gloger<br />Angerweg 15<br />31249 Hohenhameln<br />Germany<br /><a href="mailto:wagloger@web.de">wagloger@web.de</a></>, privacyText: "Controller: Selesitina Gloger, Angerweg 15, 31249 Hohenhameln. When you submit a purchase enquiry, we process your email address, product, size and quantity solely to answer and fulfil your enquiry. The notification is sent through FormSubmit. Data is retained only as long as necessary for processing and statutory obligations. You may request access, correction, deletion or restriction by emailing wagloger@web.de. No advertising cookies or analytics are used on this website.",
  },
  de: {
    nav: ["Produkte", "Handwerk", "Selesitina"], choose: "Auswählen", origin: "Handverlesen in Hohenhameln",
    hero: <>Ein Duft, der<br /><em>bei der Rose beginnt.</em></>, intro: "Rose of Berlin entsteht aus selbst angebauten Rosen und eigenem Rosenwasser – in kleinen Mengen von Hand gefertigt.",
    select: "Produkt auswählen", story: "Unsere Geschichte", collection: "Die Kollektion", made: <>Von Hand gemacht.<br /><em>Für dich abgefüllt.</em></>, collectionText: "Jede Flasche ist Teil einer kleinen Charge. Wähle deine gewünschte Größe und sende eine Kaufanfrage.",
    parfum: "Eau de Parfum", parfumTitle: "Rose of Berlin", parfumDesc: "Ein floraler Rosenduft aus selbst angebauten Rosen und eigenem Rosenwasser.", oil: "Haut- & Körperöl", oilTitle: "Rosenpflege", oilDesc: "Ein handgemachtes Pflegeöl mit Rosenduft für sanfte Momente im Alltag.",
    chooseProduct: "Dieses Produkt wählen", prices: "Preise", currency: "Währung", approximate: "Umrechnungen sind unverbindlich. Der endgültige Betrag wird in Euro vereinbart.",
    enquiry: "Kaufanfrage", easy: <>Deine Auswahl,<br /><em>ganz unkompliziert.</em></>, orderText: "Wähle Produkt, Größe und Menge. Selesitina meldet sich per E-Mail mit Verfügbarkeit, Zahlung und Versand.",
    shipping: "Versand & Zusatzkosten", shippingText: "Alle Preise verstehen sich ohne Versandkosten. Es wird keine Mehrwertsteuer berechnet. Wechselkursgebühren, Gebühren des Zahlungsanbieters, Einfuhrabgaben und Zölle sind nicht enthalten und werden vom Kunden getragen.",
    product: "Produkt", size: "Größe", quantity: "Menge", email: "Deine E-Mail-Adresse", selection: "Deine Auswahl", goods: "Warenwert", nonBinding: "Dies ist eine unverbindliche Kaufanfrage, noch keine zahlungspflichtige Bestellung.", send: "Kaufanfrage senden", sending: "Wird gesendet…", success: "Vielen Dank. Wir melden uns zur Bestellung per E-Mail.", error: "Bitte versuche es später erneut.",
    garden: "Vom Garten zum Flakon", grown: <>Gewachsen mit<br /><em>Zeit und Sorgfalt.</em></>, steps: [["Eigener Anbau", "Rote und gelbe Rosen wachsen im eigenen Garten."], ["Eigenes Rosenwasser", "Aus frisch geernteten Blüten entsteht sorgfältig das Rosenwasser."], ["Von Hand abgefüllt", "Parfum und Pflegeöl werden in kleinen Chargen vorbereitet."]],
    maker: "Die Herstellerin", makerLead: "Geboren und aufgewachsen in Tonga. Seit über 30 Jahren in Deutschland zu Hause.", makerText: "Ihre Liebe zu Blumen, natürlichen Düften und sorgfältiger Handarbeit verbindet Selesitina in Rose of Berlin. Vom Rosenanbau bis zum Abfüllen begleitet sie jeden Schritt selbst.",
    footer: "Handgemachte Düfte & Öle aus Hohenhameln.", imprint: "Impressum", privacy: "Datenschutzerklärung", imprintText: <>Selesitina Gloger<br />Angerweg 15<br />31249 Hohenhameln<br />Deutschland<br /><a href="mailto:wagloger@web.de">wagloger@web.de</a></>, privacyText: "Verantwortlich: Selesitina Gloger, Angerweg 15, 31249 Hohenhameln. Bei einer Kaufanfrage verarbeiten wir E-Mail-Adresse, Produkt, Größe und Menge ausschließlich zur Bearbeitung und Erfüllung der Anfrage. Die Benachrichtigung wird über FormSubmit versendet. Daten werden nur so lange gespeichert, wie dies für die Bearbeitung und gesetzliche Pflichten erforderlich ist. Auskunft, Berichtigung, Löschung oder Einschränkung können per E-Mail an wagloger@web.de verlangt werden. Diese Website verwendet keine Werbe-Cookies und keine Analyse-Dienste.",
  },
} as const;

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [rates, setRates] = useState(fallbackRates);
  const [product, setProduct] = useState<ProductKey>("parfum");
  const [sizeIndex, setSizeIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const t = copy[language];
  const selected = products[product];
  const option = selected.options[sizeIndex] ?? selected.options[0];

  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/EUR").then((response) => response.ok ? response.json() : Promise.reject()).then((data: { rates?: Partial<Record<Currency, number>> }) => setRates((current) => ({ ...current, USD: data.rates?.USD ?? current.USD, AUD: data.rates?.AUD ?? current.AUD, NZD: data.rates?.NZD ?? current.NZD, TOP: data.rates?.TOP ?? current.TOP }))).catch(() => undefined);
  }, []);

  const formatMoney = (value: number) => new Intl.NumberFormat(language === "de" ? "de-DE" : "en-US", { style: "currency", currency }).format(value * rates[currency]);
  const total = useMemo(() => option.price * quantity, [option.price, quantity]);
  const label = (key: ProductKey) => key === "parfum" ? t.parfum : t.oil;
  const title = (key: ProductKey) => key === "parfum" ? t.parfumTitle : t.oilTitle;
  const description = (key: ProductKey) => key === "parfum" ? t.parfumDesc : t.oilDesc;
  function chooseProduct(next: ProductKey) { setProduct(next); setSizeIndex(0); setStatus("idle"); }

  async function submitInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("sending"); setMessage("");
    const honeypot = new FormData(event.currentTarget).get("website")?.toString() ?? "";
    if (honeypot) { setStatus("success"); setMessage(t.success); return; }
    try {
      const response = await fetch("https://formsubmit.co/ajax/wagloger@web.de", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({
          _subject: `Neue Kaufanfrage: ${label(product)} ${option.size}`,
          Produkt: label(product),
          Größe: option.size,
          Menge: String(quantity),
          Einzelpreis: `${option.price.toFixed(2).replace(".", ",")} €`,
          Gesamt: `${total.toFixed(2).replace(".", ",")} €`,
          "Angezeigte Währung": currency,
          "Angezeigter Gesamtbetrag": formatMoney(total),
          Sprache: language,
          "Kunden-E-Mail": email.trim().toLowerCase(),
          _replyto: email.trim().toLowerCase(),
          _template: "table",
          _captcha: "false",
        }),
      });
      const data = (await response.json()) as { success?: string | boolean; message?: string };
      const sent = response.ok && (data.success === true || data.success === "true");
      if (!sent) throw new Error(data.message || t.error);
      setStatus("success"); setMessage(t.success); setEmail("");
    } catch { setStatus("error"); setMessage(t.error); }
  }

  return <main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "Brand", name: "Rose of Berlin", description: "Handmade rose perfume and body oil by Selesitina Gloger", founder: { "@type": "Person", name: "Selesitina Gloger" }, address: { "@type": "PostalAddress", streetAddress: "Angerweg 15", postalCode: "31249", addressLocality: "Hohenhameln", addressCountry: "DE" } }) }} />
    <header className="site-header"><a className="wordmark" href="#start" aria-label="Selesitina home"><span className="mark">S</span><span>SELESITINA</span></a><nav aria-label="Main navigation"><a href="#produkte">{t.nav[0]}</a><a href="#handwerk">{t.nav[1]}</a><a href="#selesitina">{t.nav[2]}</a></nav><div className="header-tools"><button className="language-switch" onClick={() => setLanguage(language === "en" ? "de" : "en")} aria-label="Change language">{language === "en" ? "DE" : "EN"}</button><a className="header-cta" href="#bestellen">{t.choose}</a></div></header>
    <section id="start" className="hero"><div className="hero-copy"><p className="eyebrow">{t.origin}</p><h1>{t.hero}</h1><p className="intro">{t.intro}</p><div className="hero-actions"><a className="button primary" href="#bestellen">{t.select}</a><a className="text-link" href="#handwerk">{t.story} <span>↓</span></a></div></div><figure className="hero-visual"><img src="/rose-of-berlin-hero.jpeg" alt="Rose of Berlin Eau de Parfum surrounded by pink roses" /><RosePetalField /><figcaption>Red Rose · Selected by Selesitina</figcaption></figure></section>
    <section id="produkte" className="products-section"><div className="section-heading"><p className="eyebrow">{t.collection}</p><h2>{t.made}</h2><p>{t.collectionText}</p></div><div className="pricing-toolbar"><label>{t.currency}<select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>{(["EUR","USD","AUD","NZD","TOP"] as Currency[]).map((code) => <option key={code} value={code}>{code}</option>)}</select></label><p>{t.approximate}</p></div><div className="product-cards">{(Object.keys(products) as ProductKey[]).map((key) => <article className="product-card" key={key}><img src={products[key].image} alt={key === "parfum" ? "Hand-filled Rose of Berlin perfume bottles" : "Hand-filled skin and body oil"} /><div className="product-card-copy"><p className="eyebrow">{label(key)}</p><h3>{title(key)}</h3><p>{description(key)}</p><ul className="price-list" aria-label={`${t.prices}: ${title(key)}`}>{products[key].options.map((price) => <li key={price.size}><span>{price.size}</span><strong>{formatMoney(price.price)}</strong></li>)}</ul><button className="button outline" onClick={() => { chooseProduct(key); document.querySelector("#bestellen")?.scrollIntoView({ behavior: "smooth" }); }}>{t.chooseProduct}</button></div></article>)}</div></section>
    <section id="bestellen" className="order-section"><div className="order-intro"><p className="eyebrow">{t.enquiry}</p><h2>{t.easy}</h2><p>{t.orderText}</p><div className="shipping-note"><span>{t.shipping}</span><p>{t.shippingText}</p></div></div><form className="order-form" onSubmit={submitInterest}><fieldset><legend>1 · {t.product}</legend><div className="choice-grid two">{(Object.keys(products) as ProductKey[]).map((key) => <label className={product === key ? "choice active" : "choice"} key={key}><input type="radio" name="product" value={key} checked={product === key} onChange={() => chooseProduct(key)} /><span>{label(key)}</span></label>)}</div></fieldset><fieldset><legend>2 · {t.size}</legend><div className="choice-grid sizes">{selected.options.map((item, index) => <label className={sizeIndex === index ? "choice active" : "choice"} key={item.size}><input type="radio" name="size" value={item.size} checked={sizeIndex === index} onChange={() => setSizeIndex(index)} /><span>{item.size}<small>{formatMoney(item.price)}</small></span></label>)}</div></fieldset><div className="form-row"><label className="field quantity-field">{t.quantity}<select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>{[1,2,3,4,5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label><label className="field">{t.email}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required /></label></div><label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label><div className="order-summary"><div><span>{t.selection}</span><strong>{label(product)} · {option.size} · {quantity}×</strong></div><div><span>{t.goods}</span><strong>{formatMoney(total)}</strong></div></div><p className="form-note">{t.approximate}</p><p className="form-note">{t.nonBinding}</p><button className="button primary submit" disabled={status === "sending"}>{status === "sending" ? t.sending : t.send}</button><div className={`form-message ${status}`} aria-live="polite">{message}</div></form></section>
    <section id="handwerk" className="craft-section"><div className="craft-image"><img src="/rose-oil-process.jpeg" alt="Homemade rose water and hand-filled oils" /></div><div className="craft-copy"><p className="eyebrow">{t.garden}</p><h2>{t.grown}</h2><ol>{t.steps.map((step, index) => <li key={step[0]}><span>0{index + 1}</span><div><h3>{step[0]}</h3><p>{step[1]}</p></div></li>)}</ol></div></section>
    <section id="selesitina" className="maker-section"><div className="maker-mark"><img src="/rose-of-berlin-label.jpeg" alt="Rose of Berlin label with rose motif" /></div><div className="maker-copy"><p className="eyebrow">{t.maker}</p><h2>Selesitina Gloger</h2><p className="maker-lead">{t.makerLead}</p><p>{t.makerText}</p></div></section>
    <footer><a className="wordmark" href="#start"><span className="mark">S</span><span>SELESITINA</span></a><p>{t.footer}</p><div className="footer-links"><a href="#impressum">{t.imprint}</a><a href="#datenschutz">{t.privacy}</a></div></footer>
    <section id="impressum" className="legal"><h2>{t.imprint}</h2><p>{t.imprintText}</p></section><section id="datenschutz" className="legal"><h2>{t.privacy}</h2><p>{t.privacyText}</p></section>
  </main>;
}
