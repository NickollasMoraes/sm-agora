import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Anuncio } from "@/components/Anuncio";
import { ChamadaCanalWhatsApp } from "@/components/CanalWhatsApp";
import { CardNoticia, Selo } from "@/components/CardNoticia";
import { caminhoAsset, categoriaPorSlug, site } from "@/lib/config";
import { formatarDataHora, noticiaPorSlug, relacionadas, todasNoticias } from "@/lib/noticias";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return todasNoticias().map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const n = noticiaPorSlug((await params).slug);
  if (!n) return {};
  const url = `${site.url}/noticia/${n.slug}/`;
  return {
    title: n.titulo,
    description: n.subtitulo,
    keywords: n.tags,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: n.titulo,
      description: n.subtitulo,
      publishedTime: n.data,
      modifiedTime: n.atualizado ?? n.data,
      section: categoriaPorSlug(n.categoria).nome,
      images: [{ url: caminhoAsset(n.imagem), alt: n.imagemAlt }],
    },
  };
}

export default async function PaginaNoticia({ params }: Params) {
  const n = noticiaPorSlug((await params).slug);
  if (!n) notFound();
  const outras = relacionadas(n);
  const urlCompartilhar = encodeURIComponent(`${site.url}/noticia/${n.slug}/`);
  const textoCompartilhar = encodeURIComponent(n.titulo);

  // Dados estruturados para o Google Notícias
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: n.titulo,
    description: n.subtitulo,
    image: [new URL(caminhoAsset(n.imagem), site.url).toString()],
    datePublished: n.data,
    dateModified: n.atualizado ?? n.data,
    author: { "@type": "Organization", name: `Redação ${site.nome}`, url: `${site.url}/sobre/` },
    publisher: {
      "@type": "NewsMediaOrganization",
      name: site.nome,
      url: `${site.url}/`,
      logo: { "@type": "ImageObject", url: new URL(caminhoAsset(site.logo), site.url).toString() },
    },
    mainEntityOfPage: `${site.url}/noticia/${n.slug}/`,
    articleSection: categoriaPorSlug(n.categoria).nome,
    keywords: n.tags.join(", "),
    inLanguage: "pt-BR",
    isAccessibleForFree: true,
    contentLocation: { "@type": "Place", name: `${site.cidade}, ${site.estado}` },
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href={`/categoria/${n.categoria}/`}>
        <Selo categoria={n.categoria} />
      </Link>
      <h1 className="mt-2 font-serif text-3xl font-extrabold leading-tight sm:text-5xl">{n.titulo}</h1>
      {n.subtitulo && <p className="mt-4 text-xl text-texto-suave">{n.subtitulo}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-borda py-3 text-sm text-texto-suave">
        <Link href="/sobre/" className="underline">Redação {site.nome}</Link>
        <time dateTime={n.data}>{formatarDataHora(n.data)}</time>
        {n.atualizado && <span>Atualizado em {formatarDataHora(n.atualizado)}</span>}
        <span>{n.tempoLeitura} min de leitura</span>
        <span className="ml-auto flex gap-2">
          <a
            className="rounded-full bg-[#25D366] px-3 py-1 text-xs font-semibold text-white"
            href={`https://wa.me/?text=${textoCompartilhar}%20${urlCompartilhar}`}
            target="_blank"
            rel="noopener"
          >
            WhatsApp
          </a>
          <a
            className="rounded-full bg-[#1877F2] px-3 py-1 text-xs font-semibold text-white"
            href={`https://www.facebook.com/sharer/sharer.php?u=${urlCompartilhar}`}
            target="_blank"
            rel="noopener"
          >
            Facebook
          </a>
        </span>
      </div>

      <figure className="mt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="relative">
          <img src={caminhoAsset(n.imagem)} alt={n.imagemAlt} className="w-full rounded-lg object-cover" />
          {n.imagemIlustrativa && (
            <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white">Imagem meramente ilustrativa</span>
          )}
        </div>
        {n.credito && (
          <figcaption className="mt-2 text-xs text-texto-suave">
            {n.imagemIlustrativa ? (
              `${n.imagemAlt} · Imagem meramente ilustrativa`
            ) : (
              <>
                {`${n.imagemAlt} · Foto: `}
                {n.credito.fonte ? <a href={n.credito.fonte} target="_blank" rel="noopener" className="underline">{n.credito.autor}</a> : n.credito.autor}
                {` (${n.credito.licenca})`}
              </>
            )}
          </figcaption>
        )}
      </figure>

      <div className="materia mt-8" dangerouslySetInnerHTML={{ __html: n.html }} />

      <ChamadaCanalWhatsApp />

      {n.fontes.length > 0 && (
        <aside className="mt-8 rounded-lg bg-fundo-suave p-4 text-sm">
          <p className="font-semibold">Fontes</p>
          <ul className="mt-1 list-disc pl-5 text-texto-suave">
            {n.fontes.map((f) => (
              <li key={f.url}>
                <a href={f.url} target="_blank" rel="noopener nofollow" className="underline">
                  {f.nome}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {n.tags.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {n.tags.map((t) => (
            <li key={t} className="rounded-full border border-borda px-3 py-1 text-xs text-texto-suave">
              #{t}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-texto-suave">
        Encontrou um erro? <Link href="/contato/" className="underline">Fale com a redação</Link>.
      </p>

      <Anuncio slot="" />

      {outras.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 border-b-2 border-texto pb-1 font-serif text-xl font-bold">
            Leia também
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {outras.map((o) => (
              <CardNoticia key={o.slug} noticia={o} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
