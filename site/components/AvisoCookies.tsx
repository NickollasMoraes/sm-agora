"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const chave = "sm-agora-consentimento-cookies";

function lerConsentimento(): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null; // navegador bloqueia armazenamento (aba anônima, cookies desligados)
  }
}

function atualizarConsentimento(aceito: boolean) {
  try {
    window.localStorage.setItem(chave, aceito ? "aceito" : "recusado");
  } catch {
    // sem armazenamento a escolha vale só nesta visita
  }
  window.gtag?.("consent", "update", {
    ad_storage: aceito ? "granted" : "denied",
    ad_user_data: aceito ? "granted" : "denied",
    ad_personalization: aceito ? "granted" : "denied",
    analytics_storage: aceito ? "granted" : "denied",
  });
}

declare global {
  interface Window { gtag?: (...args: unknown[]) => void; }
}

export function AvisoCookies() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    setVisivel(!lerConsentimento());
    const abrir = () => setVisivel(true);
    window.addEventListener("abrir-preferencias-cookies", abrir);
    return () => window.removeEventListener("abrir-preferencias-cookies", abrir);
  }, []);

  // A barra fecha aqui mesmo: antes ela só disparava um evento que ninguém ouvia.
  const escolher = (aceito: boolean) => {
    atualizarConsentimento(aceito);
    setVisivel(false);
  };

  if (!visivel) return null;
  return (
    <aside className="fixed inset-x-0 bottom-0 z-50 border-t border-borda bg-fundo p-4 shadow-lg" aria-label="Aviso de cookies">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl">Usamos cookies para segurança, estatísticas e publicidade. Você pode aceitar ou recusar cookies não essenciais. <Link href="/politica-de-privacidade/" className="underline">Saiba mais</Link>.</p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => escolher(false)} className="rounded border border-borda px-3 py-2">Recusar</button>
          <button type="button" onClick={() => escolher(true)} className="rounded bg-marca px-3 py-2 font-semibold text-white">Aceitar</button>
        </div>
      </div>
    </aside>
  );
}
