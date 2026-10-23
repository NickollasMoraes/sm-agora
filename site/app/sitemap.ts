import type { MetadataRoute } from "next";
import { categorias, site } from "@/lib/config";
import { noticiasDaCategoria, todasNoticias } from "@/lib/noticias";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site.url}/`, changeFrequency: "hourly", priority: 1 },
    ...categorias.filter((c) => noticiasDaCategoria(c.slug).length > 0).map((c) => ({ url: `${site.url}/categoria/${c.slug}/`, changeFrequency: "daily" as const, priority: 0.6 })),
    ...["sobre", "contato", "anuncie", "politica-de-privacidade", "termos-de-uso", "politica-editorial"].map((slug) => ({ url: `${site.url}/${slug}/`, changeFrequency: "monthly" as const, priority: 0.4 })),
    ...todasNoticias().map((n) => ({
      url: `${site.url}/noticia/${n.slug}/`,
      lastModified: n.atualizado ?? n.data,
      priority: 0.8,
    })),
  ];
}
