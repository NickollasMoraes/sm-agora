import { Bot } from "grammy";
import cron from "node-cron";
import { config } from "./config.js";
import { claudeCodeLogado } from "./claude-code.js";
import { instagramConfigurado, renovarToken } from "./instagram.js";
import * as db from "./estado.js";
import { ajustarTexto, aprovar, montarPrevia, publicarItem, reenviarPautas, rodarColeta, trocarImagem } from "./fluxo.js";
import { botaoReel, receberVideo, reelPorMensagem, responderReel } from "./reels.js";
import { buscarTema } from "./buscar.js";
import { processarComandos } from "./comandos.js";
import { lerCanais } from "./canais.js";
import fs from "node:fs";
import path from "node:path";

// Uma instância só: duas janelas do .bat abertas faziam dois robôs coletarem,
// postarem em dobro e brigarem no git. A segunda sai e o .bat tenta de novo em 15 s,
// então ela assume sozinha se a primeira parar.
const trava = path.join(config.pastas.dados, "robo.lock");
function vivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function pegarTrava(): boolean {
  try {
    // "wx" é atômico: se as duas janelas subirem juntas, só uma cria o arquivo.
    fs.writeFileSync(trava, String(process.pid), { flag: "wx" });
    return true;
  } catch {
    const dono = Number(fs.readFileSync(trava, "utf8"));
    if (dono && vivo(dono)) return false;
    fs.rmSync(trava, { force: true }); // trava velha de um robô que já morreu
    return pegarTrava();
  }
}
if (!pegarTrava()) {
  console.log("Outro robô já está rodando. Esta janela fica de reserva e tenta de novo em 15 s.");
  process.exit(0);
}
process.on("exit", () => {
  if (fs.existsSync(trava) && fs.readFileSync(trava, "utf8") === String(process.pid)) fs.rmSync(trava);
});

const bot = new Bot(config.telegramToken);

// O Telegram limita mensagens no mesmo chat. A fila evita que aprovações
// simultâneas de matérias derrubem a prévia com erro 429.
let telegramFila = Promise.resolve();
bot.api.config.use(async (prev, method, payload, signal) => {
  if (method === "getUpdates") return prev(method, payload, signal);

  const anterior = telegramFila;
  let liberar!: () => void;
  telegramFila = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  await anterior;

  try {
    for (let tentativa = 1; ; tentativa++) {
      try {
        return await prev(method, payload, signal);
      } catch (erro) {
        const resposta = erro as {
          error_code?: number;
          parameters?: { retry_after?: number };
        };
        if (resposta.error_code !== 429 || tentativa >= 5) throw erro;
        const segundos = resposta.parameters?.retry_after ?? 1;
        await new Promise((resolve) => setTimeout(resolve, segundos * 1000));
      }
    }
  } finally {
    setTimeout(liberar, 1100);
  }
});

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
    "Agente do portal ativo.\n\n/pautas: ver as pautas aguardando decisão\n/coletar: buscar pautas agora\n/buscar <tema>: buscar um tema\n/status: resumo do dia\n/pendentes: reenviar prévias não publicadas\n\n🎬 Reels: mande um vídeo. Na legenda, a 1ª linha vira o título da capa e o resto vira a legenda do post.",
  ),
);

bot.command("pautas", async () => tarefa("pautas", () => reenviarPautas(bot)));

bot.command("coletar", async (ctx) => {
  await ctx.reply("🔎 Buscando pautas…");
  tarefa("coleta", () => rodarColeta(bot, true));
});

bot.command("buscar", async (ctx) => {
  const tema = ctx.match.trim();
  if (!tema) return ctx.reply("Uso: /buscar <tema>");
  await ctx.reply(`🔎 Buscando “${tema}”…`);
  tarefa("busca", () => buscarTema(tema, bot).then(() => undefined));
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
  if (acao.startsWith("rl")) {
    const texto = await botaoReel(bot, acao, id);
    await ctx.answerCallbackQuery(texto ? { text: texto } : undefined);
    if (acao !== "rlt") await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
    return;
  }
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
      db.registrarHistorico(id, "descartada");
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
      db.registrarHistorico(id, "descartada");
      await tirarBotoes();
      await ctx.answerCallbackQuery({ text: "Matéria descartada." });
      break;
  }
});

// Respostas em texto: orientação para uma pauta ou ajuste de uma prévia
bot.on("message:text", async (ctx) => {
  const respondida = ctx.message.reply_to_message?.message_id;
  if (!respondida) return;
  const reel = reelPorMensagem(respondida);
  if (reel) return tarefa("reels", () => responderReel(bot, reel, ctx.message.text));
  const r = db.porMensagem(respondida);
  if (!r) return;
  if (r.status === "pauta") {
    await ctx.reply("✅ Aprovada com a sua orientação. Escrevendo…");
    tarefa("redação", () => aprovar(bot, r.id, ctx.message.text));
  } else if (r.status === "previa") {
    tarefa("ajuste", () => ajustarTexto(bot, r.id, ctx.message.text));
  }
});

// Vídeo (ou arquivo de vídeo) enviado no chat: vira prévia de Reels
bot.on(["message:video", "message:document"], async (ctx) => {
  const arquivo = ctx.message.video ?? ctx.message.document;
  if (!arquivo || (ctx.message.document && !ctx.message.document.mime_type?.startsWith("video/"))) return;
  tarefa("reels", () => receberVideo(bot, arquivo, ctx.message.caption ?? ""));
});

bot.catch((e) => console.error("[bot]", e.message));

// Renova o token do Instagram toda segunda-feira às 4h (ele vence em 60 dias)
cron.schedule("0 4 * * 1", () => tarefa("token Instagram", renovarToken), { timezone: "America/Sao_Paulo" });

// Agenda da coleta automática
cron.schedule(config.cronColeta, () => tarefa("coleta", () => rodarColeta(bot)), { timezone: "America/Sao_Paulo" });

setInterval(() => tarefa("comandos do painel", () => processarComandos(bot)), 10_000);

const modoIa = lerCanais().redator === "codex" ? "Codex" : config.iaProvedor === "api" ? `API paga (${config.modelo})` : "seu plano do Claude (Claude Code)";
console.log(`Agente iniciado. Coleta: "${config.cronColeta}". IA: ${modoIa}. Triagem: ${config.triagem}. Instagram: ${instagramConfigurado() ? "automático" : "manual"}.`);
if (lerCanais().redator === "claude" && config.iaProvedor === "claude-code" && !(await claudeCodeLogado())) {
  console.warn("ATENÇÃO: o Claude Code não está logado. Rode 'claude auth login' no terminal.");
  if (config.telegramChatId) await bot.api.sendMessage(config.telegramChatId, "⚠️ O Claude Code não está logado no PC. Rode 'claude auth login' no terminal.").catch(() => {});
}
if (!config.telegramChatId) console.log("Mande /start para o seu bot no Telegram para descobrir o TELEGRAM_CHAT_ID.");
if (process.argv.includes("--coletar-agora")) tarefa("coleta", () => rodarColeta(bot, true));

// Menu de comandos que aparece ao digitar "/" no Telegram
await bot.api
  .setMyCommands([
    { command: "pautas", description: "Ver as pautas aguardando decisão" },
    { command: "coletar", description: "Buscar pautas agora" },
    { command: "buscar", description: "Buscar um tema no Google Notícias" },
    { command: "status", description: "Resumo do dia" },
    { command: "pendentes", description: "Reenviar prévias não publicadas" },
  ])
  .catch(() => {});

await bot.start({ drop_pending_updates: false });
