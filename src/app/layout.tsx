import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6 sm:max-w-lg">
          {children}
        </div>
      </body>
    </html>
  );
}
