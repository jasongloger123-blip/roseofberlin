"use client";

import { FormEvent, useMemo, useState } from "react";

const products = {
  parfum: { name: "Rose of Berlin · Eau de Parfum", eyebrow: "Eau de Parfum", description: "Ein floraler Rosenduft aus selbst angebauten Rosen und eigenem Rosenwasser.", image: "/small-batch.jpeg", options: [{ size: "15 ml", price: 5.9 }, { size: "20 ml", price: 12.49 }, { size: "30 ml", price: 18.6 }, { size: "50 ml", price: 24.5 }, { size: "100 ml", price: 35.7 }] },
  oil: { name: "Rose of Berlin · Haut- & Körperöl", eyebrow: "Haut- & Körperöl", description: "Ein handgemachtes Pflegeöl mit Rosenduft für sanfte Momente im Alltag.", image: "/handmade-sprays.jpeg", options: [{ size: "20 ml", price: 9 }, { size: "100 ml", price: 15 }] },
} as const;

type ProductKey = keyof typeof products;
const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export default function Home() {
  const [product, setProduct] = useState<ProductKey>("parfum");
  const [sizeIndex, setSizeIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const selected = products[product];
  const option = selected.options[sizeIndex] ?? selected.options[0];
  const total = useMemo(() => option.price * quantity, [option.price, quantity]);

  function chooseProduct(next: ProductKey) { setProduct(next); setSizeIndex(0); setStatus("idle"); }

  async function submitInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("sending"); setMessage("");
    const honeypot = new FormData(event.currentTarget).get("website")?.toString() ?? "";
    try {
      const response = await fetch("/api/interesse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product, size: option.size, quantity, email, website: honeypot }) });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Die Anfrage konnte nicht gesendet werden.");
      setStatus("success"); setMessage("Vielen Dank. Wir melden uns zur Bestellung per E-Mail."); setEmail("");
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Bitte versuche es später erneut."); }
  }

  return <main>
    <header className="site-header">
      <a className="wordmark" href="#start" aria-label="Selesitina Startseite"><span className="mark">S</span><span>SELESITINA</span></a>
      <nav aria-label="Hauptnavigation"><a href="#produkte">Produkte</a><a href="#handwerk">Handwerk</a><a href="#selesitina">Selesitina</a></nav>
      <a className="header-cta" href="#bestellen">Auswählen</a>
    </header>

    <section id="start" className="hero">
      <div className="hero-copy"><p className="eyebrow">Handverlesen in Hohenhameln</p><h1>Ein Duft, der<br /><em>bei der Rose beginnt.</em></h1><p className="intro">Rose of Berlin entsteht aus selbst angebauten Rosen und eigenem Rosenwasser – in kleinen Mengen von Hand gefertigt.</p><div className="hero-actions"><a className="button primary" href="#bestellen">Produkt auswählen</a><a className="text-link" href="#handwerk">Unsere Geschichte <span>↓</span></a></div></div>
      <figure className="hero-visual"><img src="/rose-of-berlin-hero.jpeg" alt="Rose of Berlin Eau de Parfum zwischen rosa Rosen" /><figcaption>Red Rose · Selected by Selesitina</figcaption></figure>
    </section>

    <section id="produkte" className="products-section">
      <div className="section-heading"><p className="eyebrow">Die Kollektion</p><h2>Von Hand gemacht.<br /><em>Für dich abgefüllt.</em></h2><p>Jede Flasche ist Teil einer kleinen Charge. Die verfügbaren Größen kannst du direkt für deine Kaufanfrage auswählen.</p></div>
      <div className="product-cards">{(Object.keys(products) as ProductKey[]).map((key) => { const item = products[key]; return <article className="product-card" key={key}><img src={item.image} alt={key === "parfum" ? "Handabgefüllte Rose of Berlin Parfumflaschen" : "Handabgefülltes Haut- und Körperöl"} /><div className="product-card-copy"><p className="eyebrow">{item.eyebrow}</p><h3>{key === "parfum" ? "Rose of Berlin" : "Rosenpflege"}</h3><p>{item.description}</p><ul className="price-list" aria-label={`Preise für ${item.name}`}>{item.options.map((price) => <li key={price.size}><span>{price.size}</span><strong>{money.format(price.price)}</strong></li>)}</ul><button className="button outline" onClick={() => { chooseProduct(key); document.querySelector("#bestellen")?.scrollIntoView({ behavior: "smooth" }); }}>Dieses Produkt wählen</button></div></article>; })}</div>
    </section>

    <section id="bestellen" className="order-section">
      <div className="order-intro"><p className="eyebrow">Kaufanfrage</p><h2>Deine Auswahl,<br /><em>ganz unkompliziert.</em></h2><p>Wähle Produkt, Größe und Menge. Nach deiner Anfrage meldet sich Selesitina per E-Mail mit Verfügbarkeit, Zahlung und Versand.</p><div className="shipping-note"><span>Versand</span><p>Innerhalb Deutschlands 7,69 €. Versandkosten außerhalb Deutschlands werden individuell berechnet und vom Kunden getragen.</p></div></div>
      <form className="order-form" onSubmit={submitInterest}>
        <fieldset><legend>1 · Produkt</legend><div className="choice-grid two">{(Object.keys(products) as ProductKey[]).map((key) => <label className={product === key ? "choice active" : "choice"} key={key}><input type="radio" name="product" value={key} checked={product === key} onChange={() => chooseProduct(key)} /><span>{products[key].eyebrow}</span></label>)}</div></fieldset>
        <fieldset><legend>2 · Größe</legend><div className="choice-grid sizes">{selected.options.map((item, index) => <label className={sizeIndex === index ? "choice active" : "choice"} key={item.size}><input type="radio" name="size" value={item.size} checked={sizeIndex === index} onChange={() => setSizeIndex(index)} /><span>{item.size}<small>{money.format(item.price)}</small></span></label>)}</div></fieldset>
        <div className="form-row"><label className="field quantity-field">Menge<select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>{[1,2,3,4,5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label><label className="field">Deine E-Mail-Adresse<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@beispiel.de" autoComplete="email" required /></label></div>
        <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <div className="order-summary"><div><span>Deine Auswahl</span><strong>{selected.eyebrow} · {option.size} · {quantity}×</strong></div><div><span>Warenwert</span><strong>{money.format(total)}</strong></div></div>
        <p className="form-note">Dies ist eine unverbindliche Kaufanfrage, noch keine zahlungspflichtige Bestellung.</p><button className="button primary submit" disabled={status === "sending"}>{status === "sending" ? "Wird gesendet …" : "Kaufanfrage senden"}</button><div className={`form-message ${status}`} aria-live="polite">{message}</div>
      </form>
    </section>

    <section id="handwerk" className="craft-section"><div className="craft-image"><img src="/rose-oil-process.jpeg" alt="Selbst hergestelltes Rosenwasser und abgefüllte Hautöle" /></div><div className="craft-copy"><p className="eyebrow">Vom Garten zum Flakon</p><h2>Gewachsen mit<br /><em>Zeit und Sorgfalt.</em></h2><ol><li><span>01</span><div><h3>Eigener Anbau</h3><p>Rote und gelbe Rosen wachsen im eigenen Garten.</p></div></li><li><span>02</span><div><h3>Eigene Herstellung</h3><p>Aus den frisch geernteten Blüten entsteht das Rosenwasser.</p></div></li><li><span>03</span><div><h3>Von Hand abgefüllt</h3><p>Parfum und Pflegeöl werden in kleinen Chargen vorbereitet.</p></div></li></ol></div></section>
    <section id="selesitina" className="maker-section"><div className="maker-mark"><img src="/rose-of-berlin-label.jpeg" alt="Rose of Berlin Etikett mit Rosenmotiv" /></div><div className="maker-copy"><p className="eyebrow">Die Herstellerin</p><h2>Selesitina Gloger</h2><p className="maker-lead">Geboren und aufgewachsen in Tonga. Seit über 30 Jahren in Deutschland zu Hause.</p><p>Ihre Liebe zu Blumen, natürlichen Düften und sorgfältiger Handarbeit verbindet Selesitina heute in Rose of Berlin. Vom eigenen Rosenanbau bis zum Abfüllen begleitet sie jeden Schritt selbst.</p></div></section>
    <footer><a className="wordmark" href="#start"><span className="mark">S</span><span>SELESITINA</span></a><p>Handgemachte Düfte & Öle aus Hohenhameln.</p><div className="footer-links"><a href="#impressum">Impressum</a><a href="#datenschutz">Datenschutz</a></div></footer>
    <section id="impressum" className="legal"><h2>Impressum</h2><p>Selesitina Gloger<br />Angerweg 15<br />31249 Hohenhameln<br />Deutschland<br /><a href="mailto:wagloger@web.de">wagloger@web.de</a></p></section>
    <section id="datenschutz" className="legal"><h2>Datenschutz</h2><p>Bei einer Kaufanfrage verarbeiten wir die von dir angegebene E-Mail-Adresse sowie Produkt, Größe, Menge und Zeitpunkt der Anfrage. Die Angaben werden ausschließlich zur Bearbeitung deiner Anfrage gespeichert und zur Benachrichtigung an Selesitina übermittelt. Die E-Mail-Weiterleitung erfolgt über FormSubmit. Du kannst der weiteren Verarbeitung jederzeit per E-Mail widersprechen.</p></section>
  </main>;
}
