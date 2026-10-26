# Instruções para agentes — Packager (S23)

## Contexto
Aplicação web interna para gerir pacotes de viagem, cotações e operações financeiras da S23. É uma SPA React 18 + TypeScript + Vite; persiste dados no Supabase (Postgres) e gera artefactos estáticos para Cloudflare Pages. Interface, comentários e documentação em pt-BR; identificadores de código em inglês. Antigravity é histórico de IDE, não dependência de runtime.

## Orientação operacional
- Antes de editar, verificar `git status` e ler [docs/ONBOARDING.md](docs/ONBOARDING.md), além da documentação específica do domínio.
- Manter alterações incrementais, dependências mínimas e arquitetura atual; não antecipar fases nem refatorar sem pedido explícito.
- Seguir os fluxos e riscos descritos em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) e [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
- Não expor valores de `.env.local`, segredos, dados de backups ou conteúdo de clientes em código, logs ou documentação. Nunca usar `service_role` no frontend.

## Comandos e perigos
- `npm run dev` — Vite, porta 5173.
- `npm run build` — `tsc && vite build`; exige `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` **no ambiente do processo**. A configuração de produção ignora ficheiros `.env*` e só aceita a origem de PROD. Não copiar chaves para comandos, documentação ou logs.
- `npm run preview` — pré-visualiza `dist/`.
- `npm test` — não executar sem avaliar cada suite e confirmar um projeto DEV isolado: inclui suites que criam, alteram e apagam dados Supabase; ver [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). `npm run test:all` acrescenta chamadas reais à integração de IA.
- Testes isolados usam `npx tsx`, mas `tsx` não está declarado no `package.json` nem no lockfile. Não instalar dependências automaticamente para contornar isso.
- Supabase CLI: `npx supabase ...`; stack local precisa de Docker. **Não usar `npx supabase db push` para reconciliar este histórico**. Em 2026-10-26 o ledger PROD foi alinhado após auditoria sem Docker; confirmar `migration list` antes de operações futuras. Ver [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
- Verificações read-only de 2026-10-25 e 2026-10-26 confirmaram que `.env.local` e o link Supabase deste checkout apontam para PROD. Ver [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md); revalidar antes de qualquer teste ou operação.

## Mapa e regras críticas
- Entrada: `src/main.tsx`; rotas/layout: `src/App.tsx`, `src/components/layout/`.
- Páginas por domínio em `src/pages/`; UI em `src/components/`; integrações e regras em `src/services/`; tipos em `src/types/`; configuração em `src/lib/`.
- `src/services/financeService.ts` é cálculo monetário puro; `src/services/financialService.ts` é persistência financeira Supabase. Não confundir.
- Regras financeiras atómicas (aprovação, liquidação, transferências, cancelamentos, divisão de compromissos e projeções) estão em RPCs SQL nas migrations; não as reimplementar no cliente.
- Câmbio: `1 EUR = X BRL`. Usar `roundMoney`/`formatMoney` do motor financeiro.
- CSS puro e tokens em `src/index.css`; tema escuro pela classe `dark` e `localStorage` (`packager-theme`). Não introduzir Tailwind.
- O app não implementa autenticação de utilizador. Rever políticas RLS e efeitos em dados antes de tocar em Supabase; tabelas financeiras críticas têm restrições específicas documentadas na arquitetura.
- Autenticação da aplicação está planeada para uma etapa posterior, depois do alinhamento das migrations e deploy; não antecipar implementação de Auth/RLS.
- `.opencode/skills/` e diretórios locais de agentes não são código do produto; não editar/copiar symlinks.

## Referências
- [Entrada e funcionalidades](docs/ONBOARDING.md)
- [Arquitetura e integrações](docs/ARCHITECTURE.md)
- [Desenvolvimento, testes e publicação](docs/DEVELOPMENT.md)
- [Histórico e incertezas recuperáveis](docs/PROJECT-HISTORY.md)
- Guia visual: `design-system/s23-packager/MASTER.md`

## Restrições conhecidas
- `docs/COMO_ADICIONAR_PACOTE.md` e `docs/ARQUITETURA_MANAGER.md` descrevem fluxos do S23 Manager/site, não rotas desta SPA; usar apenas como referência editorial quando aplicável.
- `README.md` contém trechos de fundação antiga que descrevem backend e funcionalidades como futuras; validar sempre com código e documentação técnica atual.
- Não publicar, fazer push/commit, alterar serviços externos ou operar dados partilhados sem pedido explícito.
