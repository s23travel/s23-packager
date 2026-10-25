# AGENTS.md — Packager (S23)

Aplicação web interna para gerenciar pacotes de viagem e cotações. SPA em React 18 + Vite + TypeScript estrito, persistência em Supabase (Postgres) e deploy estático no Cloudflare Pages.
UI, comentários e mensagens de commit em **pt-BR**; identificadores de código em inglês. (Antigravity é só o IDE usado no dia a dia, não faz parte do runtime.)

## Comandos

| Objetivo | Comando |
|---|---|
| Dev server (porta 5173) | `npm run dev` |
| Build de produção | `npm run build` — exige variáveis de ambiente, ver abaixo |
| Suíte de testes | `npm test` — **escreve no banco**, ver abaixo |
| Um teste isolado | `npx tsx tests/test_finance_engine.ts` |
| Supabase CLI | `npx supabase ...` — não existe binário `supabase` no PATH |

## ⚠️ Armadilhas que custam tempo

**1. O build de produção ignora `.env.local` — por design.**
`vite.config.ts` chama `validateProductionEnv(process.env)` (`src/lib/buildEnvGuard.ts`), que rejeita URL ausente, projeto DEV, host falso e chave `service_role`. Sem as variáveis exportadas no processo, `npm run build` falha com `VITE_SUPABASE_URL ausente`.
```powershell
# PowerShell: carregar .env.local no processo antes de buildar
Get-Content .env.local | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { Set-Item -Path "env:$($matches[1].Trim())" -Value $matches[2].Trim() } }
npm run build
```
No Cloudflare Pages as duas variáveis precisam estar configuradas no painel.

**2. `npm test` grava e apaga registros reais no projeto apontado por `.env.local`.**
Cinco suítes da lista padrão criam fixtures via anon key **sem guarda de ambiente**: `test_dashboard_phase3b`, `test_financial_balances_phase3a`, `test_quotation_approval_flows`, `test_quotation_financial_screen`, `test_weekly_calendar_phase3c`. A RLS permite `FOR ALL TO anon USING (true)` em `packages`/`quotations`, então não há barreira no banco.
Neste checkout `.env.local` aponta para **PROD** (`iqtfqitquykasvfybndl`): antes de rodar a suíte inteira, troque para DEV (`rskhshtewkgrllbtamsr`) ou assuma o risco de dados temporários em produção.

**3. Testes fora do `npm test`** (só manual, precisam de recursos reais): `tests/*_live.ts` (exigem DEV e abortam fora dele) e `tests/test_real_ai_*.ts` (chamam API de IA com chave real).

**4. Não rode `npx supabase db push`.**
O histórico de migrations divergiu: 6 versões existem só no remoto e 23 só no local (arquivos foram renomeados depois de aplicados). O schema está em dia — o push tentaria reaplicar tudo e quebraria. Reconciliar exige `supabase migration repair` com mapeamento manual, versão por versão.

**5. `tsc` roda com `noUnusedLocals` e `noUnusedParameters`** — variável ou parâmetro não usado quebra `npm run build`.

**6. `.opencode/skills/` são symlinks** para a biblioteca central de skills; não edite nem copie arquivos ali.

## Arquitetura (o que não se deduz pelos nomes)

- Rotas em `src/App.tsx` (react-router-dom v6, sem data router): `/pacotes`, `/cotacoes`, `/cotacoes/:id/financeiro`, `/financeiro`, `/servicos`.
- `src/pages/<domínio>/` = telas por rota; `src/components/<domínio>/` = blocos visuais. Domínios: `packages`, `quotes`, `financial`, `services`, `whatsapp`, `ai`, `import`, `common`, `layout`.
- **Dois serviços quase homônimos — escolher o errado é o erro mais comum:**
  - `src/services/financeService.ts` → motor de cálculo puro e determinístico (câmbio, custos, margem, `roundMoney`, `formatMoney`). Sem I/O.
  - `src/services/financialService.ts` → persistência financeira no Supabase, incluindo RPCs atômicas.
- `src/services/index.ts` é barrel **parcial**: exporta `packagesService`, `quotationsService` e namespaces de cálculo, mas não `financialService`, `packageWebsiteContentService`, `financialAlertsService` etc. — esses se importam direto do arquivo.
- Regras financeiras críticas (aprovar cotação, liquidar/dividir compromisso, cancelar operação) vivem em RPCs Postgres (`supabase/migrations/2026100103*/2026100104*/2026101001*`). Não reimplemente no client.
- Convenção de câmbio fixa: **1 EUR = X BRL** (`EXCHANGE_RATE_CONVENTION_NOTE`). Valores monetários sempre formatados por `formatMoney`/`roundMoney`.
- Estilo: CSS puro em `src/index.css` (~1.8k linhas, tokens semânticos), sem Tailwind. Tema claro/escuro via classe `dark` no `<html>`, chave `packager-theme` no localStorage e script anti-FOUC em `index.html`. Guia visual: `design-system/s23-packager/MASTER.md`.

## Supabase e dados

- PROD `iqtfqitquykasvfybndl` · DEV `rskhshtewkgrllbtamsr` (constantes em `src/lib/buildEnvGuard.ts`).
- `src/lib/supabase.ts` lança em produção se a URL não for PROD, mas no modo dev apenas emite `console.warn` quando conectado a PROD — **não é proteção de dados**, é sinalização.
- App interno sem login: as políticas RLS liberam anon para CRUD. Nunca usar `service_role` no frontend nem versionar chaves.
- `supabase/config.toml` (gerado com Postgres 17, igual ao remoto) habilita a stack local, que exige Docker.
- Scripts SQL manuais antigos de produção ficam em `docs/supabase-prod-migration-*.sql` — não são migrations versionadas.

## Deploy e operação

- Cloudflare Pages publica `dist/`; `wrangler.jsonc` define o fallback SPA (`not_found_handling: single-page-application`). `wrangler` **não** é dependência do projeto.
- `.github/workflows/backup.yml` faz dump semanal (roles, schema, data) para a branch `Bkp-Supabase-Weekly`, condicionado à variável `BACKUP_ENABLED`. Não commite backups na `main`.
- `.env.local` é ignorado pelo git; `.env.example` lista as duas chaves necessárias.

## Docs que confundem

`docs/COMO_ADICIONAR_PACOTE.md` e `docs/ARQUITETURA_MANAGER.md` descrevem outro produto (S23 Manager: pasta `content/pacotes/`, rota `/manager`), que não existe neste repositório. `docs/ARCHITECTURE.md` e `design-system/s23-packager/MASTER.md` são os documentos válidos.

## Princípios do projeto

- Entrega incremental: nada de antecipar fases nem criar abstrações prematuras.
- Dependências mínimas — justificar antes de instalar qualquer pacote.
- `npm run build` precisa passar limpo (deploy é estático).
- Desktop-first: app operacional de uso diário, priorizando densidade de informação e poucos cliques.
- Não alterar arquitetura sem validação explícita.
