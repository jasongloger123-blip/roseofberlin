import type { Metadata } from "next";
import Checkout from "../../components/Checkout";
export const metadata: Metadata = { title: "Kaufanfrage · Checkout", robots: { index: false, follow: true }, alternates: { canonical: "/kasse" } };
export default function Page() { return <Checkout />; }
