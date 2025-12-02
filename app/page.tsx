import type { Metadata } from "next";
import { Suspense } from "react";
import HomePageClient from "../components/HomePageClient";

export const metadata: Metadata = {
  title: "AI/ML IP Data & Analytics Platform",
  description:
    "SynapseIP combines semantic search, overview graphing, citation tracking, and automated alerts for agile AI/ML IP management.",
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
