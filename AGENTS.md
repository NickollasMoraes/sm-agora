# AGENTS.md — Você é o IMPLEMENTADOR (Codex)

O Claude Code (CerebroNC) orquestra e delega tarefas a você. Faça só o que a
tarefa pede.

## Projeto
Portal de notícias SM Agora: `site/` (Next.js, matérias em Markdown em
`site/content/noticias/`) e `agente/` (robô Node/TypeScript com bot do
Telegram via grammY, que coleta pautas, pede aprovação, redige, gera arte,
publica no site via git e posta nas redes).

ESTA PASTA É UM GIT WORKTREE DE DESENVOLVIMENTO (`SMAgora-dev`, branch
`artigos-v2`). O agente em produção roda em outra pasta. Não rode o agente,
não faça `git push` e não faça commits.

## Regras
1. TypeScript simples e tipado, uma instrução por linha, comentários curtos em pt-BR
   como no código existente. Siga o estilo dos arquivos vizinhos.
2. Sem dependências novas, a menos que a tarefa permita.
3. Segredos só em `agente/.env` (nunca no código). Documente variáveis novas
   em `agente/.env.example` e no `GUIA.md`.
4. Tudo que falar com rede externa deve falhar com mensagem clara e nunca
   derrubar o agente: um canal com erro não impede os outros.
5. Arquivos em UTF-8.

## Antes de terminar
Em `agente/`, rode `npm run typecheck` e corrija os erros. Responda curto:
Resumo, Arquivos alterados, Como testar, Pendências.
