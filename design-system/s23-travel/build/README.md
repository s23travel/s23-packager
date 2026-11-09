# build

Este pacote não tem etapa de build: `colors_and_type.css` é CSS puro, as fontes
são TTF locais e os previews são HTML estático. Nada é transpilado, empacotado
ou minificado — copiar a pasta é suficiente.

`tokens.json` é um export somente leitura dos tokens de `:root`, útil para
ferramentas que consomem JSON (Figma Tokens, Style Dictionary, validadores). Ele
é gerado a partir do CSS; em caso de divergência, **o CSS é a fonte de verdade**.

Se você regenerar o JSON, preserve os nomes e mantenha os valores idênticos aos
do CSS. Não introduza valores novos aqui.
