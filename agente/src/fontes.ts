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
  // Política nacional: entra no máximo MAX_NACIONAIS_POR_RODADA por coleta,
  // para não tirar o foco de Santa Maria.
  nacional?: boolean;
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
  // RS: RBS TV Santa Maria publica no G1 RS (só o que cita a região)
  { nome: "G1 RS", tipo: "rss", url: "https://g1.globo.com/rss/g1/rs/rio-grande-do-sul/", filtrarLocal: true },
  // Busca do Google Notícias (serve para descobrir pautas; o texto vem da fonte original)
  {
    nome: "Google Notícias",
    tipo: "rss",
    url: "https://news.google.com/rss/search?q=%22Santa+Maria%22+RS+when:2d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
    // A busca às vezes traz outras cidades (Vitória da Conquista, RJ): só fica o que cita a região.
    filtrarLocal: true,
  },
  {
    nome: "Google Notícias · Trânsito",
    tipo: "rss",
    url: "https://news.google.com/rss/search?q=%22Santa+Maria%22+RS+(tr%C3%A2nsito+OR+acidente+OR+rodovia+OR+BR-287+OR+BR-158+OR+BR-392+OR+RSC-287)+when:2d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
    // A busca às vezes traz outras cidades (Vitória da Conquista, RJ): só fica o que cita a região.
    filtrarLocal: true,
  },
  {
    nome: "Google Notícias · Região Central",
    tipo: "rss",
    url: "https://news.google.com/rss/search?q=(%22Regi%C3%A3o+Central%22+OR+Itaara+OR+%22S%C3%A3o+Sep%C3%A9%22+OR+%22Silveira+Martins%22+OR+%22Restinga+S%C3%AAca%22+OR+Formigueiro)+RS+when:2d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
    // A busca às vezes traz outras cidades (Vitória da Conquista, RJ): só fica o que cita a região.
    filtrarLocal: true,
  },
  // Política nacional (fontes públicas ou de referência; limitadas por rodada)
  { nome: "Agência Brasil · Política", tipo: "rss", url: "https://agenciabrasil.ebc.com.br/rss/politica/feed.xml", nacional: true },
  { nome: "Agência Senado", tipo: "rss", url: "https://www12.senado.leg.br/noticias/feed/todasnoticias/RSS", nacional: true },
  { nome: "Agência Câmara", tipo: "rss", url: "https://www.camara.leg.br/noticias/rss/ultimas-noticias", nacional: true },
  { nome: "G1 Política", tipo: "rss", url: "https://g1.globo.com/rss/g1/politica/", nacional: true },
  { nome: "Poder360", tipo: "rss", url: "https://www.poder360.com.br/feed/", nacional: true },
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
