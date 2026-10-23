import type { Metadata } from "next";
import { PaginaTexto } from "@/components/PaginaTexto";
import { site } from "@/lib/config";

export const metadata: Metadata = { title: "Termos de uso", description: `Termos de uso do ${site.nome}.` };

export default function Termos() {
  return <PaginaTexto titulo="Termos de uso">
    <p>Ao acessar o {site.nome}, você concorda com estes termos. Se não concordar, não utilize o site.</p>
    <h2>Uso permitido</h2><p>O conteúdo pode ser consultado para fins pessoais e informativos. É proibido usar o site para fraude, distribuir malware, copiar em massa ou interferir em seu funcionamento.</p>
    <h2>Propriedade intelectual</h2><p>Textos, identidade visual e materiais próprios pertencem ao {site.nome} ou a seus respectivos titulares. A reprodução depende de crédito ao {site.nome} e link para a matéria original, sem alterar seu sentido.</p>
    <h2>Conteúdo de terceiros e links</h2><p>Matérias podem citar fontes, imagens, redes sociais e sites externos. Esses conteúdos têm seus próprios termos e políticas; não controlamos sua disponibilidade ou exatidão.</p>
    <h2>Responsabilidade e publicidade</h2><p>O jornalismo é publicado com base nas fontes disponíveis e pode ser atualizado. O {site.nome} não garante que o site ficará sempre disponível nem se responsabiliza por decisões tomadas apenas com base nas publicações. Anúncios e conteúdos patrocinados são identificados e não representam necessariamente a opinião editorial.</p>
    <h2>Comentários e envios</h2><p>Envios devem ser lícitos, verdadeiros e respeitosos. Não aceitamos conteúdo discriminatório, difamatório ou que viole direitos. Podemos moderar, não publicar ou remover material enviado.</p>
    <h2>Alterações, lei e contato</h2><p>Podemos atualizar estes termos quando necessário. Aplica-se a legislação brasileira, com foro de Santa Maria/RS. Dúvidas: <a href={`mailto:${site.email}`}>{site.email}</a>.</p>
  </PaginaTexto>;
}
