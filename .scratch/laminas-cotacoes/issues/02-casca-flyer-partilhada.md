# 02 — Casca do flyer partilhada e download JPG

Status: ready-for-agent
Blocked by: —

Especificação: `.scratch/laminas-cotacoes/spec.md` («Mapa de implementação → Serviços e componentes», «Decisões de produto e template → Download/Rótulos»).

## Objetivo

Extrair de `PackageFlyerCreator` a casca de estado, os controlos, a pré-visualização do servidor, os downloads da versão salva e a conversão PNG→JPG, **sem alterar o comportamento nem o visual da lâmina de pacote**. A cotação (tickets 08) consome estes módulos.

## Ficheiros

- `src/components/flyers/useFlyerCreator.ts` (novo): máquina de estados e handlers comuns — geração IA, hint, subtítulo, itens, prévia local, prévia servidor, publicação, downloads, conversão JPG, revogação de URLs. Sem estado de aceites. Deve aceitar callbacks/adaptadores para: criar modelo local, criar prévia no servidor, publicar, ler anexo atual, descarregar anexo e produzir o nome do ficheiro.
- `src/components/flyers/FlyerControls.tsx`, `FlyerItemsEditor.tsx`, `FlyerServerPreview.tsx`, `FlyerSavedDownloads.tsx` (novos): markup e rótulos atuais («Gerar imagem e subtítulo», «Gerar nova sugestão», «Gerar lâmina», «Salvar lâmina no pacote»/equivalente parametrizável, «HTML», «IMAGEM»). Sem caixas de confirmação.
- `src/services/flyerDownload.ts` (novo): `convertPngToJpg`, geração de nome de ficheiro sanitizado, helper de download; suporta prefixo configurável (`lamina-pacote-…`, `lamina-cotacao-…`).
- `src/components/packages/PackageFlyerCreator.tsx`: passa a consumir a casca e os controlos; mantém a API pública `{ package, open, showToggle }` e o comportamento atual.
- CSS da lâmina de pacote **não** muda de aparência.

## Regras

- Nada de alterações de copy, ordem de blocos ou classes CSS da lâmina de pacote.
- A conversão JPG continua a acontecer no cliente sobre o PNG do servidor; falha mostra erro e não descarrega ficheiro mal rotulado.
- A secção da versão salva e os downloads ficam fora de qualquer bloco condicionado ao modelo local (necessário para a cotação, ticket 08).

## Testes (portão de regressão)

- `npx tsx tests/test_package_flyer.tsx`
- `npx tsx tests/test_package_flyer_persistence.ts`
- `node tests/package_flyer_flow.runner.mjs` (ou o comando documentado no próprio runner), com `CHROME_PATH` se necessário — é offline.
- `npx tsc --noEmit`.

## Critérios de aceitação

- Testes da lâmina de pacote verdes e markup da lâmina de pacote inalterado (comparar com o output antes do refactor, ex.: snapshot textual no próprio teste).
- `PackageFlyerCreator` fica claramente mais fino e sem duplicação da casca.
- Nenhuma dependência nova.
