# Exportação da lâmina

`createPackageFlyerHtml(model)` e `createPackageFlyerPng(model)`, em `src/services/packageFlyerExport.tsx`, recebem um `PackageFlyerModel` já validado e revisado e retornam `Promise<Blob>`. Não iniciam download, não chamam IA e não modificam o modelo ou o pacote. A integração deve tratar rejeições e só oferecer o arquivo após sucesso; revisão dos avisos comerciais continua sendo responsabilidade da interface.

A imagem revisada é obrigatória e pode ser uma URL `data:`, `blob:` ou uma URL acessível por `fetch` sem credenciais e com CORS quando aplicável. PNG, JPEG e WebP são aceitos; uma URL assinada pode ser usada como entrada, mas não é copiada ao arquivo. A imagem, o logotipo e os três pesos Poppins do kit são incorporados; o HTML não contém scripts nem precisa de sessão ou rede. Falhas de recursos, fontes, dimensões ou conteúdo excessivo rejeitam a operação com mensagem em português. O PNG usa SVG `foreignObject` e canvas, que exigem suporte do navegador; uma falha de rasterização também rejeita a operação.

O HTML e o PNG usam o mesmo `PackageFlyerTemplate` e os mesmos estilos/tokens da prévia, com tamanho fixo de 1080 × 1920. A validação mede a área segura e detecta transbordamento; isso não substitui a revisão humana de contraste e conteúdo. Texto editado deve ser revisado antes de chamar a API. A interface, a persistência e o download de arquivos são tarefas separadas.

## Fixture local

`tests/test_package_flyer_export.ts` usa apenas dados fictícios, constrói a imagem no navegador e testa formatos, conteúdo, recursos indisponíveis, excesso de texto e ausência de URLs assinadas. Pode ser empacotado com o esbuild já transitivo do Vite, sem instalar pacotes: use os loaders `--loader:.css=text --loader:.ttf=dataurl --loader:.png=dataurl`, bundle em `flyer-test.js` e abra `tests/package_flyer_export_fixture.html` junto ao bundle em um servidor local. O resultado aparece no atributo `data-result` do `body`. Para confirmar portabilidade, salve o conteúdo do iframe `#exported-html` e abra-o em um contexto isolado offline; a imagem `#exported-png` permite verificar o PNG visualmente.
