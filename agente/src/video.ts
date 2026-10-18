import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { seloMarcaDagua } from "./arte.js";

// Vídeos com o ffmpeg (vem junto pelo pacote ffmpeg-static, grátis, roda no PC).
// Saída sempre no formato que o Instagram aceita: MP4, H.264, AAC, 30 fps.

const exec = promisify(execFile);
const ffmpeg: string = createRequire(import.meta.url)("ffmpeg-static");

async function rodar(args: string[]): Promise<void> {
  try {
    await exec(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...args], { maxBuffer: 10 * 1024 * 1024 });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    throw new Error(`ffmpeg: ${(err.stderr || err.message).trim().split("\n").slice(-3).join(" ")}`);
  }
}

function pastaTemp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "smagora-video-"));
}

const SAIDA_H264 = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"];

// Reels de uma matéria: fundo com zoom lento + camada de texto que surge, com faixa de áudio muda.
export async function videoDaMateria(fundo: Buffer, camada: Buffer, segundos = 8): Promise<Buffer> {
  const dir = pastaTemp();
  try {
    const f = path.join(dir, "fundo.jpg");
    const c = path.join(dir, "camada.png");
    const saida = path.join(dir, "reels.mp4");
    fs.writeFileSync(f, fundo);
    fs.writeFileSync(c, camada);
    const quadros = segundos * 30;
    await rodar([
      "-loop", "1", "-i", f,
      "-loop", "1", "-i", c,
      "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-filter_complex",
      // zoompan num fundo em resolução maior evita o "tremido" do zoom
      `[0:v]scale=2160:3840,zoompan=z='min(1+on/${quadros}*0.08,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30[bg];` +
        `[1:v]format=rgba,fade=t=in:st=0.2:d=0.8:alpha=1[txt];[bg][txt]overlay=0:0:shortest=1[v]`,
      "-map", "[v]", "-map", "2:a",
      "-t", String(segundos),
      ...SAIDA_H264,
      saida,
    ]);
    return fs.readFileSync(saida);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Coloca o selo "SM. AGORA" no canto de cima à esquerda (fora da área dos botões do Reels) e padroniza
// o vídeo: 1080 de largura, H.264/AAC. Vídeo sem som ganha faixa muda (o Instagram exige áudio).
export async function marcaDagua(video: Buffer): Promise<Buffer> {
  const dir = pastaTemp();
  try {
    const entrada = path.join(dir, "entrada");
    const selo = path.join(dir, "selo.png");
    const saida = path.join(dir, "saida.mp4");
    fs.writeFileSync(entrada, video);
    fs.writeFileSync(selo, await seloMarcaDagua(200));
    const temAudio = await possuiAudio(entrada);
    await rodar([
      "-i", entrada,
      "-i", selo,
      ...(temAudio ? [] : ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]),
      "-filter_complex",
      // vídeo sempre com 1080 de largura, então o selo de 200 px ocupa ~19% dela
      "[0:v]scale=1080:-2[v0];[v0][1:v]overlay=x=44:y='main_h*0.05'[v]",
      "-map", "[v]", "-map", temAudio ? "0:a:0" : "2:a",
      ...(temAudio ? [] : ["-shortest"]),
      ...SAIDA_H264,
      saida,
    ]);
    return fs.readFileSync(saida);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function possuiAudio(arquivo: string): Promise<boolean> {
  // ffmpeg -i sem saída "falha", mas lista as faixas no stderr
  const r = await exec(ffmpeg, ["-hide_banner", "-i", arquivo]).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));
  return /Stream #.*Audio/.test(r.stderr ?? "");
}
