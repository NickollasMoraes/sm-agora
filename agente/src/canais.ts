import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export type NomeCanal = keyof Canais;

export type Canais = {
  site: boolean;
  instagramFeed: boolean;
  instagramReels: boolean;
  instagramStories: boolean;
  facebookFeed: boolean;
  facebookReels: boolean;
  facebookStories: boolean;
  youtubeShorts: boolean;
};

export type ConfiguracaoCanais = {
  redator: "codex" | "claude";
  palavrasMinimas: number;
  canais: Canais;
};

const padrao: ConfiguracaoCanais = {
  redator: "codex",
  palavrasMinimas: 800,
  canais: {
    site: true,
    instagramFeed: true,
    instagramReels: true,
    instagramStories: true,
    facebookFeed: false,
    facebookReels: false,
    facebookStories: false,
    youtubeShorts: false,
  },
};

const arquivo = path.join(config.pastas.dados, "canais.json");

export function lerCanais(): ConfiguracaoCanais {
  let salvo: Partial<ConfiguracaoCanais> = {};
  try {
    salvo = JSON.parse(fs.readFileSync(arquivo, "utf8")) as Partial<ConfiguracaoCanais>;
  } catch {
    if (!fs.existsSync(arquivo)) {
      try {
        fs.mkdirSync(config.pastas.dados, { recursive: true });
        fs.writeFileSync(arquivo, JSON.stringify(padrao, null, 2));
      } catch {
        // Padrões continuam válidos se o arquivo não puder ser criado.
      }
    }
  }
  const canais = { ...padrao.canais, ...(salvo.canais ?? {}) };
  if (process.env.REELS_MATERIAS === "false") canais.instagramReels = false;
  return {
    redator: salvo.redator === "claude" ? "claude" : salvo.redator === "codex" ? "codex" : config.redator,
    palavrasMinimas: Number(salvo.palavrasMinimas) || padrao.palavrasMinimas,
    canais,
  };
}
