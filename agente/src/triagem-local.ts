import type { ItemColetado } from "./coletor.js";
import type { Triagem } from "./ia.js";

export type RecenteTriagem = { titulo: string; categoria: string; dia: string };

// Dia no fuso de Santa Maria (AAAA-MM-DD).
export const diaLocal = (iso: string) =>
  new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

// Triagem sem IA (custo zero): nota por palavras-chave, peso da fonte e detecção de repetidas.

const palavrasPorCategoria: Record<Triagem["categoria"], string[]> = {
  seguranca: ["polícia", "brigada", "preso", "prisão", "homicídio", "assalto", "roubo", "furto", "tráfico", "morte", "morre", "crime", "delegacia", "operação", "apreensão", "bombeiros", "incêndio", "tiro", "tiros", "tiroteio", "disparo", "baleado", "perseguição", "esfaqueado", "facada", "assassinado", "assassinato", "foragido", "fuga", "sequestro", "refém", "facção", "violência", "agressão", "flagrante", "arma", "ferido", "feridos", "desaparecido", "golpe", "estelionato"],
  // Trânsito é foco do SM Agora: acidente, rodovia e blitz caem aqui, não em Segurança.
  transito: ["trânsito", "acidente", "colisão", "capotamento", "atropelamento", "atropelado", "rodovia", "br-287", "br-158", "br-392", "rsc-287", "rs-509", "faixa nova", "faixa velha", "congestionamento", "engarrafamento", "bloqueio", "desvio", "semáforo", "sinaleira", "radar", "blitz", "lei seca", "balada segura", "detran", "cnh", "multa", "prf", "daer", "motorista", "motociclista", "pedestre", "ciclista", "estacionamento", "rótula"],
  saude: ["saúde", "hospital", "husm", "upa", "vacina", "vacinação", "dengue", "ubs", "posto de saúde", "sus", "médico", "atendimento", "samu"],
  educacao: ["ufsm", "escola", "universidade", "ensino", "aluno", "estudante", "vestibular", "enem", "matrícula", "curso", "professor", "pesquisa", "ufn", "iffar"],
  politica: ["câmara", "vereador", "prefeito", "prefeitura", "eleição", "eleitoral", "projeto de lei", "sessão", "secretário", "deputado", "senador", "senado", "congresso", "governo", "presidente", "candidato", "campanha", "stf", "tse", "ministro", "lula", "bolsonaro"],
  economia: ["emprego", "vagas", "comércio", "empresa", "investimento", "economia", "preço", "imposto", "iptu", "feira", "inauguração", "negócio"],
  esporte: ["inter-sm", "riograndense", "futebol", "campeonato", "jogo", "atleta", "esporte", "corrida", "gauchão", "divisão de acesso"],
  cultura: ["show", "festival", "teatro", "exposição", "cultura", "música", "cinema", "evento", "festa", "museu", "treze de maio"],
  clima: ["chuva", "temporal", "tempestade", "granizo", "vendaval", "inmet", "frente fria", "umidade", "frio", "calor", "temperatura", "previsão", "defesa civil", "geada", "alerta", "enchente", "alagamento", "vento"],
  cidade: ["obra", "obras", "ônibus", "transporte", "rua", "avenida", "bairro", "água", "corsan", "energia", "rge", "asfalto", "coleta de lixo", "interdição"],
};

// Assuntos que afetam muita gente ou dão muita audiência sobem a nota.
const alto = ["interdição", "falta de água", "sem energia", "paralisação", "greve", "alerta", "temporal", "vacinação", "inscrições", "concurso", "vagas", "transporte coletivo", "ônibus", "morte", "homicídio", "acidente", "tiros", "tiroteio", "baleado", "perseguição", "assassinado", "esfaqueado", "sequestro", "refém", "desaparecido", "explosão", "desabamento", "tragédia", "feridos", "morre", "mortos",
  // Trânsito: o leitor precisa saber agora.
  "congestionamento", "bloqueio", "interditada", "interditado", "blitz", "br-287", "br-158", "br-392", "faixa nova",
  // Política com audiência nacional.
  "lula", "bolsonaro", "stf", "tse", "segundo turno", "pesquisa eleitoral", "debate", "cassação", "impeachment"];
// Agenda burocrática ou institucional desce a nota.
const baixo = ["sessão plenária ordinária", "ata", "edital de", "licitação", "pregão", "convocação", "nota de pesar", "aviso de"];

const pesoFonte: Record<string, number> = {
  "Diário de Santa Maria": 2,
  "Prefeitura de Santa Maria": 1,
  UFSM: 0,
  "Câmara de Vereadores de Santa Maria": 0,
  "Google Notícias": 1,
  "Agência Brasil": 0,
  "G1 RS": 1,
  "Google Notícias · Trânsito": 1,
  "Google Notícias · Região Central": 1,
  // Nacionais: sem bônus; só passam com assunto de alta audiência (e no máximo 2 por rodada).
  "Agência Brasil · Política": 0,
  "Agência Senado": 0,
  "Agência Câmara": 0,
  "G1 Política": 0,
  Poder360: 0,
};

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PARADAS = new Set(["de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas", "e", "a", "o", "as", "os", "para", "com", "por", "que", "um", "uma", "santa", "maria", "rs", "sm"]);

function palavras(titulo: string): Set<string> {
  return new Set(
    normalizar(titulo)
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((p) => p.length > 2 && !PARADAS.has(p)),
  );
}

// Similaridade entre dois títulos (0 a 1), para achar a mesma história em fontes diferentes.
// Radical simples (5 primeiras letras): "tempestade"/"tempestades", "alertas"/"alerta".
const radicais = (titulo: string) => new Set([...palavras(titulo)].map((p) => p.slice(0, 5)));

function sobreposicao(a: string, b: string): number {
  const pa = radicais(a);
  const pb = radicais(b);
  if (pa.size === 0 || pb.size === 0) return 0;
  const comuns = [...pa].filter((p) => pb.has(p)).length;
  return comuns / Math.min(pa.size, pb.size);
}

function parecido(a: string, b: string): boolean {
  return sobreposicao(a, b) >= 0.6;
}

// Virada grave do tempo justifica uma segunda matéria no dia.
const tempoGrave = /emergencia|desabrigad|desalojad|mort|estrago|enchente|alagament|calamidade/;

// Termo no começo de palavra: "morre" pega "morreu", mas "lula" não pega "celular".
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const contem = (texto: string, termos: string[]) =>
  termos.filter((t) => new RegExp(`(^|[^a-z0-9-])${escapar(normalizar(t))}`).test(texto)).length;

export function triarLocal(
  itens: ItemColetado[],
  jaVistos: string[],
  recentes: RecenteTriagem[] = [],
): Triagem[] {
  const vistos = [...jaVistos];
  const doDia = [...recentes];
  return itens.map((i) => {
    const texto = normalizar(`${i.titulo} ${i.resumo}`);

    let categoria: Triagem["categoria"] = "cidade";
    let melhor = 0;
    for (const [cat, termos] of Object.entries(palavrasPorCategoria)) {
      const n = contem(texto, termos);
      if (n > melhor) {
        melhor = n;
        categoria = cat as Triagem["categoria"];
      }
    }

    const nota = Math.max(
      1,
      Math.min(10, 3 + Math.min(melhor, 2) + contem(texto, alto) * 2 - contem(texto, baixo) * 3 + (pesoFonte[i.fonte] ?? 0)),
    );
    // Outra cidade chamada Santa Maria (DF, RN, Portugal...)
    const outraCidade = /santa maria (\(df\)|do df|- df)|santa maria, df|santa maria \(rn\)/.test(texto);
    // Mesmo assunto no mesmo dia, mesmo vindo de fontes diferentes:
    // - tempo: uma matéria por dia (outra só se for virada grave e ainda não houver grave);
    // - demais editorias: mesma editoria + radicais parecidos (régua mais baixa que a geral).
    const dia = diaLocal(i.data || new Date().toISOString());
    const mesmoDia = doDia.filter((r) => r.dia === dia && r.categoria === categoria);
    const grave = tempoGrave.test(texto);
    const repetidaNoDia =
      categoria === "clima"
        ? mesmoDia.length > 0 && !(grave && !mesmoDia.some((r) => tempoGrave.test(normalizar(r.titulo))))
        : mesmoDia.some((r) => sobreposicao(r.titulo, i.titulo) >= 0.4);
    const repetida = repetidaNoDia || vistos.some((v) => parecido(v, i.titulo));
    vistos.push(i.titulo);
    doDia.push({ titulo: i.titulo, categoria, dia });

    return {
      id: i.id,
      relevante: !outraCidade,
      repetida,
      nota,
      categoria,
      resumo: i.resumo ? i.resumo.slice(0, 280) : "(a fonte não trouxe resumo; abra o link para ver)",
    };
  });
}
