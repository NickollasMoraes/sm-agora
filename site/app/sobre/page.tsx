import type { Metadata } from "next";
import Link from "next/link";
import { PaginaTexto } from "@/components/PaginaTexto";
import { categorias, site } from "@/lib/config";

export const metadata: Metadata = { title: "Quem somos", description: `Conheça o ${site.nome}, portal de notícias de ${site.cidade}.` };

export default function Sobre() {
  return <PaginaTexto titulo="Quem somos">
    <p>O {site.nome} é um portal independente de notícias de {site.cidade} e da região central do Rio Grande do Sul. Nossa missão é informar com rapidez, clareza e contexto sobre os assuntos que afetam a comunidade.</p>
    <h2>Nossa cobertura</h2><p>Acompanhamos {categorias.map((c) => c.nome).join(", ")}, além de acontecimentos relevantes de Santa Maria e região.</p>
    <h2>Expediente</h2><p><strong>Editor responsável:</strong> {site.responsavel}<br />Redação: <a href={`mailto:${site.email}`}>{site.email}</a></p>
    <h2>Como trabalhamos</h2><p>Acompanhamos de perto as fontes oficiais e a imprensa da região, checamos as informações e todo texto passa pela revisão e aprovação do editor antes de ir ao ar. Citamos as fontes originais e usamos imagens livres, oficiais ou próprias, com crédito.</p>
    <h2>Princípios editoriais</h2><ul><li>Apuração responsável e correção transparente.</li><li>Separação entre jornalismo, opinião e publicidade.</li><li>Respeito às pessoas, à privacidade e ao interesse público.</li><li>Originalidade e indicação das fontes.</li></ul>
    <p>Conheça nossa <Link href="/politica-editorial/">Política Editorial</Link>, fale com a <Link href="/contato/">redação</Link> ou <Link href="/anuncie/">anuncie</Link> no portal.</p>
  </PaginaTexto>;
}
