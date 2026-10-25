import type { Metadata } from "next";
import CartPage from "../../components/CartPage";
export const metadata: Metadata = { title: "Warenkorb · Cart", robots: { index: false, follow: true }, alternates: { canonical: "/warenkorb" } };
export default function Page() { return <CartPage />; }
