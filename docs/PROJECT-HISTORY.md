# Histórico recuperável do projeto

## Escopo e confiança

Foi possível consultar o histórico Git local e as branches disponíveis no checkout. O histórico visível vai de **9 de setembro a 25 de outubro de 2026**; `main` estava alinhada com `origin/main` no início desta análise. O histórico comprova que commits foram feitos, mas não é prova suficiente de que todo código/função esteja implantado ou operacional em produção.

Não foram encontrados ficheiros rastreados com transcrições, sessões ou changelog do Antigravity; o anexo `pasted-context-1.txt` referido na solicitação também não estava acessível no diretório. Portanto, não há memória de sessões Antigravity disponível para reconstruir decisões além do Git e dos documentos do repositório.

## Funcionalidades implementadas — evidência atual

| Funcionalidade | Evidência | Confiança |
|---|---|---|
| SPA de gestão de pacotes e cotações com snapshot da cotação | Rotas e páginas em `src/App.tsx`; services em `src/services/`; migrations iniciais; commits `58bb22b` e próximos | Alta — código, schema e histórico |
| Motor financeiro determinístico e multi-moeda | `src/services/financeService.ts`; `tests/test_finance_engine.ts`; commit `b6b84c8` | Alta — código/teste |
| Mensagem WhatsApp a partir da cotação | `src/services/whatsappService.ts`, preview e botão copiar; commits `dde1ca7`, `4492a2b` | Alta — código/histórico |
| Geração e validação de conteúdo editorial com Gemini/Grounding | `src/services/aiContentService.ts`, `contentValidationService.ts` e `supabase/functions/generate-content/`; commits `84d5281`, `0c14ff9` | Alta quanto ao código; operação remota não verificada |
| Geração/validação de Markdown e download manual | Serviços Markdown, `AIContentGenerator.tsx`; commits `2080e6e`, `98cf638`, `c68ffa4` | Alta — código/histórico. Publicação automática foi explicitamente removida do MVP |
| Importação de dados de imagens com IA, incluindo consolidação de várias imagens | `imageImportService.ts`, `ImageImportModal.tsx`, Edge Function; commits `d35dd5f`, `588b387`, `139331a` | Alta quanto ao código |
| Catálogo de serviços favoritos e persistência de conteúdo do website | services, migrations e testes correspondentes; commits `dbf7ec4`, `dd7527e` | Alta — código/schema/histórico |
| Operações financeiras, compromissos, liquidação, transferências e projeções | `financialService.ts`, páginas/components financeiros e migrations entre 2026-09-30 e 2026-10-10 | Alta quanto ao código local; remoto não verificado |
| Paginação de 10 itens, reordenação de serviços e duplicação de cotação | commits `32702cf`, `7e3dd8b`, `4ca494c`; componentes/serviços e testes correspondentes | Alta — histórico e código |

## Decisões técnicas confirmadas

- Pacotes/cotações usam `JSONB`; cotação preserva snapshot próprio em vez de depender do estado mutável do pacote (`20260909010000_create_packages_and_quotations.sql`; `quotationsService.ts`). **Alta confiança.**
- Cálculos monetários são funções TypeScript determinísticas, com convenção fixa `1 EUR = X BRL`; Gemini não é usado para cálculos (`financeService.ts`). **Alta.**
- Gemini é chamado a partir de Supabase Edge Functions, com secret `GEMINI_API_KEY` server-side (`supabase/functions/*`; serviços de integração). **Alta quanto à implementação local; implantação remota não confirmada.**
- Geração de Markdown é determinística e a entrega ao Manager/site no MVP é manual, por download; a remoção de publicação automática aparece em `c68ffa4`. **Alta.**
- Alterações financeiras críticas usam RPCs transacionais; migrations posteriores removem escrita direta de `anon`/`authenticated` em `financial_operations` e `financial_transactions` (`20261010020000_harden_financial_transactions_and_operations.sql`). **Alta quanto à migration versionada.**
- A aplicação não implementa autenticação de utilizador. A decisão de produto/acesso pretendida não está registada de forma suficiente; as políticas SQL atuais incluem permissões amplas para `anon`. **Ausência confirmada no frontend; intenção por esclarecer.**

## Marcos identificáveis no Git

- **2026-09-09 — fundação e fluxo principal:** `5b13b71` fundação técnica; `58bb22b` CRUD/snapshot; `b6b84c8` motor financeiro; `dde1ca7` WhatsApp; `84d5281` Gemini; `2080e6e` Markdown; `98cf638` fluxo de publicação manual.
- **2026-09-09 a 2026-09-18 — editor e importação:** catálogo (`dbf7ec4`), importação multimodal (`d35dd5f`), consolidação de múltiplas imagens (`588b387`) e serviços estruturados (`320f527`).
- **2026-09-30 a 2026-10-02 — módulo financeiro:** fundação ligada à aprovação (`e5ca22f`), fases financeiras (`b013a7e`, `d5d672e`), liquidação e histórico (`af49309`, `03dc330`), ajustes de contas (`20fab6e`) e exclusão/divisão/segurança (`efe5901`, `abaa81e`, `acf51d9`).
- **2026-10-10 — build e segurança:** `18e9601` restringe configuração de build de produção; `7b0a4d3` testa a guarda de ambiente. `6bffb43` adiciona configuração local da CLI Supabase e atualiza dependências/documentação.
- **2026-10-12 a 2026-10-25 — manutenção funcional:** `139331a` custos proporcionais de voos/bagagem; `4ca494c` duplicação; `e3d2581` correção do fluxo de duplicar; `4492a2b` WhatsApp; `32702cf` paginação; `0b8c5fe` ignora diretórios locais de skills de agentes.

Os resumos acima foram obtidos de `git log --oneline --decorate` e confirmados seletivamente contra ficheiros atuais. Não foi feita auditoria de cada diff histórico; evitar atribuir detalhes não explícitos a commits.

## Limitações, riscos e trabalho aparentemente pendente

- `README.md` e partes da documentação antiga descrevem a aplicação como fundação com backend/IA futuros; isso contradiz o código e commits posteriores. Este documento e a arquitetura atual distinguem integração implementada localmente de serviço remoto verificado.
- No snapshot inicial read-only de 2026-10-25, a CLI encontrou 23 versões locais sem par remoto, 6 remotas sem ficheiro local e nenhuma coincidente. Os nomes/SQL remotos mapearam cinco migrations antigas; `create_packages_and_quotations` estava duplicada. Após o repair de 2026-10-26, `migration list` confirma 25/25 versões coincidentes. O snapshot pré-repair está em `docs/DEVELOPMENT.md`.
- As 18 migrations sem linha remota foram comparadas read-only ao catálogo PROD sem Docker: colunas/defaults, constraints/FKs, índices, triggers, policies/grants e 16 bodies finais de função correspondem cumulativamente. O nome aparente da policy era truncação de 64 para 63 bytes, não uma diferença. O overload local 6/7 de `record_commitment_settlement` foi resolvido com migration forward; quatro migrations continham corpos posteriormente substituídos.
- Por escolha do responsável, `20261026091410_restore_missing_catalog_comments.sql` restaurou comentários e `20261026094105_drop_legacy_record_commitment_settlement_overload.sql` alinhou resets locais. Ambas foram aplicadas/registadas. O repair global marcou 23 migrations locais `applied` e seis entradas antigas `reverted`; 25 versões agora coincidem. Não foi executado `db push`.
- Na mesma verificação, `.env.local` e `supabase/.temp/project-ref` apontavam para PROD. O ficheiro `.env.local` não foi copiado nem os valores de chave foram expostos.
- A consulta read-only ao catálogo do PROD confirmou 9 tabelas públicas da aplicação com RLS ativo; `anon` lê as 9, tem CRUD em 7 e pode executar as 14 funções `SECURITY DEFINER` identificadas. Nenhuma linha de negócio foi consultada. A existência de RLS, por si só, não significa isolamento quando as policies são `true`.
- Não há autenticação de utilizador no frontend, e há políticas RLS permissivas para `anon`. É necessário esclarecer modelo de acesso e revisar a exposição antes de ampliar uso público/partilhado.
- O responsável confirmou integração GitHub–Cloudflare Pages com deploy automático após push para `main`; o repositório não contém workflow próprio de publicação, e `wrangler.jsonc` configura assets/fallback.
- A lista padrão de testes contém suites que alteram e apagam dados remotos; integração real de IA exige serviço externo. `tsx` é usado pelos scripts mas não aparece como dependência direta nem no lockfile.
- `backups/data.sql`, `backups/roles.sql` e `backups/schema.sql` estão versionados; o conteúdo não foi inspecionado por poder conter dados sensíveis. Rever governança/acesso desses artefactos.
- Não há changelog/TODO central identificado nem registos acessíveis do Antigravity. Não é possível inferir o plano ou as prioridades do antigo desenvolvimento.

## Questões a esclarecer com a equipa antes de continuar

1. Qual projeto Supabase deve ser alvo de desenvolvimento? O estado observado neste checkout é PROD; é esse o alvo intencional ou falta trocar o link/variáveis para DEV?
2. O responsável confirmou que a autenticação da app será tratada depois do alinhamento das migrations e deploy. Qual modelo de identidade/autorização substituirá o acesso `anon` observado no PROD?
3. As Edge Functions estão implantadas? Qual versão do Gemini/modelo e quais secrets estão configurados no ambiente remoto?
4. O responsável confirmou publicação automática no Cloudflare Pages após push para `main`. Quais build settings/variáveis estão configuradas e qual o processo de entrega do Markdown ao website/Manager? O dashboard redirecionou para login.
5. Os backups SQL versionados devem permanecer no repositório principal ou ser governados apenas pela branch dedicada de backup?
