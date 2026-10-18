import { site } from "@/lib/config";

// Convite para o canal de WhatsApp. Só aparece quando o link do canal estiver configurado.

export function BotaoCanalWhatsApp({ className = "" }: { className?: string }) {
  if (!site.whatsappCanal) return null;
  return (
    <a
      href={site.whatsappCanal}
      target="_blank"
      rel="noopener"
      className={`inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1ebe5b] ${className}`}
    >
      Canal no WhatsApp
    </a>
  );
}

export function ChamadaCanalWhatsApp() {
  if (!site.whatsappCanal) return null;
  return (
    <aside className="mt-8 flex flex-col items-start gap-3 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">Receba as notícias de {site.cidade} no WhatsApp</p>
        <p className="text-sm text-texto-suave">Grátis, sem grupo e sem spam. Só as principais do dia.</p>
      </div>
      <BotaoCanalWhatsApp className="shrink-0" />
    </aside>
  );
}
