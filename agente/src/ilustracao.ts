import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config } from "./config.js";
import type { Rascunho } from "./ia.js";

const LIMITE_MS = 3 * 60_000;

export function gerarIlustracao(rascunho: Rascunho): Promise<Buffer> {
  const pasta = path.join(config.pastas.dados, "previas");
  fs.mkdirSync(pasta, { recursive: true });
  const destino = path.join(pasta, `ilustracao-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
  const resposta = `${destino}.txt`;
  const prompt = [
    "Use a ferramenta image_generation para gerar UMA imagem fotográfica realista, neutra e editorial.",
    `Salve o arquivo gerado exatamente neste caminho, em PNG: ${destino}`,
    "Formato paisagem 16:9.",
    "Não inclua texto, logotipos, marcas, rostos identificáveis, sangue, violência explícita, bandeiras ou brasões.",
    "Não mostre pessoas reais, fardas com identificação ou lugares famosos de outras cidades.",
    "A cena deve ser meramente ilustrativa, sem fingir ser o local exato da notícia.",
    `Título: ${rascunho.titulo}`,
    `Subtítulo: ${rascunho.subtitulo}`,
    `Editoria: ${rascunho.categoria}`,
    `Descrição da imagem: ${rascunho.descricaoImagem}`,
    "Infira uma cena simples e segura; priorize objetos e ambientes.",
    "Depois de salvar a imagem, responda somente com o caminho do arquivo.",
  ].join("\n");

  return new Promise((resolve, reject) => {
    const filho = spawn(config.codexBin, ["exec", "--ephemeral", "--sandbox", "workspace-write", "--skip-git-repo-check", "--enable", "image_generation", "-C", config.pastas.raiz, "-o", resposta, "-"], {
      cwd: config.pastas.raiz,
      shell: process.platform === "win32",
      windowsHide: true,
    });
    let erro = "";
    const limite = setTimeout(() => {
      filho.kill();
      reject(new Error("Geração da ilustração excedeu 3 minutos"));
    }, LIMITE_MS);
    filho.stderr.on("data", (d) => (erro += d));
    filho.on("error", (e) => reject(new Error(`Codex não pôde gerar a ilustração: ${e.message}`)));
    filho.on("close", (codigo) => {
      clearTimeout(limite);
      if (codigo !== 0) return reject(new Error(`Codex falhou ao gerar a ilustração: ${erro.slice(0, 300)}`));
      if (!fs.existsSync(destino)) return reject(new Error("Codex não salvou a ilustração gerada"));
      try {
        resolve(fs.readFileSync(destino));
      } catch (e) {
        reject(new Error(`Não foi possível ler a ilustração: ${(e as Error).message}`));
      }
    });
    filho.stdin.end(prompt);
  });
}
