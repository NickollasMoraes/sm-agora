import Link from "next/link";
import { Anuncio } from "@/components/Anuncio";
import { CardNoticia } from "@/components/CardNoticia";
import { categorias } from "@/lib/config";
import { todasNoticias } from "@/lib/noticias";

export default function Inicio() {
  const noticias = todasNoticias();

  if (noticias.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 text-center text-texto-suave">
        Nenhuma notícia publicada ainda. O agente vai preencher esta página assim que você aprovar a primeira.
      </div>
    );
  }

  const principal = noticias.find((n) => n.destaque) ?? noticias[0];
  const resto = noticias.filter((n) => n.slug !== principal.slug);
  const secundarias = resto.slice(0, 4);
  const maisLidas = resto.slice(4, 9);
  const usadas = new Set([principal.slug, ...secundarias.map((n) => n.slug)]);

  const porCategoria = categorias
    .map((c) => ({ c, itens: noticias.filter((n) => n.categoria === c.slug && !usadas.has(n.slug)).slice(0, 3) }))
    .filter((g) => g.itens.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CardNoticia noticia={principal} variante="grande" />
        </div>
        <div className="space-y-6">
          {secundarias.slice(0, 2).map((n) => (
            <CardNoticia key={n.slug} noticia={n} />
          ))}
        </div>
      </section>

      <Anuncio slot="" />

      <section className="grid gap-8 lg:grid-cols-3">
        <div className="grid gap-8 sm:grid-cols-2 lg:col-span-2">
          {secundarias.slice(2).map((n) => (
            <CardNoticia key={n.slug} noticia={n} />
          ))}
        </div>
        {maisLidas.length > 0 && (
          <aside>
            <h2 className="mb-2 border-b-2 border-texto pb-1 font-serif text-xl font-bold">
              Mais recentes
            </h2>
            {maisLidas.map((n) => (
              <CardNoticia key={n.slug} noticia={n} variante="compacto" />
            ))}
          </aside>
        )}
      </section>

      {porCategoria.map(({ c, itens }) => (
        <section key={c.slug} className="mt-14">
          <div className="mb-4 flex items-end justify-between border-b border-borda pb-2">
            <h2 className="font-serif text-2xl font-bold" style={{ color: c.cor }}>
              {c.nome}
            </h2>
            <Link href={`/categoria/${c.slug}/`} className="text-sm font-medium text-texto-suave hover:text-marca">
              Ver tudo
            </Link>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {itens.map((n) => (
              <CardNoticia key={n.slug} noticia={n} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
