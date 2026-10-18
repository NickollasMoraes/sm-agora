import type { Metadata } from "next";
import { Anuncio } from "@/components/Anuncio";
import { CardNoticia } from "@/components/CardNoticia";
import { categoriaPorSlug, categorias } from "@/lib/config";
import { noticiasDaCategoria } from "@/lib/noticias";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return categorias.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const c = categoriaPorSlug((await params).slug);
  return { title: `${c.nome} em Santa Maria`, description: `Últimas notícias de ${c.nome.toLowerCase()} em Santa Maria (RS).` };
}

export default async function PaginaCategoria({ params }: Params) {
  const c = categoriaPorSlug((await params).slug);
  const noticias = noticiasDaCategoria(c.slug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="border-b-4 pb-2 font-serif text-4xl font-extrabold" style={{ borderColor: c.cor }}>
        {c.nome}
      </h1>
      {noticias.length === 0 ? (
        <p className="py-16 text-center text-texto-suave">Ainda não há notícias nesta editoria.</p>
      ) : (
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {noticias.map((n, i) => (
            <div key={n.slug} className={i === 0 ? "sm:col-span-2" : ""}>
              <CardNoticia noticia={n} variante={i === 0 ? "grande" : "padrao"} />
            </div>
          ))}
        </div>
      )}
      <Anuncio slot="" />
    </div>
  );
}
