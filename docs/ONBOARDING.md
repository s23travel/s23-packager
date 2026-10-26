# Onboarding para agentes — Packager

## Propósito

O Packager é uma aplicação operacional interna da S23 para gerir pacotes de viagem, criar cotações, acompanhar compromissos/movimentos financeiros e preparar conteúdo comercial. O código confirma também geração de mensagens WhatsApp, importação assistida de dados de imagens, editor/conteúdo do website e exportação de Markdown. O upload/publicação no website/Manager não é automático neste repositório.

## Funcionalidades presentes no código

- Dashboard e listagens de pacotes/cotações, com formulários, detalhe, edição, paginação e referências.
- Criação de cotação baseada num pacote com snapshot independente; formulários de cotações também suportam duplicação (serviço, rota e teste dedicados).
- Cálculos determinísticos de custo, preço, margem e conversão EUR/BRL.
- Fluxo financeiro da cotação e central financeira: contas, operações, serviços, compromissos, movimentos, liquidação, transferências, divisão, ajustes, cancelamentos, saldos e previsões. Parte das alterações críticas ocorre por RPC SQL.
- Catálogo de serviços favoritos para reutilização no preenchimento.
- Importação de uma ou mais imagens de orçamento com IA, resultado apresentado para revisão antes de preencher o formulário.
- Geração/edição de conteúdo do website assistida por Gemini via Edge Function; conteúdo validado e guardado no Supabase.
- Geração/validação determinística de Markdown com cópia e download, além de pré-visualização/cópia de mensagem WhatsApp.
- Tema claro/escuro persistido localmente.

**Evidência:** `src/App.tsx`, `src/pages/`, `src/components/`, `src/services/`, `supabase/functions/` e migrations. A presença do código não prova que os serviços remotos estejam atualmente implantados ou operacionais.

## Mapa rápido

| Caminho | Papel |
|---|---|
| `src/main.tsx` | Entrada React e `BrowserRouter` |
| `src/App.tsx` | Rotas da SPA |
| `src/pages/` | Ecrãs por domínio |
| `src/components/` | UI e componentes por domínio |
| `src/services/` | Regras de negócio e acesso a dados/serviços |
| `src/lib/` | Cliente Supabase, guarda de ambiente e tema |
| `src/types/` | Tipos de domínio |
| `supabase/migrations/` | Alterações de schema, políticas e funções SQL |
| `supabase/functions/` | Edge Functions de conteúdo e importação com IA |
| `tests/` | Scripts de validação, unitários, integração e testes com efeitos externos |
| `docs/` | Documentação; alguns documentos referem-se a projetos/fluxos adjacentes |

## Sequência de leitura recomendada

1. `AGENTS.md` — guardrails para agentes, testes perigosos e comandos.
2. Este documento e `docs/ARCHITECTURE.md` — rotas, camadas, integrações e riscos.
3. `package.json`, `vite.config.ts`, `tsconfig.json`, `wrangler.jsonc` — comandos e configuração real.
4. `src/main.tsx` → `src/App.tsx` → página do domínio que vai ser alterado.
5. Serviço associado em `src/services/` e tipos em `src/types/`.
6. Para persistência, consultar as migrations relevantes antes de alterar serviço/UI. Para finanças, seguir também as RPCs referenciadas em `financialService.ts`.
7. Para IA/editor/exportação, ler as Edge Functions e os serviços de validação/Markdown antes de alterar prompts ou regras comerciais.
8. `docs/DEVELOPMENT.md` antes de instalar, compilar ou testar; `docs/PROJECT-HISTORY.md` para contexto histórico e incertezas.

## Factos, inferências e por confirmar

- **Confirmado no código:** React Router v6 sem data router; não há camada de servidor própria; a aplicação chama Supabase; os cálculos de negócio de moeda são TypeScript puro.
- **Confirmado no Git:** desenvolvimento histórico usou commits convencionais em pt-BR/inglês misturados; veja `docs/PROJECT-HISTORY.md`.
- **Inferência razoável:** é uma ferramenta interna de back-office, desktop-first, com base nos fluxos e estilos; isto não define requisitos de acesso nem substitui confirmação do responsável do produto.
- **Confirmado pelo responsável:** deploy do Packager por integração GitHub–Cloudflare Pages, automático após commit/push para `main`; autenticação da app será tratada depois do alinhamento das migrations e deploy.
- **Estado verificado em 2026-10-26:** ledger PROD alinhado com as 25 migrations locais após auditoria read-only sem Docker; overload e comentários foram tratados por migrations forward. **Por confirmar:** desenho futuro de autenticação/autorização, build settings/variáveis do Cloudflare e diff integral via shadow database.
- `README.md` contém uma descrição de fundação antiga que diz que persistência/IA ainda seriam implementadas. O código atual inclui essas integrações; prefira este onboarding e os documentos técnicos, confirmando sempre no código.
- `docs/COMO_ADICIONAR_PACOTE.md` e `docs/ARQUITETURA_MANAGER.md` descrevem o fluxo do S23 Manager/site adjacente. Não assumir que suas rotas, diretórios ou procedimentos existem nesta SPA.

## Regra de segurança antes de começar

O frontend não implementa login de utilizador e várias policies Supabase permitem operações a `anon`. Não executar suites de integração nem testar mutations contra um projeto desconhecido. Ver `docs/DEVELOPMENT.md`; confirmar um ambiente DEV isolado sem imprimir credenciais. Não executar `supabase db push` até reconciliar migrations locais e remotas.
