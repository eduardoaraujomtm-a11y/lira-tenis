import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lira Tênis Clube · Torneio 100 Anos",
  description:
    "Chaves, agenda, jogos ao vivo e resultados do Torneio 100 Anos do Lira Tênis Clube.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Lira Tênis", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#3b2a8c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
