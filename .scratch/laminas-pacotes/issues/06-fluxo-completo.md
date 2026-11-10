# Integrar criação, revisão e download

Status: ready-for-agent
Blocked by: 01, 02, 03, 04, 05, 07

## Objetivo

Integrar e validar a partir do detalhe do pacote a geração com IA, a revisão da prévia, as duas opções de download e salvar/recuperar a última lâmina no pacote usando arquivos renderizados no servidor.

O ticket 07 implementa a integração local de geração, revisão e download. Completar aqui a integração do anexo do ticket 05 e testar o fluxo final com persistência simulada.

## Critérios

- Revisão clara de preço, condições, datas, serviços, imagem e subtítulo; mensagens para dados ausentes, erros e estados de carregamento, sem alterar o pacote sem intenção explícita.
- Download HTML/PNG do renderer e novo download da versão salva sem chamada de IA; os dados comerciais continuam derivados deterministicamente do pacote.
- Testar o fluxo através da interface pública com IA e exportação simuladas; verificar visualmente a referência e as margens.
- Antes de salvar, mostrar e exigir confirmação da prévia final PNG gerada pelo servidor; só depois publicar o par staged. Mostrar estados de carregamento/vazio/erro e sucesso; se a persistência falhar, manter downloads locais e informar que a versão anterior continua anexada.
- Não fazer deploy, executar migration remota, rodar suites que criem ou apaguem dados nem operar dados de clientes. Documentar as integrações reais não verificadas e qualquer bloqueio.

Referência: `../spec.md` e tarefas anteriores.
