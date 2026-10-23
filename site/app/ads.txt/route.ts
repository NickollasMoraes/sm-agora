import { site } from "@/lib/config";

export const dynamic = "force-static";

export function GET() {
  const cliente = site.adsenseClient.replace(/^ca-/, "");
  const texto = cliente ? `google.com, ${cliente}, DIRECT, f08c47fec0942fa0\n` : "# AdSense ainda não configurado.\n";
  return new Response(texto, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
