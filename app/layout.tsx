import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import { Providers } from "./providers";
import NavBar from "../components/NavBar";
import GlitchtipInit from "../components/GlitchtipInit";
import localFont from "next/font/local";

// Load the project-wide sans-serif font from public/fonts
const appSans = localFont({
  src: [
    { path: "../public/fonts/inter-v20-latin-regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/inter-v20-latin-italic.woff2", weight: "400", style: "italic" },
    { path: "../public/fonts/inter-v20-latin-500.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/inter-v20-latin-500italic.woff2", weight: "500", style: "italic" },
    { path: "../public/fonts/inter-v20-latin-600.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/inter-v20-latin-600italic.woff2", weight: "600", style: "italic" },
    { path: "../public/fonts/inter-v20-latin-700.woff2", weight: "700", style: "normal" },
    { path: "../public/fonts/inter-v20-latin-700italic.woff2", weight: "700", style: "italic" },
    { path: "../public/fonts/inter-v20-latin-800.woff2", weight: "800", style: "normal" },
    { path: "../public/fonts/inter-v20-latin-800italic.woff2", weight: "800", style: "italic" },
    { path: "../public/fonts/inter-v20-latin-900.woff2", weight: "900", style: "normal" },
    { path: "../public/fonts/inter-v20-latin-900italic.woff2", weight: "900", style: "italic" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.synapse-ip.com"),
  applicationName: "SynapseIP",
  title: {
    default: "SynapseIP | AI Patent Intelligence Platform",
    template: "%s | SynapseIP",
  },
  description:
    "SynapseIP delivers semantic patent search, IP overview graph analytics, and automated alerts so IP teams can monitor AI and machine learning filings in real time.",
  keywords: [
    "AI patent search",
    "machine learning patents",
    "intellectual property analytics",
    "pgvector patent database",
    "semantic patent search",
    "IP overview analysis",
    "patent alerts platform",
    "AI/ML intellectual property",
    "patent scout",
    "artificial intelligence patents",
    "machine learning intellectual property",
    "patent landscape",
    "patent monitoring",
    "patent analytics",
    "IP management",
    "technology scouting",
    "competitive intelligence",
    "patent data visualization",
    "AI innovation tracking",
    "ML patent trends",
    "intellectual property strategy",
    "patent portfolio management",
    "R&D patent analysis",
    "patent filing trends",
    "AI research patents",
    "ML technology patents",
    "patent citation analysis",
    "IP due diligence",
    "patent valuation",
    "patent licensing",
    "patent infringement analysis",
    "AI-driven patent insights",
    "LLM IP",
    "generative AI patents",
    "deep learning patents",
    "neural network patents",
    "computer vision patents",
    "natural language processing patents",
    "autonomous systems patents",
    "AI hardware patents",
    "AI software patents",
    "AI ethics patents",
    "AI regulation patents",
    "emerging tech patents",
    "disruptive innovation patents",
    "patent search engine",
    "patent analytics tools",
    "IP intelligence platform",
  ],
  authors: [{ name: "SynapseIP" }],
  creator: "SynapseIP",
  publisher: "Phaethon Order LLC",
  openGraph: {
    title: "SynapseIP | AI/ML IP Intelligence Platform",
    description:
      "Monitor AI/ML IP with semantic search, automated alerts, IP overview, graph analytics, and more powered by SynapseIP.",
    url: "https://www.synapse-ip.com/",
    siteName: "SynapseIP",
    images: [
      {
        url: "https://www.synapse-ip.com/images/synapseip-banner-short.png",
        width: 1300,
        height: 256,
        alt: "SynapseIP banner with AI/ML analytics interface",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SynapseIP | AI/ML IP Intelligence Platform",
    description:
      "Intelligent AI/ML IP discovery with semantic search, trends, and automated alerts.",
    images: ["https://www.synapse-ip.com/images/synapseip-banner-short.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {

  return (
    <html lang="en">
      <body className={`${appSans.className} app-shell min-h-screen text-gray-900`}>
        <Script
          id="synapseip-structured-data"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              [
                {
                  "@context": "https://schema.org",
                  "@type": "Organization",
                  name: "SynapseIP",
                  url: "https://www.synapse-ip.com",
                  description:
                    "SynapseIP is an AI/ML IP intelligence platform with semantic search, IP overview, graph analytics, and automated alerts.",
                  logo: "https://www.synapse-ip.com/images/synapseip-logo.png"
                },
                {
                  "@context": "https://schema.org",
                  "@type": "WebSite",
                  name: "SynapseIP",
                  url: "https://www.synapse-ip.com",
                  potentialAction: {
                    "@type": "SearchAction",
                    target: "https://www.synapse-ip.com/?q={search_term_string}",
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
              null,
              0
            ),
          }}
        />
        {/* Client-side observability hooks */}
        <GlitchtipInit />
        <Providers>
          <NavBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
