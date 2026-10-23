import Link from "next/link";
import { categorias, site } from "@/lib/config";
import { noticiasDaCategoria } from "@/lib/noticias";
import { TempoTopo } from "@/components/Tempo";

function dataDeHoje() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

export function Cabecalho() {
  return (
    <>
      <div className="bg-tinta text-[13px] text-white/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-1.5">
          <span className="first-letter:uppercase">{dataDeHoje()}</span>
          <span className="hidden sm:inline">
            Santa Maria, coração do Rio Grande
          </span>
          <span className="flex items-center gap-4">
            <TempoTopo />
            <a href={`https://instagram.com/${site.instagram}`} className="hidden hover:text-white sm:inline">
              @{site.instagram}
            </a>
            {site.whatsappCanal && (
              <a href={site.whatsappCanal} target="_blank" rel="noopener" className="hidden hover:text-white sm:inline">
                WhatsApp
              </a>
            )}
          </span>
        </div>
      </div>
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/" className="flex items-baseline gap-1.5" aria-label={`${site.nome}, página inicial`}>
            <span className="font-serif text-[1.9rem] font-extrabold leading-none tracking-tight">
              SM<span className="text-marca">.</span>Agora
            </span>
          </Link>
          <nav aria-label="Editorias" className="min-w-0 flex-1">
            <ul className="flex gap-0.5 overflow-x-auto text-[15px] font-semibold [scrollbar-width:none]">
              {categorias.filter((c) => noticiasDaCategoria(c.slug).length > 0).map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/categoria/${c.slug}/`}
                    className="block whitespace-nowrap border-b-2 border-transparent px-2.5 py-2 text-texto-suave transition hover:border-marca hover:text-texto"
                  >
                    {c.nome}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
    </>
  );
}
