# Integrar criação, revisão e download

Status: resolved
Blocked by: 01, 02, 03, 04, 07

## Objetivo

Integrar e validar a partir do detalhe do pacote a geração com IA, a revisão da prévia e as duas opções de download. A persistência/anexo foi explicitamente adiada pelo responsável e não faz parte da primeira entrega.

O ticket 07 implementa a integração de geração, revisão e download. Este ticket valida o fluxo do começo ao fim e mantém explícito que nada fica salvo/anexado ao pacote.

## Critérios

- Revisão clara de preço, condições, datas, serviços, imagem e subtítulo; mensagens para dados ausentes, erros e estados de carregamento, sem alterar o pacote sem intenção explícita.
- Download do PNG ou HTML sem persistência nesta primeira entrega; dados comerciais permanecem determinísticos.
- Testar o fluxo através da interface pública com IA e exportação simuladas; verificar visualmente a referência e as margens.
- Informar explicitamente que a lâmina não fica guardada no pacote e que será necessário gerar novamente para baixar após sair da tela.
- Não fazer deploy, executar migration remota, rodar suites que criem ou apaguem dados nem operar dados de clientes. Documentar as integrações reais não verificadas e qualquer bloqueio.

Referência: `../spec.md` e tarefas anteriores.
