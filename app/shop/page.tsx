import { ShopCatalog } from "../../components/Storefront";
import StructuredData from "../../components/StructuredData";
import { absoluteUrl, localizedPath, pageMetadata, searchLanguage, type SearchParams } from "../../lib/seo";
import { productKeys, products } from "../../lib/storefront";
import { christmasOfferAvailable } from "../../lib/orders/domain";
type Props = { searchParams: Promise<SearchParams> };
export async function generateMetadata({searchParams}:Props) {
 const language=searchLanguage(await searchParams);
 return pageMetadata("/shop",language,language === "de" ? "Rosenparfum, Körperöl & Geschenksets entdecken" : "Shop rose perfume, body oil & gift sets",language === "de" ? "Die Rose of Berlin Kollektion: handgemachtes Eau de Parfum ab 19,90 €, Körperöl ab 9 € und Weihnachtssets. Von Selesitina in Hohenhameln gefertigt." : "Discover the Rose of Berlin collection: handmade Eau de Parfum from €19.90, body oil from €9 and Christmas gift sets by Selesitina in Hohenhameln.");
}
export default async function ShopPage({searchParams}:Props) {
 const language=searchLanguage(await searchParams);
 return <><StructuredData data={{"@context":"https://schema.org","@type":"CollectionPage",name:language === "de" ? "Rose of Berlin Kollektion" : "Rose of Berlin collection",url:absoluteUrl(localizedPath("/shop",language)),inLanguage:language,mainEntity:{"@type":"ItemList",itemListElement:productKeys.filter(key=>key!=="christmas" || christmasOfferAvailable()).map((key,index)=>({"@type":"ListItem",position:index+1,name:`${products[key].name} · ${products[key].category[language]}`,url:absoluteUrl(localizedPath(`/produkte/${products[key].slug}`,language))}))}}} /><ShopCatalog initialLanguage={language} /></>;
}
