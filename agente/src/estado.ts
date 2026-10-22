import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import type { ItemColetado } from "./coletor.js";
import type { Triagem, Rascunho } from "./ia.js";
import type { ImagemEscolhida } from "./imagens.js";
import type { Publicacao } from "./publicar.js";
import type { NomeCanal } from "./canais.js";

// Memória do agente num arquivo JSON simples (agente/data/estado.json).

export type Status =
  | "descartado_ia" // a IA achou irrelevante ou repetido
  | "pauta" // enviado ao Telegram, aguardando sua decisão
  | "rejeitado"
  | "redigindo"
  | "previa" // matéria pronta, aguardando "Publicar"
  | "publicado"
  | "erro";

export type ResultadoCanal = {
  status: "ok" | "erro" | "pulado";
  detalhe?: string;
  em: string;
  id?: string;
};

export type Registro = ItemColetado & {
  status: Status;
  triagem?: Triagem;
  orientacao?: string; // o que você pediu ao aprovar/ajustar
  rascunho?: Rascunho;
  imagem?: ImagemEscolhida;
  imagensAprovadas?: ImagemEscolhida[]; // fotos que a IA conferiu e aprovou para esta matéria, da melhor para a pior
  tentativaImagem?: number;
  mensagens: number[]; // IDs das mensagens do Telegram ligadas a este item
  atualizadoEm: string;
  erro?: string;
  publicacao?: Publicacao;
  canais?: Partial<Record<NomeCanal, ResultadoCanal>>;
};

const ARQUIVO = path.join(config.pastas.dados, "estado.json");
const DIAS_GUARDAR = 365;

type Banco = { itens: Record<string, Registro> };

function carregar(): Banco {
  try {
    return JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
  } catch {
    return { itens: {} };
  }
}

const banco = carregar();

export function salvar() {
  const limite = Date.now() - DIAS_GUARDAR * 86400_000;
  for (const [id, r] of Object.entries(banco.itens)) {
    if (new Date(r.atualizadoEm).getTime() < limite && !r.rascunho) delete banco.itens[id];
  }
  fs.mkdirSync(config.pastas.dados, { recursive: true });
  const tmp = `${ARQUIVO}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(banco, null, 2));
  fs.renameSync(tmp, ARQUIVO);
}

export const existe = (id: string) => Boolean(banco.itens[id]);
export const obter = (id: string) => banco.itens[id];

export function registrar(item: ItemColetado, status: Status, extra: Partial<Registro> = {}): Registro {
  const r: Registro = { ...item, status, mensagens: [], atualizadoEm: new Date().toISOString(), ...extra };
  banco.itens[item.id] = r;
  salvar();
  return r;
}

export function atualizar(id: string, mudancas: Partial<Registro>): Registro {
  const r = banco.itens[id];
  Object.assign(r, mudancas, { atualizadoEm: new Date().toISOString() });
  salvar();
  return r;
}

export function porMensagem(msgId: number): Registro | undefined {
  return Object.values(banco.itens).find((r) => r.mensagens.includes(msgId));
}

export function porStatus(...status: Status[]): Registro[] {
  return Object.values(banco.itens).filter((r) => status.includes(r.status));
}

export type EventoHistorico = {
  data: string;
  itemId: string;
  titulo: string;
  evento: string;
  detalhe?: string;
};

const ARQUIVO_HISTORICO = path.join(config.pastas.dados, "historico.jsonl");

export function registrarHistorico(itemId: string, evento: string, detalhe?: string, titulo?: string): void {
  const registro = banco.itens[itemId];
  const linha: EventoHistorico = {
    data: new Date().toISOString(),
    itemId,
    titulo: titulo ?? registro?.titulo ?? itemId,
    evento,
    ...(detalhe ? { detalhe } : {}),
  };
  fs.mkdirSync(config.pastas.dados, { recursive: true });
  fs.appendFileSync(ARQUIVO_HISTORICO, `${JSON.stringify(linha)}\n`);
}

// Títulos já vistos recentemente, para a IA reconhecer a mesma história vinda de outra fonte.
export function titulosRecentes(horas = 72): string[] {
  const limite = Date.now() - horas * 3600_000;
  return Object.values(banco.itens)
    .filter((r) => new Date(r.atualizadoEm).getTime() > limite && r.status !== "descartado_ia")
    .map((r) => r.titulo);
}
