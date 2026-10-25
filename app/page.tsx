import HomePage from "../components/HomePage";
import StructuredData from "../components/StructuredData";
import { absoluteUrl, homeDescriptions, localizedPath, pageMetadata, searchLanguage, type SearchParams } from "../lib/seo";
type Props = { searchParams: Promise<SearchParams> };
export async function generateMetadata({ searchParams }: Props) {
 const language = searchLanguage(await searchParams);
 return pageMetadata("/",language,language === "de" ? "Rose of Berlin · Handgemachtes Rosenparfum & Körperöl" : "Rose of Berlin · Handmade rose perfume & body oil",homeDescriptions[language]);
}
export default async function Page({ searchParams }: Props) {
 const language = searchLanguage(await searchParams);
 return <><StructuredData data={{"@context":"https://schema.org","@graph":[
  {"@type":"WebSite","@id":absoluteUrl("/#website"),name:"Rose of Berlin",alternateName:"Rose of Berlin by Selesitina",url:absoluteUrl("/"),inLanguage:["de","en"],publisher:{"@id":absoluteUrl("/#organization")}},
  {"@type":"WebPage","@id":`${absoluteUrl(localizedPath("/",language))}#webpage`,url:absoluteUrl(localizedPath("/",language)),name:language === "de" ? "Handgemachtes Rosenparfum & Körperöl" : "Handmade rose perfume & body oil",description:homeDescriptions[language],inLanguage:language,isPartOf:{"@id":absoluteUrl("/#website")},about:{"@id":absoluteUrl("/#organization")}},
 ]}} /><HomePage initialLanguage={language} /></>;
}
