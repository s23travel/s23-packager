# Integrar geração e downloads à prévia

Status: resolved
Blocked by: 01, 02, 03, 04

## Objetivo

Permitir que a operadora gere e revise a imagem e o subtítulo sugeridos por IA na prévia e baixe a peça em HTML ou PNG. Esta tarefa pode avançar independentemente da persistência, que permanece bloqueada no ticket 05 e será integrada no 06.

## Critérios

- Invocar a interface de IA já existente apenas por ação explícita; apresentar carregamento, falhas, limite de uso e dados ausentes com texto claro, sem expor segredos ou dados internos.
- Apresentar imagem e subtítulo para revisão antes de baixar; não deixar IA alterar origem, destino, valores, datas ou serviços. A nota de quarto duplo é fixa conforme decisão do responsável.
- Habilitar download HTML ou PNG apenas quando os dados e recursos necessários estiverem prontos e revisados. Usar o template e exportadores existentes; evitar vazamentos de URLs de objetos e estados antigos ao trocar de pacote ou gerar novamente.
- Não alegar que a lâmina está anexada ou salva no pacote: a persistência pertence ao ticket 05/06.
- Testar o fluxo público da tela com IA e downloads simulados e dados fictícios; não efetuar escrita remota, deploy ou testes que alterem produção. O uso de IA real foi autorizado, mas a função nova ainda não foi implantada.

Referência: `../spec.md`, `docs/LAMINA-CONTRATO.md` e contratos dos serviços integrados.
