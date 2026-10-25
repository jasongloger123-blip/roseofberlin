import { notFound } from "next/navigation";
import { ProductDetail } from "../../../components/Storefront";
import StructuredData from "../../../components/StructuredData";
import { productKeys, products } from "../../../lib/storefront";
import { pageMetadata, productStructuredData, productTitles, searchLanguage, type SearchParams } from "../../../lib/seo";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };
export function generateStaticParams() { return productKeys.map(key => ({ slug: products[key].slug })); }
export async function generateMetadata({ params, searchParams }: Props) {
 const {slug}=await params; const language=searchLanguage(await searchParams);
 const key=productKeys.find(key=>products[key].slug===slug); if(!key) return {};
 const p=products[key];
 return pageMetadata(`/produkte/${slug}`,language,productTitles[key][language],p.description[language],p.image);
}
export default async function ProductPage({ params, searchParams }: Props) {
 const {slug}=await params; const query=await searchParams; const language=searchLanguage(query);
 const key=productKeys.find(key=>products[key].slug===slug); if(!key) notFound();
 return <><StructuredData data={productStructuredData(key,language)} /><ProductDetail productKey={key} initialLanguage={language} initialSize={typeof query.size === "string" ? query.size : undefined} /></>;
}
