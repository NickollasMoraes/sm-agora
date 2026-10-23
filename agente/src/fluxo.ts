import fs from "node:fs";
import path from "node:path";
import { Bot, InlineKeyboard, InputFile } from "grammy";
import { config, nomesCategorias } from "./config.js";
import { lerCanais } from "./canais.js";
import type { NomeCanal } from "./canais.js";
import { coletarTudo, type ItemColetado } from "./coletor.js";
import * as db from "./estado.js";
import { extrairTexto } from "./extrair.js";
import { ajustar, escolherImagens, pesquisarFatos, redigir, triar, type Triagem } from "./ia.js";
import { baixarImagem, buscarCandidatas } from "./imagens.js";
import { arteInstagram, arteInstagramStory, camadasReelsMateria, fotoDoSite, fundoSemFoto, urlArte } from "./arte.js";
import { enviarAoGitHub, publicar, type ArquivoExtra } from "./publicar.js";
import { esperarUrlNoAr, instagramConfigurado, postarNoInstagram, postarReels, postarStoriesInstagram } from "./instagram.js";
import { facebookConfigurado, postarFacebookFeed, postarFacebookReels, postarFacebookStory } from "./facebook.js";
import { postarShort } from "./youtube.js";
import { publicarReelsPeloSite } from "./reels.js";
import { videoDaMateria } from "./video.js";

const h = (s = "") => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pastaPrevias = path.join(config.pastas.dados, "previas");
const arquivoPrevia = (id: string, tipo: "foto" | "arte") => path.join(pastaPrevias, `${id}-${tipo}.jpg`);
const arquivoMidia = (id: string, tipo: "story" | "reel" | "capa") => path.join(pastaPrevias, `${id}-${tipo}.${tipo === "reel" ? "mp4" : "jpg"}`);
const versoesMidias = new Map<string, number>();
const tarefasMidias = new Map<string, Promise<void>>();

function iniciarPreparacaoMidias(id: string): void {
  const versao = (versoesMidias.get(id) ?? 0) + 1;
  versoesMidias.set(id, versao);
  for (const tipo of ["story", "reel", "capa"] as const) fs.rmSync(arquivoMidia(id, tipo), { force: true });
  const tarefa = prepararMidias(id, versao).catch(() => {});
  tarefasMidias.set(id, tarefa);
}

async function prepararMidias(id: string, versao: number): Promise<void> {
  const inicio = Date.now();
  const r = db.obter(id);
  const canais = lerCanais().canais;
  const foto = fs.existsSync(arquivoPrevia(id, "foto")) ? fs.readFileSync(arquivoPrevia(id, "foto")) : null;
  const credito = r.imagem ? `${r.imagem.autor} / ${r.imagem.acervo}` : undefined;
  const midias: db.Midias = {};
  const erros: string[] = [];
  fs.mkdirSync(pastaPrevias, { recursive: true });
  const tarefas: Promise<void>[] = [];
  if (canais.instagramStories || canais.facebookStories) tarefas.push((async () => {
    const story = await arteInstagramStory(r.imagem ? foto : null, r.rascunho!.tituloArte, r.rascunho!.categoria, credito);
    if (versoesMidias.get(id) !== versao) return;
    fs.writeFileSync(arquivoMidia(id, "story"), story);
    midias.story = arquivoMidia(id, "story");
    return;
  })().catch((e) => { erros.push(`Story: ${(e as Error).message}`); }));
  if (canais.instagramReels || canais.facebookReels || canais.youtubeShorts) tarefas.push((async () => {
    const camadas = await camadasReelsMateria(r.imagem ? foto : null, r.rascunho!.tituloArte, r.rascunho!.categoria, credito);
    const video = await videoDaMateria(camadas.fundo, camadas.camada);
    if (versoesMidias.get(id) !== versao) return;
    fs.writeFileSync(arquivoMidia(id, "reel"), video);
    fs.writeFileSync(arquivoMidia(id, "capa"), camadas.capa);
    midias.reel = arquivoMidia(id, "reel");
    midias.capa = arquivoMidia(id, "capa");
    return;
  })().catch((e) => { erros.push(`Reels: ${(e as Error).message}`); }));
  await Promise.all(tarefas);
  if (versoesMidias.get(id) !== versao) return;
  midias.prontoEm = new Date().toISOString();
  if (erros.length) midias.erro = erros.join(" | ");
  db.atualizar(id, { midias });
  db.registrarHistorico(id, "midias-prontas", `${Math.round((Date.now() - inicio) / 1000)}s${midias.erro ? `; ${midias.erro}` : ""}`);
  if (midias.erro) db.registrarHistorico(id, "erro", midias.erro);
}

async function aguardarMidias(id: string, limiteMs: number): Promise<void> {
  // Robô reiniciado entre a prévia e o Publicar: a tarefa em memória sumiu e as
  // mídias não existem em disco. Gera de novo (dentro do mesmo limite de espera).
  const salvas = db.obter(id).midias;
  const temEmDisco = [salvas?.story, salvas?.reel].some((arquivo) => arquivo && fs.existsSync(arquivo));
  if (!tarefasMidias.has(id) && !temEmDisco) iniciarPreparacaoMidias(id);
  const tarefa = tarefasMidias.get(id);
  if (!tarefa) return;
  await Promise.race([tarefa, new Promise<void>((resolve) => setTimeout(resolve, limiteMs))]);
}

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
      db.registrarHistorico(item.id, "pauta-enviada");
    }

    if (aprovadas.length === 0 && avisarSeVazio) {
      await bot.api.sendMessage(config.telegramChatId, "Nenhuma pauta nova relevante agora.");
    }
  } finally {
    coletando = false;
  }
}

export async function enviarPauta(bot: Bot, item: ItemColetado, t: Triagem): Promise<number> {
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
    db.registrarHistorico(r.id, "pauta-enviada");
  }
}

// ------------------------------------------------------------ 2. Redação e prévia

export async function aprovar(bot: Bot, id: string, orientacao?: string): Promise<void> {
  const r = db.atualizar(id, { status: "redigindo", orientacao });
  db.registrarHistorico(id, "aprovada", orientacao);
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
    const palavras = rascunho.corpo.trim().split(/\s+/).filter(Boolean).length;
    if (palavras < lerCanais().palavrasMinimas) {
      await bot.api.sendMessage(config.telegramChatId, `⚠️ A matéria ficou com ${palavras} palavras; o mínimo configurado é ${lerCanais().palavrasMinimas}.`);
    }
    db.atualizar(id, { rascunho, tentativaImagem: 0, imagensAprovadas: undefined });
    db.registrarHistorico(id, "redigida");
    await montarPrevia(bot, id);
  } catch (e) {
    db.atualizar(id, { status: "erro", erro: (e as Error).message });
    db.registrarHistorico(id, "erro", (e as Error).message);
    await bot.api.sendMessage(config.telegramChatId, `⚠️ Erro ao escrever "${r.titulo}": ${(e as Error).message}`);
  }
}

export async function montarPrevia(bot: Bot, id: string): Promise<void> {
  const r = db.obter(id);
  const rascunho = r.rascunho!;
  const tentativa = r.tentativaImagem ?? 0;

  // A IA confere título, descrição e etiquetas de cada foto e só aprova as que combinam com a matéria
  // (ex.: prédio de outra universidade numa notícia da UFSM é reprovado). Sem aprovadas, entra o fundo da editoria.
  let aprovadas = r.imagensAprovadas;
  if (!aprovadas) {
    const candidatas = await buscarCandidatas(rascunho.buscaImagem);
    aprovadas = await escolherImagens(rascunho, candidatas).catch(() => []);
    db.atualizar(id, { imagensAprovadas: aprovadas });
  }
  const imagem = aprovadas[tentativa];
  let fotoReal: Buffer | null = null;
  if (imagem) {
    try {
      fotoReal = await fotoDoSite(await baixarImagem(imagem.url));
    } catch {
      fotoReal = null;
    }
  }
  const foto = fotoReal ?? (await fundoSemFoto(rascunho.categoria));
  const credito = fotoReal && imagem ? `${imagem.autor} / ${imagem.acervo}` : undefined;
  const arte = await arteInstagram(fotoReal, rascunho.tituloArte, rascunho.categoria, credito);

  fs.mkdirSync(pastaPrevias, { recursive: true });
  fs.writeFileSync(arquivoPrevia(id, "foto"), foto);
  fs.writeFileSync(arquivoPrevia(id, "arte"), arte);
  // Se a foto não baixou, a prévia usa o fundo da marca: sem crédito de foto na matéria.
  db.atualizar(id, { status: "previa", imagem: fotoReal ? imagem : undefined });
  iniciarPreparacaoMidias(id);

  const infoImagem = fotoReal && imagem
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
  // O texto pode ter mudado o assunto da foto: confere as imagens de novo.
  db.atualizar(id, { rascunho, tentativaImagem: 0, imagensAprovadas: undefined });
  await montarPrevia(bot, id);
}

// ------------------------------------------------------------ 3. Publicação

export async function publicarItem(bot: Bot, id: string): Promise<void> {
  const inicio = Date.now();
  await aguardarMidias(id, 60_000);
  const r = db.obter(id);
  const foto = fs.readFileSync(arquivoPrevia(id, "foto"));
  const arte = fs.readFileSync(arquivoPrevia(id, "arte"));
  const canais = lerCanais().canais;
  const midias = r.midias ?? {};
  const extras: ArquivoExtra[] = [];
  const adicionar = (origem: string | undefined, destino: string) => {
    if (origem && fs.existsSync(origem)) extras.push({ caminho: destino, dados: fs.readFileSync(origem) });
  };
  const slug = r.rascunho!.slug;
  adicionar(midias.story, "site/public/imagens/instagram/__SLUG__-story.jpg");
  adicionar(midias.reel, "site/public/imagens/reels/__SLUG__.mp4");
  adicionar(midias.capa, "site/public/imagens/reels/__SLUG__.jpg");
  const pub = canais.site
    ? await publicar(r.rascunho!, foto, arte, r.imagem, extras)
    : { slug, url: `${config.siteUrl}/noticia/${slug}/`, enviadoAoGitHub: false, aviso: "canal site desligado" };
  const resultados: string[] = [canais.site ? (pub.enviadoAoGitHub ? "site: ok" : `site: erro: ${pub.aviso}`) : "site: pulado: desligado"];
  db.atualizar(id, { status: "publicado", publicacao: pub, canais: { ...(r.canais ?? {}), site: { status: pub.enviadoAoGitHub ? "ok" : "erro", detalhe: pub.aviso, em: new Date().toISOString() } } });
  db.registrarHistorico(id, "publicada", pub.url);
  if (pub.enviadoAoGitHub) await esperarUrlNoAr(pub.url).catch(() => {});
  const legendaBase = r.rascunho!.legendaInstagram;
  const legenda = /bio/i.test(legendaBase) ? legendaBase : `${legendaBase}\n\n🔗 Matéria completa no link da bio`;
  const storyUrl = `${config.siteUrl}/imagens/instagram/${pub.slug}-story.jpg`;
  const reelUrl = `${config.siteUrl}/imagens/reels/${pub.slug}.mp4`;
  const capaUrl = `${config.siteUrl}/imagens/reels/${pub.slug}.jpg`;
  const executar = async (nome: string, ligado: boolean, configurado: boolean, pronto: boolean, acao: () => Promise<unknown>, falta: string) => {
    if (!ligado) { resultados.push(`${nome}: pulado: desligado`); return; }
    if (!configurado) { resultados.push(`${nome}: pulado: ${falta}`); return; }
    if (!pub.enviadoAoGitHub) { resultados.push(`${nome}: erro: matéria não foi publicada`); return; }
    if (!pronto) { resultados.push(`${nome}: erro: ${falta}`); return; }
    try { await acao(); resultados.push(`${nome}: ok`); } catch (e) { resultados.push(`${nome}: erro: ${(e as Error).message}`); }
  };
  const trabalhos = [
    executar("instagramFeed", canais.instagramFeed, instagramConfigurado(), true, () => postarNoInstagram(urlArte(pub.slug), legenda), "falta INSTAGRAM_ACCESS_TOKEN"),
    executar("facebookFeed", canais.facebookFeed, facebookConfigurado(), true, () => postarFacebookFeed(urlArte(pub.slug), `${r.rascunho!.titulo}\n\n${pub.url}`), "falta FACEBOOK_PAGE_TOKEN"),
    executar("instagramStories", canais.instagramStories, instagramConfigurado(), Boolean(midias.story), () => postarStoriesInstagram(storyUrl), "imagem do Story não ficou pronta a tempo"),
    executar("facebookStories", canais.facebookStories, facebookConfigurado(), Boolean(midias.story), () => postarFacebookStory(storyUrl), "imagem do Story não ficou pronta a tempo"),
    executar("instagramReels", canais.instagramReels, instagramConfigurado(), Boolean(midias.reel && midias.capa), () => postarReels(reelUrl, capaUrl, legenda, false), "vídeo do Reels não ficou pronto a tempo"),
    executar("facebookReels", canais.facebookReels, facebookConfigurado(), Boolean(midias.reel), () => postarFacebookReels(reelUrl, legenda), "vídeo do Reels não ficou pronto a tempo"),
  ];
  await Promise.all(trabalhos);
  if (canais.youtubeShorts) resultados.push(`youtubeShorts: ${await postarShort(midias.reel && fs.existsSync(midias.reel) ? fs.readFileSync(midias.reel) : Buffer.alloc(0), r.rascunho!.tituloArte, legenda)}`);
  else resultados.push("youtubeShorts: pulado: desligado");
  const registros: Partial<Record<NomeCanal, db.ResultadoCanal>> = {};
  for (const resultado of resultados) {
    const [nome, status, ...resto] = resultado.split(": ");
    if (!nome || !status || !["ok", "erro", "pulado"].includes(status)) continue;
    const detalhe = resto.join(": ") || undefined;
    registros[nome as NomeCanal] = { status: status as "ok" | "erro" | "pulado", detalhe, em: new Date().toISOString() };
    db.registrarHistorico(id, status === "ok" ? "canal-ok" : status === "erro" ? "canal-erro" : "canal-ok", `${nome}${detalhe ? `: ${detalhe}` : ""}`);
  }
  db.atualizar(id, { canais: { ...(db.obter(id).canais ?? {}), ...registros } });
  db.registrarHistorico(id, "canais-concluidos", `${Math.round((Date.now() - inicio) / 1000)}s`);
  await bot.api.sendMessage(config.telegramChatId, `✅ Publicado: ${pub.url}\n${pub.enviadoAoGitHub ? "O site atualiza em 1 a 3 minutos." : `⚠️ ${pub.aviso}`}\n\n${resultados.join("\n")}`);
  fs.rmSync(arquivoPrevia(id, "foto"), { force: true });
  fs.rmSync(arquivoPrevia(id, "arte"), { force: true });
}

async function publicarItemAntigo(bot: Bot, id: string): Promise<void> {
  const r = db.obter(id);
  const foto = fs.readFileSync(arquivoPrevia(id, "foto"));
  const arte = fs.readFileSync(arquivoPrevia(id, "arte"));
  const configCanais = lerCanais().canais;
  const resultados: string[] = [];
  const pub = configCanais.site
    ? await publicar(r.rascunho!, foto, arte, r.imagem)
    : { slug: r.rascunho!.slug, url: `${config.siteUrl}/noticia/${r.rascunho!.slug}/`, enviadoAoGitHub: false, aviso: "canal site desligado" };
  resultados.push(configCanais.site ? (pub.enviadoAoGitHub ? "site: ok" : `site: erro: ${pub.aviso}`) : "site: pulado: desligado");
  db.atualizar(id, {
    status: "publicado",
    publicacao: pub,
    canais: { ...(r.canais ?? {}), site: { status: pub.enviadoAoGitHub ? "ok" : "erro", detalhe: pub.aviso, em: new Date().toISOString() } },
  });
  db.registrarHistorico(id, "publicada", pub.url);

  // A IA já costuma chamar para o link da bio; só acrescenta quando ela não chamou.
  const textoIg = r.rascunho!.legendaInstagram;
  const legenda = /bio/i.test(textoIg) ? textoIg : `${textoIg}\n\n🔗 Matéria completa no link da bio`;
  if (configCanais.instagramFeed && instagramConfigurado() && pub.enviadoAoGitHub) {
    try {
      await postarNoInstagram(urlArte(pub.slug), legenda);
      resultados.push("instagramFeed: ok");
    } catch (e) {
      resultados.push(`instagramFeed: erro: ${(e as Error).message}`);
      await enviarArteManual(bot, arte, legenda);
    }
  } else if (configCanais.instagramFeed) {
    resultados.push(instagramConfigurado() ? "instagramFeed: pulado: site não publicado" : "instagramFeed: pulado: falta INSTAGRAM_ACCESS_TOKEN");
    await enviarArteManual(bot, arte, legenda);
  } else resultados.push("instagramFeed: pulado: desligado");

  let video: Buffer | undefined;
  if ((configCanais.instagramReels || configCanais.facebookReels) && (instagramConfigurado() || facebookConfigurado()) && pub.enviadoAoGitHub) {
    try {
      const credito = r.imagem ? `${r.imagem.autor} / ${r.imagem.acervo}` : undefined;
      const camadas = await camadasReelsMateria(r.imagem ? foto : null, r.rascunho!.tituloArte, r.rascunho!.categoria, credito);
      video = await videoDaMateria(camadas.fundo, camadas.camada);
      if (configCanais.facebookReels && facebookConfigurado()) {
        fs.mkdirSync(config.pastas.capasReels, { recursive: true });
        fs.writeFileSync(path.join(config.pastas.capasReels, `${pub.slug}.mp4`), video);
        await enviarAoGitHub(["site/public/imagens/reels"], `Reels Facebook: ${r.rascunho!.titulo}`);
        await postarFacebookReels(`${config.siteUrl}/imagens/reels/${pub.slug}.mp4`, legenda);
        resultados.push("facebookReels: ok");
        fs.rmSync(path.join(config.pastas.capasReels, `${pub.slug}.mp4`), { force: true });
        await enviarAoGitHub(["site/public/imagens/reels"], `Remove Reels Facebook: ${r.rascunho!.titulo}`).catch(() => {});
      }
      if (configCanais.instagramReels && instagramConfigurado()) {
        const link = await publicarReelsPeloSite(pub.slug, video, camadas.capa, legenda, r.rascunho!.tituloArte, false);
        resultados.push(`instagramReels: ok (${link})`);
      }
    } catch (e) {
      resultados.push(`instagramReels: erro: ${(e as Error).message}`);
    }
  } else if (configCanais.instagramReels) resultados.push(instagramConfigurado() ? "instagramReels: pulado: site não publicado" : "instagramReels: pulado: falta INSTAGRAM_ACCESS_TOKEN");
  else resultados.push("instagramReels: pulado: desligado");

  let storyUrl = "";
  if (configCanais.instagramStories || configCanais.facebookStories) {
    if (!instagramConfigurado() && !facebookConfigurado()) resultados.push("instagramStories: pulado: falta INSTAGRAM_ACCESS_TOKEN");
    else if (!pub.enviadoAoGitHub) resultados.push("instagramStories: pulado: site não publicado");
    else try {
      const story = await arteInstagramStory(r.imagem ? foto : null, r.rascunho!.tituloArte, r.rascunho!.categoria, r.imagem ? `${r.imagem.autor} / ${r.imagem.acervo}` : undefined);
      fs.mkdirSync(config.pastas.artes, { recursive: true });
      fs.writeFileSync(path.join(config.pastas.artes, `${pub.slug}-story.jpg`), story);
      await enviarAoGitHub(["site/public/imagens/instagram"], `Story: ${r.rascunho!.titulo}`);
      storyUrl = `${config.siteUrl}/imagens/instagram/${pub.slug}-story.jpg`;
      if (configCanais.instagramStories) {
        if (instagramConfigurado()) {
          await postarStoriesInstagram(storyUrl);
          resultados.push("instagramStories: ok");
        } else resultados.push("instagramStories: pulado: falta INSTAGRAM_ACCESS_TOKEN");
      }
    } catch (e) { resultados.push(`instagramStories: erro: ${(e as Error).message}`); }
  } else resultados.push("instagramStories: pulado: desligado");
  if (!configCanais.instagramStories && configCanais.facebookStories) resultados.push("instagramStories: pulado: desligado");

  if (configCanais.facebookFeed) {
    if (!facebookConfigurado()) resultados.push("facebookFeed: pulado: falta FACEBOOK_PAGE_TOKEN");
    else if (!pub.enviadoAoGitHub) resultados.push("facebookFeed: pulado: site não publicado");
    else try { await postarFacebookFeed(urlArte(pub.slug), `${r.rascunho!.titulo}\n\n${pub.url}`); resultados.push("facebookFeed: ok"); } catch (e) { resultados.push(`facebookFeed: erro: ${(e as Error).message}`); }
  } else resultados.push("facebookFeed: pulado: desligado");
  if (configCanais.facebookReels) {
    if (!facebookConfigurado()) resultados.push("facebookReels: pulado: falta FACEBOOK_PAGE_TOKEN");
    else if (!video) resultados.push("facebookReels: pulado: vídeo indisponível");
    // O resultado de sucesso ou erro já foi registrado durante a geração do vídeo.
  } else resultados.push("facebookReels: pulado: desligado");
  if (configCanais.facebookStories) {
    if (!facebookConfigurado()) resultados.push("facebookStories: pulado: falta FACEBOOK_PAGE_TOKEN");
    else if (!pub.enviadoAoGitHub) resultados.push("facebookStories: pulado: site não publicado");
    else try { await postarFacebookStory(storyUrl || urlArte(pub.slug)); resultados.push("facebookStories: ok"); } catch (e) { resultados.push(`facebookStories: erro: ${(e as Error).message}`); }
  } else resultados.push("facebookStories: pulado: desligado");

  if (configCanais.youtubeShorts) resultados.push(`youtubeShorts: ${await postarShort(video ?? Buffer.alloc(0), r.rascunho!.tituloArte, legenda)}`);
  else resultados.push("youtubeShorts: pulado: desligado");
  const canais: Partial<Record<NomeCanal, db.ResultadoCanal>> = {};
  for (const resultado of resultados) {
    const [nome, status, ...resto] = resultado.split(": ");
    if (!nome || !status || !["ok", "erro", "pulado"].includes(status)) continue;
    const detalhe = resto.join(": ") || undefined;
    canais[nome as NomeCanal] = { status: status as "ok" | "erro" | "pulado", detalhe, em: new Date().toISOString() };
    db.registrarHistorico(id, status === "ok" ? "canal-ok" : status === "erro" ? "canal-erro" : "canal-ok", `${nome}${detalhe ? `: ${detalhe}` : ""}`);
  }
  db.atualizar(id, { canais: { ...(db.obter(id).canais ?? {}), ...canais } });
  await bot.api.sendMessage(config.telegramChatId, `✅ Publicado: ${pub.url}\n${pub.enviadoAoGitHub ? "O site atualiza em 1 a 3 minutos." : `⚠️ ${pub.aviso}`}\n\n${resultados.join("\n")}`);

  fs.rmSync(arquivoPrevia(id, "foto"), { force: true });
  fs.rmSync(arquivoPrevia(id, "arte"), { force: true });
}

async function garantirMidiasNoSite(item: db.Registro, pub: import("./publicar.js").Publicacao): Promise<db.Midias> {
  const caminhoSite = (tipo: "story" | "reel" | "capa") => path.join(config.pastas.raiz, tipo === "story" ? `site/public/imagens/instagram/${pub.slug}-story.jpg` : `site/public/imagens/reels/${pub.slug}.${tipo === "reel" ? "mp4" : "jpg"}`);
  const precisa = (tipo: "story" | "reel" | "capa") => !fs.existsSync(caminhoSite(tipo));
  const localStory = Boolean(item.midias?.story && fs.existsSync(item.midias.story));
  const localReel = Boolean(item.midias?.reel && fs.existsSync(item.midias.reel));
  if ((!localStory && precisa("story")) || (!localReel && precisa("reel"))) {
    iniciarPreparacaoMidias(item.id);
    await aguardarMidias(item.id, 60_000);
  }
  const salvo = db.obter(item.id).midias ?? {};
  const atual: db.Midias = {
    ...salvo,
    story: salvo.story && fs.existsSync(salvo.story) ? salvo.story : fs.existsSync(caminhoSite("story")) ? caminhoSite("story") : undefined,
    reel: salvo.reel && fs.existsSync(salvo.reel) ? salvo.reel : fs.existsSync(caminhoSite("reel")) ? caminhoSite("reel") : undefined,
    capa: salvo.capa && fs.existsSync(salvo.capa) ? salvo.capa : fs.existsSync(caminhoSite("capa")) ? caminhoSite("capa") : undefined,
  };
  const extras: ArquivoExtra[] = [];
  const adicionar = (origem: string | undefined, destino: string) => {
    if (origem && fs.existsSync(origem) && !fs.existsSync(path.join(config.pastas.raiz, destino))) extras.push({ caminho: destino, dados: fs.readFileSync(origem) });
  };
  adicionar(atual.story, `site/public/imagens/instagram/${pub.slug}-story.jpg`);
  adicionar(atual.reel, `site/public/imagens/reels/${pub.slug}.mp4`);
  adicionar(atual.capa, `site/public/imagens/reels/${pub.slug}.jpg`);
  if (extras.length) await enviarAoGitHub(extras.map((e) => e.caminho), `Mídias: ${item.rascunho!.titulo}`);
  return atual;
}

export async function postarNosCanais(
  bot: Bot,
  item: db.Registro,
  pub: import("./publicar.js").Publicacao,
  filtro?: NomeCanal[],
): Promise<void> {
  const canais = lerCanais().canais;
  const midias = await garantirMidiasNoSite(item, pub);
  const storyUrl = `${config.siteUrl}/imagens/instagram/${pub.slug}-story.jpg`;
  const reelUrl = `${config.siteUrl}/imagens/reels/${pub.slug}.mp4`;
  const capaUrl = `${config.siteUrl}/imagens/reels/${pub.slug}.jpg`;
  const deve = (canal: NomeCanal) => !filtro || filtro.includes(canal);
  const legendaBase = item.rascunho!.legendaInstagram;
  const legenda = /bio/i.test(legendaBase) ? legendaBase : `${legendaBase}\n\n🔗 Matéria completa no link da bio`;
  const resultados: Partial<Record<NomeCanal, db.ResultadoCanal>> = {};
  const registrar = (canal: NomeCanal, status: "ok" | "erro" | "pulado", detalhe?: string) => {
    resultados[canal] = { status, detalhe, em: new Date().toISOString() };
    db.registrarHistorico(item.id, status === "ok" ? "canal-ok" : status === "erro" ? "canal-erro" : "canal-ok", `${canal}${detalhe ? `: ${detalhe}` : ""}`);
  };
  if (deve("instagramFeed")) {
    if (!canais.instagramFeed || !instagramConfigurado()) registrar("instagramFeed", "pulado", canais.instagramFeed ? "falta INSTAGRAM_ACCESS_TOKEN" : "desligado");
    else try { await postarNoInstagram(urlArte(pub.slug), legenda); registrar("instagramFeed", "ok"); } catch (e) { registrar("instagramFeed", "erro", (e as Error).message); }
  }
  if (deve("facebookFeed")) {
    if (!canais.facebookFeed || !facebookConfigurado()) registrar("facebookFeed", "pulado", canais.facebookFeed ? "falta FACEBOOK_PAGE_TOKEN" : "desligado");
    else try { await postarFacebookFeed(urlArte(pub.slug), `${item.rascunho!.titulo}\n\n${pub.url}`); registrar("facebookFeed", "ok"); } catch (e) { registrar("facebookFeed", "erro", (e as Error).message); }
  }
  if (deve("instagramStories") && canais.instagramStories) {
    if (!instagramConfigurado()) registrar("instagramStories", "pulado", "falta INSTAGRAM_ACCESS_TOKEN");
    else if (!midias.story && !fs.existsSync(path.join(config.pastas.artes, `${pub.slug}-story.jpg`))) registrar("instagramStories", "erro", "imagem do Story não ficou pronta");
    else try { await postarStoriesInstagram(storyUrl); registrar("instagramStories", "ok"); } catch (e) { registrar("instagramStories", "erro", (e as Error).message); }
  }
  if (deve("facebookStories") && canais.facebookStories) {
    if (!facebookConfigurado()) registrar("facebookStories", "pulado", "falta FACEBOOK_PAGE_TOKEN");
    else if (!midias.story && !fs.existsSync(path.join(config.pastas.artes, `${pub.slug}-story.jpg`))) registrar("facebookStories", "erro", "imagem do Story não ficou pronta");
    else try { await postarFacebookStory(storyUrl); registrar("facebookStories", "ok"); } catch (e) { registrar("facebookStories", "erro", (e as Error).message); }
  }
  if (deve("instagramReels")) {
    if (!canais.instagramReels || !instagramConfigurado()) registrar("instagramReels", "pulado", canais.instagramReels ? "falta INSTAGRAM_ACCESS_TOKEN" : "desligado");
    else if (!midias.reel || !midias.capa) registrar("instagramReels", "erro", "vídeo do Reels não ficou pronto");
    else try { await postarReels(reelUrl, capaUrl, legenda, false); registrar("instagramReels", "ok"); } catch (e) { registrar("instagramReels", "erro", (e as Error).message); }
  }
  if (deve("facebookReels")) {
    if (!canais.facebookReels || !facebookConfigurado()) registrar("facebookReels", "pulado", canais.facebookReels ? "falta FACEBOOK_PAGE_TOKEN" : "desligado");
    else if (!midias.reel) registrar("facebookReels", "erro", "vídeo do Reels não ficou pronto");
    else try { await postarFacebookReels(reelUrl, legenda); registrar("facebookReels", "ok"); } catch (e) { registrar("facebookReels", "erro", (e as Error).message); }
  }
  if (deve("youtubeShorts")) registrar("youtubeShorts", "pulado", "repostagem de shorts não implementada");
  db.atualizar(item.id, { canais: { ...(db.obter(item.id).canais ?? {}), ...resultados } });
  await bot.api.sendMessage(config.telegramChatId, `🔁 Repostagem concluída: ${pub.url}`);
}

async function enviarArteManual(bot: Bot, arte: Buffer, legenda: string) {
  await bot.api.sendDocument(config.telegramChatId, new InputFile(arte, "post-instagram.jpg"), {
    caption: "📲 Arte pronta para o Instagram (salve e poste). Legenda abaixo:",
  });
  await bot.api.sendMessage(config.telegramChatId, legenda);
}
