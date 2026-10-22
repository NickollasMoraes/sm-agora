import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { z } from "zod";
import { config } from "./config.js";
import { RascunhoSchema, type Rascunho } from "./ia.js";
import type { ItemColetado } from "./coletor.js";
import { lerCanais } from "./canais.js";

const promptBase = fs.readFileSync(path.join(config.pastas.raiz, "agente", "prompts", "redacao.md"), "utf8");
const palavras = (texto: string) => texto.trim().split(/\s+/).filter(Boolean).length;

function executar(prompt: string): Promise<Rascunho> {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "sm-agora-codex-"));
  const schema = path.join(pasta, "schema.json");
  const saida = path.join(pasta, "saida.json");
  const { $schema: _, ...jsonSchema } = z.toJSONSchema(RascunhoSchema, { target: "draft-7" }) as Record<string, unknown>;
  fs.writeFileSync(schema, JSON.stringify(jsonSchema));
  return new Promise((resolve, reject) => {
    const filho = spawn(config.codexBin, ["exec", "--ephemeral", "--sandbox", "read-only", "--skip-git-repo-check", "--output-schema", schema, "-o", saida, "-"], {
      cwd: pasta,
      shell: process.platform === "win32",
      windowsHide: true,
    });
    let erro = "";
    const limite = setTimeout(() => {
      filho.kill();
      reject(new Error(`Codex não respondeu em ${config.codexTimeoutMin} min`));
    }, config.codexTimeoutMin * 60_000);
    filho.stderr.on("data", (d) => (erro += d));
    filho.on("error", (e) => reject(new Error(`Codex não instalado ou não pôde ser iniciado: ${e.message}`)));
    filho.on("close", (codigo) => {
      clearTimeout(limite);
      if (codigo !== 0) {
        if (/login|auth|credential/i.test(erro)) return reject(new Error("Codex não está logado. Rode 'codex login' no terminal."));
        if (/limit|quota|rate/i.test(erro)) return reject(new Error(`Limite do Codex atingido: ${erro.slice(0, 300)}`));
        return reject(new Error(`Codex saiu com código ${codigo}: ${erro.slice(0, 400)}`));
      }
      try {
        resolve(RascunhoSchema.parse(JSON.parse(fs.readFileSync(saida, "utf8"))));
      } catch (e) {
        reject(new Error(`Codex não devolveu JSON válido: ${(e as Error).message}`));
      }
    });
    filho.stdin.end(prompt);
  });
}

async function executarComExpansao(prompt: string): Promise<Rascunho> {
  let rascunho = await executar(prompt);
  const minimo = lerCanais().palavrasMinimas;
  if (palavras(rascunho.corpo) < minimo) {
    rascunho = await executar(`${prompt}\n\nEXPANDA UMA ÚNICA VEZ a matéria abaixo para no mínimo ${minimo} palavras, preservando apenas os fatos:\n${JSON.stringify(rascunho)}`);
  }
  return rascunho;
}

export function redigirComCodex(item: ItemColetado, material: string, orientacao?: string): Promise<Rascunho> {
  return executarComExpansao(`${promptBase}\n\nFonte: ${item.fonte}\nLink original: ${item.link}\nTítulo original: ${item.titulo}\n\nMaterial:\n${material}${orientacao ? `\n\nOrientação do editor: ${orientacao}` : ""}`);
}

export function ajustarComCodex(rascunho: Rascunho, pedido: string): Promise<Rascunho> {
  return executarComExpansao(`${promptBase}\n\nAplique este pedido do editor à matéria completa abaixo e devolva o JSON completo:\n${pedido}\n\n${JSON.stringify(rascunho)}`);
}
