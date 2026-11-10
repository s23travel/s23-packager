# Editar os serviços apresentados na lâmina

Status: resolved
Blocked by: none

## Objetivo

Garantir que a lâmina mostra todos os serviços incluídos no pacote — incluindo `additional` como os bilhetes do Bernina-Express, que hoje são descartados por uma lista branca — e permitir que a operadora edite, remova e adicione itens de "Serviços apresentados" antes da prévia final. Corrigir também o enquadramento dos itens na peça.

## Critérios

- Serviço `additional` com descrição publicável entra na lista sem lista branca; descrição com termos internos, preços ou contactos continua omitida com aviso, e nada desaparece em silêncio por tamanho (o editor sinaliza).
- O editor respeita 6 itens e 40 caracteres por rótulo; qualquer edição invalida a prévia final do servidor, como o subtítulo.
- O texto editado chega ao PNG/HTML salvos: `preview` leva `items`, a Edge Function valida e substitui o modelo derivado; `publish` continua a publicar a prévia staged.
- A lista é um bloco centralizado com linhas alinhadas à esquerda e ícones de tamanho fixo; listas densas usam o modo compacto e mantêm o rodapé na área segura.
- Testes locais cobrem inclusão, rejeição, sobreposição no servidor, edição no fluxo público e recusa de `items` forjados. Sem deploy, push, migração ou dados de produção.

Referência: `../spec.md` e `../itens-apresentados-design.md`.

## Comentários

- Implementado localmente em 2026-11-10: lista branca removida, contrato `flyerItemsContract.ts`, editor no painel, campo `items` na prévia, alinhamento/compactação do CSS e testes. Verificado com `tsc --noEmit`, `deno check`, persistência, fluxo público e fixture 1080×1920 (normal e densa).
- Pendente de autorização: publicar o worker (markup/CSS), a Edge Function `package-flyer` (campo `items`) e a SPA, por esta ordem.
- O rótulo "Bilhetes de trem Tirano + Bernina Express" (41 caracteres) excede o limite mantido de 40 e tem de ser encurtado no editor.

