import type { Metadata, Viewport } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";
import PageTransition from "@/components/PageTransition";

// Headline font for the main question on each page and destination names
// only; kept to the softer end of Fraunces' optical-size axis and a
// moderate weight range so it stays warm rather than heavy.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

// Everything else: labels, buttons, body text — kept plain on purpose so
// photos and the headline carry the personality.
const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tripster",
  description: "Plan a group trip without 1,200 WhatsApp messages.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${publicSans.variable}`}>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6 sm:max-w-lg">
          <PageTransition>{children}</PageTransition>
        </div>
      </body>
    </html>
  );
}
