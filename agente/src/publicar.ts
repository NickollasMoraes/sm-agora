import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config.js";
import type { Rascunho } from "./ia.js";
import type { ImagemEscolhida } from "./imagens.js";

const exec = promisify(execFile);

export function slugUnico(slug: string): string {
  const base = slug
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  let final = base;
  for (let n = 2; fs.existsSync(path.join(config.pastas.noticias, `${final}.md`)); n++) final = `${base}-${n}`;
  return final;
}

// JSON é YAML válido, então serve para escrever o frontmatter sem problemas de aspas.
const y = (v: unknown) => JSON.stringify(v);

export type Publicacao = { slug: string; url: string; enviadoAoGitHub: boolean; aviso?: string };
export type ArquivoExtra = { caminho: string; dados: Buffer };

export async function publicar(
  r: Rascunho,
  foto: Buffer,
  arte: Buffer,
  imagem: ImagemEscolhida | undefined,
  extras: ArquivoExtra[] = [],
): Promise<Publicacao> {
  const slug = slugUnico(r.slug);
  fs.mkdirSync(config.pastas.noticias, { recursive: true });
  fs.mkdirSync(config.pastas.imagens, { recursive: true });
  fs.mkdirSync(config.pastas.artes, { recursive: true });

  limparReelsAntigos();

  fs.writeFileSync(path.join(config.pastas.imagens, `${slug}.jpg`), foto);
  fs.writeFileSync(path.join(config.pastas.artes, `${slug}.jpg`), arte);
  for (const extra of extras) {
    const destino = path.join(config.pastas.raiz, extra.caminho.replaceAll("__SLUG__", slug));
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, extra.dados);
  }

  const frontmatter = [
    "---",
    `titulo: ${y(r.titulo)}`,
    `subtitulo: ${y(r.subtitulo)}`,
    `categoria: ${r.categoria}`,
    `tags: ${y(r.tags)}`,
    `data: ${new Date().toISOString()}`,
    `imagem: ${y(`/imagens/noticias/${slug}.jpg`)}`,
    `imagemAlt: ${y(imagem ? r.descricaoImagem : config.siteNome)}`,
    imagem
      ? `credito: ${y({ autor: `${imagem.autor} / ${imagem.acervo}`, licenca: imagem.licenca, fonte: imagem.fonte })}`
      : "",
    `fontes: ${y(r.fontes)}`,
    "---",
  ]
    .filter(Boolean)
    .join("\n");
  fs.writeFileSync(path.join(config.pastas.noticias, `${slug}.md`), `${frontmatter}\n\n${r.corpo.trim()}\n`);

  const url = `${config.siteUrl}/noticia/${slug}/`;
  if (!config.gitPush) return { slug, url, enviadoAoGitHub: false, aviso: "GIT_PUSH=false: arquivos salvos só no PC." };

  try {
    await enviarAoGitHub(["site/content/noticias", "site/public/imagens"], `Notícia: ${r.titulo}`);
    return { slug, url, enviadoAoGitHub: true };
  } catch (e) {
    return { slug, url, enviadoAoGitHub: false, aviso: `Falha no git: ${(e as Error).message.slice(0, 300)}` };
  }
}

function limparReelsAntigos(): void {
  if (!fs.existsSync(config.pastas.capasReels)) return;
  const limite = Date.now() - 24 * 60 * 60_000;
  for (const nome of fs.readdirSync(config.pastas.capasReels)) {
    const arquivo = path.join(config.pastas.capasReels, nome);
    if (fs.statSync(arquivo).mtimeMs < limite) fs.rmSync(arquivo, { force: true });
  }
}

// Commit + push de arquivos do site (caminhos relativos à raiz do projeto). O GitHub Pages publica em 1 a 3 min.
// Uma operação de git por vez: matéria e Reels podem ser publicados quase juntos.
let filaGit: Promise<unknown> = Promise.resolve();
export function enviarAoGitHub(caminhos: string[], mensagem: string): Promise<void> {
  const git = (...args: string[]) => exec("git", args, { cwd: config.pastas.raiz });
  const vez = filaGit.then(async () => {
    await git("add", ...caminhos);
    await git("commit", "-m", mensagem);
    await git("pull", "--rebase=merges", "--autostash");
    await git("push");
  });
  filaGit = vez.catch(() => {});
  return vez;
}
