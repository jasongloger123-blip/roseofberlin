import { useRef, useState } from "react";
import type { ShopLanguage } from "../lib/storefront";

const copy = {
  de: {
    occasion: "Tonga und Deutschland · November 2026",
    title: "König Tupou VI. von Tonga",
    location: "in Deutschland",
    lead: "Rosenparfum für den König.",
    story: "Zum 150. Jubiläum des Freundschaftsvertrags zwischen Tonga und Deutschland besuchte uns der König mit Königin Nanasipau’u Tuku’aho und Kronprinz Tupouto’a ‘Ulukalala. Bei der Begegnung überreichten wir ihm unser handgemachtes Rosenparfum.",
    caption: "Die Geschenkübergabe im Original",
    play: "Film abspielen",
  },
  en: {
    occasion: "Tonga and Germany · November 2026",
    title: "King Tupou VI of Tonga",
    location: "in Germany",
    lead: "Rose perfume for the King.",
    story: "To mark the 150th anniversary of the Treaty of Friendship between Tonga and Germany, the King visited us with Queen Nanasipau’u Tuku’aho and Crown Prince Tupouto’a ‘Ulukalala. During the visit, we presented him with our handmade rose perfume.",
    caption: "Original footage of the gift presentation",
    play: "Play the film",
  },
};

export default function RoyalVisit({ language }: { language: ShopLanguage }) {
  const text = copy[language];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasPlayed, setHasPlayed] = useState(false);

  async function playFilm() {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      video.focus({ preventScroll: true });
    } catch {
      // Keep the play button and native controls available for another attempt.
    }
  }

  return (
    <section id="koenigsbesuch" className="royal-visit" aria-labelledby="royal-visit-title" tabIndex={-1}>
      <div className="royal-visit-inner">
        <div className="royal-visit-copy">
          <p className="eyebrow">{text.occasion}</p>
          <h2 id="royal-visit-title">{text.title} <em>{text.location}</em></h2>
        </div>
        <figure className="royal-visit-stage">
          <div className="royal-visit-frame">
            <video
              ref={videoRef}
              className="royal-visit-video"
              aria-labelledby="royal-visit-caption"
              controls
              playsInline
              preload="none"
              poster="/koenigsbesuch-tonga.webp"
              width={576}
              height={1024}
              onPlay={() => setHasPlayed(true)}
            >
              <source src="/koenigsbesuch-tonga.mp4" type="video/mp4" />
              <a href="/koenigsbesuch-tonga.mp4">{text.caption}</a>
            </video>
            {!hasPlayed && (
              <button type="button" className="royal-visit-play" aria-label={text.play} onClick={playFilm}>
                <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                  <path d="M9 5.5v13l10-6.5z" fill="currentColor" />
                </svg>
              </button>
            )}
          </div>
          <figcaption id="royal-visit-caption">{text.caption}</figcaption>
        </figure>
        <div className="royal-visit-story">
          <p className="royal-visit-lead">{text.lead}</p>
          <p>{text.story}</p>
        </div>
      </div>
    </section>
  );
}
