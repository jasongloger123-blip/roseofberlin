import { ShopCatalog } from "../../components/Storefront";
import StructuredData from "../../components/StructuredData";
import { absoluteUrl, localizedPath, pageMetadata, searchLanguage, type SearchParams } from "../../lib/seo";
import { productKeys, products } from "../../lib/storefront";
import { christmasOfferAvailable } from "../../lib/orders/domain";
type Props = { searchParams: Promise<SearchParams> };
export async function generateMetadata({searchParams}:Props) {
 const language=searchLanguage(await searchParams);
 return pageMetadata("/shop",language,language === "de" ? "Rosenparfum, Körperöl & Bio-Rosentee entdecken" : "Shop rose perfume, body oil & organic rose tea",language === "de" ? "Handgemachtes Rosenparfum, Körperöl und Bio-Rosentee aus Hohenhameln. 10 Teebeutel für 9,90 €. Die Kollektion von Selesitina entdecken." : "Handmade rose perfume, body oil and organic rose tea from Hohenhameln, Germany. 10 tea bags for €9.90. Discover the collection by Selesitina.");
}
export default async function ShopPage({searchParams}:Props) {
 const language=searchLanguage(await searchParams);
 return <><StructuredData data={{"@context":"https://schema.org","@type":"CollectionPage",name:language === "de" ? "Rose of Berlin Kollektion" : "Rose of Berlin collection",url:absoluteUrl(localizedPath("/shop",language)),inLanguage:language,mainEntity:{"@type":"ItemList",itemListElement:productKeys.filter(key=>key!=="christmas" || christmasOfferAvailable()).map((key,index)=>({"@type":"ListItem",position:index+1,name:`${products[key].name} · ${products[key].category[language]}`,url:absoluteUrl(localizedPath(`/produkte/${products[key].slug}`,language))}))}}} /><ShopCatalog initialLanguage={language} /></>;
}
