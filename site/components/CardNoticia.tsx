import Link from "next/link";
import { caminhoAsset, categoriaPorSlug } from "@/lib/config";
import { formatarData, type Noticia } from "@/lib/noticias";

export function Selo({ categoria }: { categoria: string }) {
  const c = categoriaPorSlug(categoria);
  return (
    <span className="text-[13px] font-bold" style={{ color: c.cor }}>
      {c.nome}
    </span>
  );
}

type Props = { noticia: Noticia; variante?: "grande" | "padrao" | "compacto" };

export function CardNoticia({ noticia, variante = "padrao" }: Props) {
  const link = `/noticia/${noticia.slug}/`;
  const seloImagem = noticia.imagemIlustrativa && (
    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">Ilustrativa</span>
  );

  if (variante === "compacto") {
    return (
      <article className="flex gap-3 border-b border-borda py-3 last:border-0">
        <Link href={link} className="relative block shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={caminhoAsset(noticia.imagem)}
            alt={noticia.imagemAlt}
            loading="lazy"
            className="h-16 w-24 rounded object-cover"
          />
          {seloImagem}
        </Link>
        <div>
          <Selo categoria={noticia.categoria} />
          <h3 className="mt-0.5 text-sm font-semibold leading-snug">
            <Link href={link} className="hover:text-marca">
              {noticia.titulo}
            </Link>
          </h3>
        </div>
      </article>
    );
  }

  const grande = variante === "grande";
  return (
    <article className="group">
      <Link href={link} className="relative block overflow-hidden rounded-sm bg-fundo-suave">        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={caminhoAsset(noticia.imagem)}
          alt={noticia.imagemAlt}
          loading={grande ? "eager" : "lazy"}
          className={`w-full object-cover transition duration-300 group-hover:scale-[1.03] ${
            grande ? "aspect-[16/9]" : "aspect-[3/2]"
          }`}
        />
        {seloImagem}
      </Link>
      <div className="mt-3">
        <Selo categoria={noticia.categoria} />
        <h2
          className={`mt-1 font-serif font-bold leading-tight ${
            grande ? "text-3xl sm:text-4xl" : "text-xl"
          }`}
        >
          <Link href={link} className="hover:text-marca">
            {noticia.titulo}
          </Link>
        </h2>
        {noticia.subtitulo && (
          <p className={`mt-2 text-texto-suave ${grande ? "text-lg" : "line-clamp-2 text-sm"}`}>
            {noticia.subtitulo}
          </p>
        )}
        <p className="mt-2 text-xs text-texto-suave">{formatarData(noticia.data)}</p>
      </div>
    </article>
  );
}
