# Recuperação do subtítulo das lâminas — design

## Intenção

Evitar que uma resposta de imagem válida seja perdida porque o subtítulo vindo do Gemini está ausente ou fora do contrato, e tornar falhas upstream diagnosticáveis sem expor conteúdo.

## Abordagens

- **Só instrumentar e esperar outra falha:** menor alteração imediata, mas mantém a operadora bloqueada e não recupera subtítulos inválidos.
- **Resiliência com diagnóstico seguro (escolhida):** preservar o fluxo atual; normalizar apenas espaços/linhas do texto, validar com o contrato existente e, se continuar inválido, fazer uma tentativa curta de texto-only. Registrar categoria/status HTTP do Gemini sem prompts, respostas, dados de destino ou credenciais.
- **Relaxar o contrato do subtítulo:** aceitar mais caracteres/termos; pode deixar passar conteúdo comercial impróprio, por isso não será feito sem evidência de uma rejeição específica que justifique ampliar a regra.

## Comportamento e limites

- Manter Nano Banana 2.1, imagem 9:16 em 1K e validação comercial atual.
- Se a resposta combinada trouxer texto inválido, pedir uma frase curta sobre o destino em uma chamada texto-only e validar novamente; não inventar fallback no servidor.
- Respostas de erro do Gemini serão classificadas por status/código seguro, sem registrar body ou texto gerado.
- Não alterar autenticação, persistência, migrations ou formatos dos anexos.
- Confirmar com teste offline do handler cobrindo subtítulo ausente/inválido recuperável e falha upstream, mais typecheck. Não chamar Gemini nem executar suites que acedam ao Supabase PROD.

## Critérios de aceite

Um subtítulo recuperável passa a ser retornado com a imagem; conteúdo que continue inválido permanece rejeitado pelo contrato; logs permitem distinguir classes/status de falha sem guardar conteúdo sensível.
