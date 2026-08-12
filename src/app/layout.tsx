import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const SITE_URL = "https://lira-tenis.vercel.app";
const TITLE = "Lira Tênis Clube · Torneio 100 Anos";
const DESCRIPTION =
  "Chaves, agenda, jogos ao vivo e resultados do Torneio 100 Anos do Lira Tênis Clube.";

export const metadata: Metadata = {
  // Sem isto, a prévia do link apontaria para a URL do deploy da vez em vez do
  // domínio fixo do torneio.
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Lira Tênis", statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    siteName: "Lira Tênis Clube",
    locale: "pt_BR",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
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
