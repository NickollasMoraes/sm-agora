import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));

function obrigatoria(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`Falta a variável ${nome} no arquivo agente/.env (veja .env.example).`);
  return v;
}

export const config = {
  telegramToken: obrigatoria("TELEGRAM_BOT_TOKEN"),
  // Vazio no primeiro uso: mande /start para o bot e ele responde com o número do chat.
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",

  modelo: process.env.MODELO_IA || "claude-opus-5-5",
  // A triagem roda a cada 30 min; um modelo mais barato aqui reduz bastante o custo.
  modeloTriagem: process.env.MODELO_TRIAGEM || process.env.MODELO_IA || "claude-opus-5-5",

  // Coleta
  cronColeta: process.env.CRON_COLETA ?? "*/30 6-23 * * *", // a cada 30 min, das 6h às 23h
  notaMinima: Number(process.env.NOTA_MINIMA ?? 6),
  maxPautasPorRodada: Number(process.env.MAX_PAUTAS_POR_RODADA ?? 8),

  // Imagens (opcional: sem chave, usa só Wikimedia Commons)
  pexelsKey: process.env.PEXELS_API_KEY ?? "",

  // Instagram (opcional: sem isso, o bot manda a arte pronta para você postar)
  igUserId: process.env.INSTAGRAM_USER_ID ?? "",
  igToken: process.env.INSTAGRAM_ACCESS_TOKEN ?? "",

  siteUrl: (process.env.SITE_URL ?? "https://smagora.com.br").replace(/\/$/, ""),
  siteNome: process.env.SITE_NOME ?? "SM Agora",
  instagramArroba: process.env.INSTAGRAM_ARROBA ?? "smagora",
  gitPush: (process.env.GIT_PUSH ?? "true") === "true",

  pastas: {
    raiz: path.resolve(aqui, "..", ".."),
    dados: path.resolve(aqui, "..", "data"),
    noticias: path.resolve(aqui, "..", "..", "site", "content", "noticias"),
    imagens: path.resolve(aqui, "..", "..", "site", "public", "imagens", "noticias"),
    artes: path.resolve(aqui, "..", "..", "site", "public", "imagens", "instagram"),
  },
};

export const categorias = [
  "cidade",
  "seguranca",
  "politica",
  "educacao",
  "saude",
  "economia",
  "esporte",
  "cultura",
  "clima",
] as const;

export const nomesCategorias: Record<string, string> = {
  cidade: "Cidade",
  seguranca: "Segurança",
  politica: "Política",
  educacao: "Educação",
  saude: "Saúde",
  economia: "Economia",
  esporte: "Esporte",
  cultura: "Cultura",
  clima: "Tempo",
};
