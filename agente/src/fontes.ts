// Fontes monitoradas. Para adicionar uma, inclua um item aqui e rode "npm run testar-fontes".
//
// tipo "rss":    feed RSS/Atom. Mais confiável.
// tipo "pagina": página de listagem de notícias; o agente coleta os links que casam com "padraoLink".
// filtrarLocal:  true quando a fonte é estadual/nacional e só interessam itens que citem Santa Maria.

export type Fonte = {
  nome: string;
  tipo: "rss" | "pagina";
  url: string;
  padraoLink?: string; // regex (só para tipo "pagina")
  filtrarLocal?: boolean;
  ativa?: boolean;
};

export const fontes: Fonte[] = [
  // Oficiais de Santa Maria
  {
    nome: "Prefeitura de Santa Maria",
    tipo: "pagina",
    url: "https://www.santamaria.rs.gov.br/noticias",
    padraoLink: "/noticias/\\d+",
    // A página monta a lista via JavaScript; as notícias dela chegam pelo Google Notícias.
    ativa: false,
  },
  { nome: "UFSM", tipo: "rss", url: "https://www.ufsm.br/feed" },
  {
    nome: "Câmara de Vereadores de Santa Maria",
    tipo: "pagina",
    url: "https://www.camara-sm.rs.gov.br/noticias",
    padraoLink: "/noticias?/",
  },
  // Imprensa local e regional
  { nome: "Diário de Santa Maria", tipo: "pagina", url: "https://diariosm.com.br", padraoLink: "\\.\\d{6,}$" },
  // Estaduais / nacionais, filtradas por menções a Santa Maria
  {
    nome: "Agência Brasil",
    tipo: "rss",
    url: "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml",
    filtrarLocal: true,
  },
  // Busca do Google Notícias (serve para descobrir pautas; o texto vem da fonte original)
  {
    nome: "Google Notícias",
    tipo: "rss",
    url: "https://news.google.com/rss/search?q=%22Santa+Maria%22+RS+when:2d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  },
];

// Termos que indicam que o assunto é de Santa Maria ou região.
export const termosLocais = [
  "santa maria",
  "ufsm",
  "região central",
  "camobi",
  "itaara",
  "silveira martins",
  "são sepé",
  "restinga sêca",
  "formigueiro",
  "dilermando de aguiar",
  "são martinho da serra",
];
