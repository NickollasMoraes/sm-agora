// Troca as fotos repetidas das matérias já publicadas (uso único, rodado pelo CerebroNC).
// Mantém a foto na matéria mais antiga de cada grupo e busca foto inédita para as outras,
// com a mesma conferência de IA do robô. Matérias com o fundo padrão da editoria também ganham foto.
// Só grava arquivos do site e um relatório; não faz commit nem mexe no estado do robô.
//
// Uso (na pasta agente): npx tsx scripts/trocar-fotos-repetidas.ts [--simular]

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";
import { baixarImagem, buscarCandidatas, type ImagemEscolhida } from "../src/imagens.js";
import { escolherImagens } from "../src/ia.js";
import { fotoDoSite } from "../src/arte.js";

const simular = process.argv.includes("--simular");
const pastaImg = config.pastas.imagens;
const pastaMd = config.pastas.noticias;
const estado = JSON.parse(fs.readFileSync(path.join(config.pastas.dados, "estado.json"), "utf8")).itens as Record<string, any>;

const chaveFoto = (url = "") =>
  decodeURIComponent(url).toLowerCase().replace(/\/thumb\//, "/").replace(/\/\d+px-[^/]*$/, "").replace(/[?#].*$/, "");

// Buscas genéricas por editoria (acervos de banco de imagens), quando a busca local não traz foto inédita.
const genericas: Record<string, string[]> = {
  seguranca: ["police car night", "police tape crime scene", "ambulance emergency", "car accident road"],
  cidade: ["city street traffic", "road works construction", "city bus stop", "traffic light intersection"],
  esporte: ["athletics track", "running race", "high jump athlete", "stadium"],
  educacao: ["university students", "classroom", "university campus", "students studying"],
  saude: ["vaccine", "hospital corridor", "doctor", "health clinic"],
  clima: ["storm clouds", "lightning storm", "rain city", "weather sky"],
  economia: ["job interview", "office work", "money brazil", "shopping street"],
  politica: ["city council", "government building", "voting", "meeting"],
  cultura: ["concert", "festival", "theater", "museum"],
};

function lerMd(slug: string) {
  const arquivo = path.join(pastaMd, `${slug}.md`);
  const texto = fs.readFileSync(arquivo, "utf8");
  const campo = (nome: string) => texto.match(new RegExp(`^${nome}: (.*)$`, "m"))?.[1];
  const credito = campo("credito");
  return {
    arquivo,
    texto,
    data: campo("data") ?? "",
    titulo: JSON.parse(campo("titulo") ?? '""') as string,
    categoria: campo("categoria") ?? "cidade",
    fonte: credito ? (JSON.parse(credito).fonte as string) : undefined,
  };
}

// 1. Grupos de fotos idênticas (pelo conteúdo do arquivo).
const porHash = new Map<string, string[]>();
for (const nome of fs.readdirSync(pastaImg).filter((n) => n.endsWith(".jpg"))) {
  const hash = crypto.createHash("md5").update(fs.readFileSync(path.join(pastaImg, nome))).digest("hex");
  porHash.set(hash, [...(porHash.get(hash) ?? []), nome.replace(/\.jpg$/, "")]);
}
// --refazer slug=busca1|busca2;slug2=... refaz só essas, com buscas genéricas (sem nome de lugar).
const refazer = new Map<string, string[]>(
  (process.argv[process.argv.indexOf("--refazer") + 1] ?? "")
    .split(";")
    .filter((par) => process.argv.includes("--refazer") && par.includes("="))
    .map((par) => [par.split("=")[0], par.split("=")[1].split("|")]),
);
const alvos: string[] = [...refazer.keys()];
for (const slugs of refazer.size ? [] : porHash.values()) {
  if (slugs.length < 2) continue;
  const ordenados = slugs.map((s) => ({ s, md: lerMd(s) })).sort((a, b) => a.md.data.localeCompare(b.md.data));
  // Foto real: a mais antiga fica. Fundo da editoria (sem crédito): todas ganham foto.
  const comFoto = Boolean(ordenados[0].md.fonte);
  alvos.push(...ordenados.slice(comFoto ? 1 : 0).map((o) => o.s));
}

// 2. Fotos já usadas em qualquer matéria (inclusive as que vamos manter).
const usadas = new Set<string>();
for (const nome of fs.readdirSync(pastaMd).filter((n) => n.endsWith(".md"))) {
  const slug = nome.replace(/\.md$/, "");
  if (alvos.includes(slug)) continue;
  const fonte = lerMd(slug).fonte;
  if (fonte) usadas.add(chaveFoto(fonte));
}
for (const r of Object.values(estado)) if (r.imagem && !alvos.includes(r.rascunho?.slug)) usadas.add(chaveFoto(r.imagem.url));

const ineditas = (lista: ImagemEscolhida[]) => lista.filter((i) => !usadas.has(chaveFoto(i.fonte)) && !usadas.has(chaveFoto(i.url)));

console.log(`${alvos.length} matérias para trocar${simular ? " (simulação)" : ""}`);
const relatorio: Array<{ slug: string; itemId?: string; imagem?: ImagemEscolhida; alt?: string; erro?: string }> = [];

for (const slug of alvos) {
  const md = lerMd(slug);
  const item = Object.values(estado).find((r) => r.rascunho?.slug === slug || r.publicacao?.slug === slug);
  const rascunho = item?.rascunho ?? { titulo: md.titulo, subtitulo: "", categoria: md.categoria, buscaImagem: [] };
  try {
    let escolhida: ImagemEscolhida | undefined;
    const rodadas = refazer.has(slug) ? [refazer.get(slug)!] : [rascunho.buscaImagem ?? [], genericas[md.categoria] ?? genericas.cidade];
    for (const buscas of rodadas) {
      if (!buscas.length) continue;
      const candidatas = ineditas(await buscarCandidatas(buscas));
      escolhida = (await escolherImagens(rascunho, candidatas).catch(() => []))[0];
      if (escolhida) break;
    }
    if (!escolhida) throw new Error("nenhuma foto inédita aprovada");
    usadas.add(chaveFoto(escolhida.fonte));
    usadas.add(chaveFoto(escolhida.url));
    const alt = rascunho.descricaoImagem ?? md.titulo;
    if (!simular) {
      const foto = await fotoDoSite(await baixarImagem(escolhida.url));
      fs.writeFileSync(path.join(pastaImg, `${slug}.jpg`), foto);
      const credito = `credito: ${JSON.stringify({ autor: `${escolhida.autor} / ${escolhida.acervo}`, licenca: escolhida.licenca, fonte: escolhida.fonte })}`;
      let texto = md.texto.replace(/^imagemAlt: .*$/m, `imagemAlt: ${JSON.stringify(alt)}`);
      texto = /^credito: /m.test(texto) ? texto.replace(/^credito: .*$/m, credito) : texto.replace(/^(imagemAlt: .*)$/m, `$1\n${credito}`);
      fs.writeFileSync(md.arquivo, texto);
    }
    relatorio.push({ slug, itemId: item?.id, imagem: escolhida, alt });
    console.log(`ok  ${slug} <- ${escolhida.acervo}: ${(escolhida.descricao ?? "").slice(0, 60)}`);
  } catch (e) {
    relatorio.push({ slug, itemId: item?.id, erro: (e as Error).message });
    console.log(`ERRO ${slug}: ${(e as Error).message}`);
  }
}

const arquivoRelatorio = path.join(config.pastas.dados, "troca-fotos-relatorio.json");
const anterior: typeof relatorio = refazer.size && fs.existsSync(arquivoRelatorio) ? JSON.parse(fs.readFileSync(arquivoRelatorio, "utf8")) : [];
const final = [...anterior.filter((r) => !refazer.has(r.slug)), ...relatorio];
fs.writeFileSync(arquivoRelatorio, JSON.stringify(final, null, 2));
console.log("relatório: agente/data/troca-fotos-relatorio.json");
