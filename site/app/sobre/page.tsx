import type { Metadata } from "next";
import { PaginaTexto } from "@/components/PaginaTexto";
import { site } from "@/lib/config";

export const metadata: Metadata = { title: "Quem somos" };

export default function Sobre() {
  return (
    <PaginaTexto titulo="Quem somos">
      <p>
        O {site.nome} é um portal independente de notícias de Santa Maria e região central do Rio Grande do Sul. Nosso
        objetivo é contar, de forma rápida e clara, o que acontece na cidade e afeta a vida de quem mora aqui.
      </p>
      <h2>Como trabalhamos</h2>
      <p>
        Acompanhamos fontes oficiais (Prefeitura, Câmara, UFSM, órgãos de segurança) e veículos de imprensa. Usamos
        ferramentas de inteligência artificial para monitorar essas fontes e apoiar a redação, mas{" "}
        <strong>toda matéria é aprovada por um editor humano antes de ser publicada</strong>.
      </p>
      <ul>
        <li>Sempre citamos e linkamos a fonte original da informação.</li>
        <li>Usamos apenas imagens com licença livre, oficiais ou próprias, sempre com crédito.</li>
        <li>Corrigimos erros de forma transparente, com a data da atualização.</li>
        <li>Conteúdo patrocinado é sempre identificado como tal.</li>
      </ul>
      <p>
        Contato da redação: <a href={`mailto:${site.email}`}>{site.email}</a>
      </p>
    </PaginaTexto>
  );
}
