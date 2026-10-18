import { site } from "@/lib/config";
import { todasNoticias } from "@/lib/noticias";

export const dynamic = "force-static";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function GET() {
  const itens = todasNoticias()
    .slice(0, 50)
    .map(
      (n) => `<item>
  <title>${esc(n.titulo)}</title>
  <link>${site.url}/noticia/${n.slug}/</link>
  <guid>${site.url}/noticia/${n.slug}/</guid>
  <pubDate>${new Date(n.data).toUTCString()}</pubDate>
  <description>${esc(n.subtitulo)}</description>
</item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(site.nome)}</title>
<link>${site.url}</link>
<description>${esc(site.descricao)}</description>
<language>pt-br</language>
${itens}
</channel></rss>`;

  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
