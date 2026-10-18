import crypto from "node:crypto";
import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { fontes, termosLocais, type Fonte } from "./fontes.js";

export type ItemColetado = {
  id: string;
  fonte: string;
  titulo: string;
  link: string;
  resumo: string;
  data: string; // ISO
};

const AGENTE = "Mozilla/5.0 (compatible; SMAgoraBot/1.0; +https://smagora.com.br/sobre/)";
const parser = new Parser({ timeout: 20000, headers: { "User-Agent": AGENTE } });

export const idDoLink = (link: string) =>
  crypto.createHash("sha1").update(link.replace(/[?#].*$/, "")).digest("hex").slice(0, 12);

const limpar = (s = "") => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export async function baixarHtml(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": AGENTE }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  return r.text();
}

async function lerRss(f: Fonte): Promise<ItemColetado[]> {
  const feed = await parser.parseURL(f.url);
  return feed.items
    .filter((i) => i.link && i.title)
    .map((i) => ({
      id: idDoLink(i.link!),
      fonte: f.nome,
      titulo: limpar(i.title),
      link: i.link!,
      resumo: limpar(i.contentSnippet ?? i.content ?? "").slice(0, 600),
      data: new Date(i.isoDate ?? i.pubDate ?? Date.now()).toISOString(),
    }));
}

async function lerPagina(f: Fonte): Promise<ItemColetado[]> {
  const $ = cheerio.load(await baixarHtml(f.url));
  const padrao = new RegExp(f.padraoLink ?? ".");
  const vistos = new Set<string>();
  const itens: ItemColetado[] = [];
  $("a[href]").each((_, a) => {
    const href = new URL($(a).attr("href")!, f.url).toString();
    const titulo = limpar($(a).text());
    if (!padrao.test(href) || titulo.length < 25 || vistos.has(href)) return;
    vistos.add(href);
    itens.push({ id: idDoLink(href), fonte: f.nome, titulo, link: href, resumo: "", data: new Date().toISOString() });
  });
  return itens.slice(0, 20);
}

export async function lerFonte(f: Fonte): Promise<ItemColetado[]> {
  const itens = f.tipo === "rss" ? await lerRss(f) : await lerPagina(f);
  if (!f.filtrarLocal) return itens;
  return itens.filter((i) => {
    const texto = `${i.titulo} ${i.resumo}`.toLowerCase();
    return termosLocais.some((t) => texto.includes(t));
  });
}

// Busca todas as fontes ativas e devolve só itens das últimas `horas`.
export async function coletarTudo(horas = 36): Promise<{ itens: ItemColetado[]; erros: string[] }> {
  const limite = Date.now() - horas * 3600_000;
  const erros: string[] = [];
  const resultados = await Promise.all(
    fontes
      .filter((f) => f.ativa !== false)
      .map(async (f) => {
        try {
          return await lerFonte(f);
        } catch (e) {
          erros.push(`${f.nome}: ${(e as Error).message}`);
          return [];
        }
      }),
  );
  const itens = resultados.flat().filter((i) => new Date(i.data).getTime() >= limite);
  return { itens, erros };
}
