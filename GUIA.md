# SM Agora: guia de configuração

Portal de notícias de Santa Maria com um agente que encontra pautas, pede sua aprovação no Telegram, escreve a matéria, escolhe uma imagem com licença livre e publica no site e no Instagram.

## Como funciona

```
Fontes (UFSM, Câmara, Diário de SM, Google Notícias, Agência Brasil)
   │  a cada 30 min, das 6h às 23h
   ▼
Triagem grátis por palavras-chave (nota de 1 a 10, remove repetidas e outras "Santa Maria")
   ▼
📱 Telegram: pauta com [Aprovar] [Descartar]   (ou responda com uma orientação)
   ▼ aprovou
IA escreve a matéria original + busca foto livre (Wikimedia Commons / Openverse / Pixabay) + gera arte
   ▼
📱 Telegram: prévia com [Publicar] [Outra imagem] [Ajustar texto] [Descartar]
   ▼ publicou
Agente envia para o GitHub → site atualiza sozinho em 1 a 3 min
Instagram: posta automático (se configurado) ou te manda a arte + legenda prontas
```

| Pasta | O que é |
|---|---|
| `site/` | O portal (Next.js). Cada notícia é um arquivo em `site/content/noticias/`. |
| `agente/` | O robô que roda no seu PC. |
| `.github/workflows/deploy.yml` | Publica o site no GitHub Pages a cada notícia nova. |
| `iniciar-agente.bat` | Liga o agente e o reinicia se ele cair. |

---

## Passo 1: contas (todas gratuitas para começar)

1. **GitHub**: crie a conta em github.com.
2. **Claude (IA)**: o agente usa o **seu plano do Claude** pelo Claude Code, sem custo extra. Instale e faça login uma vez:
   `npm install -g @anthropic-ai/claude-code` e depois `claude auth login`.
   (Quando o blog render, dá pra trocar para a API paga com `IA_PROVEDOR=api` no `.env`.)
3. **Bot do Telegram**: no Telegram, abra o **@BotFather**, envie `/newbot`, escolha um nome e guarde o **token**.
4. **Domínio**: `.com.br` sai mais barato no **registro.br** (cerca de R$ 40/ano). A GoDaddy também funciona.

## Passo 2: colocar o projeto no GitHub

1. No GitHub, crie um repositório **público** chamado `sm-agora`. O GitHub Pages gratuito exige repositório público.
2. Abra um terminal na pasta do projeto e rode:

```bash
git init -b main
git add .
git commit -m "Primeira versão do portal"
git remote add origin https://github.com/SEU-USUARIO/sm-agora.git
git push -u origin main
```

3. No repositório, vá em **Settings > Pages** e, em **Source**, escolha **GitHub Actions**.
4. Em **Settings > Secrets and variables > Actions > Variables**, crie:
   - `SITE_URL` = `https://smagora.com.br` (seu domínio)
   - `DOMINIO` = `smagora.com.br`
   - (sem domínio ainda? use `SITE_URL` = `https://SEU-USUARIO.github.io/sm-agora` e `BASE_PATH` = `/sm-agora`, sem criar `DOMINIO`)
5. Em **Actions**, rode o workflow "Publicar site" (ou faça qualquer push). Em uns 2 minutos o site está no ar.

## Passo 3: apontar o domínio (GoDaddy ou registro.br)

Na zona DNS do domínio:

| Tipo | Nome | Valor |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | SEU-USUARIO.github.io |

Depois, em **Settings > Pages**, confira o domínio e marque **Enforce HTTPS**. O DNS pode levar algumas horas para propagar.

## Passo 4: ligar o agente no seu PC

1. Dentro da pasta `agente`, copie `.env.example` para `.env` e preencha `TELEGRAM_BOT_TOKEN`.
2. Instale e inicie:

```bash
cd agente && npm install && npm start
```

3. No Telegram, mande `/start` para o seu bot. Ele responde com o seu `TELEGRAM_CHAT_ID`; cole no `.env` e reinicie (Ctrl+C e `npm start`). Por segurança, o bot só obedece a esse chat.
4. Mande `/coletar` para buscar pautas na hora.

**Comandos do bot:** `/pautas` (pautas aguardando decisão), `/coletar` (buscar agora), `/status` (resumo), `/pendentes` (reenviar prévias não publicadas).

### Canais e redator

O agente usa o Codex CLI para redigir matérias por padrão. Configure `REDATOR=codex` ou `REDATOR=claude` no `.env`; o timeout do Codex é controlado por `CODEX_TIMEOUT_MIN` e o executável por `CODEX_BIN`. A redação segue `agente/prompts/redacao.md` e busca no mínimo 800 palavras.

As opções de publicação ficam em `agente/data/canais.json` e são lidas a cada publicação, sem reiniciar o agente. O arquivo pode conter `redator`, `palavrasMinimas` e os canais `site`, `instagramFeed`, `instagramReels`, `instagramStories`, `facebookFeed`, `facebookReels`, `facebookStories` e `youtubeShorts`. Se o arquivo não existir, os padrões ligam site, feed/Reels/Stories do Instagram e desligam os canais novos do Facebook e YouTube. `REELS_MATERIAS=false` continua desligando os Reels do Instagram.

Para canais da Página do Facebook, preencha `FACEBOOK_PAGE_ID` e `FACEBOOK_PAGE_TOKEN`. Gere o token no Meta for Developers com as permissões `pages_manage_posts`, `pages_read_engagement` e `pages_show_list`. O feed usa `POST /{page-id}/photos` com a URL pública da arte e a legenda com link da matéria.

Para buscar um tema sob demanda, use `/buscar tema` no Telegram ou `npm run buscar -- "tema"` dentro de `agente`; as pautas passam pela mesma triagem e chegam para aprovação.

### Deixar rodando sozinho no Windows

- **Iniciar com o Windows:** aperte `Win + R`, digite `shell:startup` e coloque ali um atalho para `iniciar-agente.bat`.
- **Não deixar o PC dormir:** Configurações > Sistema > Energia > "Suspender" = **Nunca** (a tela pode desligar, sem problema).
- O git precisa estar logado no GitHub. O primeiro `git push` do Passo 2 já resolve isso.
- Se o PC desligar, nada se perde: as pautas só esperam o agente voltar. Quando quiser sair do PC, o mesmo agente roda numa VPS de R$ 30/mês sem mudar código.

## Passo 5: Instagram automático (já configurado para o @sm.agora)

O agente posta sozinho a cada matéria publicada, usando a API oficial (Login do Instagram, sem Página do Facebook).

- **App na Meta:** "SM Agora Publicador" em developers.facebook.com > Meus apps.
- **No `.env`:** `INSTAGRAM_USER_ID` e `INSTAGRAM_ACCESS_TOKEN` (já preenchidos).
- **Token:** vale 60 dias, e o agente o renova sozinho toda segunda às 4h. Se o PC ficar desligado por mais de 60 dias seguidos, gere outro token no app (Casos de uso > API do Instagram > Gerar tokens de acesso > Gerar token) e cole no `.env`.
- **Se a postagem falhar**, o bot avisa no Telegram e manda a arte + legenda pra você postar manualmente.
- Para voltar ao modo manual, apague o `INSTAGRAM_ACCESS_TOKEN` do `.env`.

### Reels a partir de um vídeo seu

1. Mande o vídeo para o bot no Telegram. Na legenda do vídeo, a **1ª linha** vira o título da capa e o resto (opcional) vira a legenda do post. Sem legenda, o bot pergunta o título. O bot coloca a marca d'água "SM. AGORA" no canto de cima (como as grandes páginas fazem, para o vídeo levar o nome do portal quando circular no WhatsApp).
2. O bot devolve a capa no padrão do portal com **[Publicar Reels] [Trocar título] [Descartar]**.
3. Ao publicar, vídeo e capa passam pelo site (a API do Instagram só aceita arquivos por link público), o Reels vai ao ar e o vídeo é apagado do site em seguida. Leva de 3 a 6 minutos.

- **Limite de 20 MB:** é o máximo que o Telegram deixa um bot baixar. Mande como vídeo normal (não como arquivo) que o Telegram comprime; vídeos de até 1 a 2 minutos costumam caber.
- O Instagram aceita Reels de 3 segundos a 15 minutos, de preferência na vertical (9:16).
- Cada vídeo passa pelo histórico do git. Se o repositório ficar pesado com o tempo (o GitHub recomenda até 1 GB), dá para migrar os vídeos para outro serviço.

### Reels automático de cada matéria

Depois de postar a arte de uma matéria, o agente gera um vídeo de 8 segundos (foto com zoom lento, manchete surgindo e "Matéria completa → link na bio") e publica como Reels. Ele aparece só na aba Reels e nas recomendações do Instagram, sem repetir o post na grade do perfil. Cada um tem cerca de 1 MB. Para desligar, coloque `REELS_MATERIAS=false` no `agente/.env`.

---

## Direitos autorais: o que o agente faz por você

- **Texto:** a IA reescreve do zero, atribui a informação no texto ("segundo a Prefeitura") e lista as fontes com link no fim da matéria. Citações literais só curtas e entre aspas.
- **Fotos:** o agente **nunca usa a foto da notícia original**. Busca apenas no Wikimedia Commons (licenças CC0, domínio público, CC BY e CC BY-SA, e descarta NC/ND, que proíbem uso comercial), no Openverse (mesmas regras de licença, sem chave) e no Pixabay. Para ligar o Pixabay, crie uma conta grátis, copie a chave em pixabay.com/api/docs e cole em `PIXABAY_API_KEY` no `agente/.env`. Autor, licença e link de origem aparecem embaixo da foto.
- **Pessoas:** a busca de imagens descreve lugares e cenas, nunca nomes de pessoas. Em casos policiais, a IA não expõe nomes de suspeitos não acusados, vítimas ou menores.
- **Você é o editor:** nada vai ao ar sem o seu "Publicar". Confira a foto na prévia; se não gostar, toque em **Outra imagem**.
- Fotos próprias são sempre as melhores. Tirou uma foto da cidade? Ela vale mais que qualquer banco de imagens.

## Custos mensais estimados

| Item | Custo |
|---|---|
| Hospedagem (GitHub Pages) | R$ 0 |
| Domínio .com.br | ~R$ 3,50/mês (R$ 40/ano) |
| IA (seu plano do Claude via Claude Code + triagem por palavras-chave) | **R$ 0 extra**: usa o limite do plano que você já tem |
| IA pela API paga (opcional, `IA_PROVEDOR=api`) | ~US$ 20–45/mês com ~5 matérias/dia |
| Energia do PC ligado | ~R$ 20–40/mês |

No modo padrão, cada matéria usa um pouco do limite do seu plano do Claude (o mesmo que você usa no app). Se o limite acabar num dia de muito uso, o bot avisa no Telegram e você tenta de novo mais tarde. Quando o blog gerar receita, mude para `IA_PROVEDOR=api` e preencha `ANTHROPIC_API_KEY` para não depender do limite do plano.

## Monetização: plano para o portal se pagar

1. **Anunciantes locais (comece já):** a página `/anuncie` tem 3 planos (R$ 290 a R$ 690). Ajuste os valores em `site/app/anuncie/page.tsx` e o WhatsApp comercial em `site/lib/config.ts`. Os espaços "Sua empresa aqui" no site levam para essa página. **Um único anunciante local já paga o mês inteiro.**
2. **Google AdSense (após ~30 matérias e o domínio no ar):** peça a aprovação em adsense.google.com. Quando aprovar, crie a variável `ADSENSE_CLIENT` no GitHub (ex.: `ca-pub-123...`) e coloque os IDs dos blocos no `slot=""` dos componentes `<Anuncio>`. As páginas de privacidade, contato e "quem somos", exigidas pelo Google, já existem.
3. **Matéria patrocinada:** publique à mão um arquivo em `site/content/noticias/` com "Conteúdo patrocinado" no subtítulo. Identificar como publicidade é obrigatório.
4. **Instagram:** com ~5 mil seguidores locais, venda posts e stories no combo com o site.
5. **Google Notícias:** cadastre o site no Google Publisher Center, que traz tráfego gratuito.

### Medição, Google Notícias e canal de WhatsApp

O site já vem pronto para os três. Cada um liga quando você cria a variável no GitHub (**Settings > Secrets and variables > Actions > Variables**) e roda o workflow "Publicar site" de novo:

| Variável | O que é | Onde conseguir |
|---|---|---|
| `GA_ID` | Google Analytics 4 (visitas, páginas mais lidas, de onde vem o público) | analytics.google.com > Admin > Criar propriedade > Fluxo da Web com o seu domínio. Copie o "ID da métrica" (`G-...`). |
| `WHATSAPP_CANAL` | Link do canal de WhatsApp. Aparece no topo, no rodapé e no fim de cada matéria. | No WhatsApp do celular: **Atualizações > + > Criar canal**. Depois, no canal, **Compartilhar > Copiar link**. |

**Google Search Console e Google Notícias (sem variável):**
1. Em search.google.com/search-console, adicione o domínio e confirme pelo registro DNS que o próprio Search Console mostra.
2. Em **Sitemaps**, envie `sitemap.xml` e `sitemap-noticias.xml` (este lista só as matérias dos últimos 2 dias, como o Google pede).
3. Em publishercenter.google.com, cadastre a publicação "SM Agora" com o mesmo domínio, idioma português e local Santa Maria (RS).

Cada matéria já leva os dados estruturados de notícia (título, data, editoria, logo do portal em `site/public/logo.png`) que o Google usa no Notícias e no Discover.

**Meta realista:** 1 a 2 anunciantes locais nos primeiros 3 meses cobrem todos os custos. A partir daí, AdSense e novos anunciantes viram lucro.

## Personalizar

- **Nome, slogan, e-mails, @:** `site/lib/config.ts` e `agente/.env`.
- **Cores e fontes:** `site/app/globals.css` e `site/app/layout.tsx`.
- **Fontes de notícia:** `agente/src/fontes.ts`. Depois de mudar, rode `npm run testar-fontes` dentro de `agente`.
- **Tom e regras da redação:** `SISTEMA_REDACAO` em `agente/src/ia.ts`.
- **Notas da triagem (palavras-chave):** `agente/src/triagem-local.ts`. Chegando pautas demais ou de menos? Ajuste `NOTA_MINIMA` no `.env`.
- **Apague a matéria de boas-vindas** (`site/content/noticias/bem-vindo-ao-sm-agora.md`) quando publicar a primeira notícia real.

## Ver o site no seu PC

```bash
cd site && npm install && npm run dev
```

Abra http://localhost:3000.
