import type { Metadata } from "next";
import { ShopCatalog } from "../../components/Storefront";
export const metadata: Metadata = { title: "Shop", description: "Discover handmade rose perfume, body oil and Christmas gift sets by Selesitina.", alternates: { canonical: "/shop" }, openGraph: { title: "Rose of Berlin · Shop", url: "/shop" } };
export default function ShopPage() { return <ShopCatalog />; }
