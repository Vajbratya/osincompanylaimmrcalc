import type { Metadata } from "next";

import "./globals.css";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Multi-currency MRR",
  description: "Compute and visualize MRR across multiple Stripe currencies.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
