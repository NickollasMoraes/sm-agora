// Configurações gerais do portal. Ajuste aqui nome, domínio, contatos e anúncios.

export const site = {
  nome: "SM Agora",
  slogan: "Notícias de Santa Maria e região, sem enrolação",
  descricao:
    "Portal de notícias de Santa Maria (RS): cidade, segurança, educação, UFSM, esporte, cultura e economia.",
  // Domínio final (sem barra no fim). Usado em SEO, sitemap e RSS.
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://smagora.com.br",
  cidade: "Santa Maria",
  estado: "RS",
  email: "contato@smagora.com.br",
  emailComercial: "anuncie@smagora.com.br",
  instagram: "sm.agora",
  whatsappComercial: "5555991727990", // ex.: "5555999999999"
  // Google AdSense: preencha quando a conta for aprovada (ex.: "ca-pub-1234567890").
  adsenseClient: process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "",
};

export type Categoria = {
  slug: string;
  nome: string;
  cor: string; // cor de destaque da editoria
};

export const categorias: Categoria[] = [
  { slug: "cidade", nome: "Cidade", cor: "#2563eb" },
  { slug: "seguranca", nome: "Segurança", cor: "#dc2626" },
  { slug: "politica", nome: "Política", cor: "#7c3aed" },
  { slug: "educacao", nome: "Educação", cor: "#0891b2" },
  { slug: "saude", nome: "Saúde", cor: "#059669" },
  { slug: "economia", nome: "Economia", cor: "#d97706" },
  { slug: "esporte", nome: "Esporte", cor: "#16a34a" },
  { slug: "cultura", nome: "Cultura e Lazer", cor: "#db2777" },
  { slug: "clima", nome: "Tempo", cor: "#0284c7" },
];

export function categoriaPorSlug(slug: string): Categoria {
  return categorias.find((c) => c.slug === slug) ?? categorias[0];
}

// Prefixo de caminho quando o site roda em usuario.github.io/repositorio (sem domínio próprio).
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function caminhoAsset(src: string): string {
  if (/^https?:\/\//.test(src)) return src;
  return `${basePath}${src.startsWith("/") ? src : `/${src}`}`;
}
