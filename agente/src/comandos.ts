import fs from "node:fs";
import path from "node:path";
import { Bot } from "grammy";
import { config } from "./config.js";
import type { NomeCanal } from "./canais.js";
import * as db from "./estado.js";
import { ajustarTexto, aprovar, enviarPauta, montarPrevia, postarNosCanais, publicarItem, trocarImagem } from "./fluxo.js";
import { buscarTema } from "./buscar.js";
import type { Publicacao } from "./publicar.js";

type Acao = "reenviar-previa" | "publicar" | "repostar" | "rebuscar" | "aprovar" | "aprovar-orientacao" | "descartar" | "outra-imagem" | "ajustar-texto" | "tentar-novamente" | "repostar-falhas";
type Comando = { id: string; acao: Acao; itemId: string; canais?: string[]; orientacao?: string; criadoEm: string; origem: string };

const pasta = path.join(config.pastas.dados, "comandos");
let processando = false;

function mover(arquivo: string, destino: string, comando: Partial<Comando>, resultado: { ok: boolean; mensagem: string }): void {
  fs.mkdirSync(destino, { recursive: true });
  const dados = { ...comando, resultado: { ...resultado, concluidoEm: new Date().toISOString() } };
  fs.writeFileSync(path.join(destino, path.basename(arquivo)), JSON.stringify(dados, null, 2));
  fs.rmSync(arquivo, { force: true });
}

export async function processarComandos(bot: Bot): Promise<void> {
  if (processando) return;
  processando = true;
  try {
    const arquivos = fs.existsSync(pasta) ? fs.readdirSync(pasta).filter((nome) => nome.endsWith(".json")) : [];
    const arquivo = arquivos.sort()[0];
    if (!arquivo) return;
    // Tira o comando da fila ANTES de executar: redigir leva minutos e, com o
    // arquivo ainda na fila, cada rodada (10 s) mandava redigir de novo.
    // O rename é atômico: se houver outro robô, só um consegue pegar.
    const emAndamento = path.join(pasta, "processando");
    fs.mkdirSync(emAndamento, { recursive: true });
    const caminho = path.join(emAndamento, arquivo);
    try {
      fs.renameSync(path.join(pasta, arquivo), caminho);
    } catch {
      return; // outro robô pegou
    }
    let comando: Partial<Comando> = {};
    try {
      comando = JSON.parse(fs.readFileSync(caminho, "utf8")) as Partial<Comando>;
      const mensagem = await executar(bot, comando);
      mover(caminho, path.join(pasta, "feitos"), comando, { ok: true, mensagem });
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      mover(caminho, path.join(pasta, "erros"), comando, { ok: false, mensagem });
      db.registrarHistorico(String(comando.itemId ?? ""), "comando", `${comando.acao ?? "inválido"}: erro: ${mensagem}`);
    }
  } finally {
    processando = false;
  }
}

// Itens publicados pela v1 não guardavam a publicação: acha a matéria no site pelo slug ou pelo título.
function publicacaoAntiga(item: db.Registro): Publicacao {
  if (!item.rascunho) throw new Error("item publicado sem rascunho");
  const arquivos = fs.readdirSync(config.pastas.noticias).filter((nome) => nome.endsWith(".md"));
  const titulo = `titulo: ${JSON.stringify(item.rascunho.titulo)}`;
  const arquivo =
    arquivos.find((nome) => nome === `${item.rascunho!.slug}.md`) ??
    arquivos.find((nome) => fs.readFileSync(path.join(config.pastas.noticias, nome), "utf8").includes(titulo));
  if (!arquivo) throw new Error("matéria não encontrada no site");
  const slug = arquivo.replace(/\.md$/, "");
  return { slug, url: `${config.siteUrl}/noticia/${slug}/`, enviadoAoGitHub: true };
}

async function executar(bot: Bot, comando: Partial<Comando>): Promise<string> {
  if (!comando.id || !comando.acao || !comando.itemId || !comando.criadoEm || comando.origem !== "painel") throw new Error("comando inválido");
  db.registrarHistorico(comando.itemId, "comando", comando.acao);
  if (comando.acao === "rebuscar") {
    await buscarTema(comando.itemId, bot);
    return "tema buscado";
  }
  const item = db.obter(comando.itemId);
  if (!item) throw new Error("item inexistente");
  if (comando.acao === "aprovar" || comando.acao === "aprovar-orientacao") {
    if (item.status === "redigindo" || item.status === "previa" || item.status === "publicado") {
      throw new Error(`item já está em "${item.status}"; não foi redigido de novo`);
    }
    await aprovar(bot, item.id, comando.orientacao);
    return "item aprovado; redação iniciada";
  }
  if (comando.acao === "descartar") {
    db.atualizar(item.id, { status: "rejeitado" });
    db.registrarHistorico(item.id, "descartado", "pelo painel");
    return "item descartado";
  }
  if (comando.acao === "outra-imagem") {
    await trocarImagem(bot, item.id);
    return "outra imagem gerada";
  }
  if (comando.acao === "ajustar-texto") {
    if (!comando.orientacao) throw new Error("orientação ausente");
    await ajustarTexto(bot, item.id, comando.orientacao);
    return "texto ajustado";
  }
  // Matéria já está no site (o erro foi só no registro): nunca publicar de novo,
  // senão o slugUnico cria uma cópia "-2". Só corrige o estado.
  const slugNoSite = item.publicacao?.slug ?? item.rascunho?.slug;
  if (
    slugNoSite &&
    fs.existsSync(path.join(config.pastas.noticias, `${slugNoSite}.md`)) &&
    (comando.acao === "publicar" || comando.acao === "tentar-novamente" || comando.acao === "repostar-falhas") &&
    item.canais?.site?.status !== "ok"
  ) {
    db.atualizar(item.id, {
      status: "publicado",
      canais: { ...(item.canais ?? {}), site: { status: "ok", detalhe: "já estava no ar; erro antigo corrigido", em: new Date().toISOString() } },
    });
    db.registrarHistorico(item.id, "ja-publicado", "matéria já estava no site; não foi publicada de novo");
    if (comando.acao !== "repostar-falhas") return "matéria já estava no site; nada foi republicado";
    const atualizado = db.obter(item.id);
    if (atualizado) Object.assign(item, atualizado);
  }
  if (comando.acao === "tentar-novamente") {
    if (item.rascunho) await montarPrevia(bot, item.id);
    else await aprovar(bot, item.id, item.orientacao);
    return "tentativa reiniciada";
  }
  if (comando.acao === "reenviar-previa") {
    if (item.rascunho) {
      await montarPrevia(bot, item.id);
      return "prévia reenviada";
    }
    if (!item.triagem) throw new Error("item não tem rascunho nem triagem");
    db.atualizar(item.id, { status: "pauta" });
    const mensagem = await enviarPauta(bot, item, item.triagem);
    db.atualizar(item.id, { mensagens: [...item.mensagens, mensagem] });
    db.registrarHistorico(item.id, "pauta-enviada");
    return "pauta reenviada";
  }
  if (comando.acao === "publicar") {
    if (!item.rascunho || !item.imagem) throw new Error("item precisa de rascunho e imagem");
    // Já publicado: usar "repostar" para não duplicar a matéria no site.
    if (item.status === "publicado") throw new Error("item já publicado; use repostar");
    await publicarItem(bot, item.id);
    await bot.api.sendMessage(config.telegramChatId, "Publicado pelo painel");
    return "item publicado";
  }
  if (item.status !== "publicado") throw new Error("item não está publicado");
  const publicacao = item.publicacao ?? publicacaoAntiga(item);
  const canais = comando.acao === "repostar-falhas"
    ? (Object.entries(item.canais ?? {}).filter(([, resultado]) => resultado.status === "erro").map(([canal]) => canal) as NomeCanal[])
    : comando.canais as NomeCanal[] | undefined;
  if (!canais?.length && comando.acao === "repostar-falhas") throw new Error("não há canais com falha");
  await postarNosCanais(bot, item, publicacao, canais);
  return "canais repostados";
}
