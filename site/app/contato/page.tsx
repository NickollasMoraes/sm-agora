import type { Metadata } from "next";
import { PaginaTexto } from "@/components/PaginaTexto";
import { site } from "@/lib/config";

export const metadata: Metadata = { title: "Contato e correções", description: `Fale com a redação e o comercial do ${site.nome}.` };

export default function Contato() {
  const assunto = (texto: string) => `mailto:${site.email}?subject=${encodeURIComponent(texto)}`;
  return <PaginaTexto titulo="Contato e correções">
    <p>O {site.nome} fica em {site.cidade}/{site.estado}. Para facilitar, escolha o assunto:</p>
    <ul><li>Pauta: <a href={assunto("Sugestão de pauta - SM Agora")}>{site.email}</a></li><li>Correção: <a href={assunto("Pedido de correção - SM Agora")}>{site.email}</a></li><li>Privacidade/LGPD: <a href={assunto("Privacidade e LGPD - SM Agora")}>{site.email}</a></li><li>Publicidade: <a href={`mailto:${site.emailComercial}?subject=${encodeURIComponent("Publicidade - SM Agora")}`}>{site.emailComercial}</a></li></ul>
    <p>Também atendemos pelo WhatsApp comercial <a href={`https://wa.me/${site.whatsappComercial}`}>{site.whatsappComercial}</a> e pelo Instagram <a href={`https://instagram.com/${site.instagram}`}>@{site.instagram}</a>.</p>
    <p>Prazo usual de resposta: até 48 horas úteis. Para correções, envie o link da matéria, o trecho e a fonte que sustenta o pedido.</p>
  </PaginaTexto>;
}
