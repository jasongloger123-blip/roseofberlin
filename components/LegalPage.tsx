"use client";
import { copy } from "../lib/home-copy";
import { ShopFooter, ShopHeader, useShopLanguage } from "./Storefront";
export default function LegalPage({ kind }: { kind: "privacy" | "imprint" }) {
 const [language,setLanguage] = useShopLanguage(); const t = copy[language];
 return <main className="storefront"><ShopHeader language={language} toggle={() => setLanguage(language === "de" ? "en" : "de")} /><article className="standalone-legal"><p className="eyebrow">Rose of Berlin</p><h1>{kind === "privacy" ? t.privacy : t.imprint}</h1><p>{kind === "privacy" ? t.privacyText : t.imprintText}</p></article><ShopFooter language={language} /></main>;
}
