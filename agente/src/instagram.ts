import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

// Publicação automática pela API oficial do Instagram.
// Funciona com os dois tipos de token da Meta:
// - "Login do Instagram" (começa com IG...): só precisa de conta Profissional, sem Página do Facebook
// - "Login do Facebook" (começa com EA...): conta Profissional ligada a uma Página do Facebook
// A API só aceita imagem por URL pública, por isso esperamos o site terminar o deploy.

const API = config.igToken.startsWith("IG") ? "https://graph.instagram.com/v21.0" : "https://graph.facebook.com/v21.0";

export const instagramConfigurado = () => Boolean(config.igToken);

// Tokens do Login do Instagram valem 60 dias. Renovamos toda semana e gravamos no .env,
// assim o agente nunca perde o acesso enquanto estiver rodando.
export async function renovarToken(): Promise<void> {
  if (!config.igToken.startsWith("IG")) return;
  const r = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${config.igToken}`,
  );
  const dados = (await r.json()) as { access_token?: string; expires_in?: number; error?: { message: string } };
  if (!dados.access_token) throw new Error(`Instagram: não consegui renovar o token (${dados.error?.message ?? r.status})`);
  const arquivo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");
  const env = fs.readFileSync(arquivo, "utf8").replace(/^INSTAGRAM_ACCESS_TOKEN=.*$/m, `INSTAGRAM_ACCESS_TOKEN=${dados.access_token}`);
  fs.writeFileSync(arquivo, env);
  config.igToken = dados.access_token;
  console.log(`[instagram] token renovado (vale mais ${Math.round((dados.expires_in ?? 0) / 86400)} dias)`);
}

let idConta = config.igUserId;
async function contaId(): Promise<string> {
  if (idConta) return idConta;
  // Sem INSTAGRAM_USER_ID: descobre pela própria conta do token (Login do Instagram)
  const r = await fetch(`${API}/me?fields=user_id,username&access_token=${config.igToken}`);
  const dados = (await r.json()) as { user_id?: string; id?: string; error?: { message: string } };
  idConta = dados.user_id ?? dados.id ?? "";
  if (!idConta) throw new Error(`Instagram: não consegui identificar a conta (${dados.error?.message ?? r.status})`);
  return idConta;
}

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
  const container = await chamar(`${await contaId()}/media`, { image_url: urlImagem, caption: legenda });

  // Aguarda o Instagram processar a imagem
  for (let i = 0; i < 12; i++) {
    const r = await fetch(`${API}/${container}?fields=status_code&access_token=${config.igToken}`);
    const { status_code } = (await r.json()) as { status_code?: string };
    if (status_code === "FINISHED") break;
    if (status_code === "ERROR") throw new Error("Instagram recusou a imagem.");
    await esperar(5000);
  }
  return chamar(`${await contaId()}/media_publish`, { creation_id: container });
}
