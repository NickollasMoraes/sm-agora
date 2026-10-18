import fs from "node:fs";
import path from "node:path";
import { Bot, InlineKeyboard, InputFile } from "grammy";
import { config } from "./config.js";
import { capaReels } from "./arte.js";
import { instagramConfigurado, postarReels } from "./instagram.js";
import { enviarAoGitHub } from "./publicar.js";
import { marcaDagua } from "./video.js";

// Vídeos enviados por você no Telegram viram Reels com capa no padrão do portal.
// Legenda do vídeo no Telegram: 1ª linha = título da capa; o resto (opcional) = legenda do post.

type Reel = {
  id: string;
  titulo: string;
  legenda: string;
  status: "previa" | "publicando" | "publicado" | "descartado";
  mensagens: number[];
  criadoEm: string;
};

const pasta = path.join(config.pastas.dados, "reels");
const ARQUIVO = path.join(pasta, "reels.json");
const arquivoVideo = (id: string) => path.join(pasta, `${id}.mp4`);
const arquivoCapa = (id: string) => path.join(pasta, `${id}-capa.jpg`);
const DIAS_GUARDAR = 7;

function carregar(): Record<string, Reel> {
  try {
    return JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
  } catch {
    return {};
  }
}
const reels = carregar();

function salvar() {
  // Apaga vídeos antigos para não lotar o disco
  const limite = Date.now() - DIAS_GUARDAR * 86400_000;
  for (const [id, r] of Object.entries(reels)) {
    if (new Date(r.criadoEm).getTime() < limite) {
      fs.rmSync(arquivoVideo(id), { force: true });
      fs.rmSync(arquivoCapa(id), { force: true });
      delete reels[id];
    }
  }
  fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(ARQUIVO, JSON.stringify(reels, null, 2));
}

export const reelPorMensagem = (msgId: number) => Object.values(reels).find((r) => r.mensagens.includes(msgId));

const h = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HASHTAGS = "#SantaMaria #SantaMariaRS #SMAgora #RegiaoCentral";

// O Telegram só deixa bots baixarem arquivos de até 20 MB.
const LIMITE_TELEGRAM = 20 * 1024 * 1024;

export async function receberVideo(
  bot: Bot,
  arquivo: { file_id: string; file_size?: number },
  textoTelegram: string,
): Promise<void> {
  const chat = config.telegramChatId;
  if (!instagramConfigurado()) {
    await bot.api.sendMessage(chat, "⚠️ O Instagram automático não está configurado no .env, então não consigo postar Reels.");
    return;
  }
  if ((arquivo.file_size ?? 0) > LIMITE_TELEGRAM) {
    await bot.api.sendMessage(
      chat,
      "⚠️ Esse vídeo passa de 20 MB, o limite que o Telegram deixa o bot baixar. Mande de novo como vídeo normal (não como arquivo), que o Telegram comprime, ou corte um trecho menor.",
    );
    return;
  }

  const [primeira, ...resto] = textoTelegram.trim().split(/\r?\n/);
  const titulo = (primeira ?? "").trim();
  const id = Date.now().toString(36);

  await bot.api.sendMessage(chat, "🎬 Recebi o vídeo. Montando a capa…");
  const info = await bot.api.getFile(arquivo.file_id);
  const resp = await fetch(`https://api.telegram.org/file/bot${config.telegramToken}/${info.file_path}`);
  if (!resp.ok) throw new Error(`Não consegui baixar o vídeo do Telegram (HTTP ${resp.status})`);
  fs.mkdirSync(pasta, { recursive: true });
  await bot.api.sendMessage(chat, "🏷 Colocando a marca d'água…");
  fs.writeFileSync(arquivoVideo(id), await marcaDagua(Buffer.from(await resp.arrayBuffer())));

  const legendaExtra = resto.join("\n").trim();
  reels[id] = {
    id,
    titulo,
    legenda: legendaExtra || (titulo ? `${titulo}\n\n${HASHTAGS}` : HASHTAGS),
    status: "previa",
    mensagens: [],
    criadoEm: new Date().toISOString(),
  };
  salvar();

  if (!titulo) {
    const m = await bot.api.sendMessage(chat, "✏️ Qual o título da capa? Responda ESTA mensagem.", {
      reply_markup: { force_reply: true },
    });
    reels[id].mensagens.push(m.message_id);
    salvar();
    return;
  }
  await enviarPrevia(bot, id);
}

async function enviarPrevia(bot: Bot, id: string): Promise<void> {
  const r = reels[id];
  const capa = await capaReels(r.titulo);
  fs.writeFileSync(arquivoCapa(id), capa);
  const teclado = new InlineKeyboard()
    .text("📤 Publicar Reels", `rlp:${id}`)
    .row()
    .text("✏️ Trocar título", `rlt:${id}`)
    .text("❌ Descartar", `rld:${id}`);
  const m = await bot.api.sendPhoto(config.telegramChatId, new InputFile(capa, "capa.jpg"), {
    caption: `🎬 <b>Prévia do Reels</b>\n\n${h(r.legenda)}`.slice(0, 1024),
    parse_mode: "HTML",
    reply_markup: teclado,
  });
  r.mensagens.push(m.message_id);
  salvar();
}

// Resposta em texto a uma mensagem do Reels: é o título (novo) da capa.
export async function responderReel(bot: Bot, r: Reel, texto: string): Promise<void> {
  if (r.status !== "previa") return;
  const antigo = r.titulo;
  r.titulo = texto.trim().split(/\r?\n/)[0];
  // Se a legenda era a automática, acompanha o título novo
  if (r.legenda === `${antigo}\n\n${HASHTAGS}` || r.legenda === HASHTAGS) r.legenda = `${r.titulo}\n\n${HASHTAGS}`;
  salvar();
  await enviarPrevia(bot, r.id);
}

export async function botaoReel(bot: Bot, acao: string, id: string): Promise<string> {
  const r = reels[id];
  if (!r) return "Vídeo não encontrado (talvez muito antigo).";
  if (r.status !== "previa") return "Esse vídeo já foi tratado.";

  if (acao === "rld") {
    r.status = "descartado";
    fs.rmSync(arquivoVideo(id), { force: true });
    salvar();
    return "Vídeo descartado.";
  }
  if (acao === "rlt") {
    const m = await bot.api.sendMessage(config.telegramChatId, "✏️ Responda ESTA mensagem com o novo título da capa.", {
      reply_markup: { force_reply: true },
    });
    r.mensagens.push(m.message_id);
    salvar();
    return "";
  }
  // rlp: publicar
  r.status = "publicando";
  salvar();
  publicar(bot, id).catch(async (e) => {
    r.status = "previa"; // deixa tentar de novo
    salvar();
    await bot.api.sendMessage(config.telegramChatId, `⚠️ Reels não publicado: ${(e as Error).message}`).catch(() => {});
  });
  return "Publicando…";
}

async function publicar(bot: Bot, id: string): Promise<void> {
  const r = reels[id];
  await bot.api.sendMessage(config.telegramChatId, "⏳ Enviando vídeo e capa pelo site para o Instagram. Leva de 3 a 6 minutos.");
  const link = await publicarReelsPeloSite(id, fs.readFileSync(arquivoVideo(id)), fs.readFileSync(arquivoCapa(id)), r.legenda, r.titulo, true);
  r.status = "publicado";
  fs.rmSync(arquivoVideo(id), { force: true });
  salvar();
  await bot.api.sendMessage(config.telegramChatId, `📸 Reels publicado: ${link}`);
}

// A API do Instagram só aceita vídeo e capa por URL pública: os dois vão para o site primeiro.
// A capa fica; o vídeo sai do site assim que o Instagram termina de baixá-lo. Devolve o link do post.
export async function publicarReelsPeloSite(
  nome: string,
  video: Buffer,
  capa: Buffer,
  legenda: string,
  titulo: string,
  noFeed: boolean,
): Promise<string> {
  const videoNoSite = path.join(config.pastas.capasReels, `${nome}.mp4`);
  fs.mkdirSync(config.pastas.capasReels, { recursive: true });
  fs.writeFileSync(path.join(config.pastas.capasReels, `${nome}.jpg`), capa);
  fs.writeFileSync(videoNoSite, video);
  await enviarAoGitHub(["site/public/imagens/reels"], `Reels: ${titulo}`);
  const base = `${config.siteUrl}/imagens/reels/${nome}`;
  try {
    return await postarReels(`${base}.mp4`, `${base}.jpg`, legenda, noFeed);
  } finally {
    fs.rmSync(videoNoSite, { force: true });
    await enviarAoGitHub(["site/public/imagens/reels"], `Remove vídeo do Reels: ${titulo}`).catch(() => {});
  }
}
