import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "../../../components/Storefront";
import { productKeys, products } from "../../../lib/storefront";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return productKeys.map(key => ({ slug: products[key].slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const key = productKeys.find(key => products[key].slug === slug);
  if (!key) return {};
  const p = products[key];
  return { title: `${p.name} · ${p.category.en}`, description: p.description.en, alternates: { canonical: `/produkte/${slug}` }, openGraph: { title: p.name, description: p.description.en, url: `/produkte/${slug}`, images: [{ url: p.image }] } };
}
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const key = productKeys.find(key => products[key].slug === slug);
  if (!key) notFound();
  return <ProductDetail productKey={key} />;
}
