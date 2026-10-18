import { config } from "./config.js";

// Busca imagens SOMENTE em acervos com licença livre e guarda autor, licença e origem.
// Nunca usa a foto da notícia original (ela pertence ao veículo/fotógrafo).

export type ImagemEscolhida = {
  url: string; // arquivo para baixar
  autor: string;
  licenca: string;
  fonte: string; // página de origem (para o crédito)
  acervo: "Wikimedia Commons" | "Openverse" | "Pixabay" | "Pexels";
};

// Licenças aceitas no Wikimedia Commons. "NC" (não comercial) e "ND" ficam de fora: o site tem anúncios.
const LICENCA_OK = /^(cc0|public domain|domínio público|pd|cc by(-sa)? \d(\.\d)?|cc by(-sa)?)/i;
const LICENCA_PROIBIDA = /(nc|nd|fair use|non-free)/i;

const semHtml = (s = "") => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function wikimedia(busca: string): Promise<ImagemEscolhida[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `${busca} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
    iiurlwidth: "1600",
  });
  const r = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": `${config.siteNome}Bot/1.0 (${config.siteUrl})` },
  });
  if (!r.ok) return [];
  const dados = (await r.json()) as {
    query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url: string; descriptionurl: string; width: number; extmetadata?: Record<string, { value: string }> }> }> };
  };
  return Object.values(dados.query?.pages ?? {})
    .map((p) => p.imageinfo?.[0])
    .filter((i): i is NonNullable<typeof i> => Boolean(i && i.width >= 900))
    .map((i) => {
      const meta = i.extmetadata ?? {};
      return {
        url: i.thumburl ?? i.url,
        autor: semHtml(meta.Artist?.value) || "Autor desconhecido",
        licenca: semHtml(meta.LicenseShortName?.value),
        fonte: i.descriptionurl,
        acervo: "Wikimedia Commons" as const,
      };
    })
    .filter((i) => LICENCA_OK.test(i.licenca) && !LICENCA_PROIBIDA.test(i.licenca))
    .filter((i) => combinaComBusca(i.fonte, busca));
}

// A busca do Commons é ampla ("Rio Grande do Sul" traz o estado inteiro). Exige que o nome
// do arquivo contenha a maioria das palavras específicas da busca.
const GENERICAS = new Set(["rio", "grande", "sul", "brasil", "brazil", "rs", "do", "da", "de", "dos", "das"]);
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function combinaComBusca(urlArquivo: string, busca: string): boolean {
  return textoCombina(decodeURIComponent(urlArquivo.split("File:")[1] ?? "").replace(/_/g, " "), busca);
}

function textoCombina(texto: string, busca: string): boolean {
  const alvo = normalizar(texto);
  const palavras = normalizar(busca).split(/\s+/).filter((p) => p.length > 2 && !GENERICAS.has(p));
  if (palavras.length === 0) return true;
  const acertos = palavras.filter((p) => alvo.includes(p)).length;
  return acertos / palavras.length >= 0.6;
}

// Openverse (do WordPress): milhões de fotos Creative Commons, sem chave. Pede só licenças que
// permitem uso comercial e alteração. O Commons já é buscado direto, então fica de fora daqui.
const NOMES_LICENCA: Record<string, string> = { by: "CC BY", "by-sa": "CC BY-SA", cc0: "CC0", pdm: "Domínio público" };

async function openverse(busca: string): Promise<ImagemEscolhida[]> {
  const params = new URLSearchParams({
    q: busca,
    license: "by,by-sa,cc0,pdm",
    excluded_source: "wikimedia",
    aspect_ratio: "wide",
    page_size: "10",
  });
  const r = await fetch(`https://api.openverse.org/v1/images/?${params}`, {
    headers: { "User-Agent": `${config.siteNome}Bot/1.0 (${config.siteUrl})` },
  });
  if (!r.ok) return [];
  const dados = (await r.json()) as {
    results: Array<{ url: string; creator: string | null; license: string; license_version: string | null; foreign_landing_url: string; width: number | null; mature: boolean }>;
  };
  return dados.results
    .filter((i) => !i.mature && (i.width ?? 0) >= 900 && NOMES_LICENCA[i.license])
    .map((i) => ({
      url: i.url,
      autor: i.creator || "Autor desconhecido",
      licenca: [NOMES_LICENCA[i.license], i.license.startsWith("by") ? i.license_version : ""].filter(Boolean).join(" "),
      fonte: i.foreign_landing_url,
      acervo: "Openverse" as const,
    }));
}

// Pixabay: fotos livres para uso comercial. As regras da API pedem baixar a imagem em vez de usar o link
// direto, e o agente já faz isso. A busca em português só funciona sem acento ("ônibus" volta vazio) e
// devolve muita coisa solta (catedral de Florença para "Santa Maria catedral"), então filtra pelas etiquetas.
async function pixabay(busca: string): Promise<ImagemEscolhida[]> {
  if (!config.pixabayKey) return [];
  const params = new URLSearchParams({
    key: config.pixabayKey,
    q: normalizar(busca).slice(0, 100),
    lang: "pt",
    image_type: "photo",
    orientation: "horizontal",
    safesearch: "true",
    per_page: "10",
  });
  const r = await fetch(`https://pixabay.com/api/?${params}`);
  if (!r.ok) return [];
  const dados = (await r.json()) as { hits: Array<{ pageURL: string; user: string; largeImageURL: string; tags: string }> };
  return dados.hits.filter((p) => textoCombina(p.tags, busca)).map((p) => ({
    url: p.largeImageURL,
    autor: p.user,
    licenca: "Licença Pixabay",
    fonte: p.pageURL,
    acervo: "Pixabay" as const,
  }));
}

async function pexels(busca: string): Promise<ImagemEscolhida[]> {
  if (!config.pexelsKey) return [];
  const r = await fetch(
    `https://api.pexels.com/v1/search?${new URLSearchParams({ query: busca, per_page: "10", orientation: "landscape" })}`,
    { headers: { Authorization: config.pexelsKey } },
  );
  if (!r.ok) return [];
  const dados = (await r.json()) as { photos: Array<{ url: string; photographer: string; src: { large2x: string } }> };
  return dados.photos.map((p) => ({
    url: p.src.large2x,
    autor: p.photographer,
    licenca: "Licença Pexels",
    fonte: p.url,
    acervo: "Pexels" as const,
  }));
}

// Devolve candidatas na ordem de preferência: Commons (mais específico, ex.: lugares de Santa Maria),
// depois Pixabay, Pexels e Openverse.
export async function buscarCandidatas(buscas: string[]): Promise<ImagemEscolhida[]> {
  const todas: ImagemEscolhida[] = [];
  for (const b of buscas) {
    const [w, px, p, o] = await Promise.all([
      wikimedia(b).catch(() => []),
      pixabay(b).catch(() => []),
      pexels(b).catch(() => []),
      openverse(b).catch(() => []),
    ]);
    todas.push(...w, ...px, ...p, ...o);
  }
  const vistas = new Set<string>();
  return todas.filter((i) => !vistas.has(i.url) && vistas.add(i.url));
}

export async function baixarImagem(url: string): Promise<Buffer> {
  let r = await fetch(url, { headers: { "User-Agent": `${config.siteNome}Bot/1.0 (${config.siteUrl})` } });
  // O Wikimedia exige identificação, mas o Flickr (fotos do Openverse) recusa esse "Bot": tenta sem ele.
  if (r.status === 403) r = await fetch(url);
  if (!r.ok) throw new Error(`Não consegui baixar a imagem (HTTP ${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}
