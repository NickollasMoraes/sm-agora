import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Public_Sans, Source_Serif_4 } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { caminhoAsset, site } from "@/lib/config";
import { AvisoCookies } from "@/components/AvisoCookies";

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
      <head>
        {/* Consent Mode primeiro (padrão negado), depois o AdSense como tag literal no <head>:
            o verificador do AdSense procura exatamente essa tag no HTML; com next/script ela
            só era injetada por JavaScript e a verificação falhava. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});try{if(localStorage.getItem('sm-agora-consentimento-cookies')==='aceito')gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});}catch(e){}`,
          }}
        />
        {site.adsenseClient && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${site.adsenseClient}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body className="flex min-h-screen flex-col">
        {site.googleAnalytics && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${site.googleAnalytics}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">
              {`gtag('js',new Date());gtag('config','${site.googleAnalytics}');`}
            </Script>
          </>
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "NewsMediaOrganization",
              name: site.nome,
              url: `${site.url}/`,
              logo: new URL(caminhoAsset(site.logo), site.url).toString(),
              email: site.email,
              sameAs: [`https://instagram.com/${site.instagram}`, ...(site.whatsappCanal ? [site.whatsappCanal] : [])],
              areaServed: `${site.cidade} - ${site.estado}`,
              contactPoint: { "@type": "ContactPoint", email: site.email, contactType: "customer service", areaServed: "BR" },
              publishingPrinciples: `${site.url}/politica-editorial/`,
            }),
          }}
        />
        <Cabecalho />
        <main className="flex-1">{children}</main>
        <Rodape />
        <AvisoCookies />
      </body>
    </html>
  );
}
