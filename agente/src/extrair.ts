import * as cheerio from "cheerio";
import { baixarHtml } from "./coletor.js";

// Extrai o texto principal de uma página de notícia (só para a IA ler os fatos;
// o texto nunca é copiado para o site).
export async function extrairTexto(url: string): Promise<string> {
  try {
    const $ = cheerio.load(await baixarHtml(url));
    $("script, style, nav, header, footer, aside, form, noscript, iframe, .comments, .related").remove();
    const raiz = $("article").first().length ? $("article").first() : $("main").first().length ? $("main").first() : $("body");
    const paragrafos = raiz
      .find("p, h2, h3, li")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter((t) => t.length > 40);
    return paragrafos.join("\n").slice(0, 12000);
  } catch {
    return "";
  }
}
