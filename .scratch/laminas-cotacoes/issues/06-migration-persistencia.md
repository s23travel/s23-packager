# 06 — Migration: persistência da lâmina da cotação

Status: ready-for-agent
Blocked by: —

Especificação: `.scratch/laminas-cotacoes/spec.md` («Decisões de segurança e persistência»). Modelo: `supabase/migrations/20261109201258_package_flyer_attachments.sql` e `20261109234000_fix_package_flyer_cleanup_ambiguity.sql`.

## Objetivo

Criar a persistência isolada da lâmina da cotação, reusando o bucket e a fila de limpeza, sem alterar dados de pacotes existentes.

## Ficheiros

- `supabase/migrations/<timestamp>_quotation_flyer_attachments.sql` (novo; timestamp posterior a `20261109234000`).

## Conteúdo obrigatório

- `public.quotation_flyer_operations`: espelhar `package_flyer_operations` com `quotation_id uuid not null references public.quotations(id) on delete cascade`; mesmos estados/hashes/timestamps e índice por `quotation_id`.
- `public.quotation_flyer_attachments`: `quotation_id uuid primary key references public.quotations(id) on delete cascade`, `operation_id`/`request_id`, caminhos HTML/PNG, created/updated.
- RLS ativa nas duas tabelas; `revoke all` a `public, anon, authenticated`; `grant select, insert, update, delete` a `service_role`.
- RPCs `security definer` espelhadas: `begin_quotation_flyer_upload`, `mark_quotation_flyer_uploaded`, `publish_quotation_flyer`, `fail_quotation_flyer_upload`, com CAS por `quotations.updated_at` e `expected_revision`; a publicação substitui a versão anterior e enfileira os objetos antigos; idempotência por `request_id`.
- Fila partilhada: `alter table public.package_flyer_cleanup_queue add column owner_kind text not null default 'package' check (owner_kind in ('package','quotation'))`; o claim do pacote passa a filtrar `owner_kind = 'package'`; novas `claim_quotation_flyer_cleanup(p_limit integer)` e `finish_quotation_flyer_cleanup(p_object_path text, p_success boolean, p_error text)` que filtram/gravam `quotation`. Não duplicar a tabela da fila.
- Trigger `before delete on public.quotations` que enfileira os objetos das operações da cotação com `owner_kind = 'quotation'`, sem bloquear a exclusão (a regra financeira existente continua a decidir se a cotação pode ser apagada).
- `comment on table/column` em pt-BR coerente com o resto.
- Nenhuma alteração às tabelas, RPCs ou triggers de pacote além do filtro `owner_kind` no claim e do default da coluna.

## Testes

- Revisão estática: comparar assinaturas e corpos com o espelho de pacote; garantir que `revoke`/`grant` cobrem todas as funções novas e que nenhuma função fica executável por `anon`/`authenticated`.
- Novo `tests/test_quotation_flyer_sql.ts` (offline) que lê o ficheiro e valida presença das tabelas, colunas, RLS, grants, RPCs, `owner_kind`, trigger e ausência de `drop table`/`alter table … package_flyer_*` destrutivo.
- **Não aplicar remotamente neste ticket.** A aplicação no projeto Supabase é feita na fase final pelo agente principal.

## Critérios de aceitação

- SQL válido, idempotente na medida do estilo do repositório (`create or replace` nas funções, `if not exists` nas tabelas/colunas).
- Pacotes existentes continuam a funcionar com o claim filtrado.
- Nenhum dado de cliente nos comentários/fixtures.
