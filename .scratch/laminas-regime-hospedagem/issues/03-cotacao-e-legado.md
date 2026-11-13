# 03 — Lâmina de cotação e legado

Status: ready-for-agent
Blocked by: 02

Especificação: `.scratch/laminas-regime-hospedagem/spec.md` («Decisões de implementação», «Decisões de teste»).

## Objetivo

Confirmar que a regra vale também na proposta de viagem, incluindo o caminho de legado, sem alterar o cartão de hospedagem.

## Ficheiros

- `src/services/quotationFlyerService.ts`: só mexer se a derivação partilhada não bastar; o `DEFAULT_MEAL_PLAN` de legado mantém-se (cotação antiga sem regime → `Hospedagem com café da manhã`).
- `src/services/flyerCommercialModel.ts`: ajustes só se os testes revelarem divergência.
- `tests/test_quotation_flyer.ts`: casos novos no seam existente (`createQuotationFlyer(...).model.included` e `.model.lodging`).

## Detalhes

- O cartão de hospedagem (`model.lodging` e `model.lodging.mealPlan`) mantém o comportamento atual, incluindo `apenas alojamento` como linha própria.
- Cotação com `services` atuais: regime `Café da manhã (BB)` → `Hospedagem com café da manhã`; `Somente alojamento` → `Hospedagem`; regime livre → `Hospedagem com <regime>`.
- Cotação de legado (`data.services` ausente, `data.lodging` presente) sem regime → `Hospedagem com café da manhã`.
- Pacote de legado sem regime → `Hospedagem` (cobrir em `tests/test_package_flyer.tsx` se ainda não estiver coberto).
- Regime desconhecido continua a bloquear? Não: agora aparece na lista apenas quando publicável; sem regime mantém-se o aviso.
- Os testes são offline. Não correr `npm test` (suites tocam no Supabase).

## Testes

`npx --yes tsx@4 tests/test_quotation_flyer.ts` e `npx --yes tsx@4 tests/test_package_flyer.tsx`. Manter `model.lodging.mealPlan === 'café da manhã'` e as asserções existentes.
