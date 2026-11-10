# Desenho: serviços apresentados na lâmina

Status: aprovado em 2026-11-10 (opção A, limite de 40 caracteres mantido)

## Intenção

A lâmina deve divulgar todos os serviços que o pacote inclui e permitir que a operadora ajuste o texto dessa lista antes de gerar o arquivo final. Hoje a lista é derivada do pacote por uma regra fechada que descarta serviços legítimos, e não há como corrigir o texto.

## Problema observado

1. `addAdditional` em `src/services/packageFlyerService.ts` só aceita três descrições exatas ("passeio de barco", "passeio guiado", "ingresso"). Qualquer outro serviço `additional` — como "Bilhetes de trem Tirano + Bernina Express" — é omitido com aviso, independentemente do nome.
2. Não existe estado nem interface para editar os itens; o subtítulo e a imagem têm edição, os itens não.
3. `.package-flyer__items li` centraliza cada linha isoladamente e o ícone usa `width: 5%` do próprio `li`. As margens esquerdas ficam irregulares e cada ícone sai com tamanho diferente conforme o texto da linha.

## Objetivos

- Incluir por padrão todo serviço `additional` com descrição publicável, sem lista branca.
- Permitir editar, remover e adicionar itens em "Serviços apresentados" antes da prévia final.
- Garantir que o texto editado chega ao PNG/HTML salvos, com validação equivalente no cliente e na Edge Function.
- Corrigir o enquadramento dos itens e manter o rodapé dentro da área segura mesmo com listas densas.

## Não objetivos

- Guardar os itens editados no pacote (`data.flyerItems`) — opção B, descartada nesta entrega.
- Mudar os nomes comerciais padrão "Aéreo" e "Hospedagem" (continuam iguais; passam apenas a ser editáveis).
- Aumentar o limite de 6 itens ou criar ícone específico de bilhete.
- Alterar preço, datas, condições de pagamento, IA, persistência do anexo ou regras de publicação.

## Abordagens consideradas

1. **Itens na sessão da lâmina e enviados na prévia final — escolhida.** Mesmo padrão do subtítulo: estado no painel, validado por contrato partilhado, enviado em `preview` para o modelo canônico. Não mexe nos dados do pacote; ao reabrir, a lista volta a ser a automática, já completa.
2. **Lista curada em `data.flyerItems` — descartada.** Preserva a curadoria entre sessões, mas exige gravação do pacote, leitura do campo no servidor e um "voltar à lista automática", sem resolver o problema principal (a lista automática incompleta).
3. **Manter a lista branca e depender só da edição — descartada.** Omitiria o serviço por padrão e obrigaria a corrigir cada lâmina.

## Decisões

- **Contrato partilhado** `supabase/functions/_shared/flyerItemsContract.ts`: tipos de ícone, máximo de 6 itens, rótulo entre 1 e 40 caracteres, normalização (trim, espaços colapsados, sem caracteres de controlo) e rejeição de termos internos (`fornecedor`, `custo`, `lucro`, `margem`, `comissão`, `confidencial`, `sigiloso`, `interno`), valores monetários, percentagens, e-mails, URLs e telefones. Usado pelo cliente e pela Edge Function.
- **Limite mantido em 40 caracteres**, decisão do responsável. O worker não muda de limite; "Bilhetes de trem Tirano + Bernina Express" (41) tem de ser encurtado no editor. Um pagamento/cobrança não é o critério.
- **Geração**: `additional` passa a usar o rótulo normalizado da descrição em vez da lista branca; reprovado por conteúdo, o item é omitido com aviso. Uma descrição publicável mas acima de 40 caracteres entra na lista e é assinalada como erro no editor, bloqueando a prévia final — nunca desaparece em silêncio. `other` continua omitido (categoria de custo), mas pode ser adicionado manualmente no editor. O teste de "Passeio com fornecedor secreto" continua a não aparecer.
- **Editor no painel** (`PackageFlyerCreator`): lista inicializada a partir do modelo ao abrir ou quando o pacote/modo muda; cada linha tem tipo (Aéreo, Transporte, Hospedagem, Transfer, Seguro, Extra), texto com contador e botão remover; "Adicionar item" desativado em 6. Lista vazia é permitida: a caixa de itens só é desenhada se houver itens ou subtítulo.
- **Revisão**: qualquer alteração nos itens limpa a prévia final do servidor e a respetiva confirmação, como já acontece com o subtítulo. Rótulo inválido mostra erro em texto e bloqueia a prévia final.
- **Servidor**: `preview` aceita o campo opcional `items` (o campo passa a ser permitido em `fieldsByAction`); `createPackageFlyerServerModel` recebe os itens, valida e substitui os derivados. Sem `items`, o comportamento é o atual. `publish` não muda: publica a prévia staged.
- **Densidade**: `renderPackageFlyerMarkup` calcula uma classe `package-flyer--compact` quando há 5 ou mais itens ou algum rótulo acima de 30 caracteres; o CSS reduz então a fonte e o espaçamento apenas dentro de `.package-flyer__items`. Sem isso, 6 rótulos de duas linhas empurram o rodapé para fora da área segura (a faixa útil é de cerca de 1420 px em 1080 × 1920).
- **Enquadramento**: a lista fica num bloco centralizado (`width: fit-content; margin: 0 auto`), com linhas alinhadas à esquerda, ícone em `cqw` e alinhado ao topo do texto; sem ícones de tamanhos diferentes.
- **Textos do painel**: o aviso "Preço, datas, rota e serviços vêm do pacote" passa a "Preço, datas e rota vêm do pacote; ajuste os serviços abaixo se precisar". O bloco de texto sob a prévia passa a mostrar os itens e o subtítulo revistos, não o modelo automático.
- **Ordem de publicação**: worker (markup + CSS) → Edge Function `package-flyer` (campo `items`) → SPA. Publicar antes da função faria a prévia final recusar o campo novo; cada passo exige autorização.

## O que fica para a implementação

- Calibrar o fator da classe compacta com um fixture 1080 × 1920 de pior caso (6 itens de 40 caracteres) e confirmar que o rodapé continua dentro da área segura.
- Definir os textos de erro do editor (vazio, longo, termo interno) e o `aria-describedby` dos campos.
- Cobrir em `tests/test_package_flyer.tsx` a inclusão de `additional` livre, a rejeição por termo interno e por tamanho, e a sobreposição validada no modelo do servidor; em `tests/package_flyer_flow.browser.tsx` a edição que altera a prévia, invalida a prévia final e chega ao `preview`; em `tests/test_package_flyer_persistence.ts` a recusa de `items` forjados.
- Nenhuma operação em base de dados, deploy ou push faz parte desta entrega sem autorização específica.

## Aprovação e limites

A opção A foi escolhida pelo responsável ("Ok, siga com o A"). A aprovação deste documento cobre apenas código e testes locais; deploy do worker/Edge Function e publicação da SPA continuam a exigir autorização própria.
