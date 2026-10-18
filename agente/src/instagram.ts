import { config } from "./config.js";

// Publicação automática pela API oficial do Instagram (Graph API).
// Exige conta Profissional ligada a uma Página do Facebook e um token de acesso de longa duração.
// A API só aceita imagem por URL pública, por isso esperamos o site terminar o deploy.

const API = "https://graph.facebook.com/v21.0";

export const instagramConfigurado = () => Boolean(config.igUserId && config.igToken);

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function esperarUrlNoAr(url: string, minutos = 10): Promise<void> {
  const fim = Date.now() + minutos * 60_000;
  while (Date.now() < fim) {
    const r = await fetch(url, { method: "HEAD" }).catch(() => null);
    if (r?.ok) return;
    await esperar(20_000);
  }
  throw new Error(`A imagem não ficou disponível em ${minutos} min (o deploy do site terminou?)`);
}

async function chamar(caminho: string, params: Record<string, string>) {
  const r = await fetch(`${API}/${caminho}`, {
    method: "POST",
    body: new URLSearchParams({ ...params, access_token: config.igToken }),
  });
  const dados = (await r.json()) as { id?: string; error?: { message: string } };
  if (!r.ok || !dados.id) throw new Error(`Instagram: ${dados.error?.message ?? r.status}`);
  return dados.id;
}

export async function postarNoInstagram(urlImagem: string, legenda: string): Promise<string> {
  await esperarUrlNoAr(urlImagem);
  const container = await chamar(`${config.igUserId}/media`, { image_url: urlImagem, caption: legenda });

  // Aguarda o Instagram processar a imagem
  for (let i = 0; i < 12; i++) {
    const r = await fetch(`${API}/${container}?fields=status_code&access_token=${config.igToken}`);
    const { status_code } = (await r.json()) as { status_code?: string };
    if (status_code === "FINISHED") break;
    if (status_code === "ERROR") throw new Error("Instagram recusou a imagem.");
    await esperar(5000);
  }
  return chamar(`${config.igUserId}/media_publish`, { creation_id: container });
}
