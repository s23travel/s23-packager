# Caixa de valores da lâmina de pacote: sinal na terceira linha

## Intenção

A caixa central da lâmina mostra hoje o rótulo “Valor”, o preço por pessoa, a condição “por pessoa em quarto duplo” e, quando existe, o texto livre de condições de pagamento. O pacote já grava `depositAmount`, mas a lâmina não o lê, e continua a avisar “Condições de pagamento não informadas” mesmo em pacotes com sinal registado.

O pedido da operação: a caixa passa a ler, de cima para baixo, o que o cliente precisa saber para decidir.

1. `valor por pessoa em quarto duplo`
2. o preço por pessoa, como hoje
3. `sinal <valor do sinal> + restante até 10 dias antes`

## Abordagens

- Ler o sinal e a data-limite (`balanceDueDate`) e escrever a data na terceira linha — descartada: a operação decidiu que a linha fala em “10 dias antes”, não numa data do pacote.
- Ler apenas o sinal e usar o texto fixo “restante até 10 dias antes” — escolhida: é o que a operação pediu e não depende de o campo de data estar preenchido.
- Manter a linha de condições de pagamento como está e acrescentar a do sinal por cima — escolhida como base, porque nenhum dos 43 pacotes tem o texto livre preenchido e assim nada se perde.

## Desenho

- `createPackageFlyer` passa a expor `deposit?: { amount, currency, formatted }` no modelo, a partir de `data.depositAmount` (`parseDepositAmount`). O sinal é por pessoa, na moeda do pacote, como o preço.
- O sinal só entra no modelo quando é maior que zero e menor que o preço por pessoa. Caso contrário fica de fora e gera aviso: sem isso a peça afirmaria um “restante” que não existe ou seria maior do que a própria viagem.
- Linha 1: o rótulo passa a ser o texto completo “valor por pessoa em quarto duplo”, em vez de “Valor” e da condição em duas linhas.
- Linha 3: `sinal <formatMoney(sinal)> + restante até 10 dias antes`, renderizada só quando o modelo tem sinal. O texto livre de condições de pagamento continua a aparecer abaixo, quando existir e passar na validação atual.
- O aviso “Condições de pagamento não informadas” passa a aparecer apenas quando o pacote não tem nem texto livre nem sinal.
- Pacotes sem sinal ficam exatamente como hoje: duas linhas dentro do bloco de preço.
- O modelo do servidor e a validação do renderer (`validPackageModel`, que recusa chaves desconhecidas) passam a aceitar `deposit`.
- CSS: `--flyer-text-body` para o rótulo e `font-size: calc(var(--flyer-text-body) * 1.1)` para a linha do sinal, seguindo o padrão de tamanhos derivados já usado nas lâminas. Nenhum token novo.
- Fora do âmbito: `balanceDueDate`, o campo “Restante até” do formulário, a lâmina de cotação e o layout de cabeçalho, rota, período, serviços e rodapé.

## Testes

- `tests/test_package_flyer.tsx`: rótulo novo, linha do sinal presente com sinal válido, ausente sem sinal e sem aviso indevido, sinal maior ou igual ao preço omitido com aviso.
- `tests/test_flyer_renderer_templates.ts`: `deposit` aceito e validado pelo renderer, markup do documento com a terceira linha.
- `tests/test_package_flyer_persistence.ts`: o modelo do servidor leva o sinal até ao renderer.
