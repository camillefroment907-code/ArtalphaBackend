import type { Metadata } from "next";
import "./globals.css";
import { PlanSync } from "@/components/layout/PlanSync";

export const metadata: Metadata = {
  title: "ArtAlpha — AI Auction Deal Finder",
  description: "Detect underpriced auction lots before the gavel falls.",
  keywords: ["auction", "art", "deals", "drouot", "invaluable", "AI"],
  openGraph: {
    title: "ArtAlpha",
    description: "Intelligence at the gavel.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body style={{ minHeight: "100vh", backgroundColor: "#0a0a0b", color: "#fafafa" }} className="antialiased">
        <PlanSync />
        {children}
      </body>
    </html>
  );
}
