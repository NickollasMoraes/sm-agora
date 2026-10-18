import { Bot } from "grammy";
import cron from "node-cron";
import { config } from "./config.js";
import * as db from "./estado.js";
import { ajustarTexto, aprovar, montarPrevia, publicarItem, rodarColeta, trocarImagem } from "./fluxo.js";

const bot = new Bot(config.telegramToken);

// Segurança: só responde ao seu chat. No primeiro uso, /start mostra o número a colocar no .env.
bot.use(async (ctx, next) => {
  const chat = String(ctx.chat?.id ?? "");
  if (!config.telegramChatId) {
    if (ctx.message?.text === "/start") {
      await ctx.reply(`Olá! Coloque esta linha no arquivo agente/.env e reinicie o agente:\n\nTELEGRAM_CHAT_ID=${chat}`);
    }
    return;
  }
  if (chat !== config.telegramChatId) return;
  await next();
});

// Executa uma tarefa sem travar o bot e avisa se der erro
function tarefa(nome: string, fn: () => Promise<void>) {
  fn().catch(async (e) => {
    console.error(`[${nome}]`, e);
    await bot.api.sendMessage(config.telegramChatId, `⚠️ Erro (${nome}): ${(e as Error).message}`).catch(() => {});
  });
}

bot.command("start", (ctx) =>
  ctx.reply(
    "Agente do portal ativo.\n\n/coletar: buscar pautas agora\n/status: resumo do dia\n/pendentes: reenviar prévias não publicadas",
  ),
);

bot.command("coletar", async (ctx) => {
  await ctx.reply("🔎 Buscando pautas…");
  tarefa("coleta", () => rodarColeta(bot, true));
});

bot.command("status", async (ctx) => {
  const conta = (s: db.Status) => db.porStatus(s).length;
  await ctx.reply(
    `Pautas aguardando: ${conta("pauta")}\nPrévias aguardando: ${conta("previa")}\nPublicadas (30 dias): ${conta("publicado")}\nDescartadas pela IA (30 dias): ${conta("descartado_ia")}`,
  );
});

bot.command("pendentes", async (ctx) => {
  const previas = db.porStatus("previa");
  if (previas.length === 0) return ctx.reply("Nenhuma prévia pendente.");
  for (const r of previas) tarefa("prévia", () => montarPrevia(bot, r.id));
});

// Botões
bot.on("callback_query:data", async (ctx) => {
  const [acao, id] = ctx.callbackQuery.data.split(":");
  const r = db.obter(id);
  if (!r) return ctx.answerCallbackQuery({ text: "Item não encontrado (talvez muito antigo)." });

  const tirarBotoes = () => ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});

  switch (acao) {
    case "ap":
      if (r.status !== "pauta") return ctx.answerCallbackQuery({ text: "Essa pauta já foi tratada." });
      await ctx.answerCallbackQuery({ text: "Aprovada! Escrevendo a matéria…" });
      await tirarBotoes();
      tarefa("redação", () => aprovar(bot, id));
      break;
    case "rj":
      db.atualizar(id, { status: "rejeitado" });
      await ctx.answerCallbackQuery({ text: "Descartada." });
      await ctx.editMessageText(`❌ <s>${r.titulo.replace(/</g, "&lt;")}</s>`, { parse_mode: "HTML" }).catch(() => {});
      break;
    case "pb":
      if (r.status !== "previa") return ctx.answerCallbackQuery({ text: "Essa matéria não está aguardando publicação." });
      await ctx.answerCallbackQuery({ text: "Publicando…" });
      await tirarBotoes();
      tarefa("publicação", () => publicarItem(bot, id));
      break;
    case "im":
      await ctx.answerCallbackQuery({ text: "Buscando outra imagem…" });
      await tirarBotoes();
      tarefa("imagem", () => trocarImagem(bot, id));
      break;
    case "aj": {
      await ctx.answerCallbackQuery();
      const m = await ctx.reply("✏️ Responda ESTA mensagem dizendo o que mudar no texto.", {
        reply_markup: { force_reply: true },
      });
      db.atualizar(id, { mensagens: [...r.mensagens, m.message_id] });
      break;
    }
    case "dc":
      db.atualizar(id, { status: "rejeitado" });
      await tirarBotoes();
      await ctx.answerCallbackQuery({ text: "Matéria descartada." });
      break;
  }
});

// Respostas em texto: orientação para uma pauta ou ajuste de uma prévia
bot.on("message:text", async (ctx) => {
  const respondida = ctx.message.reply_to_message?.message_id;
  if (!respondida) return;
  const r = db.porMensagem(respondida);
  if (!r) return;
  if (r.status === "pauta") {
    await ctx.reply("✅ Aprovada com a sua orientação. Escrevendo…");
    tarefa("redação", () => aprovar(bot, r.id, ctx.message.text));
  } else if (r.status === "previa") {
    tarefa("ajuste", () => ajustarTexto(bot, r.id, ctx.message.text));
  }
});

bot.catch((e) => console.error("[bot]", e.message));

// Agenda da coleta automática
cron.schedule(config.cronColeta, () => tarefa("coleta", () => rodarColeta(bot)), { timezone: "America/Sao_Paulo" });

console.log(`Agente iniciado. Coleta: "${config.cronColeta}". Modelo: ${config.modelo}.`);
if (!config.telegramChatId) console.log("Mande /start para o seu bot no Telegram para descobrir o TELEGRAM_CHAT_ID.");
if (process.argv.includes("--coletar-agora")) tarefa("coleta", () => rodarColeta(bot, true));

await bot.start({ drop_pending_updates: false });
