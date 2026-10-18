import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Public_Sans, Source_Serif_4 } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { site } from "@/lib/config";

// Títulos: grotesca expressiva. Texto corrido: serifada de leitura. Interface: sans neutra.
const fonteUi = Public_Sans({ subsets: ["latin"], variable: "--fonte-ui" });
const fonteTitulo = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--fonte-titulo",
  weight: ["600", "700", "800"],
});
const fonteTexto = Source_Serif_4({ subsets: ["latin"], variable: "--fonte-texto" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.nome} | Notícias de Santa Maria - RS`, template: `%s | ${site.nome}` },
  description: site.descricao,
  alternates: { types: { "application/rss+xml": `${site.url}/rss.xml` } },
  openGraph: { type: "website", locale: "pt_BR", siteName: site.nome },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fonteUi.variable} ${fonteTitulo.variable} ${fonteTexto.variable}`}>
      <body className="flex min-h-screen flex-col">
        {site.adsenseClient && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${site.adsenseClient}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        <Cabecalho />
        <main className="flex-1">{children}</main>
        <Rodape />
      </body>
    </html>
  );
}
