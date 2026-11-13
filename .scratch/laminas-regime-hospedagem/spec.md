# Especificação: regime da hospedagem nos serviços apresentados da lâmina

Status: done

## Problema

Ao abrir a lâmina de um pacote ou de uma cotação, a lista "Serviços apresentados" é pré-preenchida a partir dos serviços do registo. Para a hospedagem, o texto sugerido hoje é apenas "Hospedagem" sempre que o regime registado não está entre os cinco regimes conhecidos, e o regime fica fora da peça. Quando o regime é de apenas alojamento (registado como "Somente alojamento", "Room only", "Só hospedagem" e afins) o rótulo também não comunica nada de útil.

A operadora precisa que a lista comunique o que está incluído: "Hospedagem com pequeno-almoço", "Hospedagem com meia-pensão". Só quando não há refeições registadas é que "Hospedagem" sozinho é o texto certo.

## Solução

A sugestão do item de hospedagem passa a ser:

- regime de apenas alojamento (RO, "apenas/somente alojamento", "só/somente hospedagem", "room only") → **"Hospedagem"**, sem menção ao regime;
- qualquer outro regime registado → **"Hospedagem com <regime registado>"**, em minúscula inicial e sem o código entre parênteses;
- regime ausente → **"Hospedagem"**, mantendo o aviso atual de que o regime não foi reconhecido.

Nada muda no editor: a sugestão continua a poder ser revista, o tipo do item continua a poder ser trocado e os limites de 6 itens e 40 caracteres por texto mantêm-se.

## Histórias de usuário

1. Como operadora, quero que a lâmina mostre "Hospedagem com pequeno-almoço" quando registei esse regime, para que o cliente saiba o que está incluído sem eu editar o texto à mão.
2. Como operadora, quero que a lâmina mostre "Hospedagem com café da manhã" quando registei o regime "Café da manhã (BB)", para manter a linguagem que já sai nas peças.
3. Como operadora, quero que a lâmina mostre "Hospedagem com meia-pensão" quando registei "Meia-pensão (HB)".
4. Como operadora, quero que a lâmina mostre "Hospedagem com pensão completa" quando registei "Pensão completa (FB)".
5. Como operadora, quero que a lâmina mostre "Hospedagem com tudo incluído" quando registei "Tudo incluído (AI)".
6. Como operadora, quero que a lâmina mostre apenas "Hospedagem" quando o regime é "Apenas alojamento (RO)", para não escrever na peça algo que o cliente não recebe.
7. Como operadora, quero que "Somente alojamento", "Só hospedagem" e "Room only" registados em textos antigos também resultem em apenas "Hospedagem", para não depender do texto exato que veio do cadastro antigo.
8. Como operadora, quero que um regime escrito de outra forma ("Pequeno-almoço", "All inclusive", "Bed & breakfast") apareça tal como o registei, em minúscula inicial, para a peça refletir o que contratei.
9. Como operadora, quero que o código do regime entre parênteses ("(BB)", "(HB)") não apareça na lista, para o texto ficar curto e legível.
10. Como operadora, quero que a sugestão apareça igual na lâmina do pacote e na lâmina da cotação, para não ter de corrigir cada uma.
11. Como operadora, quero que a sugestão já venha preenchida ao abrir a lâmina, para publicar com poucos cliques.
12. Como operadora, quero continuar a poder editar o texto sugerido, para ajustar a linguagem ao cliente.
13. Como operadora, quero continuar a poder remover o item de hospedagem, para montar uma peça só com os serviços que quero destacar.
14. Como operadora, quero que duas hospedagens com regimes diferentes apareçam como dois itens distintos, para mostrar as duas estadas.
15. Como operadora, quero que a mesma hospedagem repetida no registo não duplique a linha, para a peça ficar limpa.
16. Como operadora, quero ser avisada quando o regime registado não pode ir para a peça, para corrigir o cadastro em vez de publicar algo incompleto.
17. Como operadora, quero que um regime com termos internos, preços ou contactos não vá para a peça, para não expor informação da operação.
18. Como operadora, quero que um regime demasiado longo não seja cortado a meio, para o texto não ficar truncado na lâmina.
19. Como operadora, quero que o aviso de regime não reconhecido deixe de aparecer quando o regime é de apenas alojamento, porque nesse caso o texto está correto.
20. Como operadora, quero que a cotação criada a partir de um pacote antigo, sem regime gravado, continue a apresentar "Hospedagem com café da manhã", para manter o comportamento que já conheço.
21. Como operadora, quero que um pacote antigo sem regime gravado apresente "Hospedagem", porque não há informação de refeições a afirmar.
22. Como operadora, quero que o texto que revi e guardei numa versão anterior da lâmina não seja substituído, para não perder o meu trabalho.
23. Como operadora, quero que a prévia e o ficheiro publicado mostrem o mesmo texto, para não haver surpresa no anexo.
24. Como revisor da peça, quero que a lista continue limitada a 40 caracteres por item, para o desenho da lâmina não quebrar.
25. Como revisor da peça, quero que a lista continue limitada a 6 itens, para a lâmina não ficar sobrecarregada.
26. Como responsável pelo produto, quero que a regra viva num único ponto partilhado pelas duas lâminas, para não divergirem com o tempo.
27. Como responsável pelo produto, quero que a regra não altere o cartão de hospedagem da proposta de viagem, para não mexer numa peça que já está validada.
28. Como responsável pelo produto, quero que a alteração não introduza novas opções de regime no formulário, para não abrir trabalho de cadastro nesta fase.

## Decisões de implementação

- **Um único ponto de derivação.** A regra do rótulo entra na derivação comercial partilhada que já converte serviços em itens da lista, usada pela lâmina do pacote e pela da cotação. O construtor do modelo no servidor reutiliza a mesma derivação, por isso prévia, publicação e download não podem divergir.
- **O texto do regime vem do que está registado.** Retira-se o código entre parênteses, normalizam-se espaços e baixa-se a primeira letra. Os cinco regimes conhecidos mantêm a forma que a peça já publica ("café da manhã", "meia-pensão", "pensão completa", "tudo incluído", "apenas alojamento"); qualquer outro valor registado é usado como está, sem tradução nem lista branca. Não se inventa um regime que não esteja no registo.
- **Apenas alojamento é um caso próprio.** A deteção reaproveita a normalização de regimes existente, que já reconhece "apenas alojamento", "somente alojamento", "só hospedagem", "room only" e as siglas RO/BB/HB/FB/AI. Acrescenta-se o reconhecimento de "somente hospedagem" e de "pequeno-almoço" na normalização, que é o ponto único dessa tradução. Nesse caso o rótulo é exatamente "Hospedagem" e não há aviso.
- **Refeições vencem a palavra alojamento.** Um regime que nomeia alojamento e refeições ("Alojamento com café da manhã", "Alojamento e meia-pensão") não é apenas alojamento: a normalização passa a olhar primeiro para o termo de refeição, para não perder a refeição nem anunciar "Hospedagem" sozinho.
- **Regime negativo não vira afirmação.** Um regime que começa por "sem" ou "não" ("sem café", "não inclui refeições") não é publicado como "Hospedagem com …": o rótulo fica "Hospedagem" e há um aviso para a operadora descrever o que está incluído. A peça nunca afirma o contrário do registo.
- **Regime ausente.** Mantém-se o rótulo "Hospedagem" e o aviso atual de que o regime não foi reconhecido, para a operadora saber que falta um dado no cadastro.
- **Regime que não pode ser publicado.** Se o texto do regime tiver termos internos, preços ou contactos — incluindo quando aparecem dentro do código entre parênteses — ou não couber no espaço restante do limite de 40 caracteres (15 caracteres são do prefixo "Hospedagem com "), o rótulo fica "Hospedagem" e é apresentado um aviso. O texto comercial nunca é truncado e o aviso não expõe constantes internas.
- **Sem mudanças no contrato dos itens.** O item continua com tipo e texto, até 6 itens e 40 caracteres, validados igualmente no cliente e no servidor. A sugestão é apenas o ponto de partida: o que a operadora editar e publicar prevalece, e as versões já guardadas não são reescritas.
- **Fora do cartão de hospedagem.** O mapa de regimes usado no cartão de hospedagem da proposta de viagem mantém-se como está; aquele cartão apresenta o regime numa linha própria e não recebe o prefixo "Hospedagem com".
- **Duas hospedagens.** Duas estadas com regimes diferentes produzem dois itens distintos; quando o texto público é o mesmo (duas estadas ambas em apenas alojamento, ainda que registadas com grafias diferentes), fica um único item, pela deduplicação já existente: a lista é um resumo público, não um inventário.
- **Legado.** A cotação continua a assumir café da manhã quando o serviço antigo não traz regime; o pacote antigo sem regime fica em "Hospedagem". Não se altera o adaptador de legado nem o formulário.

## Decisões de teste

- Um bom teste aqui observa o resultado externo: para um pacote ou cotação com determinado regime, a lista de itens do modelo da lâmina tem o texto esperado. Não se testa o helper interno nem a forma como o texto é composto.
- O seam é o que já existe e é o mais alto disponível: os construtores puros do modelo da lâmina do pacote e da cotação, verificando a lista de itens. Não são necessários seams novos.
- Prior art: `tests/test_package_flyer.tsx` compara a lista de itens do modelo com `assert.deepEqual`, e `tests/test_quotation_flyer.ts` faz o mesmo com os itens incluídos da proposta. Os dois correm offline, com `npx tsx`, sem tocar no Supabase.
- Casos a cobrir: regime conhecido com refeições (café da manhã, meia-pensão, pensão completa, tudo incluído); apenas alojamento em três grafias incluindo "Somente alojamento"; regime livre registado fora do mapa; regime com código entre parênteses; regime com termo interno, resultando em "Hospedagem" com aviso; regime maior do que o espaço disponível, resultando em "Hospedagem" com aviso; duas hospedagens com regimes diferentes; cotação antiga sem regime; pacote antigo sem regime.
- Os testes existentes que já esperam "Hospedagem" ou "Hospedagem com café da manhã" servem de regressão e devem continuar a passar sem alteração de intenção.

## Fora de escopo

- Alterar as opções de regime no formulário do pacote ou da cotação, ou passar o regime a texto livre.
- Renomear o cartão de hospedagem, o regime mostrado nesse cartão ou a linguagem da peça de "café da manhã" para "pequeno-almoço".
- Reescrever textos já guardados em versões anteriores da lâmina ou itens editados manualmente pela operadora.
- Alterar os limites de 6 itens e 40 caracteres, o contrato dos itens ou a validação do servidor.
- Mudar o comportamento dos restantes tipos de serviço (aéreo, transporte, transfer, seguro, extras).
- Autenticação, políticas RLS e migrações de base de dados.

## Notas adicionais

- A sugestão é recalculada sempre que a lâmina é aberta; depois de a operadora guardar uma versão, os itens revistos são os que prevalecem, por isso esta regra beneficia sobretudo as lâminas novas.
- A regra é puramente textual: não depende de financeiro, câmbio nem do cadastro de serviços favoritos.
- O limite de caracteres é o que mais aperta: "Hospedagem com " consome 15 dos 40 disponíveis, portanto regimes longos escritos à mão tendem a cair no aviso em vez de aparecerem na peça.
