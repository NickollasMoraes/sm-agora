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
IA escreve a matéria original + busca foto livre (Wikimedia Commons / Pexels) + gera arte
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

**Comandos do bot:** `/coletar` (buscar agora), `/status` (resumo), `/pendentes` (reenviar prévias não publicadas).

### Deixar rodando sozinho no Windows

- **Iniciar com o Windows:** aperte `Win + R`, digite `shell:startup` e coloque ali um atalho para `iniciar-agente.bat`.
- **Não deixar o PC dormir:** Configurações > Sistema > Energia > "Suspender" = **Nunca** (a tela pode desligar, sem problema).
- O git precisa estar logado no GitHub. O primeiro `git push` do Passo 2 já resolve isso.
- Se o PC desligar, nada se perde: as pautas só esperam o agente voltar. Quando quiser sair do PC, o mesmo agente roda numa VPS de R$ 30/mês sem mudar código.

## Passo 5 (opcional): Instagram automático

Sem configurar nada, a cada publicação o bot te manda **a arte pronta + a legenda** pra você postar em 30 segundos. Para postar sozinho:

1. Transforme o Instagram em **conta Profissional** e ligue a uma **Página do Facebook**.
2. Em developers.facebook.com, crie um app do tipo **Business** e adicione o produto **Instagram Graph API**.
3. Gere um token de longa duração com as permissões `instagram_basic`, `instagram_content_publish` e `pages_show_list`, e descubra o **ID da conta do Instagram**.
4. Preencha `INSTAGRAM_USER_ID` e `INSTAGRAM_ACCESS_TOKEN` no `.env`.

Atenção: o token de longa duração vence em 60 dias e precisa ser renovado.

---

## Direitos autorais: o que o agente faz por você

- **Texto:** a IA reescreve do zero, atribui a informação no texto ("segundo a Prefeitura") e lista as fontes com link no fim da matéria. Citações literais só curtas e entre aspas.
- **Fotos:** o agente **nunca usa a foto da notícia original**. Busca apenas no Wikimedia Commons (licenças CC0, domínio público, CC BY e CC BY-SA, e descarta NC/ND, que proíbem uso comercial) e no Pexels. Autor, licença e link de origem aparecem embaixo da foto.
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
