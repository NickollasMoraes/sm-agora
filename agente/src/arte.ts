import sharp from "sharp";
import { config, nomesCategorias } from "./config.js";

// Gera as imagens finais com o sharp (grátis, roda no seu PC):
// - foto do site: 1600x900
// - arte do Instagram: 1080x1350 (formato retrato do feed). Com foto: foto em cima e manchete num
//   painel sólido (fica legível com qualquer foto). Sem foto: a manchete é o destaque.

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

// Cores da marca (as mesmas da foto de perfil e do site)
const TINTA = "#121c27";
const TINTA_CLARA = "#2a3d52";
const MARCA = "#b3261e";
const PONTO = "#e0362b";
const FONTE = "Segoe UI, Arial, Helvetica, sans-serif";
const FONTE_FORTE = "Segoe UI Black, Arial Black, Segoe UI, sans-serif";

const coresCategoria: Record<string, string> = {
  cidade: "#2563eb", seguranca: "#dc2626", politica: "#7c3aed", educacao: "#0891b2", saude: "#059669",
  economia: "#d97706", esporte: "#16a34a", cultura: "#db2777", clima: "#0284c7",
};

export async function fotoDoSite(original: Buffer): Promise<Buffer> {
  return sharp(original).rotate().resize(1600, 900, { fit: "cover", position: "attention" }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
}

// Selo "SM. AGORA" igual à foto de perfil. (x, y) é o canto de cima à esquerda.
function selo(x: number, y: number, escala = 1): string {
  return `<g transform="translate(${x} ${y}) scale(${escala})">
    <text x="0" y="62" font-family="${FONTE_FORTE}" font-weight="900" font-size="76" fill="#fff" letter-spacing="-2">SM</text>
    <circle cx="133" cy="55" r="8" fill="${PONTO}"/>
    <rect x="2" y="74" width="126" height="28" rx="4" fill="${MARCA}"/>
    <text x="65" y="95" text-anchor="middle" font-family="${FONTE_FORTE}" font-weight="900" font-size="19" fill="#fff" letter-spacing="5">AGORA</text>
  </g>`;
}

// Mesmo número de linhas, mas com larguras parecidas (evita uma palavra sozinha na última linha).
function equilibrar(texto: string, maxCaracteres: number): string[] {
  const linhas = quebrarLinhas(texto, maxCaracteres);
  for (let max = Math.ceil(texto.length / linhas.length); max < maxCaracteres; max++) {
    const tentativa = quebrarLinhas(texto, max);
    if (tentativa.length === linhas.length) return tentativa;
  }
  return linhas;
}

// Maior fonte em que a manchete cabe na largura e no número de linhas.
function ajustarManchete(titulo: string, largura: number, maxLinhas: number, maior: number, menor: number) {
  for (let tamanho = maior; tamanho >= menor; tamanho -= 2) {
    const linhas = equilibrar(titulo, Math.floor(largura / (tamanho * 0.55)));
    if (linhas.length <= maxLinhas) return { linhas, tamanho };
  }
  return { linhas: quebrarLinhas(titulo, Math.floor(largura / (menor * 0.55))).slice(0, maxLinhas), tamanho: menor };
}

function etiqueta(x: number, y: number, categoria: string): string {
  const cor = coresCategoria[categoria] ?? MARCA;
  const nome = (nomesCategorias[categoria] ?? "Notícia").toUpperCase();
  const largura = nome.length * 19 + 44;
  return `<rect x="${x}" y="${y}" width="${largura}" height="48" rx="6" fill="${cor}"/>
  <text x="${x + 22}" y="${y + 33}" font-family="${FONTE}" font-weight="800" font-size="24" letter-spacing="2.5" fill="#fff">${esc(nome)}</text>`;
}

function manchete(x: number, topo: number, linhas: string[], tamanho: number): string {
  const altura = tamanho * 1.12;
  return linhas
    .map((l, i) => `<text x="${x}" y="${topo + tamanho + i * altura}" font-family="${FONTE}" font-weight="800" font-size="${tamanho}" fill="#fff">${esc(l)}</text>`)
    .join("\n  ");
}

function rodape(L: number, A: number, credito?: string): string {
  return `<line x1="64" y1="${A - 118}" x2="${L - 64}" y2="${A - 118}" stroke="#fff" stroke-opacity="0.15" stroke-width="2"/>
  <text x="64" y="${A - 66}" font-family="${FONTE}" font-weight="700" font-size="30" fill="#fff">Leia a matéria completa <tspan fill="${PONTO}">→</tspan> link na bio</text>
  ${credito ? `<text x="${L - 64}" y="${A - 66}" text-anchor="end" font-family="${FONTE}" font-size="21" fill="#fff" fill-opacity="0.6">Foto: ${esc(credito.slice(0, 48))}</text>` : ""}
  <rect y="${A - 14}" width="${L}" height="14" fill="${MARCA}"/>`;
}

// Fundo sem foto (site): azul-marinho da marca, selo no centro e faixa embaixo na cor da editoria.
export async function fundoSemFoto(categoria: string): Promise<Buffer> {
  const cor = coresCategoria[categoria] ?? MARCA;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
  <defs><radialGradient id="g" cx="0.5" cy="0.45" r="0.8"><stop offset="0" stop-color="${TINTA_CLARA}"/><stop offset="1" stop-color="${TINTA}"/></radialGradient></defs>
  <rect width="1600" height="900" fill="url(#g)"/>
  <rect y="876" width="1600" height="24" fill="${cor}"/>
  ${selo(800 - 72 * 2.6, 450 - 52 * 2.6, 2.6)}
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

export async function arteInstagram(foto: Buffer | null, titulo: string, categoria: string, credito?: string): Promise<Buffer> {
  const L = 1080;
  const A = 1350;
  const largura = L - 128;

  if (!foto) {
    const cor = coresCategoria[categoria] ?? MARCA;
    const { linhas, tamanho } = ajustarManchete(titulo, largura, 6, 104, 64);
    const alturaTexto = tamanho * 1.12 * linhas.length;
    const topo = Math.max(330, (A - alturaTexto) / 2 - 20);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${A}">
  <defs><radialGradient id="g" cx="0.25" cy="0.2" r="1.1"><stop offset="0" stop-color="${TINTA_CLARA}"/><stop offset="1" stop-color="${TINTA}"/></radialGradient></defs>
  <rect width="${L}" height="${A}" fill="url(#g)"/>
  <text x="${L + 60}" y="${A + 90}" text-anchor="end" font-family="${FONTE_FORTE}" font-weight="900" font-size="720" fill="#fff" fill-opacity="0.04" letter-spacing="-24">SM.</text>
  <rect width="16" height="${A}" fill="${cor}"/>
  ${selo(64, 64)}
  ${etiqueta(64, topo - 80, categoria)}
  ${manchete(64, topo, linhas, tamanho)}
  ${rodape(L, A)}
</svg>`;
    return sharp(Buffer.from(svg)).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  }

  // Com foto: foto em cima, manchete no painel de baixo.
  const { linhas, tamanho } = ajustarManchete(titulo, largura, 4, 78, 56);
  const alturaTexto = tamanho * 1.12 * linhas.length;
  const fimFoto = Math.round(A - 118 - 70 - alturaTexto - 110);
  const imagem = await sharp(foto).resize(L, fimFoto + 60, { fit: "cover", position: "attention" }).toBuffer();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${A}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${TINTA}" stop-opacity="0"/><stop offset="1" stop-color="${TINTA}"/>
    </linearGradient>
    <linearGradient id="topo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${TINTA}" stop-opacity="0.75"/><stop offset="1" stop-color="${TINTA}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${L}" height="240" fill="url(#topo)"/>
  <rect y="${fimFoto - 220}" width="${L}" height="280" fill="url(#base)"/>
  <rect y="${fimFoto + 59}" width="${L}" height="${A - fimFoto}" fill="${TINTA}"/>
  ${selo(64, 56)}
  ${etiqueta(64, fimFoto - 4, categoria)}
  ${manchete(64, fimFoto + 70, linhas, tamanho)}
  ${rodape(L, A, credito)}
</svg>`;

  return sharp({ create: { width: L, height: A, channels: 3, background: TINTA } })
    .composite([
      { input: imagem, top: 0, left: 0 },
      { input: Buffer.from(svg), top: 0, left: 0 },
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

export async function arteInstagramStory(foto: Buffer | null, titulo: string, categoria: string, credito?: string): Promise<Buffer> {
  const base = await camadasReelsMateria(foto, titulo, categoria, credito);
  return base.capa;
}

// Capa de Reels: 1080x1920. A grade do perfil mostra só o centro (3:4, de y=240 a 1680), então
// selo, etiqueta e manchete ficam nessa faixa.
export async function capaReels(titulo: string): Promise<Buffer> {
  const L = 1080;
  const A = 1920;
  const { linhas, tamanho } = ajustarManchete(titulo, L - 128, 6, 116, 72);
  const alturaTexto = tamanho * 1.12 * linhas.length;
  const topo = Math.max(720, 960 - alturaTexto / 2);
  const data = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${A}">
  <defs><radialGradient id="g" cx="0.3" cy="0.35" r="0.9"><stop offset="0" stop-color="${TINTA_CLARA}"/><stop offset="1" stop-color="${TINTA}"/></radialGradient></defs>
  <rect width="${L}" height="${A}" fill="url(#g)"/>
  <rect width="16" height="${A}" fill="${MARCA}"/>
  ${selo(64, 300)}
  <rect x="64" y="${topo - 90}" width="236" height="56" rx="6" fill="${PONTO}"/>
  <path d="M88 ${topo - 74} L108 ${topo - 62} L88 ${topo - 50} Z" fill="#fff"/>
  <text x="122" y="${topo - 50}" font-family="${FONTE}" font-weight="800" font-size="30" letter-spacing="3" fill="#fff">VÍDEO</text>
  ${manchete(64, topo, linhas, tamanho)}
  <text x="64" y="${Math.min(1640, topo + alturaTexto + 110)}" font-family="${FONTE}" font-weight="700" font-size="34" fill="#fff" fill-opacity="0.85">${esc(`Santa Maria · ${data}`)}</text>
  <rect y="${A - 14}" width="${L}" height="14" fill="${MARCA}"/>
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

// Selo para marca d'água em vídeo: PNG transparente com fundo escuro translúcido (legível em qualquer imagem).
export async function seloMarcaDagua(largura = 200): Promise<Buffer> {
  const escala = largura / 170;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${Math.round(124 * escala)}">
  <rect width="100%" height="100%" rx="${14 * escala}" fill="${TINTA}" fill-opacity="0.55"/>
  ${selo(18 * escala, 10 * escala, escala)}
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Reels de uma matéria: duas camadas 1080x1920 que o ffmpeg anima (zoom lento no fundo, texto surgindo).
// Fundo: a foto na parte de cima (ou o degradê da marca). Camada: painel, etiqueta, manchete e chamada.
export async function camadasReelsMateria(foto: Buffer | null, titulo: string, categoria: string, credito?: string) {
  const L = 1080;
  const A = 1920;
  const cor = coresCategoria[categoria] ?? MARCA;
  const { linhas, tamanho } = foto ? ajustarManchete(titulo, L - 128, 4, 88, 60) : ajustarManchete(titulo, L - 128, 5, 96, 64);
  const alturaTexto = tamanho * 1.12 * linhas.length;

  let fundo: Buffer;
  let topoTexto: number;
  if (foto) {
    // A foto encolhe quando a manchete é longa, para sobrar espaço para manchete, chamada e crédito.
    const altFoto = Math.min(1100, Math.round(A - 420 - alturaTexto));
    fundo = await sharp({ create: { width: L, height: A, channels: 3, background: TINTA } })
      .composite([{ input: await sharp(foto).resize(L, altFoto, { fit: "cover", position: "attention" }).toBuffer(), top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer();
    topoTexto = altFoto + 40;
  } else {
    const svgFundo = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${A}">
  <defs><radialGradient id="g" cx="0.3" cy="0.35" r="0.9"><stop offset="0" stop-color="${TINTA_CLARA}"/><stop offset="1" stop-color="${TINTA}"/></radialGradient></defs>
  <rect width="${L}" height="${A}" fill="url(#g)"/>
  <text x="${L + 60}" y="${A - 160}" text-anchor="end" font-family="${FONTE_FORTE}" font-weight="900" font-size="720" fill="#fff" fill-opacity="0.04" letter-spacing="-24">SM.</text>
</svg>`;
    fundo = await sharp(Buffer.from(svgFundo)).jpeg({ quality: 90 }).toBuffer();
    topoTexto = Math.max(700, 960 - alturaTexto / 2);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${A}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${TINTA}" stop-opacity="0"/><stop offset="1" stop-color="${TINTA}"/></linearGradient>
    <linearGradient id="topo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${TINTA}" stop-opacity="0.7"/><stop offset="1" stop-color="${TINTA}" stop-opacity="0"/></linearGradient>
  </defs>
  ${foto ? `<rect width="${L}" height="380" fill="url(#topo)"/><rect y="${topoTexto - 340}" width="${L}" height="300" fill="url(#base)"/><rect y="${topoTexto - 41}" width="${L}" height="${A - topoTexto + 41}" fill="${TINTA}"/>` : ""}
  <rect width="16" height="${A}" fill="${cor}"/>
  ${selo(64, 220)}
  ${etiqueta(64, topoTexto - (foto ? 20 : 80), categoria)}
  ${manchete(64, topoTexto + (foto ? 50 : 0), linhas, tamanho)}
  <text x="64" y="${topoTexto + (foto ? 50 : 0) + alturaTexto + 100}" font-family="${FONTE}" font-weight="700" font-size="36" fill="#fff">Matéria completa <tspan fill="${PONTO}">→</tspan> link na bio</text>
  ${credito ? `<text x="64" y="${A - 60}" font-family="${FONTE}" font-size="22" fill="#fff" fill-opacity="0.55">Foto: ${esc(credito.slice(0, 60))}</text>` : ""}
  <rect y="${A - 14}" width="${L}" height="14" fill="${MARCA}"/>
</svg>`;
  const camada = await sharp(Buffer.from(svg)).png().toBuffer();
  // Capa do Reels = fundo + camada (o quadro final do vídeo)
  const capa = await sharp(fundo).composite([{ input: camada }]).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  return { fundo, camada, capa };
}

export const urlArte =(slug: string) => `${config.siteUrl}/imagens/instagram/${slug}.jpg`;
