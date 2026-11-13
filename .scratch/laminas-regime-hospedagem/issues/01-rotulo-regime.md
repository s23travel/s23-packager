# 01 — Rótulo do regime na derivação partilhada

Status: ready-for-agent
Blocked by: —

Especificação: `.scratch/laminas-regime-hospedagem/spec.md` («Solução», «Decisões de implementação»).

## Objetivo

A derivação comercial partilhada passa a produzir o texto de hospedagem a partir do regime registado no serviço:

- regime de apenas alojamento → `Hospedagem`;
- qualquer outro regime registado → `Hospedagem com <regime>`, em minúscula inicial e sem o código entre parênteses;
- regime ausente → `Hospedagem` (aviso inalterado).

## Ficheiros

- `src/services/flyerCommercialModel.ts`: a regra vive na derivação serviço→item, numa função pura local ao módulo.
- `tests/test_package_flyer.tsx`: casos novos no seam existente (`createPackageFlyer(...).model.items`).

## Detalhes

- Os cinco regimes conhecidos mantêm a forma que a peça já publica: `café da manhã`, `meia-pensão`, `pensão completa`, `tudo incluído`, `apenas alojamento`.
- O valor registado que não está no mapa é usado como está: retirar parênteses, normalizar espaços, baixar a primeira letra.
- Apenas alojamento: reaproveitar `normalizeMealPlan` (`../types/index.ts`), que já reconhece `apenas alojamento`, `somente alojamento`, `só hospedagem`, `room only`, `RO`. Acrescentar as grafias de alojamento sem refeições que hoje escapam (`somente hospedagem`, `só alojamento`, `alojamento`) para não gerar `Hospedagem com somente alojamento`.
- Caso de apenas alojamento: rótulo exatamente `Hospedagem`, sem aviso.
- Duas hospedagens com regimes diferentes continuam a produzir dois itens; a deduplicação atual mantém-se.

## Testes

`npx --yes tsx@4 tests/test_package_flyer.tsx` (offline, sem Supabase). Cobrir: `Café da manhã (BB)`, `Meia-pensão (HB)`, `Pensão completa (FB)`, `Tudo incluído (AI)`, `Apenas alojamento (RO)`, `Somente alojamento` e `Room only`; regime livre registado (`Pequeno-almoço`); regime com código entre parênteses fora do mapa. Manter as asserções existentes.
