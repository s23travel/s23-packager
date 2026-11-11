# 01 — Campos da cotação (data, sinal, restante, não incluído)

Status: done
Blocked by: —
Commit: 710d397

Especificação: `.scratch/laminas-cotacoes/spec.md` («Decisões aprovadas em 2026-11-11», «Campos a criar», «Campos a renomear no formulário», «Decisões de dados»).

## Objetivo

Criar a base de dados da cotação que o template 9:16 vai consumir: data da cotação, sinal, data-limite do restante e lista de não incluídos, com formulário, detalhe, rascunho e duplicação.

## Ficheiros

- `src/types/index.ts`: `QuotationData` ganha `proposalDate?: string`, `depositAmount?: number`, `balanceDueDate?: string`, `notIncluded?: string[]`. `QuoteDraft` ganha os mesmos quatro campos. **Não** criar `validUntil`.
- `src/pages/quotes/QuoteFormPage.tsx`: «Data da cotação» (input `date`, pré-preenchido com a data de `created_at` ao carregar uma cotação existente; editável; default hoje numa nova), «Sinal» (número), «Restante até» (input `date`), «Não incluído» (lista de até 3 linhas, 100 caracteres cada; acrescentar/remover). Preservar em `saveQuoteDraft` e no payload de `QuotationData`.
- `src/services/quoteDraftService.ts` (se normalizar campos): incluir os novos campos.
- `src/pages/quotes/QuoteDetailPage.tsx`: exibir a data da cotação (`DD/MM/AAAA`), o sinal (`formatMoney`) e o restante até (`DD/MM`) e a lista de não incluídos na secção comercial.
- `src/services/quotationsService.ts` e/ou duplicação de cotação: copiar os quatro campos no snapshot de duplicação.
- Labels do formulário conforme a tabela «Campos a renomear no formulário» (apenas os labels; não mudar a semântica dos campos existentes). Em particular: «Condição de Pagamento (Entrada / Saldo)» → «Sinal + Restante até», «Taxa Local na Hospedagem»/«Serviços Extras / Opcionais» → «Não incluído (lista)». Manter `paymentConditions`, `localTaxNotes`, `extraServicesNotes` e `customNotes` no formulário e nos dados como legado; não os remover.
- `src/components/packages/PackageServicesEditor.tsx`: label dos transportes para «Serviço de ida/volta (rota e companhia)» e da observação para «Bagagem / tarifa».

## Regras

- `proposalDate` e `balanceDueDate` são ISO `YYYY-MM-DD`.
- `depositAmount` na moeda da cotação; validar `>= 0` e `<= salePrice` quando ambos existirem (mensagem não bloqueante no formulário é aceitável; guardar como número ou `undefined`).
- `notIncluded`: máximo 3 linhas, cada uma 1–100 caracteres após `trim`; linhas vazias são descartadas.
- Sem migração SQL para estes campos: vivem no JSON `quotations.data`.

## Testes

- Novo teste offline `tests/test_quotation_flyer_fields.ts` (sem rede) que valide: rascunho preserva os quatro campos; normalização de `notIncluded` (trim, vazias fora, limite de 3); `depositAmount` numérico; `proposalDate` default a partir de `created_at`.
- `npx tsc --noEmit` limpo.
- Regressão: `npx tsx tests/test_package_flyer.tsx` (não executar suites que escrevem no Supabase).

## Critérios de aceitação

- É possível gravar e reabrir uma cotação com os quatro campos.
- O detalhe mostra os novos dados.
- Nenhum campo antigo foi removido.
- Nenhuma chamada a Supabase/IA nos testes.
