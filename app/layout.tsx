import { metadataBaseUrl } from "../lib/site-url";
import AnalyticsConsent from "../components/AnalyticsConsent";
import StructuredData from "../components/StructuredData";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl()),
  title: { default: "Rose of Berlin | Handgemachtes Rosenparfum & Körperöl", template: "%s | Rose of Berlin" },
  description: "Handgemachtes Rosenparfum und Körperöl von Selesitina Tatafu Gloger aus Hohenhameln. Mit Rosen aus dem eigenen Garten und selbst hergestelltem Rosenwasser.",
  authors: [{ name: "Selesitina Tatafu Gloger" }],
  creator: "Selesitina Tatafu Gloger",
  verification: { google: "glPkhssh_XugipLNP6ZGsWSmSJEZdHQWf2r52SUNaw8" },
  openGraph: { type: "website", locale: "de_DE", alternateLocale: ["en_GB"], siteName: "Rose of Berlin", title: "Rose of Berlin | Handgemachtes Rosenparfum & Körperöl", description: "Handgemachtes Rosenparfum und Körperöl aus Hohenhameln.", url: "/", images: [{ url: "/rose-of-berlin-hero-mobile.webp", alt: "Rose of Berlin Rosenparfum" }] },
  twitter: { card: "summary_large_image", title: "Rose of Berlin | Handgemachtes Rosenparfum & Körperöl", description: "Handgemachtes Rosenparfum und Körperöl von Selesitina Tatafu Gloger.", images: ["/rose-of-berlin-hero-mobile.webp"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon.png", type: "image/png", sizes: "512x512" }],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body
        className="antialiased"
      >
        <StructuredData data={{ "@context":"https://schema.org", "@type":"Organization", "@id":`${metadataBaseUrl()}/#organization`, name:"Rose of Berlin", url:metadataBaseUrl(), logo:{"@type":"ImageObject",url:`${metadataBaseUrl()}/icon.png`}, founder:{"@type":"Person",name:"Selesitina Tatafu Gloger"}, email:"wagloger@web.de", address:{"@type":"PostalAddress",streetAddress:"Angerweg 15",postalCode:"31249",addressLocality:"Hohenhameln",addressCountry:"DE"} }} />
        {children}
        <AnalyticsConsent />
      </body>
    </html>
  );
}
