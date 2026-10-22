import Parser from "rss-parser";
import { Bot } from "grammy";
import { config } from "./config.js";
import { idDoLink, type ItemColetado } from "./coletor.js";
import * as db from "./estado.js";
import { enviarPauta } from "./fluxo.js";
import { triar } from "./ia.js";

const parser = new Parser({ timeout: 20000 });

export async function buscarTema(tema: string, bot: Bot): Promise<number> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(tema)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  const feed = await parser.parseURL(url);
  const itens: ItemColetado[] = feed.items
    .filter((item) => item.link && item.title)
    .map((item) => ({
      id: idDoLink(item.link!),
      fonte: `busca: ${tema}`,
      titulo: item.title!.replace(/\s+-\s+[^-]+$/, "").trim(),
      link: item.link!,
      resumo: item.contentSnippet ?? item.content ?? "",
      data: new Date(item.isoDate ?? item.pubDate ?? Date.now()).toISOString(),
    }))
    .filter((item) => !db.existe(item.id));
  const avaliacoes = await triar(itens.slice(0, 40), db.titulosRecentes());
  const porId = new Map(avaliacoes.map((avaliacao) => [avaliacao.id, avaliacao]));
  const aprovadas = itens
    .map((item) => ({ item, avaliacao: porId.get(item.id) }))
    .filter(({ avaliacao }) => avaliacao?.relevante && !avaliacao.repetida && avaliacao.nota >= config.notaMinima)
    .sort((a, b) => b.avaliacao!.nota - a.avaliacao!.nota)
    .slice(0, 3);
  for (const { item, avaliacao } of aprovadas) {
    const mensagem = await enviarPauta(bot, item, avaliacao!);
    db.registrar(item, "pauta", { triagem: avaliacao, mensagens: [mensagem] });
  }
  await bot.api.sendMessage(config.telegramChatId, aprovadas.length ? `🔎 ${aprovadas.length} pauta(s) encontradas para “${tema}”.` : `Nenhuma pauta relevante encontrada para “${tema}”.`);
  return aprovadas.length;
}
