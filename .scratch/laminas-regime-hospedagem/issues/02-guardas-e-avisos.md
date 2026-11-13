# 02 — Guardas de publicação do regime e avisos

Status: done
Blocked by: 01
Commit: 6a0a1cf

Especificação: `.scratch/laminas-regime-hospedagem/spec.md` («Decisões de implementação», avisos).

## Objetivo

O regime só entra no texto público quando pode ser publicado e cabe no limite do item. Caso contrário, o rótulo fica `Hospedagem` e a operadora recebe um aviso.

## Ficheiros

- `src/services/flyerCommercialModel.ts`: aplicar as guardas na mesma função de rótulo do ticket 01, reutilizando `itemContentProblem` e `FLYER_ITEM_LABEL_MAX` do contrato dos itens.
- `tests/test_package_flyer.tsx`: casos no seam `createPackageFlyer`.

## Detalhes

- Prefixo `Hospedagem com ` ocupa 15 dos 40 caracteres: regime maior do que o espaço restante → `Hospedagem` + aviso. Nunca truncar texto comercial.
- Regime com termo interno, preço ou contacto (`itemContentProblem`) → `Hospedagem` + aviso.
- Regime ausente → `Hospedagem` e mantém-se o aviso atual de regime não reconhecido.
- Avisos continuam a ser acrescentados à lista `warnings` que os construtores já devolvem; não bloquear a lâmina.
- Não alterar o contrato dos itens nem a validação do servidor.

## Testes

`npx --yes tsx@4 tests/test_package_flyer.tsx`. Cobrir: regime com termo interno (`sem fornecedor`), regime com valor (`10%`), regime com 26+ caracteres, regime ausente. Verificar rótulo `Hospedagem` e presença de aviso em cada caso, e ausência de aviso nos casos válidos do ticket 01.

## Comentarios

Entregue junto com o ticket 01: as guardas de conteudo (itemContentProblem) e de tamanho nasceram na mesma funcao do rotulo, e os testes respetivos ficaram no commit 6a0a1cf. A revisao de codigo (ticket 04) reescreveu o aviso de tamanho e verificou o conteudo do regime antes de retirar os parenteses.
