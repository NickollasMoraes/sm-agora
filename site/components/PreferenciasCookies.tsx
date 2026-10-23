"use client";

export function PreferenciasCookies() {
  return <button type="button" onClick={() => window.dispatchEvent(new Event("abrir-preferencias-cookies"))} className="hover:text-white">Preferências de cookies</button>;
}
