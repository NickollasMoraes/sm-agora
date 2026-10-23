import type { Metadata } from "next";
import { PaginaTexto } from "@/components/PaginaTexto";
import { site } from "@/lib/config";

export const metadata: Metadata = { title: "Política de privacidade", description: `Como o ${site.nome} trata dados pessoais e cookies.` };

export default function Privacidade() {
  return <PaginaTexto titulo="Política de privacidade">
    <p><strong>Última atualização: 22 de outubro de 2026.</strong></p>
    <p>Esta política explica como o {site.nome}, portal de notícias de {site.cidade}/{site.estado}, trata dados pessoais conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>
    <h2>Controlador e contato</h2><p>O controlador é o {site.nome}. Para dúvidas, solicitações de privacidade ou exercício de direitos, escreva para <a href={`mailto:${site.email}`}>{site.email}</a>.</p>
    <h2>Dados coletados</h2><p>Não exigimos cadastro para leitura. Podemos tratar dados técnicos de navegação, como IP, data e hora, páginas acessadas, navegador, dispositivo e localização aproximada; cookies e identificadores; e dados que você enviar voluntariamente ao entrar em contato, como nome, e-mail, mensagem e anexos.</p>
    <h2>Finalidades e bases legais</h2><p>Usamos esses dados para entregar e proteger o site, medir audiência, responder contatos, publicar e corrigir conteúdo e cumprir obrigações legais. As bases podem ser execução de serviço, legítimo interesse, consentimento e cumprimento de obrigação legal, conforme cada finalidade. Cookies não essenciais dependem do seu consentimento.</p>
    <h2>Google AdSense e cookies</h2><p>Podemos usar Google AdSense, que utiliza cookies próprios e de terceiros, inclusive DoubleClick/DART, para medir campanhas e exibir anúncios personalizados com base em visitas a este e a outros sites, quando permitido pelo consentimento. Você pode desativar anúncios personalizados em <a href="https://adssettings.google.com" target="_blank" rel="noopener">Configurações de anúncios do Google</a> e em <a href="https://www.aboutads.info" target="_blank" rel="noopener">aboutads.info</a>. Saiba <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">como o Google usa dados quando você usa sites ou aplicativos de parceiros</a>.</p>
    <h2>Google Analytics 4</h2><p>Se configurado, o Google Analytics 4 coleta eventos de navegação para estatísticas de audiência e melhoria do portal. O carregamento depende do consentimento de analytics_storage, conforme o Google Consent Mode v2.</p>
    <h2>Redes sociais e incorporações</h2><p>Links e conteúdos incorporados de Instagram, WhatsApp, YouTube ou outras plataformas podem definir cookies e coletar dados. Consulte as políticas dessas plataformas.</p>
    <h2>Compartilhamento, retenção e segurança</h2><p>Compartilhamos dados apenas com provedores necessários ao funcionamento, estatísticas, publicidade, hospedagem e segurança, ou quando exigido por lei. Mantemos dados pelo tempo necessário à finalidade, a obrigações legais e à defesa de direitos. Adotamos controles técnicos e administrativos razoáveis.</p>
    <h2>Direitos do titular</h2><p>Você pode solicitar confirmação e acesso, correção, anonimização, bloqueio ou eliminação, portabilidade quando aplicável, informação sobre compartilhamentos, revogação do consentimento e revisão de decisões automatizadas, nos termos do art. 18 da LGPD. Envie o pedido para <a href={`mailto:${site.email}`}>{site.email}</a>; podemos confirmar sua identidade.</p>
    <h2>Menores de idade</h2><p>O site não é direcionado a crianças e não solicita intencionalmente dados de menores. Se um responsável identificar esse tratamento, entre em contato.</p>
    <h2>Alterações</h2><p>Podemos atualizar esta política para refletir mudanças legais, técnicas ou editoriais. A data no início indica a versão vigente.</p>
  </PaginaTexto>;
}
