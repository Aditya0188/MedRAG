import type { Metadata } from "next";
import { Suspense } from "react";
import { Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MedDRAG — Generative AI-Based Medical Document Analysis System",
  description:
    "BTech CSE (Data Science) Mini-Project: Multimodal prescription understanding, RxNorm ontological grounding, official DailyMed/openFDA drug-food interaction retrieval via Qdrant RAG, and physician triage gateway.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${ibmPlexMono.variable}`}>
      <body className="min-h-screen bg-[#F7F6F2] text-[#202722] flex">
        {/* Compact Clinical Sidebar with Suspense */}
        <Suspense fallback={<aside className="w-64 bg-[#F7F6F2] border-r border-[#E5E3DC] hidden lg:block" />}>
          <Sidebar />
        </Suspense>

        {/* Main Content Workspace */}
        <main className="flex-1 lg:pl-64 min-h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
