import Link from "next/link";
import { BotaoCanalWhatsApp } from "@/components/CanalWhatsApp";
import { categorias, site } from "@/lib/config";
import { noticiasDaCategoria } from "@/lib/noticias";
import { PreferenciasCookies } from "@/components/PreferenciasCookies";

export function Rodape() {
  return (
    <footer className="mt-16 border-t border-borda bg-tinta text-white/90">      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-serif text-xl font-extrabold">{site.nome}</p>
          <p className="mt-2 text-sm text-white/60">{site.descricao}</p>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Editorias</p>
          <ul className="grid grid-cols-2 gap-1 text-sm text-white/60">
            {categorias.filter((c) => noticiasDaCategoria(c.slug).length > 0).map((c) => (
              <li key={c.slug}>
                <Link href={`/categoria/${c.slug}/`} className="hover:text-white">
                  {c.nome}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Institucional</p>
          <ul className="space-y-1 text-sm text-white/60">
            <li><Link href="/sobre/" className="hover:text-white">Quem somos</Link></li>
            <li><Link href="/anuncie/" className="hover:text-white">Anuncie</Link></li>
            <li><Link href="/contato/" className="hover:text-white">Contato e correções</Link></li>
            <li><Link href="/politica-de-privacidade/" className="hover:text-white">Política de privacidade</Link></li>
            <li><Link href="/termos-de-uso/" className="hover:text-white">Termos de uso</Link></li>
            <li><Link href="/politica-editorial/" className="hover:text-white">Política editorial</Link></li>
            <li><PreferenciasCookies /></li>
            <li><a href={`${site.url}/rss.xml`} className="hover:text-white">RSS</a></li>
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Siga</p>
          <a
            href={`https://instagram.com/${site.instagram}`}
            className="inline-flex items-center gap-2 rounded-full bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-escura"
          >
            @{site.instagram} no Instagram
          </a>
          <BotaoCanalWhatsApp className="mt-2" />
        </div>
      </div>
      <p className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/60">
        © {new Date().getFullYear()} {site.nome}. Conteúdo produzido com apoio de inteligência artificial e
        revisado por editor humano. As fontes originais são sempre citadas.
      </p>
    </footer>
  );
}
