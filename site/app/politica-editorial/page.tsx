import type { Metadata } from "next";
import { PaginaTexto } from "@/components/PaginaTexto";
import { site } from "@/lib/config";

export const metadata: Metadata = { title: "Política editorial", description: `Como o ${site.nome} apura, publica e corrige notícias.` };

export default function Editorial() {
  return <PaginaTexto titulo="Política editorial e de correções">
    <p>Esta política explica os critérios que orientam o jornalismo do {site.nome} em Santa Maria e região.</p>
    <h2>Apuração e fontes</h2><p>Buscamos documentos e fontes oficiais, ouvimos os envolvidos quando possível e conferimos nomes, datas, locais e números. Indicamos as fontes consultadas nas matérias e diferenciamos fato, contexto e opinião.</p>
    <h2>Revisão editorial</h2><p>Monitoramos continuamente fontes oficiais e veículos da região. Nenhum texto é publicado sem passar pelo julgamento jornalístico do editor: todo conteúdo é revisado e aprovado antes da publicação.</p>
    <h2>Originalidade e imagens</h2><p>Não praticamos plágio. Textos são produzidos pela redação a partir da apuração e das fontes citadas. Usamos imagens próprias, oficiais ou com licença compatível, sempre com crédito e link quando aplicável.</p>
    <h2>Patrocínio</h2><p>Publicidade e publieditoriais são identificados como conteúdo patrocinado. O anunciante não compra controle sobre a cobertura editorial.</p>
    <h2>Correções</h2><p>Se encontrar um erro factual, envie o link, a informação a corrigir e a fonte de apoio para <a href={`mailto:${site.email}`}>{site.email}</a>. Avaliamos o pedido e, quando procedente, corrigimos o texto indicando a atualização. Respondemos em até 48 horas.</p>
  </PaginaTexto>;
}
