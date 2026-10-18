// Testa cada fonte e mostra quantos itens ela devolveu e um exemplo de título.
import { lerFonte } from "./coletor.js";
import { fontes } from "./fontes.js";

for (const f of fontes) {
  try {
    const itens = await lerFonte(f);
    const exemplo = itens[0] ? `"${itens[0].titulo.slice(0, 70)}"` : "(nenhum item)";
    console.log(`${itens.length > 0 ? "OK  " : "VAZIA"} ${f.nome}: ${itens.length} itens ${exemplo}`);
  } catch (e) {
    console.log(`ERRO ${f.nome}: ${(e as Error).message}`);
  }
}
