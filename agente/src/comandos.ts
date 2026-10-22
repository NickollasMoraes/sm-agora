import fs from "node:fs";
import path from "node:path";
import { Bot } from "grammy";
import { config } from "./config.js";
import type { NomeCanal } from "./canais.js";
import * as db from "./estado.js";
import { enviarPauta, montarPrevia, postarNosCanais, publicarItem } from "./fluxo.js";
import { buscarTema } from "./buscar.js";

type Acao = "reenviar-previa" | "publicar" | "repostar" | "rebuscar";
type Comando = { id: string; acao: Acao; itemId: string; canais?: string[]; criadoEm: string; origem: string };

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
    const caminho = path.join(pasta, arquivo);
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

async function executar(bot: Bot, comando: Partial<Comando>): Promise<string> {
  if (!comando.id || !comando.acao || !comando.itemId || !comando.criadoEm || comando.origem !== "painel") throw new Error("comando inválido");
  db.registrarHistorico(comando.itemId, "comando", comando.acao);
  if (comando.acao === "rebuscar") {
    await buscarTema(comando.itemId, bot);
    return "tema buscado";
  }
  const item = db.obter(comando.itemId);
  if (!item) throw new Error("item inexistente");
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
    await publicarItem(bot, item.id);
    await bot.api.sendMessage(config.telegramChatId, "Publicado pelo painel");
    return "item publicado";
  }
  if (item.status !== "publicado" || !item.publicacao) throw new Error("item não está publicado");
  await postarNosCanais(bot, item, item.publicacao, comando.canais as NomeCanal[] | undefined);
  return "canais repostados";
}
