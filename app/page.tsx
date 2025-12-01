import type { Metadata } from "next";
import { Suspense } from "react";
import HomePageClient from "../components/HomePageClient";

export const metadata: Metadata = {
  title: "AI Patent Search & Analytics Platform",
  description:
    "SynapseIP combines semantic patent search, IP overview graphing, and automated alerts so IP teams can rapidly track AI and machine learning filings.",
  alternates: {
    canonical: "/",
  },
};

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading…</div>}>
      <HomePageClient />
    </Suspense>
  );
}
