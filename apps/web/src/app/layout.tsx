import type { Metadata, Viewport } from "next";

import { DM_Sans, DM_Serif_Display } from "next/font/google";

import "../index.css";
import Header from "@/components/header";
import Providers from "@/components/providers";
import { getToken } from "@/lib/auth-server";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jujurnal — a little room for your thoughts",
  description: "A gentle daily journal that grows with you.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcf6ea" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = await getToken();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${dmSerif.variable} antialiased`}>
        <Providers initialToken={token}>
          <div className="mx-auto min-h-screen max-w-6xl px-4 pb-32 pt-4 sm:px-6 sm:pb-12 lg:px-8">
            <Header />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
