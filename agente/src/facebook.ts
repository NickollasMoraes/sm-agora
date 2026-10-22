import { config } from "./config.js";

const API = "https://graph.facebook.com/v21.0";

export const facebookConfigurado = () => Boolean(config.facebookPageId && config.facebookPageToken);

function exigirConfiguracao(): void {
  if (!config.facebookPageId) throw new Error("falta FACEBOOK_PAGE_ID");
  if (!config.facebookPageToken) throw new Error("falta FACEBOOK_PAGE_TOKEN");
}

async function chamar(caminho: string, dados: Record<string, string>): Promise<Record<string, string>> {
  exigirConfiguracao();
  const resposta = await fetch(`${API}/${caminho}`, {
    method: "POST",
    body: new URLSearchParams({ ...dados, access_token: config.facebookPageToken }),
  });
  const json = (await resposta.json()) as { id?: string; post_id?: string; error?: { message?: string } };
  if (!resposta.ok || (!json.id && !json.post_id)) throw new Error(`Facebook: ${json.error?.message ?? resposta.status}`);
  return { id: json.id ?? json.post_id ?? "" };
}

export async function postarFacebookFeed(urlImagem: string, legenda: string): Promise<string> {
  return (await chamar(`${config.facebookPageId}/photos`, { url: urlImagem, caption: legenda })).id;
}

export async function postarFacebookReels(urlVideo: string, legenda: string): Promise<string> {
  const caminho = `${config.facebookPageId}/video_reels`;
  const inicio = await chamar(caminho, { upload_phase: "start" });
  // O envio do vídeo vai para o servidor de upload, não para a Graph API.
  const upload = await fetch(`https://rupload.facebook.com/video-upload/v21.0/${inicio.id}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${config.facebookPageToken}`, file_url: urlVideo },
  });
  const enviado = (await upload.json()) as { success?: boolean; error?: { message?: string } };
  if (!upload.ok || !enviado.success) throw new Error(`Facebook Reels: ${enviado.error?.message ?? upload.status}`);
  const fim = { upload_phase: "finish", video_id: inicio.id, description: legenda, video_state: "PUBLISHED" };
  await chamar(caminho, fim);
  return inicio.id;
}

export async function postarFacebookStory(urlImagem: string): Promise<string> {
  const foto = await chamar(`${config.facebookPageId}/photos`, { url: urlImagem, published: "false" });
  return (await chamar(`${config.facebookPageId}/photo_stories`, { photo_id: foto.id })).id;
}
