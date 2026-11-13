# 04 — Correções da revisão: normalização de regimes e guardas

Status: ready-for-agent
Blocked by: 03

Especificação: `.scratch/laminas-regime-hospedagem/spec.md` («Apenas alojamento é um caso próprio», «Refeições vencem a palavra alojamento», «Regime negativo não vira afirmação», «Regime que não pode ser publicado»).

## Objetivo

Fechar as falhas encontradas na revisão de código do ramo `spec/laminas-regime-hospedagem`.

## Ficheiros

- `src/types/index.ts`: `normalizeMealPlan` passa a olhar primeiro para o termo de refeição e só depois para alojamento, e reconhece "pequeno-almoço". Acrescentar "somente hospedagem" ao caso de apenas alojamento.
- `src/services/flyerCommercialModel.ts`: usar a normalização como fonte única do regime de apenas alojamento (eliminar a regex local duplicada); verificar o conteúdo do regime **antes** de retirar os parênteses; normalizar texto todo em maiúsculas; renomear variáveis ambíguas; reescrever o aviso de tamanho sem expor a constante interna.
- `tests/test_package_flyer.tsx` e `tests/test_quotation_flyer.ts`: casos que fixam as correções.
- `docs/LAMINA-CONTRATO.md`: uma frase no parágrafo dos regimes conhecidos a descrever a regra do rótulo de hospedagem.

## Detalhes

- Falsos positivos atuais: "Alojamento com café da manhã", "Alojamento e meia-pensão", "Alojamento com tudo incluído" saem como `Hospedagem` sem aviso. Passam a sair com a refeição nomeada.
- Preço dentro do código entre parênteses ("Pensão completa (R$ 300)") passa a cair em `Hospedagem` com aviso, sem publicar o valor.
- Regime todo em maiúsculas não deve produzir `Hospedagem com pEQUENO-ALMOÇO`.
- Manter o aviso de regime negativo e o de regime ausente, ambos cobertos por teste.
- Nada muda no cartão de hospedagem da cotação nem no contrato dos itens.

## Testes

- `npx --yes tsx@4 tests/test_package_flyer.tsx`
- `npx --yes tsx@4 tests/test_quotation_flyer.ts`

Cobrir ainda: contacto no regime (ex.: um número de telefone) e a fronteira exata de 25/26 caracteres do regime.
