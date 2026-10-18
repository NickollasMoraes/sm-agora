import sharp from "sharp";
import { config, nomesCategorias } from "./config.js";

// Gera as imagens finais com o sharp (grátis, roda no seu PC):
// - foto do site: 1600x900
// - arte do Instagram: 1080x1350 (formato retrato do feed), foto + título + marca

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function quebrarLinhas(texto: string, maxCaracteres: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/)) {
    if ((atual + " " + palavra).trim().length > maxCaracteres && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = (atual + " " + palavra).trim();
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export async function fotoDoSite(original: Buffer): Promise<Buffer> {
  return sharp(original).rotate().resize(1600, 900, { fit: "cover", position: "attention" }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
}

// Fundo sem foto: degradê na cor da editoria.
const coresCategoria: Record<string, string> = {
  cidade: "#2563eb", seguranca: "#dc2626", politica: "#7c3aed", educacao: "#0891b2", saude: "#059669",
  economia: "#d97706", esporte: "#16a34a", cultura: "#db2777", clima: "#0284c7",
};

export async function fundoSemFoto(categoria: string): Promise<Buffer> {
  const cor = coresCategoria[categoria] ?? "#1d2b3a";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cor}"/><stop offset="1" stop-color="#111827"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

export async function arteInstagram(foto: Buffer, titulo: string, categoria: string, credito?: string): Promise<Buffer> {
  const L = 1080;
  const A = 1350;
  const linhas = quebrarLinhas(titulo, 24).slice(0, 4);
  const tamanho = linhas.length > 3 ? 66 : 74;
  const alturaLinha = tamanho * 1.15;
  const baseTitulo = A - 190 - (linhas.length - 1) * alturaLinha;
  const cor = coresCategoria[categoria] ?? "#b3261e";
  const nomeCat = esc(nomesCategorias[categoria] ?? "Notícia");
  const fonte = "Segoe UI, Arial, Helvetica, sans-serif";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${A}">
  <defs><linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0.25" stop-color="#0d1117" stop-opacity="0"/>
    <stop offset="0.62" stop-color="#0d1117" stop-opacity="0.85"/>
    <stop offset="1" stop-color="#0d1117" stop-opacity="1"/>
  </linearGradient>
  <linearGradient id="t" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0d1117" stop-opacity="0.6"/>
    <stop offset="1" stop-color="#0d1117" stop-opacity="0"/>
  </linearGradient></defs>
  <rect width="${L}" height="${A}" fill="url(#v)"/>
  <rect width="${L}" height="220" fill="url(#t)"/>
  <text x="64" y="104" font-family="${fonte}" font-size="44" font-weight="800" fill="#fff">SM<tspan fill="#f0645a">.</tspan>Agora</text>
  <rect x="64" y="${baseTitulo - tamanho - 70}" rx="6" width="${nomeCat.length * 19 + 40}" height="52" fill="${cor}"/>
  <text x="84" y="${baseTitulo - tamanho - 34}" font-family="${fonte}" font-size="28" font-weight="700" fill="#fff">${nomeCat}</text>
  ${linhas
    .map(
      (l, i) =>
        `<text x="64" y="${baseTitulo + i * alturaLinha}" font-family="${fonte}" font-size="${tamanho}" font-weight="800" fill="#fff">${esc(l)}</text>`,
    )
    .join("\n  ")}
  <text x="64" y="${A - 70}" font-family="${fonte}" font-size="30" fill="#fff" fill-opacity="0.8">Leia a matéria completa no link da bio</text>
  ${credito ? `<text x="${L - 40}" y="${A - 24}" text-anchor="end" font-family="${fonte}" font-size="20" fill="#fff" fill-opacity="0.6">Foto: ${esc(credito.slice(0, 80))}</text>` : ""}
</svg>`;

  return sharp(foto)
    .resize(L, A, { fit: "cover", position: "attention" })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

export const urlArte = (slug: string) => `${config.siteUrl}/imagens/instagram/${slug}.jpg`;
