"use client";

import { useEffect, useState } from "react";

const consentKey = "rob-analytics-consent-v1";
const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? "";
const configured = /^G-[A-Z0-9]+$/.test(measurementId);
type Choice = "granted" | "denied";
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

function rememberedChoice(): Choice | null {
 try {
  const data = JSON.parse(localStorage.getItem(consentKey) ?? "null");
  return data?.version === 1 && ["granted","denied"].includes(data.choice) && Date.now()-data.at < 180*86400000 ? data.choice : null;
 } catch { return null; }
}
function clearAnalyticsCookies() {
 const hostname = window.location.hostname;
 const domains = ["",hostname,`.${hostname}`,`.${hostname.replace(/^www\./,"")}`];
 for (const cookie of document.cookie.split(";")) {
  const name=cookie.split("=")[0].trim();
  if (!/^_ga(?:_|$)|^_gid$|^_gat/.test(name)) continue;
  for (const domain of domains) document.cookie=`${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ""}`;
 }
}
function startAnalytics() {
 if (!configured || document.getElementById("rob-google-analytics")) return;
 const target=window as AnalyticsWindow;
 target.dataLayer=target.dataLayer ?? [];
 target.gtag=function(){target.dataLayer!.push(arguments);};
 target.gtag("consent","default",{analytics_storage:"denied",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied"});
 target.gtag("consent","update",{analytics_storage:"granted"});
 target.gtag("js",new Date());
 target.gtag("config",measurementId,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,cookie_expires:15552000});
 // Never send query strings, fragments, order tokens, contact fields or form values.
 if (!window.location.pathname.startsWith("/kasse")) target.gtag("event","page_view",{page_location:`${window.location.origin}${window.location.pathname}`,page_title:document.title,page_referrer:document.referrer ? new URL(document.referrer).origin : ""});
 const script=document.createElement("script");
 script.id="rob-google-analytics";script.async=true;script.src=`https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
 document.head.appendChild(script);
}
export default function AnalyticsConsent() {
 const [visible,setVisible]=useState(false);
 const [ready,setReady]=useState(false);
 const [english,setEnglish]=useState(false);
 useEffect(()=>{
  if (!configured || /^\/(?:admin|api|order)(?:\/|$)/.test(window.location.pathname)) return;
  setEnglish(new URLSearchParams(window.location.search).get("lang")==="en");
  const choice=rememberedChoice();
  setReady(true);setVisible(choice===null);
  if(choice==="granted") startAnalytics();
 },[]);
 function choose(choice: Choice) {
  try{localStorage.setItem(consentKey,JSON.stringify({version:1,choice,at:Date.now()}));}catch{/* Choice still applies to this page. */}
  setVisible(false);
  if(choice==="granted") startAnalytics();
  else {
   (window as AnalyticsWindow).gtag?.("consent","update",{analytics_storage:"denied",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied"});
   clearAnalyticsCookies();
   if(document.getElementById("rob-google-analytics")) window.location.reload();
  }
 }
 if(!ready) return null;
 return <><button type="button" className="analytics-settings" onClick={()=>setVisible(true)}>{english ? "Cookie settings" : "Cookie-Einstellungen"}</button>{visible ? <section className="analytics-consent" aria-label={english ? "Optional analytics" : "Optionale Statistik"}><div><h2>{english ? "Optional website statistics" : "Optionale Website-Statistik"}</h2><p>{english ? "With your consent, Google Analytics helps us understand how visitors use this website. Google receives usage data and may process it outside the EU. We use no advertising personalisation. You can decline or change your choice at any time." : "Mit deiner Einwilligung hilft uns Google Analytics zu verstehen, wie die Website genutzt wird. Google erhält Nutzungsdaten und kann sie außerhalb der EU verarbeiten. Wir nutzen keine personalisierte Werbung. Du kannst ablehnen und deine Auswahl jederzeit ändern."} <a href="/datenschutz">{english ? "Privacy policy" : "Datenschutz"}</a></p></div><div className="analytics-actions"><button type="button" onClick={()=>choose("denied")}>{english ? "Decline analytics" : "Statistik ablehnen"}</button><button type="button" onClick={()=>choose("granted")}>{english ? "Allow analytics" : "Statistik erlauben"}</button></div></section> : null}</>;
}
