import type { ShopLanguage } from "../lib/storefront";

const copy = {
  de: {
    occasion: "November 2026 · 150 Jahre Freundschaft zwischen Tonga und Deutschland",
    title: "Rose of Berlin als Geschenk für König Tupou VI",
    visit: "Zum 150. Jubiläum des Freundschaftsvertrags zwischen Tonga und Deutschland besuchte uns König Tupou VI von Tonga in Deutschland. Ihn begleiteten Königin Nanasipau’u Tuku’aho und Kronprinz Tupouto’a ‘Ulukalala.",
    gift: "Bei der Begegnung überreichten wir dem König unser handgemachtes Rosenparfum Rose of Berlin. Das Video zeigt die Geschenkübergabe.",
    videoLabel: "Video der Geschenkübergabe an König Tupou VI",
  },
  en: {
    occasion: "November 2026 · 150 years of friendship between Tonga and Germany",
    title: "Rose of Berlin as a gift for King Tupou VI",
    visit: "To mark the 150th anniversary of the Treaty of Friendship between Tonga and Germany, King Tupou VI of Tonga visited us in Germany. He was accompanied by Queen Nanasipau’u Tuku’aho and Crown Prince Tupouto’a ‘Ulukalala.",
    gift: "During the visit, we presented the King with our handmade Rose of Berlin perfume. The video shows the presentation of the gift.",
    videoLabel: "Video of the gift presentation to King Tupou VI",
  },
};

export default function RoyalVisit({ language }: { language: ShopLanguage }) {
  const text = copy[language];

  return (
    <section id="koenigsbesuch" className="royal-visit" aria-labelledby="royal-visit-title">
      <div className="royal-visit-copy">
        <p className="eyebrow">{text.occasion}</p>
        <h2 id="royal-visit-title">{text.title}</h2>
        <p>{text.visit}</p>
        <p>{text.gift}</p>
      </div>
      <video
        className="royal-visit-video"
        aria-label={text.videoLabel}
        controls
        playsInline
        preload="none"
        poster="/koenigsbesuch-tonga.webp"
        width={576}
        height={1024}
      >
        <source src="/koenigsbesuch-tonga.mp4" type="video/mp4" />
        <a href="/koenigsbesuch-tonga.mp4">{text.videoLabel}</a>
      </video>
    </section>
  );
}
