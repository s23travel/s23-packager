# Desenvolvimento e validação

## Pré-requisitos observáveis

- Node.js e npm. `README.md` recomenda Node 18+ (Node 20+ recomendado); `package.json` não fixa engines. Versões resolvidas no lockfile nesta revisão: React 18.3.1, React DOM 18.3.1, React Router 6.30.6, Supabase JS 2.118.0, Vite 6.4.5, TypeScript 5.6.3, plugin React 4.7.0 e Supabase CLI 2.122.0.
- Docker apenas para subir a stack Supabase local; a configuração indica Postgres 17.
- O projeto usa CSS próprio. Não há script de lint, format ou typecheck independente no `package.json`.

## Instalação e configuração local

1. Instalar dependências: `npm install` (o lockfile existe; usar `npm ci` se for necessário reproduzir exatamente as versões travadas).
2. Criar `.env.local` com base em `.env.example` e configurar apenas:

   | Variável | Finalidade |
   |---|---|
   | `VITE_SUPABASE_URL` | URL do projeto Supabase a que o cliente liga |
   | `VITE_SUPABASE_ANON_KEY` | Chave pública `anon` usada pelo frontend |
   | `GEMINI_API_KEY` | Secret server-side das Edge Functions de IA; não é variável do frontend |

   Não colocar `service_role` nem chaves Gemini em variáveis `VITE_*`. Não incluir valores reais em documentação, commits, logs ou mensagens.
3. Para o servidor local, `npm run dev` inicia Vite em `http://localhost:5173`. `vite.config.ts` ou o próprio Vite lê variáveis locais para desenvolvimento. Usar um projeto DEV isolado: o código apenas avisa se dev estiver ligado a PROD.

Verificações read-only em 2026-10-25 e revalidação em 2026-10-26: o host em `.env.local` e o `supabase/.temp/project-ref` deste checkout apontam ambos para o projeto PROD. Não é uma recomendação para testar nele: confirmar novamente antes de qualquer execução com I/O e não confiar apenas no aviso da aplicação. Os valores das variáveis não foram copiados para a documentação.

Também foi consultado somente o catálogo de schema/policies/grants (sem ler linhas de negócio): as nove tabelas públicas da aplicação têm RLS ligado; `anon` pode ler todas, fazer CRUD direto em sete e executar as RPCs `SECURITY DEFINER` consultadas. A análise confirma que o estado efetivo em PROD é acesso anónimo amplo, não apenas uma possibilidade descrita nas migrations. O modelo desejado continua por decidir.

## Build e pré-visualização

- `npm run build` executa `tsc && vite build` e gera `dist/`.
- **Condição especial:** builds de produção exigem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente do processo. `vite.config.ts` deliberadamente não carrega `.env.local`/`.env.production` para esse build; `buildEnvGuard.ts` exige URL HTTPS e chave JWT `anon` da origem de PROD, rejeitando DEV, origem diferente e `service_role`. Configurar as variáveis no ambiente seguro do processo/Cloudflare, sem as imprimir. A validação é uma barreira de build, não um mecanismo de autenticação do app.
- `npm run preview` pré-visualiza o conteúdo produzido em `dist/`.

## Testes e validações

- `npm test` é uma sequência de scripts `npx tsx`, não um runner isolado com mocks garantidos. **Não executar sem revisão/isolamento:** as suites `test_dashboard_phase3b`, `test_financial_balances_phase3a`, `test_quotation_approval_flows`, `test_quotation_financial_screen` e `test_weekly_calendar_phase3c` criam fixtures e limpam dados no projeto indicado pelas variáveis de ambiente. As policies de `anon` tornam a proteção do banco insuficiente para confiar em isolamento por utilizador.
- O histórico de instruções do repositório assinala que `.env.local` pode apontar para PROD. O ficheiro não foi inspecionado; confirmar explicitamente DEV isolado antes de testes com acesso remoto.
- `npm run test:all` também executa `tests/test_real_ai_integration.ts`, que chama uma Edge Function real. `tests/*_live.ts` e `tests/test_real_ai_*.ts` são testes com serviços/dados reais e não devem ser executados como validação local comum.
- Há testes determinísticos offline, por exemplo `tests/test_finance_engine.ts`, `tests/test_whatsapp_service.ts`, `tests/test_ai_content.ts`, `tests/test_markdown_service.ts` e `tests/test_supabase_env_guard.ts`. Os scripts usam `npx tsx`, mas `tsx` não consta nas dependências nem no lockfile neste checkout; a execução pode tentar buscar pacote à rede. Não foi instalada dependência para esta análise.
- Não há script próprio de lint, cobertura ou typecheck. O `tsc` faz parte do build e está configurado com `strict`, `noUnusedLocals` e `noUnusedParameters`.

## Supabase local e migrations

- Configuração: `supabase/config.toml`; migrations versionadas em `supabase/migrations/`; Edge Functions em `supabase/functions/`.
- CLI incluída como devDependency; invocar com `npx supabase ...`. Stack local requer Docker.
- **Não usar `npx supabase db push` para reconciliar este histórico.** O snapshot inicial de 2026-10-25 mostrou 23 versões locais sem par remoto, 6 remotas sem ficheiro local e nenhuma coincidente. Após as migrations forward e o repair de 2026-10-26, `migration list --linked` confirma 25 versões coincidentes e nenhuma pendente. Os candidatos iniciais às versões remotas estão na tabela abaixo.

  | Versão remota | Nome guardado no remoto | Candidato local | Observação |
  |---|---|---|---|
  | `20260909005938` | `create_packages_and_quotations` | `20260909010000_create_packages_and_quotations.sql` | DDL base aparenta corresponder |
  | `20260909005949` | `create_packages_and_quotations` | `20260909010000_create_packages_and_quotations.sql` | Segunda linha com o mesmo nome e o mesmo hash da instrução SQL remota |
  | `20260909010541` | `enable_crud_rls_policies` | `20260909020000_enable_crud_rls_policies.sql` | Conteúdo SQL canónico coincide |
  | `20260909034347` | `create_favorite_services` | `20260909030000_create_favorite_services.sql` | Estrutura/policy correspondem; diferenças em comentários/metadados textuais |
  | `20260909094015` | `remove_region_from_favorite_services` | `20260909040000_remove_region_from_favorite_services.sql` | Conteúdo SQL coincide |
  | `20260909165816` | `create_package_website_contents` | `20260909050000_create_package_website_contents.sql` | Tabela/índice/trigger/policy correspondem; migration local acrescenta `COMMENT ON` |

  No snapshot inicial, cinco versões remotas mapearam para migrations locais e 18 versões locais não tinham linha remota. A comparação de catálogo validou os seus efeitos; a entrada inicial duplicada está preservada no snapshot pré-repair.

### Estratégia de reconciliação sem Docker

O CLI local suporta `supabase db query --linked` pela Management API; o comando não exige Docker, mas **pode executar SQL arbitrário** — restringir auditorias a `SELECT` e rever cada SQL. A comparação usou apenas consultas de catálogo e não leu linhas de negócio. Separadamente, por escolha explícita do responsável, foi aplicada uma migration forward de comentários (DDL de metadados) e registada a sua versão; nenhuma linha de negócio foi alterada.

1. Guardar um inventário local das migrations (`version`, nome, hash/conteúdo) e do ledger remoto (`version`, `name`, hash de `statements`). Preservar o resultado como evidência antes de qualquer mudança.
2. Para cada migration local, inspecionar por consultas `SELECT` as tabelas/colunas (`information_schema`), defaults, constraints/FKs/checks, índices, triggers, RLS/policies, grants, tipos/extensões e definições/ACL de funções (`pg_catalog`, `pg_policies`, `pg_get_functiondef`). Comparar manualmente as alterações esperadas de cada migration com o estado PROD e marcar `confirmada`, `ausente`, `divergente` ou `incerta`.
3. Não considerar a mera existência de uma tabela/função como prova de equivalência; validar colunas, constraints, bodies, permissões e efeitos posteriores/substituições entre migrations. Se um elemento não puder ser provado por catálogo, deixar `incerta`.
4. Se alguma alteração estiver ausente/divergente, não a marcar `applied` e não fazer push em lote. Preparar uma correção forward-only a partir do estado real, rever SQL e impacto, e aplicar apenas pelo procedimento de release aprovado.
5. Só quando todas as migrations locais estiverem comprovadamente refletidas no schema e o mapa for revisto, preparar um plano de **ledger-only**: marcar versões locais corretas como `applied` e versões antigas/duplicadas como `reverted` via `supabase migration repair <versões> --status applied|reverted --linked`. Esse comando altera `supabase_migrations.schema_migrations`, não executa o SQL dos ficheiros; é uma escrita no PROD e requer revisão/autorizações próprias. Verificar depois com `migration list`.

`supabase db diff --linked` continua indisponível sem Docker; a auditoria manual por catálogo foi concluída. O repair foi executado versão a versão depois de aplicar as duas migrations forward, sem executar o SQL das migrations antigas.

### Resultado da validação read-only das 18 migrations

Em 2026-10-26 foram comparados os catálogos PROD (`information_schema`, `pg_catalog`, `pg_indexes`, `pg_policies` e ACLs) com as 18 migrations sem linha remota. Essa comparação não leu linhas de negócio. Resultado cumulativo:

| Migrations locais | Estado verificado no PROD |
|---|---|
| `20260914060000_add_unique_reference_constraints.sql` | Índices únicos de referência de pacotes e cotações presentes. |
| `20260930210000`–`20260930230000` | Tabelas/colunas financeiras, defaults, checks, FKs, índices e RPC final de aprovação presentes. O nome da policy da tabela `financial_operation_services` aparece sem o `s` final no catálogo, mas o nome local tem 64 caracteres e PostgreSQL o trunca para 63 bytes; portanto, PROD já tem o identificador efetivo esperado. **Não renomear a policy.** |
| `20261001010000`–`20261001070000` | Proteção de status, payment method, campos/índices de cancelamento e RPCs presentes. Bodies das RPCs finais correspondem; `record_commitment_settlement` de `01040000` foi substituída pela versão de `01050000`. Há uma diferença de assinatura explicada abaixo. |
| `20261001080000`–`20261001081000` | RPCs de projeção presentes; as definições atuais correspondem a `01081000`, que substitui as de `01080000`. |
| `20261001090000` | `quotations.archived_at`, índice, trigger e função de proteção presentes e correspondentes. |
| `20261001100000`–`20261001110000` | Tipo `balance_adjustment`, direção e checks presentes; funções atuais correspondem a `01110000`, que substitui as de `01100000`. |
| `20261010010000_atomic_split_financial_commitment.sql` | RPC presente; body normalizado corresponde. ACL confirma `anon`/`authenticated` e ausência de `PUBLIC`, como pede o `REVOKE` local. |
| `20261010020000_harden_financial_transactions_and_operations.sql` | RLS/policies e privilégios correspondem: `financial_operations` e `financial_transactions` são SELECT-only para `anon`/`authenticated`; `service_role` mantém CRUD. |

Foram comparadas **16 funções relevantes** por assinatura, segurança/configuração e body normalizado: as 16 definições finais correspondem aos corpos locais após normalizar comentários, espaços de formatação e qualificadores `public.`. Não é um diff binário do dump, mas a comparação preservou e comparou as linhas de código restantes. As versões intermediárias que foram substituídas não são reconstruíveis a partir do estado atual, apenas o resultado cumulativo.

**Policy: nenhuma diferença efetiva.** O identificador local tem 64 caracteres; PostgreSQL conserva no máximo 63 bytes e trunca o `s` final. Assim, o nome mostrado em `pg_policies` como singular é o mesmo identificador efetivo criado pelo SQL local. Uma tentativa de rename foi protegida e abortou antes de qualquer alteração; não é necessário renomear.

**Comentários de catálogo:** a migration `20261026091410_restore_missing_catalog_comments.sql` restaurou as descrições locais ausentes/abreviadas, incluindo comentários de `favorite_services`, `package_website_contents`, colunas financeiras e funções. A descrição de liquidação foi aplicada à assinatura de 7 argumentos que existe no PROD. `COMMENT ON` altera apenas metadados, não dados nem regras de execução.

As duas atualizações de dados fora de corpos de função também têm evidência de resultado sem ler linhas: o check validado de `financial_operation_services.status` exclui `active` (compatível com o backfill para `planned` de `30220000`), e o check validado de `financial_transactions.adjustment_direction` garante `positive`/`negative` para ajustes e `NULL` nos outros tipos (compatível com `01110000`). Os índices únicos de `packages.reference` e `quotations.reference` existem e estão ativos.

**Diferença de overload resolvida:** a sequência local cria `record_commitment_settlement` com 6 e 7 argumentos; uma migration forward remove o overload de 6 nos resets locais. Foi um no-op no PROD, onde já existia apenas a versão de 7 argumentos com o último defaultado.

Os efeitos funcionais cumulativos das 18 migrations foram validados. Em 2026-10-26, `20261026091410_restore_missing_catalog_comments.sql` restaurou comentários e `20261026094105_drop_legacy_record_commitment_settlement_overload.sql` normalizou o reset local; ambas foram aplicadas/registadas. O repair global marcou as 23 versões locais como `applied` e as seis versões remotas antigas como `reverted`. Verificação final: **25 versões coincidentes; 0 só locais; 0 só remotas**. Nenhum SQL das 23 migrations antigas foi executado pelo repair; `db push` não foi usado. Snapshot pré-repair do ledger: `C:\Users\ptmaralvoli\AppData\Local\Temp\opencode\packager-prod-ledger-before-repair-d138f0f173d141aab903b7d986f44715.json`.
- Não executar comandos que gravem em ambientes partilhados. Migrations e RPCs podem afetar dados, permissões e integridade financeira.

## Publicação

- `wrangler.jsonc` descreve publicação estática de `dist/` com fallback SPA em Cloudflare Pages.
- Não foi encontrado script de deploy nem workflow de publicação da aplicação; o único workflow presente é `.github/workflows/backup.yml`, que pode fazer dump de roles/schema/dados e push para uma branch própria quando habilitado por configuração/secrets do GitHub.
- **Processo confirmado pelo responsável em 2026-10-25:** o repositório GitHub está integrado com Cloudflare Pages; commit/push para `main` desencadeia deploy automático da aplicação. Não foi publicada nenhuma alteração nesta análise.
- `wrangler.jsonc` confirma `dist/` e fallback SPA; o repositório não revela as build settings/variáveis configuradas no dashboard. A tentativa de inspeção read-only redirecionou para login, pelo que esses valores/configurações não foram verificados.
- Referências gerais oficiais: [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/) e [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/). O projeto usa a primeira conforme confirmação do responsável; não inferir valores de build settings não observados.
- Esta análise não publicou nem executou workflow.
