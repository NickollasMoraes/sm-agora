import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

// Cada notícia é um arquivo Markdown em content/noticias/<slug>.md,
// escrito pelo agente (ou à mão) com o frontmatter abaixo.

export type CreditoImagem = {
  autor: string;
  licenca: string;
  fonte: string; // URL da página de origem da imagem
};

export type Noticia = {
  slug: string;
  titulo: string;
  subtitulo: string;
  categoria: string;
  tags: string[];
  data: string; // ISO
  atualizado?: string;
  imagem: string;
  imagemAlt: string;
  credito?: CreditoImagem;
  fontes: { nome: string; url: string }[];
  destaque: boolean;
  html: string;
  tempoLeitura: number;
};

const PASTA = path.join(process.cwd(), "content", "noticias");

function lerArquivo(arquivo: string): Noticia {
  const bruto = fs.readFileSync(path.join(PASTA, arquivo), "utf8");
  const { data, content } = matter(bruto);
  const palavras = content.split(/\s+/).filter(Boolean).length;
  return {
    slug: arquivo.replace(/\.md$/, ""),
    titulo: data.titulo,
    subtitulo: data.subtitulo ?? "",
    categoria: data.categoria ?? "cidade",
    tags: data.tags ?? [],
    data: new Date(data.data).toISOString(),
    atualizado: data.atualizado ? new Date(data.atualizado).toISOString() : undefined,
    imagem: data.imagem ?? `/imagens/padrao/${data.categoria ?? "cidade"}.svg`,
    imagemAlt: data.imagemAlt ?? data.titulo,
    credito: data.credito,
    fontes: data.fontes ?? [],
    destaque: Boolean(data.destaque),
    html: marked.parse(content, { async: false }) as string,
    tempoLeitura: Math.max(1, Math.round(palavras / 200)),
  };
}

let cache: Noticia[] | null = null;

export function todasNoticias(): Noticia[] {
  if (cache) return cache;
  if (!fs.existsSync(PASTA)) return [];
  cache = fs
    .readdirSync(PASTA)
    .filter((f) => f.endsWith(".md"))
    .map(lerArquivo)
    .sort((a, b) => b.data.localeCompare(a.data));
  return cache;
}

export function noticiaPorSlug(slug: string): Noticia | undefined {
  return todasNoticias().find((n) => n.slug === slug);
}

export function noticiasDaCategoria(categoria: string): Noticia[] {
  return todasNoticias().filter((n) => n.categoria === categoria);
}

export function relacionadas(noticia: Noticia, limite = 3): Noticia[] {
  return todasNoticias()
    .filter((n) => n.slug !== noticia.slug)
    .map((n) => ({
      n,
      pontos:
        (n.categoria === noticia.categoria ? 2 : 0) +
        n.tags.filter((t) => noticia.tags.includes(t)).length,
    }))
    .filter((x) => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || b.n.data.localeCompare(a.n.data))
    .slice(0, limite)
    .map((x) => x.n);
}

export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}
