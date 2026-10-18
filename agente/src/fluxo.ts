import fs from "node:fs";
import path from "node:path";
import { Bot, InlineKeyboard, InputFile } from "grammy";
import { config, nomesCategorias } from "./config.js";
import { coletarTudo, type ItemColetado } from "./coletor.js";
import * as db from "./estado.js";
import { extrairTexto } from "./extrair.js";
import { ajustar, pesquisarFatos, redigir, triar, type Triagem } from "./ia.js";
import { baixarImagem, buscarCandidatas } from "./imagens.js";
import { arteInstagram, fotoDoSite, fundoSemFoto, urlArte } from "./arte.js";
import { publicar } from "./publicar.js";
import { instagramConfigurado, postarNoInstagram } from "./instagram.js";

const h = (s = "") => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pastaPrevias = path.join(config.pastas.dados, "previas");
const arquivoPrevia = (id: string, tipo: "foto" | "arte") => path.join(pastaPrevias, `${id}-${tipo}.jpg`);

let coletando = false;

// ------------------------------------------------------------ 1. Coleta e triagem

export async function rodarColeta(bot: Bot, avisarSeVazio = false): Promise<void> {
  if (coletando || !config.telegramChatId) return;
  coletando = true;
  try {
    const { itens, erros } = await coletarTudo();
    const novos = itens.filter((i) => !db.existe(i.id));
    if (erros.length) console.warn("Fontes com erro:", erros.join(" | "));
    console.log(`[coleta] ${itens.length} itens, ${novos.length} novos`);

    const avaliacoes = await triar(novos.slice(0, 40), db.titulosRecentes());
    const porId = new Map(avaliacoes.map((a) => [a.id, a]));

    const aprovadas = novos
      .map((i) => ({ item: i, t: porId.get(i.id) }))
      .filter((x) => x.t && x.t.relevante && !x.t.repetida && x.t.nota >= config.notaMinima)
      .sort((a, b) => b.t!.nota - a.t!.nota)
      .slice(0, config.maxPautasPorRodada);
    const enviar = new Set(aprovadas.map((x) => x.item.id));

    // Itens descartados também são guardados, para não serem avaliados de novo.
    for (const i of novos.slice(0, 40)) {
      if (!enviar.has(i.id)) db.registrar(i, "descartado_ia", { triagem: porId.get(i.id) });
    }

    for (const { item, t } of aprovadas) {
      const msgId = await enviarPauta(bot, item, t!);
      db.registrar(item, "pauta", { triagem: t, mensagens: [msgId] });
    }

    if (aprovadas.length === 0 && avisarSeVazio) {
      await bot.api.sendMessage(config.telegramChatId, "Nenhuma pauta nova relevante agora.");
    }
  } finally {
    coletando = false;
  }
}

async function enviarPauta(bot: Bot, item: ItemColetado, t: Triagem): Promise<number> {
  const texto =
    `📰 <b>${h(item.titulo)}</b>\n\n${h(t.resumo)}\n\n` +
    `🏷 ${nomesCategorias[t.categoria]} · nota ${t.nota}/10\n🔗 <a href="${item.link}">${h(item.fonte)}</a>\n\n` +
    `<i>Dica: responda esta mensagem com uma orientação para aprovar com ela.</i>`;
  const teclado = new InlineKeyboard().text("✅ Aprovar", `ap:${item.id}`).text("❌ Descartar", `rj:${item.id}`);
  const msg = await bot.api.sendMessage(config.telegramChatId, texto, {
    parse_mode: "HTML",
    reply_markup: teclado,
    link_preview_options: { is_disabled: true },
  });
  return msg.message_id;
}

// Reenvia as pautas que ainda aguardam decisão (comando /pautas), da maior nota para a menor
export async function reenviarPautas(bot: Bot): Promise<void> {
  const pendentes = db
    .porStatus("pauta")
    .filter((r) => r.triagem)
    .sort((a, b) => b.triagem!.nota - a.triagem!.nota);
  if (pendentes.length === 0) {
    await bot.api.sendMessage(config.telegramChatId, "Nenhuma pauta aguardando decisão.");
    return;
  }
  await bot.api.sendMessage(config.telegramChatId, `📋 ${pendentes.length} pauta(s) aguardando decisão:`);
  for (const r of pendentes) {
    const msgId = await enviarPauta(bot, r, r.triagem!);
    db.atualizar(r.id, { mensagens: [...r.mensagens, msgId] });
  }
}

// ------------------------------------------------------------ 2. Redação e prévia

export async function aprovar(bot: Bot, id: string, orientacao?: string): Promise<void> {
  const r = db.atualizar(id, { status: "redigindo", orientacao });
  const aviso = await bot.api.sendMessage(config.telegramChatId, `✍️ Escrevendo: <b>${h(r.titulo)}</b>…`, { parse_mode: "HTML" });
  db.atualizar(id, { mensagens: [...r.mensagens, aviso.message_id] });

  try {
    let material = await extrairTexto(r.link);
    if (material.length < 600) {
      // Página não legível (ex.: link do Google Notícias): busca os fatos em outras fontes
      const pesquisa = await pesquisarFatos(r.titulo, r.fonte);
      material = `${r.resumo}\n\n${material}\n\n${pesquisa}`.trim();
    }
    const rascunho = await redigir(r, material, orientacao);
    db.atualizar(id, { rascunho, tentativaImagem: 0 });
    await montarPrevia(bot, id);
  } catch (e) {
    db.atualizar(id, { status: "erro", erro: (e as Error).message });
    await bot.api.sendMessage(config.telegramChatId, `⚠️ Erro ao escrever "${r.titulo}": ${(e as Error).message}`);
  }
}

export async function montarPrevia(bot: Bot, id: string): Promise<void> {
  const r = db.obter(id);
  const rascunho = r.rascunho!;
  const tentativa = r.tentativaImagem ?? 0;

  const candidatas = await buscarCandidatas(rascunho.buscaImagem);
  const imagem = candidatas[tentativa];
  let foto: Buffer;
  if (imagem) {
    try {
      foto = await fotoDoSite(await baixarImagem(imagem.url));
    } catch {
      foto = await fundoSemFoto(rascunho.categoria);
    }
  } else {
    foto = await fundoSemFoto(rascunho.categoria);
  }
  const credito = imagem ? `${imagem.autor} / ${imagem.acervo}` : undefined;
  const arte = await arteInstagram(foto, rascunho.tituloArte, rascunho.categoria, credito);

  fs.mkdirSync(pastaPrevias, { recursive: true });
  fs.writeFileSync(arquivoPrevia(id, "foto"), foto);
  fs.writeFileSync(arquivoPrevia(id, "arte"), arte);
  db.atualizar(id, { status: "previa", imagem });

  const infoImagem = imagem
    ? `🖼 Imagem: ${h(imagem.autor)} (${h(imagem.licenca)}, <a href="${imagem.fonte}">${imagem.acervo}</a>)`
    : "🖼 Sem foto livre adequada: usando fundo da editoria.";
  const legenda =
    `<b>${h(rascunho.titulo)}</b>\n<i>${h(rascunho.subtitulo)}</i>\n\n` +
    `🏷 ${nomesCategorias[rascunho.categoria]} · ${rascunho.tags.map((t) => `#${t}`).join(" ")}\n${infoImagem}`;
  const teclado = new InlineKeyboard()
    .text("🚀 Publicar", `pb:${id}`)
    .row()
    .text("🖼 Outra imagem", `im:${id}`)
    .text("✏️ Ajustar texto", `aj:${id}`)
    .row()
    .text("🗑 Descartar", `dc:${id}`);

  const m1 = await bot.api.sendPhoto(config.telegramChatId, new InputFile(arte, "arte.jpg"), {
    caption: legenda.slice(0, 1024),
    parse_mode: "HTML",
  });
  const corpo = `📄 <b>Texto da matéria</b>\n\n${h(rascunho.corpo)}\n\n📱 <b>Legenda Instagram</b>\n${h(rascunho.legendaInstagram)}`;
  const m2 = await bot.api.sendMessage(config.telegramChatId, corpo.slice(0, 4000), {
    parse_mode: "HTML",
    reply_markup: teclado,
  });
  db.atualizar(id, { mensagens: [...r.mensagens, m1.message_id, m2.message_id] });
}

export async function trocarImagem(bot: Bot, id: string): Promise<void> {
  const r = db.obter(id);
  db.atualizar(id, { tentativaImagem: (r.tentativaImagem ?? 0) + 1 });
  await montarPrevia(bot, id);
}

export async function ajustarTexto(bot: Bot, id: string, pedido: string): Promise<void> {
  const r = db.obter(id);
  await bot.api.sendMessage(config.telegramChatId, "✏️ Ajustando a matéria…");
  const rascunho = await ajustar(r.rascunho!, pedido);
  db.atualizar(id, { rascunho });
  await montarPrevia(bot, id);
}

// ------------------------------------------------------------ 3. Publicação

export async function publicarItem(bot: Bot, id: string): Promise<void> {
  const r = db.obter(id);
  const foto = fs.readFileSync(arquivoPrevia(id, "foto"));
  const arte = fs.readFileSync(arquivoPrevia(id, "arte"));
  const pub = await publicar(r.rascunho!, foto, arte, r.imagem);
  db.atualizar(id, { status: "publicado" });

  await bot.api.sendMessage(
    config.telegramChatId,
    `✅ Publicado: ${pub.url}\n${pub.enviadoAoGitHub ? "O site atualiza em 1 a 3 minutos." : `⚠️ ${pub.aviso}`}`,
  );

  const legenda = `${r.rascunho!.legendaInstagram}\n\n🔗 Link na bio · @${config.instagramArroba}`;
  if (instagramConfigurado() && pub.enviadoAoGitHub) {
    try {
      await postarNoInstagram(urlArte(pub.slug), legenda);
      await bot.api.sendMessage(config.telegramChatId, "📸 Postado no Instagram.");
    } catch (e) {
      await bot.api.sendMessage(config.telegramChatId, `⚠️ Instagram: ${(e as Error).message}`);
      await enviarArteManual(bot, arte, legenda);
    }
  } else {
    await enviarArteManual(bot, arte, legenda);
  }

  fs.rmSync(arquivoPrevia(id, "foto"), { force: true });
  fs.rmSync(arquivoPrevia(id, "arte"), { force: true });
}

async function enviarArteManual(bot: Bot, arte: Buffer, legenda: string) {
  await bot.api.sendDocument(config.telegramChatId, new InputFile(arte, "post-instagram.jpg"), {
    caption: "📲 Arte pronta para o Instagram (salve e poste). Legenda abaixo:",
  });
  await bot.api.sendMessage(config.telegramChatId, legenda);
}
