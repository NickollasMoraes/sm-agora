"use client";

import { useEffect } from "react";
import Link from "next/link";
import { site } from "@/lib/config";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type Props = {
  slot?: string; // ID do bloco criado no painel do AdSense
  formato?: "horizontal" | "retangulo";
};

// Espaço publicitário. Sem AdSense configurado, mostra um convite para anunciantes locais.
export function Anuncio({ slot, formato = "horizontal" }: Props) {
  const ativo = Boolean(site.adsenseClient && slot);

  useEffect(() => {
    if (!ativo) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // bloqueador de anúncios ou script ainda carregando
    }
  }, [ativo]);

  const altura = formato === "horizontal" ? "min-h-[100px]" : "min-h-[250px]";

  return (
    <aside aria-label="Publicidade" className="my-8">
      <p className="mb-1 text-center text-xs text-texto-suave">Publicidade</p>
      {ativo ? (
        <ins
          className={`adsbygoogle block ${altura}`}
          data-ad-client={site.adsenseClient}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : (
        <Link
          href="/anuncie/"
          className={`grid ${altura} place-items-center rounded-sm border border-dashed border-borda bg-fundo-suave px-4 text-center text-sm text-texto-suave hover:border-marca hover:text-texto`}
        >
          <span>
            <strong className="block text-texto">Sua empresa aqui</strong>
            Anuncie para quem vive em Santa Maria
          </span>
        </Link>
      )}
    </aside>
  );
}
