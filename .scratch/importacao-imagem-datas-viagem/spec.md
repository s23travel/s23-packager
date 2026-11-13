# Especificação: datas da viagem sugeridas na importação por imagem

Status: ready-for-agent

## Problema

Ao importar a imagem de um voo pela "Importação por IA", a revisão reconhece o trecho, os horários, os passageiros e o valor, mas os campos de data da viagem ficam vazios: "Data de Início" e "Data de Retorno" no pacote, "Ida" e "Regresso" na cotação. Na caixa de revisão, o bloco "Datas da Viagem" mostra "Não informado" para as duas. Só a lista de Serviços recebe dados.

O resultado é que a operadora precisa digitar o período à mão mesmo quando a captura mostra claramente as datas do voo, e a Duração (Dias) e (Noites) também fica sem preenchimento automático.

As causas são três, todas no caminho da importação:

1. O contrato de extração pede, para cada trecho, companhia, rota, horários, valor, quantidade e observações, mas não pede datas. O período geral (`dates`) existe no JSON, porém sem uma instrução que o ligue às datas visíveis do voo; somado à regra de nunca inventar, o modelo tende a devolver `dates` vazio.
2. A hospedagem tem check-in e check-out previstos na normalização, mas o formato de retorno pedido à IA não inclui o objeto de hospedagem, então essas datas também não chegam.
3. A normalização aceita qualquer texto como data. Uma data em formato humano (por exemplo `12/11/2026`) é repassada ao campo `type="date"`, que a descarta silenciosamente. Mesmo quando a IA devolve alguma data, o campo pode terminar vazio.

## Solução

A importação passa a assumir as datas visíveis na imagem e a sugerir o período da viagem:

- cada trecho de transporte passa a trazer a data de partida e a data de chegada, e a hospedagem o check-in e o check-out;
- o período da viagem é montado a partir dessas datas quando a IA não devolver um período explícito: início no primeiro embarque (ou check-in) e fim no último desembarque (ou check-out);
- as datas são aceitas no padrão brasileiro (dia primeiro, `DD/MM/AAAA`, `DD-MM-AAAA` ou `DD.MM.AAAA`) e também em ISO, e convertidas para o formato interno que o formulário já usa;
- a revisão mostra o período sugerido, em `DD/MM/AAAA`, antes de aplicar;
- ao aplicar, os campos de data do pacote ou da cotação são preenchidos e a Duração (Dias) e (Noites) é calculada como já acontece quando a operadora digita as datas;
- nada é inventado: data que não estiver legível na imagem permanece vazia, e uma data impossível ou ambígua não é adivinhada.

Quando a imagem só cobre parte da viagem (só a ida, só a volta, só o hotel), a importação preenche apenas o lado que consegue sustentar. Imagens complementares (voo + hotel, ida em uma imagem e volta em outra) completam o período sem conflito.

## Histórias de usuário

1. Como operadora, ao importar a imagem de um voo de ida e volta em um pacote, quero que "Data de Início" e "Data de Retorno" venham preenchidas com as datas do voo, para não as digitar.
2. Como operadora, ao importar a mesma imagem em uma cotação, quero que "Ida" e "Regresso" venham preenchidas, para ter o mesmo comportamento nos dois formulários.
3. Como operadora, quero ver o período sugerido na caixa de revisão antes de aplicar, para conferir se a IA leu as datas certas.
4. Como operadora, quero ver as datas da revisão no padrão brasileiro `DD/MM/AAAA`, para não precisar traduzir um formato técnico.
5. Como operadora, quero que o campo de data do formulário mostre a data no formato que o meu navegador já usa, sem eu converter nada.
6. Como operadora, quero que a Duração (Dias) e a Duração (Noites) sejam calculadas automaticamente a partir do período sugerido.
7. Como operadora, quero que uma imagem só do voo de ida preencha a data de início e deixe o retorno vazio, em vez de inventar uma data de volta.
8. Como operadora, quero que uma imagem só da volta preencha a data de retorno e deixe o início vazio, pelo mesmo motivo.
9. Como operadora, quero que uma imagem de hotel preencha o período da estadia quando não houver voo na importação, para aproveitar o check-in e o check-out visíveis.
10. Como operadora, quero que imagens complementares resultem em um período completo, com uma imagem contribuindo com o início e outra com o fim.
11. Como operadora, quero ser avisada quando as imagens discordarem sobre o período, para decidir qual está certo em vez de o sistema escolher por mim.
12. Como operadora, quero que uma data que a IA não conseguiu ler fique vazia, para não gravar um palpite no pacote ou na cotação.
13. Como operadora, quero que uma data impossível (como `31/02/2026`) seja descartada, para o período não ficar errado.
14. Como operadora, quero que datas escritas como `12/11/2026` e `12-11-2026` sejam lidas como 12 de novembro, no padrão brasileiro, mesmo quando o dia e o mês são ambos menores que 13.
15. Como operadora, quero que uma data em ISO devolvida pela IA (`2026-11-12`) também seja entendida, para a sugestão não depender do formato que o modelo escolher.
16. Como operadora, quero que a data não mude de dia por causa do fuso do navegador, para o período não começar um dia antes.
17. Como operadora, quero que a importação não apague datas quando a imagem não trouxer nenhuma sugestão, para não perder o que já estava preenchido.
18. Como operadora, quero que datas que eu já tinha digitado só sejam substituídas quando a importação realmente trouxer uma sugestão daquele lado.
19. Como operadora, quero continuar podendo corrigir as datas depois de aplicar, nos próprios campos do formulário.
20. Como operadora, quero que a mensagem de sucesso diga que datas e serviços foram importados, para saber o que foi preenchido.
21. Como operadora, quero que um voo com escala use a data do primeiro embarque e a do último desembarque, para o período cobrir a viagem inteira.
22. Como operadora, quero que a revisão continue a mostrar os serviços extraídos e a permitir removê-los antes de aplicar.
23. Como agente de viagens, quero que serviços, valores, moeda, passageiros, bagagem e destino continuem a ser importados exatamente como hoje, para a mudança não afetar o resto da cotação.
24. Como agente de viagens, quero que a revisão seja a mesma no pacote e na cotação, para não aprender dois fluxos.
25. Como responsável pelo produto, quero que a dedução do período aconteça em um único ponto da importação, para os dois formulários e o modo multi-imagem não divergirem.
26. Como responsável pelo produto, quero que a sugestão venha apenas do que está visível na imagem, para a importação continuar confiável.
27. Como responsável pelo produto, quero que a mudança não altere o contrato guardado dos serviços, para não precisar migrar pacotes e cotações existentes.
28. Como revisor de qualidade, quero testes offline que cubram voo, hotel, multi-imagem e formatos de data, para validar a regra sem chamar a IA.

## Decisões de implementação

- **Leitura das datas na extração.** O prompt da função de importação passa a pedir, para cada trecho de transporte, a data de partida e a data de chegada, e, para a hospedagem, o check-in e o check-out, além de pedir explicitamente que o período geral seja preenchido com a janela visível (primeiro embarque e último desembarque, ou check-in e check-out). A instrução de não inventar continua valendo: sem data legível, o campo volta nulo. Os campos de data por trecho são apenas de extração: alimentam a dedução do período e não são gravados no serviço do pacote, que mantém o contrato atual (sem migração nem campo novo no serviço).
- **Um único ponto de dedução, no cliente.** A dedução vive na normalização do serviço de importação por imagem, depois da extração e antes da consolidação, e não na função de servidor. Assim ela também vale para payloads de versões antigas da função, para simulações de teste e para os dois formulários, e pode ser testada offline.
- **Contrato de data na fronteira da importação.** A normalização aceita ISO `AAAA-MM-DD` (e ISO com hora, usando só a data), o padrão brasileiro `DD/MM/AAAA`, `DD-MM-AAAA` e `DD.MM.AAAA`, com dia e mês de um ou dois dígitos quando fizer sentido, e valida o calendário (inclusive ano bissexto). Qualquer outro texto é tratado como ausente; não se deduz ano nem se escolhe entre dia e mês fora do padrão brasileiro. As datas com hífen são desambiguadas pelo padrão: quatro dígitos no início é ISO; o restante é dia primeiro, como nas capturas e na interface em português.
- **Persistência continua em ISO.** O valor guardado no pacote e na cotação permanece `AAAA-MM-DD`, porque é o formato dos campos `type="date"`, do tipo de datas da viagem e dos registos existentes. O padrão brasileiro é aplicado na leitura da imagem e na exibição da revisão, nunca no armazenamento.
- **Dedução da janela.** O início sugerido é a data explícita válida quando existir; caso contrário, a menor data entre as partidas dos transportes de ida e os check-ins das hospedagens. O fim sugerido é a data explícita válida quando existir; caso contrário, a maior data entre as chegadas dos transportes de volta e os check-outs das hospedagens. Apenas transporte e hospedagem alimentam a janela; datas de transfers, seguros, atividades e taxas não a esticam. Conexões contribuem com o primeiro embarque e o último desembarque.
- **Um lado de cada vez.** Início e fim são resolvidos independentemente: se só houver partida, só o início é preenchido; se só houver chegada, só o fim. Nada é completado por simetria ou por duração presumida.
- **Período inconsistente.** Se a resolução terminar com fim anterior ao início, o fim é descartado, o início é mantido e um aviso de conflito é registrado, para a revisão mostrar o problema em vez de gravar um período impossível.
- **Divergência entre período explícito e trechos.** Quando o período explícito e as datas dos serviços sustentarem valores diferentes para o mesmo lado, o valor explícito é mantido e um aviso de conflito é registrado com o campo de datas, seguindo a regra já existente de não escolher arbitrariamente entre dados divergentes. A revisão mostra o aviso antes de aplicar.
- **Consolidação multi-imagem.** A dedução acontece por imagem; a consolidação continua a preservar o primeiro valor não nulo de início e de fim e a registrar conflito quando duas imagens trouxerem valores diferentes. Uma imagem só com a ida e outra só com a volta formam um período completo, sem conflito.
- **Aplicação nos formulários.** Os tratamentos de importação do pacote e da cotação continuam a preencher os campos de data a partir do período importado, sem alteração estrutural: substituem o campo quando a importação traz uma data para aquele lado e nunca limpam um campo quando não trazem. Como os valores chegam normalizados, os campos de data deixam de descartar a sugestão.
- **Revisão.** O bloco "Datas da Viagem" da revisão passa a exibir as datas em `DD/MM/AAAA`, sinalizando que são sugestões do que foi lido na imagem. Um lado ausente continua como "Não informado". A revisão continua sem edição de datas; a correção é feita nos campos do formulário depois de aplicar.
- **Duração.** Nenhuma regra nova: o cálculo de Duração (Dias) e (Noites) que já reage às datas do formulário passa a reagir também às datas sugeridas.
- **Mensagem de sucesso.** A confirmação de importação passa a mencionar as datas quando elas foram aplicadas, para não sugerir que só a lista de serviços foi importada.
- **Compatibilidade.** A normalização do formato legado (ida/volta/hospedagem no topo do payload) também lê as datas por trecho e o check-in/check-out, de modo que respostas no formato antigo continuam a produzir a sugestão.
- **Sem mudanças no restante da importação.** Serviços, valores, moeda, quantidade, passageiros, bagagem, destino e conflitos existentes permanecem com o comportamento atual.

## Decisões de teste

- Um bom teste aqui observa o comportamento externo do serviço de importação: dado o payload que a IA devolve para uma imagem, o período resultante é o esperado. Não se testa o helper interno de conversão nem a forma como as datas são combinadas.
- O seam é o que já existe e é o mais alto disponível: as funções puras de normalização e de consolidação do serviço de importação por imagem, exercitadas offline com `npx tsx`, sem Supabase e sem chamada ao Gemini. Não são necessários seams novos. O preenchimento dos campos do pacote e da cotação é uma atribuição direta já existente e fica coberto pela revisão de código; a revisão da interface não ganha teste de navegador nesta entrega.
- Prior art: as suítes `test_image_import.ts`, `test_image_import_services_phase5.ts` e `test_multi_image_consolidation.ts` já montam payloads e verificam os campos normalizados e a consolidação de várias imagens.
- Casos a cobrir: voo de ida e volta com datas explícitas; voo com datas só nos trechos, deduzindo início e fim; ida sozinha, preenchendo só o início; volta sozinha, preenchendo só o fim; hospedagem sozinha, preenchendo o período pelo check-in e check-out; conexão, usando o primeiro embarque e o último desembarque; formato `DD/MM/AAAA`, `DD-MM-AAAA`, `DD.MM.AAAA` e ISO, incluindo um dia maior que 12 para confirmar a leitura dia-primeiro; data impossível descartada; payload sem nenhuma data, mantendo os dois lados nulos; imagem de voo e imagem de hotel consolidando um período completo; duas imagens com períodos divergentes gerando aviso; período inconsistente descartando o fim e gerando aviso.
- Regressão: as suítes atuais de importação e de consolidação devem continuar a passar sem mudança de intenção, em especial o caso que exige campo ausente permanecer nulo.
- O prompt e o comportamento do modelo não são testados em suite: a verificação é manual, com uma captura real de voo de ida e volta. A suíte que chama a IA de verdade não entra nesta entrega.

## Fora de escopo

- Editar as datas dentro da caixa de revisão; a correção continua nos campos do formulário.
- Guardar ou exibir as datas por trecho no editor de serviços, na lista de serviços, no detalhe do pacote ou na lâmina.
- Deduzir o período a partir de transfers, seguros, atividades ou taxas.
- Alterar o formato de data guardado, o tipo de datas da viagem, os campos dos formulários ou qualquer outro campo da importação.
- Refazer a análise automaticamente quando faltar data.
- Mudar o desenho da revisão ou o layout dos cartões de serviços, além do formato e do rótulo das datas.
- Trocar o modelo ou o provedor de IA.
- Alterar o cálculo financeiro, a divisão de custos por trecho ou a quantidade de passageiros.

## Notas

- O prompt pertence à função de importação publicada no Supabase. A entrega só produz o efeito completo depois de publicar essa função junto com o cliente; publicar apenas o frontend não traz as datas por trecho. A publicação não faz parte desta especificação e não deve ser executada sem pedido explícito.
- Sobre o padrão brasileiro: `DD-MM-AAAA` é aceito na leitura e a revisão exibe `DD/MM/AAAA`, mas o valor gravado permanece ISO `AAAA-MM-DD`. Gravar `DD-MM-AAAA` quebraria os campos `type="date"`, o período já salvo em pacotes e cotações e o cálculo de duração.
- A captura usada no relato é do Google Flights, que mostra o período e as datas de cada trecho com mês abreviado. Se o modelo devolver um texto que não seja ISO nem numérico brasileiro, a data é tratada como ausente em vez de interpretada; a dedução a partir das datas por trecho, quando disponíveis, continua a preencher o período.
