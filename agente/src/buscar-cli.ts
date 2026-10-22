import { Bot } from "grammy";
import { config } from "./config.js";
import { buscarTema } from "./buscar.js";

const tema = process.argv.slice(2).join(" ").trim();
if (!tema) throw new Error('Uso: npm run buscar -- "tema"');
const bot = new Bot(config.telegramToken);
await buscarTema(tema, bot);
