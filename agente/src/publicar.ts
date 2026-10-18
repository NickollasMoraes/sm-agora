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

export async function publicar(
  r: Rascunho,
  foto: Buffer,
  arte: Buffer,
  imagem: ImagemEscolhida | undefined,
): Promise<Publicacao> {
  const slug = slugUnico(r.slug);
  fs.mkdirSync(config.pastas.noticias, { recursive: true });
  fs.mkdirSync(config.pastas.imagens, { recursive: true });
  fs.mkdirSync(config.pastas.artes, { recursive: true });

  fs.writeFileSync(path.join(config.pastas.imagens, `${slug}.jpg`), foto);
  fs.writeFileSync(path.join(config.pastas.artes, `${slug}.jpg`), arte);

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
    const git = (...args: string[]) => exec("git", args, { cwd: config.pastas.raiz });
    await git("add", "site/content/noticias", "site/public/imagens");
    await git("commit", "-m", `Notícia: ${r.titulo}`);
    await git("pull", "--rebase", "--autostash");
    await git("push");
    return { slug, url, enviadoAoGitHub: true };
  } catch (e) {
    return { slug, url, enviadoAoGitHub: false, aviso: `Falha no git: ${(e as Error).message.slice(0, 300)}` };
  }
}
