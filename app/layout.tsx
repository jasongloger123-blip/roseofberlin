import { metadataBaseUrl } from "../lib/site-url";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl()),
  title: { default: "Rose of Berlin | Handmade Rose Perfume", template: "%s | Rose of Berlin" },
  description: "Handmade rose perfume and body oil by Selesitina Gloger, crafted in small batches from home-grown roses and homemade rose water.",
  keywords: ["Rose of Berlin", "handmade perfume", "rose perfume", "rose water", "body oil", "Selesitina Gloger", "Hohenhameln"],
  authors: [{ name: "Selesitina Gloger" }],
  creator: "Selesitina Gloger",
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "en_US", alternateLocale: ["de_DE"], siteName: "Rose of Berlin", title: "Rose of Berlin | Handmade Rose Perfume", description: "Handcrafted in small batches from home-grown roses and homemade rose water.", url: "/" },
  twitter: { card: "summary", title: "Rose of Berlin | Handmade Rose Perfume", description: "Handcrafted rose perfume and body oil by Selesitina Gloger." },
  robots: { index: true, follow: true },
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
