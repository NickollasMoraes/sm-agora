import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { z } from "zod";
import { config } from "./config.js";

// Usa o Claude Code instalado no PC (login do seu plano do Claude) em vez da API paga.
// Cada chamada roda "claude -p" numa pasta vazia, sem ferramentas além das liberadas.

function caminhoClaude(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const nativo = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
  return fs.existsSync(nativo) ? nativo : "claude";
}

const pastaVazia = path.join(os.tmpdir(), "sm-agora-claude");

type Opcoes = {
  sistema: string;
  ferramentas?: string[]; // ex.: ["WebSearch", "WebFetch"]
  minutos?: number;
};

function rodar(prompt: string, args: string[], minutos: number): Promise<string> {
  fs.mkdirSync(pastaVazia, { recursive: true });
  return new Promise((resolve, reject) => {
    const filho = spawn(caminhoClaude(), args, { cwd: pastaVazia, windowsHide: true });
    let saida = "";
    let erro = "";
    const limite = setTimeout(() => {
      filho.kill();
      reject(new Error(`Claude Code não respondeu em ${minutos} min`));
    }, minutos * 60_000);
    filho.stdout.on("data", (d) => (saida += d));
    filho.stderr.on("data", (d) => (erro += d));
    filho.on("error", (e) => {
      clearTimeout(limite);
      reject(new Error(`Não consegui iniciar o Claude Code (${e.message}). Ele está instalado?`));
    });
    filho.on("close", (codigo) => {
      clearTimeout(limite);
      if (codigo === 0) resolve(saida);
      else reject(new Error(`Claude Code saiu com código ${codigo}: ${(erro || saida).slice(0, 400)}`));
    });
    filho.stdin.end(prompt);
  });
}

function argsBase(o: Opcoes): string[] {
  const args = [
    "-p",
    "--output-format", "json",
    "--system-prompt", o.sistema,
    "--no-session-persistence",
    "--strict-mcp-config",
    "--tools", o.ferramentas?.length ? o.ferramentas.join(",") : "",
  ];
  if (o.ferramentas?.length) args.push("--allowedTools", o.ferramentas.join(","));
  if (config.modeloClaudeCode) args.push("--model", config.modeloClaudeCode);
  return args;
}

type Resultado = { is_error?: boolean; result?: string; structured_output?: unknown; subtype?: string };

function lerResultado(bruto: string): Resultado {
  const r = JSON.parse(bruto) as Resultado;
  if (r.is_error) {
    const msg = r.result ?? r.subtype ?? "erro desconhecido";
    if (/limit|rate/i.test(msg)) throw new Error(`Limite do seu plano do Claude atingido. Tente mais tarde. (${msg.slice(0, 200)})`);
    if (/log ?in|auth|credential/i.test(msg)) throw new Error("Claude Code não está logado. Rode 'claude auth login' no terminal.");
    throw new Error(`Claude Code: ${msg.slice(0, 300)}`);
  }
  return r;
}

// Pergunta com resposta estruturada, validada pelo schema zod.
export async function perguntarJson<T extends z.ZodType>(prompt: string, schema: T, o: Opcoes): Promise<z.infer<T>> {
  const { $schema: _, ...jsonSchema } = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  const args = [...argsBase(o), "--json-schema", JSON.stringify(jsonSchema)];
  const r = lerResultado(await rodar(prompt, args, o.minutos ?? 8));
  let dados = r.structured_output;
  if (dados === undefined && r.result) {
    const texto = r.result.replace(/^```(?:json)?\s*|\s*```$/g, "");
    dados = JSON.parse(texto);
  }
  return schema.parse(dados);
}

// Pergunta com resposta em texto livre.
export async function perguntarTexto(prompt: string, o: Opcoes): Promise<string> {
  const r = lerResultado(await rodar(prompt, argsBase(o), o.minutos ?? 8));
  return (r.result ?? "").trim();
}

export async function claudeCodeLogado(): Promise<boolean> {
  try {
    const saida = await new Promise<string>((resolve, reject) => {
      const f = spawn(caminhoClaude(), ["auth", "status"], { windowsHide: true });
      let s = "";
      f.stdout.on("data", (d) => (s += d));
      f.on("error", reject);
      f.on("close", () => resolve(s));
    });
    return JSON.parse(saida).loggedIn === true;
  } catch {
    return false;
  }
}
