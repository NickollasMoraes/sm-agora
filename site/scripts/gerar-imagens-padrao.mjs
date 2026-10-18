// Gera as imagens padrão (SVG) de cada editoria, usadas quando a notícia não tem foto.
// Uso: node scripts/gerar-imagens-padrao.mjs
import fs from "node:fs";

const categorias = [
  ["cidade", "Cidade", "#2563eb"],
  ["seguranca", "Segurança", "#dc2626"],
  ["politica", "Política", "#7c3aed"],
  ["educacao", "Educação", "#0891b2"],
  ["saude", "Saúde", "#059669"],
  ["economia", "Economia", "#d97706"],
  ["esporte", "Esporte", "#16a34a"],
  ["cultura", "Cultura e Lazer", "#db2777"],
  ["clima", "Tempo", "#0284c7"],
];

fs.mkdirSync("public/imagens/padrao", { recursive: true });
for (const [slug, nome, cor] of categorias) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cor}"/><stop offset="1" stop-color="#111827"/></linearGradient></defs>
<rect width="1200" height="675" fill="url(#g)"/>
<circle cx="1050" cy="120" r="260" fill="#fff" opacity=".06"/><circle cx="150" cy="620" r="200" fill="#fff" opacity=".05"/>
<text x="600" y="330" text-anchor="middle" font-family="Georgia,serif" font-size="96" font-weight="800" fill="#fff">${nome}</text>
<text x="600" y="400" text-anchor="middle" font-family="Arial,sans-serif" font-size="36" fill="#fff" opacity=".8">Santa Maria, RS</text>
</svg>`;
  fs.writeFileSync(`public/imagens/padrao/${slug}.svg`, svg);
}
console.log("Imagens padrão geradas.");
