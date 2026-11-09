# Gerar imagem e subtítulo por IA

Status: ready-for-agent
Blocked by: 02

## Objetivo

Implementar a fronteira de geração de imagem do destino e de sugestão do subtítulo, com integração autenticada e chave somente no backend; a IA não altera preços, datas ou itens.

## Critérios

- Usar modelo de imagem Gemini compatível com 9:16; verificar documentação atual, disponibilidade e custos, sem supor que a chave existente dá acesso ao modelo.
- Reaproveitar a validação de usuário existente; validar entradas, tratar respostas sem imagem, erros e limites e evitar expor segredos ou dados comerciais internos.
- Disponibilizar uma interface tipada para a futura tela, sem depender do conteúdo do website.
- Testar pela fronteira pública com respostas simuladas. Não publicar funções nem gravar dados remotos. Chamada real à IA apenas se necessária e permitida, usando dados fictícios; documentar custo e resultado sem revelar segredos.

Referência: `../spec.md`.
