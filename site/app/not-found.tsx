import Link from "next/link";
import { site } from "@/lib/config";

export default function NotFound() {
  return <div className="mx-auto max-w-3xl px-4 py-24 text-center"><p className="text-6xl font-extrabold text-marca">404</p><h1 className="mt-4 font-serif text-3xl font-bold">Página não encontrada</h1><p className="mt-3 text-texto-suave">O endereço pode ter mudado ou não existe no {site.nome}.</p><div className="mt-8 flex justify-center gap-4"><Link href="/" className="rounded bg-marca px-4 py-2 font-semibold text-white">Ir para a capa</Link><Link href="/contato/" className="rounded border border-borda px-4 py-2">Falar com a redação</Link></div></div>;
}
