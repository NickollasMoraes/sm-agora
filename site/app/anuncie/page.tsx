import type { Metadata } from "next";
import { PaginaTexto } from "@/components/PaginaTexto";
import { site } from "@/lib/config";

export const metadata: Metadata = { title: "Anuncie", description: `Anuncie no ${site.nome} e alcance Santa Maria.` };

const planos = [
  { nome: "Banner Destaque", preco: "R$ 390/mês", itens: ["Banner no topo da home e das matérias", "Link direto para seu site ou WhatsApp", "Relatório mensal de cliques"] },
  { nome: "Matéria Patrocinada", preco: "R$ 290/unid.", itens: ["Publieditorial escrito pela redação", "Post no Instagram do portal", "Marcado como conteúdo patrocinado"] },
  { nome: "Combo Mensal", preco: "R$ 690/mês", itens: ["Banner Destaque", "2 matérias patrocinadas", "4 stories no Instagram"] },
];

export default function Anuncie() {
  const contato = site.whatsappComercial
    ? `https://wa.me/${site.whatsappComercial}?text=${encodeURIComponent(`Olá! Quero anunciar no ${site.nome}.`)}`
    : `mailto:${site.emailComercial}`;
  return (
    <PaginaTexto titulo="Anuncie no portal">
      <p>
        O {site.nome} fala todos os dias com quem mora, trabalha e consome em Santa Maria. Coloque sua marca na frente
        desse público, no site e no Instagram.
      </p>
      <div className="not-prose my-8 grid gap-4 sm:grid-cols-3">
        {planos.map((p) => (
          <div key={p.nome} className="rounded-sm border border-borda p-5 text-base">
            <p className="font-bold">{p.nome}</p>
            <p className="mt-1 text-2xl font-extrabold text-marca">{p.preco}</p>
            <ul className="mt-3 space-y-1 text-sm text-texto-suave">
              {p.itens.map((i) => (
                <li key={i}>✓ {i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p>
        <a href={contato}>Fale com o comercial</a> e peça o mídia kit com os números atualizados de audiência.
      </p>
    </PaginaTexto>
  );
}
