import type { Metadata } from "next";
import { PaginaTexto } from "@/components/PaginaTexto";
import { site } from "@/lib/config";

export const metadata: Metadata = { title: "Contato e correções" };

export default function Contato() {
  return (
    <PaginaTexto titulo="Contato e correções">
      <p>
        Tem uma sugestão de pauta, encontrou um erro ou é dono de uma imagem publicada aqui? Fale com a gente:
      </p>
      <ul>
        <li>Redação e correções: <a href={`mailto:${site.email}`}>{site.email}</a></li>
        <li>Comercial: <a href={`mailto:${site.emailComercial}`}>{site.emailComercial}</a></li>
        <li>Instagram: <a href={`https://instagram.com/${site.instagram}`}>@{site.instagram}</a></li>
      </ul>
      <h2>Direitos autorais e de imagem</h2>
      <p>
        Respeitamos direitos autorais. Se você é titular de algum conteúdo publicado aqui e quer o crédito corrigido ou a
        remoção, escreva para {site.email} com o link da matéria. Respondemos em até 48 horas.
      </p>
    </PaginaTexto>
  );
}
