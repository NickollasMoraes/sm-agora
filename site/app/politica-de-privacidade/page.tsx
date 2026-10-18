import type { Metadata } from "next";
import { PaginaTexto } from "@/components/PaginaTexto";
import { site } from "@/lib/config";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function Privacidade() {
  return (
    <PaginaTexto titulo="Política de privacidade">
      <p>
        Esta política explica como o {site.nome} trata dados de visitantes, em conformidade com a Lei Geral de Proteção
        de Dados (Lei 13.709/2018).
      </p>
      <h2>Dados coletados</h2>
      <p>
        Não pedimos cadastro para ler o site. Podemos coletar dados de navegação de forma anônima (páginas visitadas,
        tipo de dispositivo, cidade aproximada) por meio de ferramentas de estatística.
      </p>
      <h2>Publicidade e cookies</h2>
      <p>
        Este site pode exibir anúncios do Google AdSense. O Google e seus parceiros usam cookies para exibir anúncios com
        base em visitas anteriores a este e a outros sites. Você pode desativar a publicidade personalizada em{" "}
        <a href="https://adssettings.google.com" target="_blank" rel="noopener">
          adssettings.google.com
        </a>
        . Saiba mais em{" "}
        <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener">
          policies.google.com/technologies/ads
        </a>
        .
      </p>
      <h2>Seus direitos</h2>
      <p>
        Você pode pedir informações, correção ou exclusão de dados pelo e-mail{" "}
        <a href={`mailto:${site.email}`}>{site.email}</a>.
      </p>
    </PaginaTexto>
  );
}
