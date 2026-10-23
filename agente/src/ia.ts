import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { categorias, config } from "./config.js";
import type { ItemColetado } from "./coletor.js";
import type { ImagemEscolhida } from "./imagens.js";
import { perguntarJson, perguntarTexto } from "./claude-code.js";
import { perguntarJson as perguntarJsonCodex, perguntarTexto as perguntarTextoCodex } from "./codex.js";
import { triarLocal, type RecenteTriagem } from "./triagem-local.js";
import fs from "node:fs";
import path from "node:path";
import { lerCanais } from "./canais.js";
import { ajustarComCodex, redigirComCodex } from "./codex.js";
import * as db from "./estado.js";

// Dois jeitos de usar o Claude (IA_PROVEDOR no .env):
// "claude-code": usa o seu plano do Claude pelo Claude Code instalado no PC (sem custo extra)
// "api":         usa a API paga da Anthropic (ANTHROPIC_API_KEY)
const usarApi = () => config.iaProvedor === "api";
const usarCodex = () => lerCanais().redator === "codex";
const registrarProvedor = (ids: string[], provedor: string) => ids.forEach((id) => db.registrarHistorico(id, "ia-provedor", provedor));
let _client: Anthropic | undefined;
const client = () => (_client ??= new Anthropic()); // lê ANTHROPIC_API_KEY do .env

// Fallback automático: se o modelo recusar um pedido, a API tenta outro modelo na mesma chamada.
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[],
  fallbacks: "default" as const,
};

// ---------------------------------------------------------------- Triagem

const TriagemSchema = z.object({
  avaliacoes: z.array(
    z.object({
      id: z.string(),
      relevante: z.boolean().describe("Afeta ou interessa a quem mora em Santa Maria/RS ou região?"),
      repetida: z.boolean().describe("É a mesma história de um título já visto ou de outro item da lista?"),
      nota: z.number().int().min(1).max(10).describe("Interesse jornalístico para o público local"),
      categoria: z.enum(categorias),
      resumo: z.string().describe("Resumo factual em 1 ou 2 frases, em português"),
    }),
  ),
});
export type Triagem = z.infer<typeof TriagemSchema>["avaliacoes"][number];

const SISTEMA_TRIAGEM = `Você é o editor-chefe do ${config.siteNome}, portal de notícias de Santa Maria (RS).
Avalie cada item coletado das fontes e decida se vira pauta.

Critérios de nota (1 a 10):
- 8 a 10: afeta diretamente a vida na cidade (serviços, obras, trânsito, segurança, saúde, clima severo, UFSM, decisões da Câmara/Prefeitura, esporte local relevante).
- 5 a 7: interesse local moderado (eventos, cultura, economia local, pesquisas da UFSM).
- 1 a 4: pouco interesse local, agenda burocrática (ex.: "sessão plenária" sem pauta descrita), conteúdo promocional, notícia de outra Santa Maria (DF, Portugal etc.).
Marque "repetida" quando o assunto for o mesmo de um título já visto, mesmo com palavras diferentes.
Avalie TODOS os itens recebidos, usando o mesmo id.`;

export async function triar(itens: ItemColetado[], jaVistos: string[], recentes: RecenteTriagem[] = []): Promise<Triagem[]> {
  if (itens.length === 0) return [];
  if (config.triagem === "local") return triarLocal(itens, jaVistos, recentes);
  const lista = itens.map((i) => ({ id: i.id, fonte: i.fonte, titulo: i.titulo, resumo: i.resumo.slice(0, 300) }));
  const conteudo = `Títulos já vistos nas últimas 72h:\n${jaVistos.slice(-150).join("\n") || "(nenhum)"}\n\nItens novos:\n${JSON.stringify(lista, null, 1)}`;
  if (usarCodex()) {
    try {
      const resultado = (await perguntarJsonCodex(conteudo, TriagemSchema, { sistema: SISTEMA_TRIAGEM })).avaliacoes;
      registrarProvedor(itens.map((item) => item.id), "codex");
      return resultado;
    } catch (e) {
      console.warn(`[ia] Codex falhou na triagem; tentando Claude: ${(e as Error).message}`);
    }
  }
  if (!usarApi()) {
    const resultado = (await perguntarJson(conteudo, TriagemSchema, { sistema: SISTEMA_TRIAGEM })).avaliacoes;
    registrarProvedor(itens.map((item) => item.id), "claude");
    return resultado;
  }
  const resp = await client().beta.messages.parse({
    model: config.modeloTriagem,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "low", format: betaZodOutputFormat(TriagemSchema) },
    system: [{ type: "text", text: SISTEMA_TRIAGEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: conteudo }],
  });
  if (resp.stop_reason === "refusal" || !resp.parsed_output) {
    throw new Error(`Triagem sem resposta válida (stop_reason: ${resp.stop_reason})`);
  }
  registrarProvedor(itens.map((item) => item.id), "claude-api");
  return resp.parsed_output.avaliacoes;
}

// ---------------------------------------------------------------- Pesquisa (quando a página original não pôde ser lida)

export async function pesquisarFatos(titulo: string, fonte: string): Promise<string> {
  const pedidoPesquisa = `Pesquise na web a notícia "${titulo}" (fonte: ${fonte}), de Santa Maria/RS. Liste os fatos verificáveis e os links das fontes consultadas. Responda só com os fatos, em português.`;
  if (usarCodex()) {
    try {
      return await perguntarTextoCodex(pedidoPesquisa, {
        sistema: "Você é pesquisador de uma redação jornalística. Busque e relate apenas fatos verificáveis, com as fontes.",
      });
    } catch (e) {
      console.warn(`[ia] Codex falhou na pesquisa; tentando Claude: ${(e as Error).message}`);
    }
  }
  if (!usarApi()) {
    return perguntarTexto(
      `Pesquise na web a notícia "${titulo}" (fonte: ${fonte}), de Santa Maria/RS. Liste os fatos verificáveis (o quê, quem, quando, onde, números, citações curtas com autor) e os links das fontes consultadas. Responda só com os fatos, em português.`,
      {
        sistema: "Você é pesquisador de uma redação jornalística. Busque e relate apenas fatos verificáveis, com as fontes.",
        ferramentas: ["WebSearch", "WebFetch"],
        minutos: 10,
      },
    );
  }
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Pesquise na web a notícia "${titulo}" (fonte: ${fonte}), de Santa Maria/RS. Liste os fatos verificáveis (o quê, quem, quando, onde, números, citações curtas com autor) e os links das fontes consultadas. Responda só com os fatos, em português.`,
    },
  ];
  let texto = "";
  for (let rodada = 0; rodada < 3; rodada++) {
    const resp = await client().messages.create({
      model: config.modelo,
      max_tokens: 16000,
      output_config: { effort: "low" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3, user_location: { type: "approximate", city: "Santa Maria", region: "Rio Grande do Sul", country: "BR" } }],
      messages,
    });
    texto += resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    if (resp.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: resp.content });
  }
  return texto.trim();
}

// ---------------------------------------------------------------- Redação

export const RascunhoSchema = z.object({
  titulo: z.string().describe("Título jornalístico, até 90 caracteres, sem caixa alta e sem ponto final"),
  subtitulo: z.string().describe("Linha fina com a informação principal, até 180 caracteres"),
  slug: z.string().describe("URL amigável: minúsculas, sem acentos, palavras separadas por hífen, até 70 caracteres"),
  categoria: z.enum(categorias),
  tags: z.array(z.string()).describe("3 a 6 tags curtas, minúsculas, com hífen no lugar de espaço"),
  corpo: z.string().describe("Matéria em Markdown, no mínimo 800 palavras, alvo de 800 a 1.100, com 3 a 5 intertítulos ##"),
  fontes: z.array(z.object({ nome: z.string(), url: z.string() })),
  legendaInstagram: z.string().describe("Legenda para o Instagram: 2 a 4 frases, chamada para o link na bio, 5 a 8 hashtags"),
  tituloArte: z.string().describe("Versão curta do título para a arte do Instagram, até 70 caracteres"),
  buscaImagem: z
    .array(z.string())
    .describe(
      "3 buscas para banco de imagens livres, do mais específico ao mais genérico. A 1ª é o LUGAR REAL da notícia pelo nome (ex.: 'Universidade Federal de Santa Maria', 'Santa Maria Rio Grande do Sul catedral', 'Caçapava do Sul'). As outras são OBJETOS ou CENAS genéricas que não identificam outro lugar (ex.: 'urna eletrônica', 'ambulância', 'estudantes sala de aula'). Nunca peça prédio, fachada ou campus genérico: o banco devolve prédios de outras cidades. NUNCA nomes de pessoas.",
    ),
  descricaoImagem: z.string().describe("Texto alternativo (alt) para a imagem, descrevendo a cena"),
});
export type Rascunho = z.infer<typeof RascunhoSchema>;

const SISTEMA_REDACAO = fs.readFileSync(path.join(config.pastas.raiz, "agente", "prompts", "redacao.md"), "utf8");
/* const SISTEMA_REDACAO_ANTIGO = `Você é repórter do ${config.siteNome}, portal de notícias de Santa Maria (RS). Escreva em português do Brasil, em estilo jornalístico claro, direto e neutro (pirâmide invertida: o mais importante no primeiro parágrafo).

REGRAS DE DIREITO AUTORAL E ÉTICA (obrigatórias):
1. Escreva um texto ORIGINAL. Nunca copie frases do material de referência; reescreva com suas palavras e sua estrutura. Citações literais só entre aspas, curtas (até 2 frases) e com o autor identificado.
2. Atribua a informação à fonte original no texto ("segundo a Prefeitura", "de acordo com o Diário de Santa Maria") e liste as fontes no campo "fontes" com o link real.
3. Use APENAS fatos presentes no material. Não invente números, nomes, datas, falas ou detalhes. Se faltar uma informação importante, diga que ela não foi divulgada.
4. Agregue valor local quando o material permitir: explique o impacto para quem mora em Santa Maria, serviço (datas, endereços, como participar).
5. Em casos policiais, não exponha nomes de suspeitos que não foram formalmente acusados nem de vítimas; nunca identifique menores de idade.
6. Não use clichês ("vale ressaltar", "é importante destacar") nem adjetivação opinativa.`; */

export async function redigir(item: ItemColetado, material: string, orientacao?: string): Promise<Rascunho> {
  const pedido = [
    `Fonte: ${item.fonte}\nLink original: ${item.link}\nTítulo original: ${item.titulo}`,
    `Material de referência (somente para extrair fatos):\n"""\n${material}\n"""`,
    orientacao ? `Orientação do editor: ${orientacao}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (usarCodex()) {
    try {
      const resultado = await redigirComCodex(item, material, orientacao);
      db.registrarHistorico(item.id, "ia-provedor", "codex");
      return resultado;
    } catch (e) {
      console.warn(`[ia] Codex falhou na redação; tentando Claude: ${(e as Error).message}`);
    }
  }
  if (!usarApi()) {
    const resultado = await perguntarJson(pedido, RascunhoSchema, { sistema: SISTEMA_REDACAO });
    db.registrarHistorico(item.id, "ia-provedor", "claude");
    return resultado;
  }
  const resp = await client().beta.messages.parse({
    model: config.modelo,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "medium", format: betaZodOutputFormat(RascunhoSchema) },
    system: [{ type: "text", text: SISTEMA_REDACAO, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: pedido }],
  });
  if (resp.stop_reason === "refusal" || !resp.parsed_output) {
    throw new Error(`Redação sem resposta válida (stop_reason: ${resp.stop_reason})`);
  }
  return resp.parsed_output;
}

// ------------------------------------------------------- Conferência das fotos

const EscolhaImagemSchema = z.object({
  aprovadas: z
    .array(z.number().int())
    .describe("Números das fotos que servem, da melhor para a pior. Lista vazia se nenhuma servir."),
});

const SISTEMA_IMAGEM = `Você é editor de fotografia do ${config.siteNome}, portal de Santa Maria (RS).
Recebe uma matéria e fotos candidatas de bancos livres, cada uma com o título, a descrição e as etiquetas do acervo.
Aprove só as fotos que não enganam o leitor:
- Se a foto mostra um lugar, prédio ou instituição identificável, ele TEM de ser o da matéria (ex.: matéria da UFSM só aceita foto da UFSM; prédio de outra cidade ou universidade é reprovado).
- Cena ou objeto genérico (urna, ambulância, sala de aula, chuva) é aprovado quando combina com o assunto e não identifica outro lugar.
- Reprove foto sem relação com o assunto, com descrição vaga demais para saber o que mostra, com pessoas identificáveis ligadas a outro fato, ou com logotipo de outra marca.
Na dúvida, reprove: a matéria sai com o fundo da editoria, o que é melhor que uma foto errada.`;

export async function escolherImagens(rascunho: Rascunho, candidatas: ImagemEscolhida[]): Promise<ImagemEscolhida[]> {
  if (candidatas.length === 0) return [];
  const lista = candidatas
    .slice(0, 20)
    .map((c, i) => `${i}. [${c.acervo}] ${c.descricao || "(sem descrição)"}`)
    .join("\n");
  const pedido = `Matéria: ${rascunho.titulo}\n${rascunho.subtitulo}\nEditoria: ${rascunho.categoria}\n\nFotos candidatas:\n${lista}`;

  let aprovadas: number[];
  if (usarCodex()) {
    try {
      aprovadas = (await perguntarJsonCodex(pedido, EscolhaImagemSchema, { sistema: SISTEMA_IMAGEM })).aprovadas;
    } catch (e) {
      console.warn(`[ia] Codex falhou na escolha de imagens; tentando Claude: ${(e as Error).message}`);
      aprovadas = !usarApi() ? (await perguntarJson(pedido, EscolhaImagemSchema, { sistema: SISTEMA_IMAGEM })).aprovadas : [];
    }
  } else if (!usarApi()) {
    aprovadas = (await perguntarJson(pedido, EscolhaImagemSchema, { sistema: SISTEMA_IMAGEM })).aprovadas;
  } else {
    const resp = await client().beta.messages.parse({
      model: config.modelo,
      max_tokens: 2000,
      ...FALLBACK,
      output_config: { effort: "low", format: betaZodOutputFormat(EscolhaImagemSchema) },
      system: SISTEMA_IMAGEM,
      messages: [{ role: "user", content: pedido }],
    });
    aprovadas = resp.parsed_output?.aprovadas ?? [];
  }
  const vistos = new Set<number>();
  const escolhidas = aprovadas
    .filter((i) => candidatas[i] && !vistos.has(i) && vistos.add(i))
    .map((i) => candidatas[i]);
  return escolhidas.length > 0 || !usarCodex() ? escolhidas : [candidatas[0]];
}

export async function ajustar(rascunho: Rascunho, pedido: string): Promise<Rascunho> {
  const conteudo = `Esta é a matéria atual:\n${JSON.stringify(rascunho, null, 1)}\n\nAplique este pedido do editor e devolva a matéria completa: ${pedido}`;
  if (usarCodex()) {
    try {
      return await ajustarComCodex(rascunho, pedido);
    } catch (e) {
      console.warn(`[ia] Codex falhou no ajuste; tentando Claude: ${(e as Error).message}`);
    }
  }
  if (!usarApi()) return perguntarJson(conteudo, RascunhoSchema, { sistema: SISTEMA_REDACAO });
  const resp = await client().beta.messages.parse({
    model: config.modelo,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "medium", format: betaZodOutputFormat(RascunhoSchema) },
    system: [{ type: "text", text: SISTEMA_REDACAO, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: conteudo }],
  });
  if (resp.stop_reason === "refusal" || !resp.parsed_output) {
    throw new Error(`Ajuste sem resposta válida (stop_reason: ${resp.stop_reason})`);
  }
  return resp.parsed_output;
}
