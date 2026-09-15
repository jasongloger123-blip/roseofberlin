"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { randomRequestKey } from "../lib/orders/client-key";
import RosePetalField from "../components/RosePetalField";

type Language = "en" | "de";
type Currency = "EUR" | "USD" | "AUD" | "NZD" | "TOP";
type ProductKey = "parfum" | "oil";
const countryCodes = "DE AT CH AU NZ TO US GB FR NL BE DK SE NO FI IE IT ES PT PL CZ LU CA JP SG FJ WS AS AD AE AF AG AI AL AM AO AQ AR AW AX AZ BA BB BD BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CC CD CF CG CI CK CL CM CN CO CR CU CV CW CX CY DJ DM DO DZ EC EE EG EH ER ET FK FM FO GA GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IL IM IN IO IQ IR IS JE JM JO KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NP NR NU OM PA PE PF PG PH PK PM PN PR PS PW PY QA RE RO RS RU RW SA SB SC SD SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TR TT TV TW TZ UA UG UM UY UZ VA VC VE VG VI VN VU WF YE YT ZA ZM ZW".split(" ");

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
    enquiry: "Purchase enquiry", easy: <>Your selection,<br /><em>made simple.</em></>, orderText: "Choose your product and enter your delivery address. You will receive an email confirmation. Selesitina will then check availability and shipping before sending your payment request.",
    shipping: "Shipping & additional costs", shippingText: "All prices exclude shipping. No VAT is charged. Currency conversion fees, payment-provider fees, import taxes and customs duties are not included and are paid by the customer.",
    product: "Product", size: "Size", quantity: "Quantity", email: "Your email address", selection: "Your selection", goods: "Product value", nonBinding: "This is a non-binding purchase enquiry, not a payment obligation.", send: "Send purchase enquiry", sending: "Sending…", success: "Your enquiry has been saved. Your confirmation will follow by email. Order number:", error: "Your enquiry could not be confirmed. Your details are still here. Please try again; repeating the same request will not create a duplicate order.",
    garden: "From garden to bottle", grown: <>Grown with<br /><em>time and care.</em></>, steps: [["Home-grown roses", "Red and yellow roses grow in the family garden."], ["Homemade rose water", "Freshly harvested petals are carefully processed into rose water."], ["Filled by hand", "Perfume and care oils are prepared in small batches."]],
    maker: "The maker", makerLead: "Born and raised in Tonga. At home in Germany for more than 30 years.", makerText: "Selesitina combines her love of flowers, natural scents and careful craftsmanship in Rose of Berlin. She personally oversees every step, from growing the roses to filling each bottle.",
    footer: "Handmade fragrances and oils from Hohenhameln.", imprint: "Legal notice", privacy: "Privacy policy", imprintText: <>Selesitina Gloger<br />Angerweg 15<br />31249 Hohenhameln<br />Germany<br /><a href="mailto:wagloger@web.de">wagloger@web.de</a></>, privacyText: "Controller: Selesitina Gloger, Angerweg 15, 31249 Hohenhameln, wagloger@web.de. We process your name, email, delivery address, optional phone number, product selection and order/payment/shipping status to handle your enquiry and fulfil your order (Art. 6(1)(b) GDPR). Order records and email delivery events are stored in Cloudflare D1. Transactional emails are sent through Resend (a service of Plus Five Five, Inc.). Hosting and email providers process these data on our behalf; processing outside the EU may occur, subject to applicable transfer safeguards, including standard contractual clauses. Data are retained for processing and applicable statutory retention obligations (Art. 6(1)(c) GDPR), then deleted. Payment details are shown only in private payment documents and emails; no card data are collected. The private document link grants access to order details: keep it confidential. A necessary session-storage entry holds only a request fingerprint and random key to prevent duplicate orders. Hashed, hourly identifiers limit abusive requests and expire shortly thereafter (Art. 6(1)(f) GDPR). You may request access, rectification, erasure, restriction and portability and, where applicable, object. You may complain to a supervisory authority, including the Lower Saxony data protection authority. No advertising cookies or analytics are used. The optional currency display requests exchange rates from open.er-api.com, which receives the IP address as part of that request.",
  },
  de: {
    nav: ["Produkte", "Handwerk", "Selesitina"], choose: "Auswählen", origin: "Handverlesen in Hohenhameln",
    hero: <>Ein Duft, der<br /><em>bei der Rose beginnt.</em></>, intro: "Rose of Berlin entsteht aus selbst angebauten Rosen und eigenem Rosenwasser – in kleinen Mengen von Hand gefertigt.",
    select: "Produkt auswählen", story: "Unsere Geschichte", collection: "Die Kollektion", made: <>Von Hand gemacht.<br /><em>Für dich abgefüllt.</em></>, collectionText: "Jede Flasche ist Teil einer kleinen Charge. Wähle deine gewünschte Größe und sende eine Kaufanfrage.",
    parfum: "Eau de Parfum", parfumTitle: "Rose of Berlin", parfumDesc: "Ein floraler Rosenduft aus selbst angebauten Rosen und eigenem Rosenwasser.", oil: "Haut- & Körperöl", oilTitle: "Rosenpflege", oilDesc: "Ein handgemachtes Pflegeöl mit Rosenduft für sanfte Momente im Alltag.",
    chooseProduct: "Dieses Produkt wählen", prices: "Preise", currency: "Währung", approximate: "Umrechnungen sind unverbindlich. Der endgültige Betrag wird in Euro vereinbart.",
    enquiry: "Kaufanfrage", easy: <>Deine Auswahl,<br /><em>ganz unkompliziert.</em></>, orderText: "Wähle dein Produkt und gib deine Lieferadresse an. Du erhältst eine Bestätigung per E-Mail. Selesitina prüft anschließend Verfügbarkeit und Versand und sendet dir die Zahlungsanforderung.",
    shipping: "Versand & Zusatzkosten", shippingText: "Alle Preise verstehen sich ohne Versandkosten. Es wird keine Mehrwertsteuer berechnet. Wechselkursgebühren, Gebühren des Zahlungsanbieters, Einfuhrabgaben und Zölle sind nicht enthalten und werden vom Kunden getragen.",
    product: "Produkt", size: "Größe", quantity: "Menge", email: "Deine E-Mail-Adresse", selection: "Deine Auswahl", goods: "Warenwert", nonBinding: "Dies ist eine unverbindliche Kaufanfrage, noch keine zahlungspflichtige Bestellung.", send: "Kaufanfrage senden", sending: "Wird gesendet…", success: "Deine Anfrage ist gespeichert. Die Bestätigung folgt per E-Mail. Bestellnummer:", error: "Deine Anfrage konnte nicht bestätigt werden. Deine Eingaben bleiben erhalten. Bitte erneut senden; dieselbe Anfrage erzeugt keine doppelte Bestellung.",
    garden: "Vom Garten zum Flakon", grown: <>Gewachsen mit<br /><em>Zeit und Sorgfalt.</em></>, steps: [["Eigener Anbau", "Rote und gelbe Rosen wachsen im eigenen Garten."], ["Eigenes Rosenwasser", "Aus frisch geernteten Blüten entsteht sorgfältig das Rosenwasser."], ["Von Hand abgefüllt", "Parfum und Pflegeöl werden in kleinen Chargen vorbereitet."]],
    maker: "Die Herstellerin", makerLead: "Geboren und aufgewachsen in Tonga. Seit über 30 Jahren in Deutschland zu Hause.", makerText: "Ihre Liebe zu Blumen, natürlichen Düften und sorgfältiger Handarbeit verbindet Selesitina in Rose of Berlin. Vom Rosenanbau bis zum Abfüllen begleitet sie jeden Schritt selbst.",
    footer: "Handgemachte Düfte & Öle aus Hohenhameln.", imprint: "Impressum", privacy: "Datenschutzerklärung", imprintText: <>Selesitina Gloger<br />Angerweg 15<br />31249 Hohenhameln<br />Deutschland<br /><a href="mailto:wagloger@web.de">wagloger@web.de</a></>, privacyText: "Verantwortlich: Selesitina Gloger, Angerweg 15, 31249 Hohenhameln, wagloger@web.de. Wir verarbeiten Namen, E-Mail-Adresse, Lieferadresse, freiwillig angegebene Telefonnummer, Produktauswahl sowie Bestell-, Zahlungs- und Versandstatus zur Bearbeitung deiner Anfrage und Abwicklung deiner Bestellung (Art. 6 Abs. 1 lit. b DSGVO). Bestellungen und Versandprotokolle für E-Mails werden in Cloudflare D1 gespeichert. Transaktionsmails versenden wir über Resend (Dienst der Plus Five Five, Inc.). Hosting- und Mailanbieter verarbeiten die Angaben in unserem Auftrag; eine Verarbeitung außerhalb der EU ist möglich, unter den anwendbaren Garantien für Drittlandübermittlungen einschließlich Standardvertragsklauseln. Wir speichern die Daten zur Abwicklung und zur Erfüllung gesetzlicher Aufbewahrungspflichten (Art. 6 Abs. 1 lit. c DSGVO) und löschen sie danach. Zahlungsdaten erscheinen ausschließlich in privaten Zahlungsübersichten und E-Mails; Kartendaten werden nicht erhoben. Der private Dokumentlink ermöglicht Zugriff auf Bestelldaten: bitte vertraulich behandeln. Ein technisch notwendiger Eintrag im Sitzungsspeicher enthält ausschließlich einen Anfrage-Fingerabdruck und einen Zufallsschlüssel zur Vermeidung doppelter Bestellungen. Gehashte stündliche Kennungen begrenzen missbräuchliche Anfragen und verfallen zeitnah (Art. 6 Abs. 1 lit. f DSGVO). Du hast Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und gegebenenfalls Widerspruch sowie Beschwerde bei einer Aufsichtsbehörde, etwa der Landesbeauftragten für den Datenschutz Niedersachsen. Diese Website verwendet keine Werbe-Cookies und keine Analyse-Dienste. Für die optionale Währungsanzeige werden Kurse von open.er-api.com abgerufen; dabei wird technisch die IP-Adresse übermittelt.",
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
  const sendingRef = useRef(false);
  const requestRef = useRef<{ fingerprint: string; key: string } | null>(null);
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
  function chooseProduct(next: ProductKey) { setProduct(next); setSizeIndex(0); if (status !== "success") setStatus("idle"); }

  async function submitInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingRef.current || status === "success") return;
    sendingRef.current = true;
    setStatus("sending"); setMessage("");
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
    const body = { ...fields, product, size: option.size, quantity, email, language };
    try {
      const canPersistHash = Boolean(crypto.subtle);
      const fingerprint = canPersistHash ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(body)))), b => b.toString(16).padStart(2, "0")).join("") : JSON.stringify(body);
      let cached: { fingerprint: string; key: string } | null = null;
      try { cached = JSON.parse(sessionStorage.getItem("rob-order-retry") || "null"); } catch { /* Device storage is optional. */ }
      const previous = requestRef.current ?? cached;
      const key = previous?.fingerprint === fingerprint ? previous.key : randomRequestKey();
      requestRef.current = { fingerprint, key };
      try { if (canPersistHash) sessionStorage.setItem("rob-order-retry", JSON.stringify({ fingerprint, key })); } catch { /* No address or payment data is stored here. */ }
      const response = await fetch("/api/interesse", {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
      });
      const data = await response.json() as { error?: string; orderNumber?: string };
      if (!response.ok) {
        if (response.status === 429) throw new Error(language === "de" ? "Zu viele Anfragen. Bitte versuche es in einer Stunde erneut." : "Too many enquiries. Please try again in one hour.");
        if (response.status === 400) throw new Error(language === "de" ? "Bitte prüfe deine Auswahl, Kontaktdaten und Lieferadresse." : "Please check your selection, contact details and delivery address.");
        if (response.status === 409) throw new Error(language === "de" ? "Diese Anfrage wurde bereits mit anderen Angaben übermittelt. Bitte lade die Seite neu." : "This request was already submitted with different details. Please reload the page.");
        throw new Error(t.error);
      }
      setStatus("success"); setMessage(`${t.success}${data.orderNumber ? ` ${data.orderNumber}` : ""}`);
    } catch (error) { setStatus("error"); setMessage(error instanceof Error && error.name === "Error" ? error.message : t.error); }
    finally { sendingRef.current = false; }
  }

  return <main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "Brand", name: "Rose of Berlin", description: "Handmade rose perfume and body oil by Selesitina Gloger", founder: { "@type": "Person", name: "Selesitina Gloger" }, address: { "@type": "PostalAddress", streetAddress: "Angerweg 15", postalCode: "31249", addressLocality: "Hohenhameln", addressCountry: "DE" } }) }} />
    <header className="site-header"><a className="wordmark" href="#start" aria-label="Selesitina home"><span className="mark">S</span><span>SELESITINA</span></a><nav aria-label="Main navigation"><a href="#produkte">{t.nav[0]}</a><a href="#handwerk">{t.nav[1]}</a><a href="#selesitina">{t.nav[2]}</a></nav><div className="header-tools"><button className="language-switch" onClick={() => setLanguage(language === "en" ? "de" : "en")} aria-label="Change language">{language === "en" ? "DE" : "EN"}</button><a className="header-cta" href="#bestellen">{t.choose}</a></div></header>
    <section id="start" className="hero"><div className="hero-copy"><p className="eyebrow">{t.origin}</p><h1>{t.hero}</h1><p className="intro">{t.intro}</p><div className="hero-actions"><a className="button primary" href="#bestellen">{t.select}</a><a className="text-link" href="#handwerk">{t.story} <span>↓</span></a></div></div><figure className="hero-visual"><img src="/rose-of-berlin-hero.jpeg" alt="Rose of Berlin Eau de Parfum surrounded by pink roses" /><RosePetalField /><figcaption>Red Rose · Selected by Selesitina</figcaption></figure></section>
    <section id="produkte" className="products-section"><div className="section-heading"><p className="eyebrow">{t.collection}</p><h2>{t.made}</h2><p>{t.collectionText}</p></div><div className="pricing-toolbar"><label>{t.currency}<select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>{(["EUR","USD","AUD","NZD","TOP"] as Currency[]).map((code) => <option key={code} value={code}>{code}</option>)}</select></label><p>{t.approximate}</p></div><div className="product-cards">{(Object.keys(products) as ProductKey[]).map((key) => <article className="product-card" key={key}><img src={products[key].image} alt={key === "parfum" ? "Hand-filled Rose of Berlin perfume bottles" : "Hand-filled skin and body oil"} /><div className="product-card-copy"><p className="eyebrow">{label(key)}</p><h3>{title(key)}</h3><p>{description(key)}</p><ul className="price-list" aria-label={`${t.prices}: ${title(key)}`}>{products[key].options.map((price) => <li key={price.size}><span>{price.size}</span><strong>{formatMoney(price.price)}</strong></li>)}</ul><button className="button outline" onClick={() => { chooseProduct(key); document.querySelector("#bestellen")?.scrollIntoView({ behavior: "smooth" }); }}>{t.chooseProduct}</button></div></article>)}</div></section>
    <section id="bestellen" className="order-section"><div className="order-intro"><p className="eyebrow">{t.enquiry}</p><h2>{t.easy}</h2><p>{t.orderText}</p><div className="shipping-note"><span>{t.shipping}</span><p>{t.shippingText}</p></div></div><form className="order-form" onSubmit={submitInterest} aria-busy={status === "sending"}><fieldset><legend>1 · {t.product}</legend><div className="choice-grid two">{(Object.keys(products) as ProductKey[]).map((key) => <label className={product === key ? "choice active" : "choice"} key={key}><input type="radio" name="product" value={key} checked={product === key} onChange={() => chooseProduct(key)} /><span>{label(key)}</span></label>)}</div></fieldset><fieldset><legend>2 · {t.size}</legend><div className="choice-grid sizes">{selected.options.map((item, index) => <label className={sizeIndex === index ? "choice active" : "choice"} key={item.size}><input type="radio" name="size" value={item.size} checked={sizeIndex === index} onChange={() => setSizeIndex(index)} /><span>{item.size}<small>{formatMoney(item.price)}</small></span></label>)}</div></fieldset><div className="form-row"><label className="field quantity-field">{t.quantity}<select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>{[1,2,3,4,5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label><label className="field">{t.email}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" maxLength={254} required /></label></div><fieldset className="address-fields"><legend>3 · {language === "de" ? "Kontakt & Lieferadresse" : "Contact & delivery address"}</legend><p className="form-note">{language === "de" ? "Alle Felder sind Pflichtfelder, sofern nicht als optional gekennzeichnet." : "All fields are required unless marked optional."}</p>
      <div className="address-grid">
        <label className="field">{language === "de" ? "Vorname" : "First name"}<input name="firstName" autoComplete="given-name" maxLength={80} required /></label>
        <label className="field">{language === "de" ? "Nachname" : "Last name"}<input name="lastName" autoComplete="family-name" maxLength={80} required /></label>
        <label className="field full">{language === "de" ? "Straße + Hausnummer" : "Street + house number"}<input name="addressLine1" autoComplete="address-line1" maxLength={200} required /></label>
        <label className="field full">{language === "de" ? "Adresszusatz (optional)" : "Address line 2 (optional)"}<input name="addressLine2" autoComplete="address-line2" maxLength={200} /></label>
        <label className="field">{language === "de" ? "PLZ" : "Postal code"}<input name="postalCode" autoComplete="postal-code" maxLength={20} required /></label>
        <label className="field">{language === "de" ? "Stadt" : "City"}<input name="city" autoComplete="address-level2" maxLength={100} required /></label>
        <label className="field full">{language === "de" ? "Land" : "Country"}<select name="country" autoComplete="country" defaultValue="DE" required>{countryCodes.map(code => <option value={code} key={code}>{new Intl.DisplayNames([language], { type: "region" }).of(code)}</option>)}</select></label>
        <label className="field full">{language === "de" ? "Telefonnummer (optional)" : "Phone number (optional)"}<input type="tel" name="phone" autoComplete="tel" maxLength={40} /></label>
      </div></fieldset><label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label><div className="order-summary"><div><span>{t.selection}</span><strong>{label(product)} · {option.size} · {quantity}×</strong></div><div><span>{t.goods}</span><strong>{formatMoney(total)}</strong></div></div><p className="form-note">{currency !== "EUR" && <strong>{language === "de" ? "Warenwert in EUR: " : "Subtotal in EUR: "}{new Intl.NumberFormat(language, { style: "currency", currency: "EUR" }).format(total)}. </strong>}{t.approximate}</p><p className="form-note">{t.nonBinding} <a href="#datenschutz">{t.privacy}</a></p><button className="button primary submit" disabled={status === "sending" || status === "success"}>{status === "sending" ? t.sending : t.send}</button><div className={`form-message ${status}`} aria-live="polite">{message}</div>{status === "success" && <button className="button outline submit" type="button" onClick={() => { requestRef.current = null; try { sessionStorage.removeItem("rob-order-retry"); } catch {} setStatus("idle"); setMessage(""); }}>{language === "de" ? "Weitere Anfrage erstellen" : "Start another enquiry"}</button>}</form></section>
    <section id="handwerk" className="craft-section"><div className="craft-image"><img src="/rose-oil-process.jpeg" alt="Homemade rose water and hand-filled oils" /></div><div className="craft-copy"><p className="eyebrow">{t.garden}</p><h2>{t.grown}</h2><ol>{t.steps.map((step, index) => <li key={step[0]}><span>0{index + 1}</span><div><h3>{step[0]}</h3><p>{step[1]}</p></div></li>)}</ol></div></section>
    <section id="selesitina" className="maker-section"><div className="maker-mark"><img src="/rose-of-berlin-label.jpeg" alt="Rose of Berlin label with rose motif" /></div><div className="maker-copy"><p className="eyebrow">{t.maker}</p><h2>Selesitina Gloger</h2><p className="maker-lead">{t.makerLead}</p><p>{t.makerText}</p></div></section>
    <footer><a className="wordmark" href="#start"><span className="mark">S</span><span>SELESITINA</span></a><p>{t.footer}</p><div className="footer-links"><a href="#impressum">{t.imprint}</a><a href="#datenschutz">{t.privacy}</a></div></footer>
    <section id="impressum" className="legal"><h2>{t.imprint}</h2><p>{t.imprintText}</p></section><section id="datenschutz" className="legal"><h2>{t.privacy}</h2><p>{t.privacyText}</p></section>
  </main>;
}
