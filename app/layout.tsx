import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import { AppNav } from "@/components/AppNav";
import { ToastProvider } from "@/components/Toast";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Copy-Trade Lite",
  description: "Kid-simple trading on Decibel testnet with copy-trade signals. Play money only.",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}>
      {/* Room for the nav: at the bottom on phones, at the top from 1024 px. */}
      <body className="flex min-h-full flex-col pb-16 lg:pb-0 lg:pt-16">
        <ToastProvider>
          {children}
          <AppNav />
        </ToastProvider>
      </body>
    </html>
  );
}
