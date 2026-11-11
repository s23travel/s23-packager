# 07 — Edge Function `quotation-flyer` sobre pipeline comum

Status: ready-for-agent
Blocked by: 03, 06

Especificação: `.scratch/laminas-cotacoes/spec.md` («API da Edge Function», «Decisões de segurança e persistência»).

## Objetivo

Criar a Edge Function autenticada `quotation-flyer` com as ações `current`, `download`, `preview` e `publish`, reusando a orquestração da `package-flyer`, e extrair essa orquestração para `_shared/flyerPipeline.ts` sem alterar a função de pacote.

## Ficheiros

- `supabase/functions/_shared/flyerPipeline.ts` (novo): extrair de `supabase/functions/package-flyer/handler.ts` a leitura limitada do body, validação da imagem, hash, chamada ao renderer, upload para o bucket `s23-package-flyers`, chamadas RPC de begin/mark/publish/fail, idempotência e respostas de erro. Parametrizar por: nome da função, tabela/coluna do dono (`packages.id` / `quotations.id`), prefixo do RPC (`package` / `quotation`), construtor do modelo canônico, renderizador de markup, copy das mensagens e caminho `<id>/<requestId>.html|png`.
- `supabase/functions/_shared/quotationFlyerModel.ts` (novo): `createQuotationFlyerServerModel(quotationRecord, subtitle, items)` usando `createQuotationFlyer` e as validações de `validSubtitle`/`validFlyerItems`; rejeita `items` inválidos; não aceita do browser preço, sinal, cliente, data nem não incluídos.
- `supabase/functions/quotation-flyer/index.ts` e `handler.ts` (novos): configuração da cotação sobre a pipeline; `requireUser`; campos permitidos por ação — `current: [action, quotationId]`, `download: [action, quotationId, format]`, `preview/publish: [action, quotationId, expectedRevision, requestId, …]` com `image/subtitle/items` só no `preview`.
- `supabase/functions/package-flyer/handler.ts` e `index.ts`: passam a usar a pipeline, com o mesmo comportamento e mensagens.
- `supabase/functions/cleanup-package-flyer/index.ts`: processar as duas filas — claim do pacote e claim da cotação; para cada linha, apagar o objeto pelo Storage API e chamar o finish correspondente (`owner_kind`), mantendo o retry/contadores atuais.
- `supabase/config.toml`: registar `[functions.quotation-flyer]` com `verify_jwt = true`, se o padrão do ficheiro o exigir.

## Regras

- O modelo canônico é construído no servidor a partir da linha de `quotations` lida com o JWT do utilizador (RLS); o renderer recebe `template: 'quotation'`.
- Nenhum dado pessoal em logs; erros com código + mensagem pública, no formato atual.
- A prévia grava HTML/PNG no bucket privado; a publicação faz CAS por `updated_at` + `expectedRevision`.
- O download devolve `image/png` ou `text/html`, com o nome de ficheiro coerente (`lamina-cotacao-<ref>-<destino>` sanitizado).

## Testes

- Novo `tests/test_quotation_flyer_persistence.ts` (offline, com `fetch` falso, como `tests/test_package_flyer_persistence.ts`) cobrindo: `current`, `download` HTML/PNG, `preview` feliz, `publish` feliz, conflito de revisão, prévia expirada, idempotência, caminho inválido, hash, limite de tamanho, modelo inválido, imagem inválida e renderer a falhar.
- `npx tsx tests/test_package_flyer_persistence.ts` verde (pipeline extraída não muda o pacote).
- `npx tsc --noEmit`.

## Critérios de aceitação

- `package-flyer` mantém contrato e mensagens.
- `quotation-flyer` não confia em dados comerciais vindos do browser.
- Funções sem dependências novas (Deno imports atuais).
- Sem deploy neste ticket.
