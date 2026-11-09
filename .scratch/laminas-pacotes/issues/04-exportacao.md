# Exportar lâmina em PNG e HTML

Status: ready-for-agent
Blocked by: 02

## Objetivo

Disponibilizar a exportação da lâmina revisada usando o mesmo modelo visual da prévia, em PNG 1080 × 1920 e HTML utilizável fora da sessão do aplicativo.

## Critérios

- Fonte, logotipo, imagem, cores e informações comerciais coincidem com a prévia; o HTML não depende de URLs temporárias autenticadas nem de segredos e pode ser aberto offline.
- Validar dimensões e legibilidade; falhas de imagem, fonte ou exportação devem ser reportadas, sem baixar arquivo incompleto como se fosse sucesso.
- A exportação recebe dados revisados e não chama IA nem modifica o pacote.
- Priorizar testes de comportamento com dados fictícios e recursos locais. Não executar testes que escrevam em produção.

Referência: `../spec.md`, em especial as histórias de download e as regras de segurança.
