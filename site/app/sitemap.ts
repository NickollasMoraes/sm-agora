import type { MetadataRoute } from "next";
import { categorias, site } from "@/lib/config";
import { todasNoticias } from "@/lib/noticias";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site.url}/`, changeFrequency: "hourly", priority: 1 },
    ...categorias.map((c) => ({ url: `${site.url}/categoria/${c.slug}/`, changeFrequency: "daily" as const, priority: 0.6 })),
    ...todasNoticias().map((n) => ({
      url: `${site.url}/noticia/${n.slug}/`,
      lastModified: n.atualizado ?? n.data,
      priority: 0.8,
    })),
  ];
}
