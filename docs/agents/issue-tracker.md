# Rastreador de trabalho: Markdown local

As especificações e tarefas das skills de engenharia ficam em `.scratch/`, sem publicação automática em serviços externos.

## Convenções

- Uma funcionalidade por diretório: `.scratch/<funcionalidade>/`.
- Especificação: `.scratch/<funcionalidade>/spec.md`.
- Tarefas de implementação: um arquivo por tarefa em `.scratch/<funcionalidade>/issues/<NN>-<nome>.md`, numerado a partir de `01`.
- O estado fica em uma linha `Status:` perto do início de cada arquivo. Uma especificação pronta para execução usa `Status: ready-for-agent`.
- Comentários e histórico são acrescentados ao final, em uma seção `## Comentários`.

## Operações das skills

- Ao publicar uma especificação ou tarefa, criar o arquivo correspondente no diretório da funcionalidade, sem publicar externamente.
- Ao buscar uma tarefa, ler o arquivo informado pelo usuário ou localizado pelo número.
- Para mapas de trabalho, usar `.scratch/<funcionalidade>/map.md` e uma tarefa por arquivo na pasta `issues/`; registrar dependências em `Blocked by:` e resolução em `Status:`.

Não criar issues, etiquetas ou outros recursos em serviços externos sem pedido explícito.
