import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { categorias, config } from "./config.js";
import type { ItemColetado } from "./coletor.js";
import { perguntarJson, perguntarTexto } from "./claude-code.js";
import { triarLocal } from "./triagem-local.js";

// Dois jeitos de usar o Claude (IA_PROVEDOR no .env):
// "claude-code": usa o seu plano do Claude pelo Claude Code instalado no PC (sem custo extra)
// "api":         usa a API paga da Anthropic (ANTHROPIC_API_KEY)
const usarApi = () => config.iaProvedor === "api";
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

export async function triar(itens: ItemColetado[], jaVistos: string[]): Promise<Triagem[]> {
  if (itens.length === 0) return [];
  if (config.triagem === "local") return triarLocal(itens, jaVistos);
  const lista = itens.map((i) => ({ id: i.id, fonte: i.fonte, titulo: i.titulo, resumo: i.resumo.slice(0, 300) }));
  const conteudo = `Títulos já vistos nas últimas 72h:\n${jaVistos.slice(-150).join("\n") || "(nenhum)"}\n\nItens novos:\n${JSON.stringify(lista, null, 1)}`;
  if (!usarApi()) return (await perguntarJson(conteudo, TriagemSchema, { sistema: SISTEMA_TRIAGEM })).avaliacoes;
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
  return resp.parsed_output.avaliacoes;
}

// ---------------------------------------------------------------- Pesquisa (quando a página original não pôde ser lida)

export async function pesquisarFatos(titulo: string, fonte: string): Promise<string> {
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

const RascunhoSchema = z.object({
  titulo: z.string().describe("Título jornalístico, até 90 caracteres, sem caixa alta e sem ponto final"),
  subtitulo: z.string().describe("Linha fina com a informação principal, até 180 caracteres"),
  slug: z.string().describe("URL amigável: minúsculas, sem acentos, palavras separadas por hífen, até 70 caracteres"),
  categoria: z.enum(categorias),
  tags: z.array(z.string()).describe("3 a 6 tags curtas, minúsculas, com hífen no lugar de espaço"),
  corpo: z.string().describe("Matéria em Markdown, 300 a 600 palavras, com 1 ou 2 intertítulos ##"),
  fontes: z.array(z.object({ nome: z.string(), url: z.string() })),
  legendaInstagram: z.string().describe("Legenda para o Instagram: 2 a 4 frases, chamada para o link na bio, 5 a 8 hashtags"),
  tituloArte: z.string().describe("Versão curta do título para a arte do Instagram, até 70 caracteres"),
  buscaImagem: z
    .array(z.string())
    .describe(
      "3 buscas para banco de imagens livres, do mais específico ao mais genérico. Descreva LUGARES, OBJETOS ou CENAS (ex.: 'Santa Maria Rio Grande do Sul catedral', 'ambulância', 'sala de aula universidade'). NUNCA nomes de pessoas.",
    ),
  descricaoImagem: z.string().describe("Texto alternativo (alt) para a imagem, descrevendo a cena"),
});
export type Rascunho = z.infer<typeof RascunhoSchema>;

const SISTEMA_REDACAO = `Você é repórter do ${config.siteNome}, portal de notícias de Santa Maria (RS). Escreva em português do Brasil, em estilo jornalístico claro, direto e neutro (pirâmide invertida: o mais importante no primeiro parágrafo).

REGRAS DE DIREITO AUTORAL E ÉTICA (obrigatórias):
1. Escreva um texto ORIGINAL. Nunca copie frases do material de referência; reescreva com suas palavras e sua estrutura. Citações literais só entre aspas, curtas (até 2 frases) e com o autor identificado.
2. Atribua a informação à fonte original no texto ("segundo a Prefeitura", "de acordo com o Diário de Santa Maria") e liste as fontes no campo "fontes" com o link real.
3. Use APENAS fatos presentes no material. Não invente números, nomes, datas, falas ou detalhes. Se faltar uma informação importante, diga que ela não foi divulgada.
4. Agregue valor local quando o material permitir: explique o impacto para quem mora em Santa Maria, serviço (datas, endereços, como participar).
5. Em casos policiais, não exponha nomes de suspeitos que não foram formalmente acusados nem de vítimas; nunca identifique menores de idade.
6. Não use clichês ("vale ressaltar", "é importante destacar") nem adjetivação opinativa.`;

export async function redigir(item: ItemColetado, material: string, orientacao?: string): Promise<Rascunho> {
  const pedido = [
    `Fonte: ${item.fonte}\nLink original: ${item.link}\nTítulo original: ${item.titulo}`,
    `Material de referência (somente para extrair fatos):\n"""\n${material}\n"""`,
    orientacao ? `Orientação do editor: ${orientacao}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!usarApi()) return perguntarJson(pedido, RascunhoSchema, { sistema: SISTEMA_REDACAO });
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

export async function ajustar(rascunho: Rascunho, pedido: string): Promise<Rascunho> {
  const conteudo = `Esta é a matéria atual:\n${JSON.stringify(rascunho, null, 1)}\n\nAplique este pedido do editor e devolva a matéria completa: ${pedido}`;
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
