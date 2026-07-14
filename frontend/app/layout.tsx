import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Footer } from "@/components/layout/Footer";
import { NavBar } from "@/components/layout/NavBar";
import { RouteTransition } from "@/components/layout/RouteTransition";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_DESCRIPTION = "MathMaster — Ensinar, acompanhar e motivar através da matemática.";

export const metadata: Metadata = {
  title: {
    default: "MathMaster — Ensinar, acompanhar e motivar através da matemática",
    template: "%s — MathMaster",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "MathMaster",
    description: SITE_DESCRIPTION,
    locale: "pt_BR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="flex min-h-screen flex-col bg-background text-text-primary">
        <a
          href="#main-content"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-accent focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
        >
          Pular para o conteúdo
        </a>
        <NavBar />
        <main id="main-content" className="flex-1">
          <RouteTransition>{children}</RouteTransition>
        </main>
        <Footer />
      </body>
    </html>
  );
}
