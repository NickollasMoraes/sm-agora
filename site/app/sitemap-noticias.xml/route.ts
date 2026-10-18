import { site } from "@/lib/config";
import { todasNoticias } from "@/lib/noticias";

export const dynamic = "force-static";

// Sitemap do Google Notícias: só matérias dos últimos 2 dias (regra do Google), no máximo 1000.
// O site é refeito a cada notícia publicada, então a lista se renova sozinha.
const DOIS_DIAS = 2 * 24 * 60 * 60 * 1000;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function GET() {
  const limite = Date.now() - DOIS_DIAS;
  const itens = todasNoticias()
    .filter((n) => new Date(n.data).getTime() >= limite)
    .slice(0, 1000)
    .map(
      (n) => `<url>
  <loc>${site.url}/noticia/${n.slug}/</loc>
  <news:news>
    <news:publication><news:name>${esc(site.nome)}</news:name><news:language>pt</news:language></news:publication>
    <news:publication_date>${n.data}</news:publication_date>
    <news:title>${esc(n.titulo)}</news:title>
  </news:news>
</url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${itens}
</urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
