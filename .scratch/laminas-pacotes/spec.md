# Especificação: criação de lâminas de pacotes

Status: ready-for-agent

## Problema

A pessoa responsável pela operação precisa divulgar pacotes de viagem no WhatsApp e em redes sociais. Hoje ela precisa montar a peça visual fora do Packager e repetir manualmente os dados, com risco de erro em preço, datas ou serviços. A geração de conteúdo para o website resolve outra necessidade e não substitui uma lâmina pronta para divulgação.

## Solução

No detalhe de um pacote já criado, oferecer a ação **Criar lâmina**. O Packager apresenta uma prévia baseada no modelo visual escolhido, usando informações comerciais do próprio pacote, uma imagem do destino criada por IA e um subtítulo comercial sugerido por IA. A pessoa revisa a peça e escolhe baixar em PNG ou HTML. Após confirmar uma prévia final gerada no servidor, pode salvá-la como o único anexo atual do pacote.

A primeira referência é vertical, 9:16, em 1080 × 1920 pixels. A imagem de referência, com valores e serviços fictícios, está em [referencia-visual.png](referencia-visual.png). A peça é independente da geração de conteúdo do website. A validação de segurança e o renderer confiável vivem no backend; HTML/PNG recebidos do browser nunca são aceitos para substituir um anexo.

## Histórias de usuário

1. Como operadora, quero iniciar a criação da lâmina no detalhe de um pacote existente para divulgar a oferta sem repetir seu cadastro.
2. Como operadora, quero identificar claramente a ação de criar lâmina para encontrá-la entre as ações do pacote.
3. Como operadora, quero que a lâmina seja independente do conteúdo do website para não precisar gerá-lo antes.
4. Como operadora, quero ver uma prévia antes de baixar para conferir o resultado.
5. Como operadora, quero usar o modelo visual escolhido para manter a identidade S23 Travel.
6. Como operadora, quero uma imagem vertical 9:16 para publicar em Stories e canais semelhantes.
7. Como operadora, quero baixar um PNG em 1080 × 1920 para enviar por WhatsApp ou publicar em redes sociais.
8. Como operadora, quero escolher o download em HTML para ter outra forma de reutilizar a lâmina.
9. Como operadora, quero que o HTML exportado apresente a mesma peça com seus recursos necessários para poder abri-lo fora do Packager.
10. Como operadora, quero baixar a lâmina revisada em HTML ou PNG para compartilhar o pacote fora do Packager.
11. Como operadora, quero que a prévia mostre o mesmo conteúdo comercial exportado para reduzir erros de divulgação.
12. Como operadora, quero baixar novamente a última lâmina salva sem gerar outra imagem de IA para evitar chamadas e custos desnecessários.
13. Como operadora, quero ver a origem da viagem na lâmina para mostrar de onde parte a oferta.
14. Como operadora, quero ver o destino principal do pacote para identificar rapidamente a viagem.
15. Como operadora, quero que o preço seja o valor comercial por pessoa do pacote para não divulgar custos ou lucros internos.
16. Como operadora, quero que a lâmina informe “por pessoa em quarto duplo” para esclarecer a condição comercial solicitada.
17. Como operadora, quero registrar as condições de pagamento no pacote para usá-las na lâmina.
18. Como operadora, quero que as condições exibidas correspondam às cadastradas para não anunciar parcelamento inventado.
19. Como operadora, quero exibir as datas de início e retorno para comunicar o período da viagem.
20. Como operadora, quero que a lâmina use moeda e formatação corretas para evitar anúncios ambíguos.
21. Como operadora, quero que o valor total e eventuais parcelas sejam identificados corretamente para não confundir um com o outro.
22. Como operadora, quero que serviços de transporte aéreo sejam apresentados como “Aéreo” quando aplicável para simplificar o anúncio.
23. Como operadora, quero que a acomodação apareça como “Hospedagem” acompanhada do regime cadastrado para comunicar o que está incluído.
24. Como operadora, quero que outros itens incluídos apareçam na lâmina para representar a oferta do pacote.
25. Como operadora, quero ícones correspondentes aos itens para tornar a leitura mais rápida.
26. Como operadora, quero que serviços ausentes não sejam anunciados como inclusos para evitar promessas incorretas.
27. Como operadora, quero que dados internos como custo, lucro e fornecedor não sejam divulgados para proteger informações comerciais.
28. Como operadora, quero que a IA crie uma imagem representativa do destino para não precisar produzir uma foto manualmente.
29. Como operadora, quero que a imagem seja preparada para o formato da lâmina para minimizar cortes indesejados.
30. Como operadora, quero que a IA sugira um subtítulo comercial para tornar a peça mais atraente.
31. Como operadora, quero revisar o subtítulo e a imagem antes do download para evitar conteúdo inadequado.
32. Como operadora, quero manter a identidade visual, os contatos e a mensagem da S23 na peça para que o público reconheça a marca.
33. Como operadora, quero o logotipo e os textos do cabeçalho sobre um fundo legível para funcionar também com imagens claras.
34. Como operadora, quero que os itens e o subtítulo fiquem em uma caixa semitransparente para melhorar a leitura sobre a foto.
35. Como operadora, quero que os elementos importantes respeitem as margens de segurança da referência para não serem cobertos pela interface dos Stories.
36. Como operadora, quero ser avisada quando faltar um dado necessário para corrigir o pacote antes de divulgar.
37. Como operadora, quero ser informada de falhas na IA ou no download para saber o que aconteceu.
38. Como operadora, quero que nomes longos e listas variáveis não cortem textos ou invadam margens para manter a peça legível.
39. Como usuária autenticada, quero que o servidor gere e valide os arquivos do anexo para impedir que arquivos adulterados substituam uma lâmina válida.
40. Como responsável pelo projeto, quero evitar testes que alterem dados de clientes ou finanças em produção para preservar a operação.
41. Como responsável pelo projeto, quero poder usar a IA disponível no sistema durante o desenvolvimento para validar a geração real quando necessário.
42. Como operadora, quero manter apenas a última lâmina salva para que uma nova lâmina substitua a anterior sem acumular histórico.

## Decisões de implementação

- A primeira entrega usa um único modelo 9:16 baseado na referência escolhida; outros formatos e outros modelos não foram definidos e ficam fora desta primeira entrega.
- O modelo deve usar as cores e a fonte Poppins do sistema visual S23 Travel: foto de fundo; cabeçalho navy para marca, slogan e website; caixa terracota para origem e destino; preço e período em branco; caixa semitransparente para itens e subtítulo; rodapé com contato e aviso. A escolha de desenho da peça não altera o design system da interface interna do Packager.
- Copy de marca solicitada pelo responsável: “Sua viagem, nossa missão”, `www.s23.travel`, “Fale com um especialista” e `zap: +351 960 153 290`. Esse número foi fornecido diretamente pelo responsável; não foi inventado pelo agente nem consultado em serviço externo.
- Em 1080 × 1920, informações importantes ficam fora dos 250 pixels superiores e inferiores, conforme a referência fornecida. Ícones são selecionados de acordo com o tipo de item; texto e ícones precisam continuar legíveis sobre fotos claras ou escuras.
- A origem, o destino principal, o período, os serviços e o preço são obtidos do pacote. Usar as regras monetárias existentes e a moeda correspondente; não recriar cálculo financeiro nem deixar a IA alterar dados comerciais. Pacotes legados devem ser normalizados sem perder dados.
- O pacote já possui um campo textual de condições de pagamento preservado nos dados, mas não editável no formulário atual. A implementação deve avaliar seu reaproveitamento e permitir cadastro/edição sem perder valores existentes nem alterar outros metadados.
- Não inferir número de parcelas, valor de cada parcela, ausência de juros, classificação de hotel, transporte aéreo ou serviço incluído quando os dados não sustentarem a afirmação. Diferenciar explicitamente valor total por pessoa de valor de parcela; dados ausentes ou inconsistentes devem gerar aviso e impedir anúncio enganoso.
- “Aéreo” e “Hospedagem” são nomes comerciais fixos quando correspondentes aos serviços efetivamente incluídos; a hospedagem inclui o regime informado. Outros itens devem refletir apenas serviços confirmados, sem expor notas internas, fornecedores, custos, margens ou identificadores.
- A nota “por pessoa em quarto duplo” deve aparecer sempre na lâmina. O responsável confirmou essa escolha mesmo quando o cadastro não comprovar automaticamente a condição, sem exigir confirmação específica para cada geração. A revisão comercial geral continua necessária.
- A imagem e o subtítulo são gerados com IA. A chamada deve usar o backend existente como padrão de segurança, validar usuário autenticado e manter a chave fora do navegador. Verificar modelo de imagem, disponibilidade e custo no momento da implementação; a existência da chave de texto não garante acesso ao modelo de imagem.
- A composição comercial é determinística: a IA não escreve preços, datas ou itens no arquivo final. A prévia serve para revisão antes da exportação.
- A exportação em PNG e HTML usa os dados revisados e deve preservar fontes, cores, logotipo e imagem. O HTML precisa ser utilizável fora da sessão do aplicativo, sem depender de links autenticados temporários ou chaves.
- A renderização e validação dos arquivos do anexo ocorrem num Worker Cloudflare dedicado com Browser Run, chamado somente pela Edge Function autenticada. O Worker existente `s23-packager` que atende `packager.s23.travel` não deve ser alterado. A Edge Function consulta/valida o pacote e envia um modelo público canônico e os recursos revisados ao renderer; nunca aceita HTML/PNG do browser para publicação.
- Antes do salvamento, o backend retorna uma prévia PNG final. HTML e PNG correspondentes ficam em paths imutáveis privados e em estado staged, ainda sem alterar o ponteiro atual. Após a revisão explícita da imagem final, uma RPC transacional/CAS publica o par e só então aposenta a versão anterior. Repetição idempotente e conflitos não apagam a versão ativa. A versão salva permanece imutável se o pacote mudar; apenas uma nova prévia revisada pode substituí-la.
- Em 2026-11-10, o responsável aprovou a edição dos "Serviços apresentados" no painel, com o texto revisto enviado à prévia final e não guardado no pacote; o limite de 40 caracteres por item foi mantido. Serviços `additional` deixam de depender de uma lista branca de nomes, mas continuam sujeitos a validação de conteúdo.
- Preparar limpeza automática de versões antigas, tentativas órfãs e previews staged abandonadas (expiração em 24h) via tombstones duráveis e Storage API, sem apagar objeto ativo. O código, configurações e migration ficam locais nesta fase; ativar em produção, provisionar o bucket, definir secrets/agendamento e testar escrita/limpeza real exige autorização específica e ambiente aprovado.
- O aplicativo não publica automaticamente no WhatsApp, Instagram ou TikTok; o envio e a publicação são realizados pela operadora após o download.
- Permanecem a definir no desenho técnico: exclusão explícita de anexos e a forma exata de revisão dos textos e da imagem. Não tratar as propostas como decisões já aprovadas.

## Decisões de teste

- Priorizar testes de comportamento pela entrada mais próxima da experiência da operadora: abrir a criação a partir de um pacote, revisar os dados e baixar, sem depender de detalhes internos do componente.
- Validar com exemplos fictícios o mapeamento comercial, moedas, datas, regimes, dados ausentes, serviços legados, itens longos e a proibição de informações internas. Confirmar que a IA não inventa ou altera valores e inclusões.
- Validar visualmente a referência, margens 9:16, fontes, contraste, itens com quebras, cabeçalho sobre foto clara, preço integralmente visível e PNG com dimensões corretas. Abrir o HTML exportado fora da sessão, sem rede ou recursos temporários, para verificar a peça.
- Testar erros, falhas parciais, permissões e novo download com serviços simulados. Usar como precedentes os testes isolados dos serviços financeiros, de conteúdo comercial e de persistência de conteúdo do website.
- O responsável informou que não dispõe de DEV isolado e deseja trabalhar com a branch conectada à base de produção. A branch Git **não isola o banco**. O uso da IA disponível foi autorizado, incluindo o custo associado; não foram autorizadas automaticamente alterações de dados compartilhados ou publicação.
- Antes de qualquer teste remoto, confirmar o alvo sem imprimir segredos, delimitar o efeito e evitar dados de clientes. A validação real de escrita, exclusão, políticas e armazenamento permanece pendente de autorização específica e de um procedimento seguro; sem isso, não alegar que a integração de persistência foi validada.
- Não executar a suíte completa nem testes que criem, modifiquem ou apaguem dados no projeto compartilhado. Revisar cada teste isolado; não instalar automaticamente dependências para contornar a ausência do executor de testes.

## Sequência sugerida

1. Definir as regras de apresentação para dados ausentes, pacotes legados, serviços e condições de pagamento; validar a representação do total e das parcelas.
2. Expor as condições de pagamento no cadastro e preparar os dados comerciais da lâmina, preservando os dados existentes.
3. Construir a prévia 9:16 conforme a referência e validar visualmente com dados fictícios.
4. Integrar geração de imagem e subtítulo por IA no backend autenticado e tratar falhas e custos, sem confiar à IA os dados comerciais.
5. Implementar e validar os downloads PNG e HTML, incluindo fontes e imagem necessárias para uso fora da sessão.
6. Projetar e testar um renderer Cloudflare separado, com Preview/mock e Browser Run, sem alterar o Worker de produção.
7. Implementar Edge Function autenticada, persistência imutável em bucket privado e ponteiro transacional da última versão; cobrir falhas/retries e preparar limpeza automática.
8. Integrar salvamento e recuperação do anexo à tela. Registrar testes reais de RLS/Storage/concorrência como pendentes até que o responsável autorize um ambiente seguro e as operações remotas necessárias.

## Fora de escopo

- Geração ou publicação de conteúdo para o website/Manager.
- Publicação automática em redes sociais ou envio automático pelo WhatsApp.
- Editor gráfico genérico, importação de templates externos ou upload de fotografias reais.
- Formatos ou templates adicionais sem requisitos acordados.
- Alterações das regras financeiras, implementação de novas regras de autenticação ou refatorações não relacionadas.
- Implantação, alteração de serviços externos, migração remota, commit ou push sem solicitação explícita.

## Notas

- A referência visual contém dados fictícios, incluindo preço e serviços; não é uma oferta real nem uma fonte de dados de clientes.
- Os testes do protótipo foram realizados com uma imagem gerada separadamente e não comprovam disponibilidade, custo, fidelidade geográfica ou permissões da integração de IA do aplicativo.
- A documentação atual do Gemini admite proporção 9:16 em modelos de geração de imagem; a disponibilidade e resolução variam conforme o modelo. Buckets privados do Supabase exigem controle de acesso também para download. Consultar as versões correntes antes de construir a integração.
- A configuração atual inclui login e uma restrição de acesso aplicada às tabelas conhecidas; qualquer nova tabela, arquivo ou função requer revisão própria de grants, políticas e acesso. O sistema existente não define isolamento por usuário/tenant.
- A referência visual registra o template escolhido. A especificação ainda não equivale a autorização para iniciar a implementação nem para efetuar deploy ou operações com dados compartilhados.
