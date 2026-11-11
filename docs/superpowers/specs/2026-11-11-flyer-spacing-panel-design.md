# Ajustes de espaçamento e painel da lâmina

## Intenção

Dar mais respiro visual entre o período e os serviços apresentados, e entre os serviços e o subtítulo, clareando discretamente a caixa central conforme a referência enviada.

## Abordagens

- Aumentar o `gap` geral do painel — simples, mas também altera os intervalos do bloco de preço e entre outros elementos não solicitados.
- Aplicar espaçamento adicional apenas à lista de serviços e ao subtítulo — escolhido por ser localizado e preservar o restante da composição.

## Desenho

- Manter a estrutura/markup atual e adicionar um incremento de espaço acima da lista e do subtítulo, inclusive no modo compacto.
- Aumentar a opacidade do token `--flyer-panel` de `0.70` para `0.75`, sincronizando `colors_and_type.css` e `handoff/tokens.css`.
- Não alterar preço, data, dimensões, outros intervalos, itens ou imagem.
- Validar o build e os testes determinísticos da lâmina; não publicar Worker nem fazer commit/push sem pedido.
