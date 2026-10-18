"use client";

import { useEffect, useState } from "react";

// Previsão do tempo de Santa Maria (RS) direto do navegador do leitor, via Open-Meteo
// (grátis, sem chave). Licença dos dados: CC BY 4.0, por isso o crédito no card.
// Atenção: o plano gratuito do Open-Meteo é para uso não comercial. Quando o portal
// tiver receita, assine o plano deles ou troque a fonte aqui.

const URL_API =
  "https://api.open-meteo.com/v1/forecast?latitude=-29.6842&longitude=-53.8069" +
  "&current=temperature_2m,weather_code,is_day" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
  "&timezone=America%2FSao_Paulo&forecast_days=4";

const CHAVE_CACHE = "sm-tempo-v1";
const VALIDADE = 30 * 60_000;

type Dados = {
  atual: { temp: number; codigo: number; dia: boolean };
  dias: { data: string; codigo: number; max: number; min: number; chuva: number }[];
};

// Códigos WMO resumidos
function descrever(codigo: number, dia = true): { icone: string; texto: string } {
  if (codigo === 0) return { icone: dia ? "☀️" : "🌙", texto: "Céu limpo" };
  if (codigo <= 2) return { icone: dia ? "🌤️" : "🌙", texto: "Poucas nuvens" };
  if (codigo === 3) return { icone: "☁️", texto: "Nublado" };
  if (codigo <= 48) return { icone: "🌫️", texto: "Neblina" };
  if (codigo <= 57) return { icone: "🌦️", texto: "Garoa" };
  if (codigo <= 67) return { icone: "🌧️", texto: "Chuva" };
  if (codigo <= 77) return { icone: "🌨️", texto: "Neve" };
  if (codigo <= 82) return { icone: "🌧️", texto: "Pancadas de chuva" };
  return { icone: "⛈️", texto: "Temporal" };
}

function lerCache(): Dados | null {
  try {
    const bruto = localStorage.getItem(CHAVE_CACHE);
    if (!bruto) return null;
    const { quando, dados } = JSON.parse(bruto);
    return Date.now() - quando < VALIDADE ? dados : null;
  } catch {
    return null;
  }
}

function useTempo(): Dados | null {
  const [dados, setDados] = useState<Dados | null>(null);
  useEffect(() => {
    const cache = lerCache();
    if (cache) {
      setDados(cache);
      return;
    }
    fetch(URL_API)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        const d: Dados = {
          atual: { temp: j.current.temperature_2m, codigo: j.current.weather_code, dia: j.current.is_day === 1 },
          dias: j.daily.time.map((data: string, i: number) => ({
            data,
            codigo: j.daily.weather_code[i],
            max: j.daily.temperature_2m_max[i],
            min: j.daily.temperature_2m_min[i],
            chuva: j.daily.precipitation_probability_max[i] ?? 0,
          })),
        };
        setDados(d);
        try {
          localStorage.setItem(CHAVE_CACHE, JSON.stringify({ quando: Date.now(), dados: d }));
        } catch {
          // navegação privada: segue sem cache
        }
      })
      .catch(() => {});
  }, []);
  return dados;
}

const graus = (n: number) => `${Math.round(n)}°`;
const diaDaSemana = (iso: string, i: number) =>
  i === 0
    ? "Hoje"
    : new Date(`${iso}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" }).replace(".", "");

// Versão compacta, para a faixa do topo
export function TempoTopo() {
  const d = useTempo();
  if (!d) return <span className="tabular-nums opacity-0">--°</span>;
  const { icone, texto } = descrever(d.atual.codigo, d.atual.dia);
  const hoje = d.dias[0];
  return (
    <span className="tabular-nums" title={`${texto} em Santa Maria agora`}>
      <span aria-hidden>{icone}</span> {graus(d.atual.temp)}
      <span className="hidden sm:inline text-white/60">
        {" "}
        (máx. {graus(hoje.max)}, mín. {graus(hoje.min)})
      </span>
    </span>
  );
}

// Card completo, para a coluna lateral da página inicial
export function TempoCard() {
  const d = useTempo();
  return (
    <section aria-labelledby="tempo-titulo" className="rounded-sm border border-borda p-4">
      <h2 id="tempo-titulo" className="font-serif text-lg font-bold">
        Tempo em Santa Maria
      </h2>
      {!d ? (
        <p className="mt-3 h-[132px] text-sm text-texto-suave">Carregando a previsão…</p>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-4xl" aria-hidden>
              {descrever(d.atual.codigo, d.atual.dia).icone}
            </span>
            <div>
              <p className="text-3xl font-bold tabular-nums leading-none">{graus(d.atual.temp)}</p>
              <p className="text-sm text-texto-suave">{descrever(d.atual.codigo, d.atual.dia).texto} agora</p>
            </div>
          </div>
          <ul className="mt-4 grid grid-cols-4 gap-1 text-center text-sm">
            {d.dias.map((dia, i) => {
              const { icone, texto } = descrever(dia.codigo);
              return (
                <li key={dia.data} title={texto}>
                  <p className="font-semibold capitalize">{diaDaSemana(dia.data, i)}</p>
                  <p className="text-xl" aria-label={texto}>
                    {icone}
                  </p>
                  <p className="tabular-nums">
                    {graus(dia.max)} <span className="text-texto-suave">{graus(dia.min)}</span>
                  </p>
                  <p className="text-xs tabular-nums text-texto-suave">💧{dia.chuva}%</p>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="mt-3 text-[11px] text-texto-suave">
        Dados:{" "}
        <a href="https://open-meteo.com/" target="_blank" rel="noopener" className="underline">
          Open-Meteo
        </a>
      </p>
    </section>
  );
}
