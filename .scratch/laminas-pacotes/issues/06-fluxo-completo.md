# Integrar criação, revisão, download e anexo

Status: ready-for-agent
Blocked by: 01, 02, 03, 04, 05, 07

## Objetivo

Integrar a partir do detalhe do pacote a geração com IA, a revisão da prévia, as duas opções de download e o salvamento/recuperação da última lâmina.

O ticket 07 antecipa a integração de geração, revisão e download; completar aqui a integração do anexo e validar o fluxo inteiro, sem considerar concluído o salvamento enquanto o ticket 05 estiver bloqueado.

## Critérios

- Revisão clara de preço, condições, datas, serviços, imagem e subtítulo; mensagens para dados ausentes, erros e estados de carregamento, sem alterar o pacote sem intenção explícita.
- Download do PNG ou HTML e novo download da última versão salva sem nova chamada à IA; dados comerciais permanecem determinísticos.
- Testar o fluxo através da interface pública com IA e persistência simuladas; verificar visualmente a referência e as margens.
- Não fazer deploy, executar migration remota, rodar suites que criem ou apaguem dados nem operar dados de clientes. Documentar as integrações reais não verificadas e qualquer bloqueio.

Referência: `../spec.md` e tarefas anteriores.
