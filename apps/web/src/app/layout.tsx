import type { Metadata } from "next";

import { Geist, Geist_Mono, Figtree } from "next/font/google";

import "../index.css";
import Header from "@/components/header";
import Providers from "@/components/providers";
import { getToken } from "@/lib/auth-server";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "puma-brain",
  description: "puma-brain",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = await getToken();
  return (
    <html lang="en" suppressHydrationWarning className={figtree.variable}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers initialToken={token}>
          <div className="max-w-2xl mx-auto">
            <Header />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
