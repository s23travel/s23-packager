# 09 — Documentação e fecho da entrega

Status: ready-for-agent
Blocked by: 05, 06, 07, 08

Especificação: `.scratch/laminas-cotacoes/spec.md` («Mapa de implementação → Documentação», «Sequência sugerida»).

## Objetivo

Documentar a lâmina da cotação e fechar a verificação final antes da publicação.

## Ficheiros

- `docs/LAMINA-CONTRATO.md`: secção da cotação — contrato do modelo, template 9:16, mapeamento de campos, privacidade, decisões de 2026-11-11, referência visual `preview-cotacao-9x16.png`, tabelas/RPCs/Edge Function, fila com `owner_kind`, ordem de publicação.
- `docs/LAMINA-IA.md`: corrigir o modelo desatualizado para o estado atual (`gemini-nano-banana-2.1` na imagem, `gemini-3.6-flash` no texto) e registar que a IA continua a receber apenas destino + indicação; o nome do cliente nunca é enviado.
- `docs/DEVELOPMENT.md`: nota curta sobre a nova Edge Function `quotation-flyer` e a migration de lâmina da cotação.
- `AGENTS.md` (se aplicável): manter o mapa de ficheiros coerente se novos diretórios forem relevantes.
- `.scratch/laminas-cotacoes/map.md`: estado final.

## Verificação final

- `npx tsc --noEmit`.
- `npm run build` com as variáveis de ambiente do processo (se disponíveis no ambiente do agente); caso contrário, registar que `tsc` passou e que o build exige `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` de PROD.
- Suítes offline: `tests/test_package_flyer.tsx`, `tests/test_package_flyer_persistence.ts`, `tests/test_quotation_flyer.ts(x)`, `tests/test_quotation_flyer_persistence.ts`, runners browser de pacote e cotação, `tests/test_quotation_flyer_sql.ts`, `tests/test_flyer_renderer_templates.ts`.
- **Não** executar `npm test` nem suites que escrevem no Supabase; **não** executar `test:all`.
- Confirmar que nenhuma alteração visual da lâmina de pacote entrou.

## Critérios de aceitação

- Documentação descreve a implementação real (nomes de RPC, ações, campos, template).
- Nenhum segredo, dado de cliente real ou chave em documentação.
- Checklist de publicação preenchido: renderer (`npx wrangler@3 deploy --config workers/flyer-renderer/wrangler.jsonc`), migration, Edge Function `quotation-flyer`, frontend (push em `main`).
