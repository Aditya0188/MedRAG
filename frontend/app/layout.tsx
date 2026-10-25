import type { Metadata } from "next";
import { Suspense } from "react";
import { Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import QueryProvider from "@/components/QueryProvider";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";

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
  title: "MedDRAG — Evidence-Grounded Clinical Decision Support Platform",
  description:
    "Multimodal prescription analysis, RxNorm ontological grounding, official DailyMed/openFDA drug-food interaction retrieval via Qdrant RAG, and physician triage gateway.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-[#F7F6F2] text-[#202722] flex" suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider>
            <ToastProvider>
              {/* Role-Aware Sidebar */}
              <Suspense fallback={<aside className="w-64 bg-[#F7F6F2] border-r border-[#E5E3DC] hidden lg:block" />}>
                <Sidebar />
              </Suspense>

              {/* Main Content Workspace */}
              <div className="flex-1 lg:pl-64 min-h-screen flex flex-col">
                {children}
              </div>
            </ToastProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
