# Especificação: lâminas de cotações

Status: ready-for-agent

## Revisão 2026-11-11

Esta especificação foi escrita antes das alterações de 2026-11-11 na lâmina de pacote. A revisão abaixo incorpora o estado atual do código; onde a versão anterior divergir, vale esta secção.

- A caixa central da lâmina de pacote passou a ser cinza (`--flyer-panel`, alpha 0.60) e agrupa valor, período, serviços e subtítulo. Cabeçalho e rota ficam fora dela. A cotação usa o template anexo descrito mais abaixo, não esta caixa.
- Foram removidas as caixas de confirmação (“Revisei a imagem”, “Revisei o subtítulo”, “Revisei a prévia final”). Gerar a prévia e salvar ficam liberados sem aceite explícito; a revisão continua a ser visual e humana.
- Os rótulos atuais são “Gerar nova sugestão” para a segunda geração de IA, “Gerar lâmina” para a prévia final no servidor, e os downloads “HTML” e “IMAGEM”. O botão “IMAGEM” entrega JPG real, convertido no cliente a partir do PNG armazenado; a prévia e o anexo continuam PNG.
- O subtítulo passou a usar `gemini-3.6-flash` como modelo de texto; se a frase vier inválida, há uma nova tentativa nesse modelo e, se ainda falhar, uma frase neutra validada. Não se volta ao modelo de imagem para pedir texto. A imagem usa `gemini-nano-banana-2.1` em 9:16/1K; o contrato aceita PNG e JPEG.
- O renderer `s23-flyer-renderer` é publicado manualmente com `npx wrangler@3 deploy --config workers/flyer-renderer/wrangler.jsonc`. O push para `main` publica a SPA, não o renderer. A prévia React acompanha o push; o arquivo gerado no servidor não.
- O espaçamento entre período e serviços e entre serviços e subtítulo ganhou uma linha completa da tipografia dos serviços, inclusive no modo compacto; o espaçamento interno do preço não deve ser reduzido.
- Em 2026-11-11 o responsável aprovou um template próprio para a cotação (anexo “Proposta de viagem”): hero com foto, cartões brancos de voos e hospedagem, bloco navy de investimento, CTA laranja e rodapé legal. Ele substitui, para a cotação, a composição de caixa cinza da lâmina de pacote. O mapeamento de campos está na secção “Template anexo e mapeamento”.

## Decisões aprovadas em 2026-11-11

Onde o texto anterior divergir, valem estas decisões:

1. **Cliente, referência e validade:** não tratar. O título usa o nome do cliente e o destino; não há referência nem validade na peça.
2. **Data:** campo “Data da cotação” no formulário, pré-preenchido a partir da data da cotação (`created_at`), editável, exibido no formato `DD/MM/AAAA`.
3. **Sinal/restante:** campos estruturados `depositAmount` e `balanceDueDate`. O bloco “Pagamento” usa esses valores; o total continua em `salePrice`.
4. **Não incluído:** lista nova `notIncluded` (até 3 linhas, 100 caracteres cada), editável no formulário; é a única fonte do bloco “Não incluído”.
5. **Detalhes:** rota extraída de `ServiceItem.description` (ida/volta); companhia de `ServiceItem.carrier`; datas e noites derivadas do cabeçalho da cotação. Só criar campos por serviço se houver vários voos/hotéis ou datas diferentes.
6. **Moeda:** usar o formato da app (`formatMoney`, ex.: `€ 700,00`), não o formato `700,00 €` do mockup.
7. **Título:** nome do cliente + destino, sem duração.
8. **Referência visual aprovada:** `.scratch/laminas-cotacoes/preview-cotacao-9x16.png` (1080 × 1920), com os ajustes visuais registados.
9. **Formato da imagem (2026-11-11):** o download «IMAGEM» entrega o PNG do servidor, sem conversão para JPG, no pacote e na cotação — o mesmo padrão para ambas as lâminas.
10. **Laranja (2026-11-11):** blocos, formas e letras usam `--color-accent` (terracotta-600), o laranja mais claro do kit; deixa de haver `--color-primary`/`--color-primary-strong` na peça.
11. **Regime da hospedagem:** quando o serviço não traz `mealPlan`, a peça usa «Café da manhã (BB)», o mesmo default que o editor apresenta, e o formulário passa a gravar esse valor.

## Problema

A operadora precisa enviar ao cliente uma proposta de viagem visual, com o nome do cliente, a data da cotação, o preço total, os serviços e as condições comerciais. Hoje a lâmina existe apenas para pacotes e é uma peça pública de divulgação: não tem cliente, data nem total. Montar a proposta fora do Packager repete dados e arrisca divergências de preço, datas e serviços.

## Solução

No detalhe de uma cotação, oferecer a ação **Criar lâmina**. O fluxo é o mesmo da lâmina de pacote — sugestão de imagem e subtítulo por IA, revisão visual sem caixas de confirmação, prévia final gerada no servidor, salvamento da última versão e download em HTML ou JPG —, mas com um template 9:16 próprio para propostas a clientes reais. O template mantém a identidade S23 Travel e acrescenta os dados da cotação.

O objetivo é reaproveitar ao máximo os componentes existentes sem alterar o comportamento da lâmina de pacote: a casca de estado e os controlos da interface, a derivação comercial, os helpers de markup, o renderer Cloudflare, o bucket, a fila de limpeza e o contrato de itens. A persistência da cotação fica isolada em tabelas e RPCs próprias, reusando a mesma fila e o mesmo bucket.

## Objetivos

1. Criar uma lâmina de proposta a partir de uma cotação existente, sem repetir o cadastro.
2. Mostrar no detalhe da cotação a ação **Criar lâmina**, no mesmo padrão da ação do pacote.
3. Reutilizar o máximo possível de `PackageFlyerCreator`, `packageFlyerService`, `packageFlyerMarkup`, `flyerItemsContract`, `flyerAiContract`, `generate-flyer-ai`, do worker `flyer-renderer` e da infraestrutura de anexos.
4. Produzir uma peça 9:16 em 1080 × 1920 com a identidade S23 Travel e as margens de segurança já usadas na lâmina de pacote.
5. Exibir os dados do template aprovado: cliente/destino no título, subtítulo, datas, viajantes, rota, voos, hospedagem, incluídos, não incluídos, total e pagamento (texto de `paymentConditions`), CTA e rodapé.
6. Manter a mesma segurança da lâmina de pacote: modelo comercial construído no servidor, renderer confiável, prévia staged, publicação CAS, apenas a última versão e limpeza automática.
7. Não expor custos, margens, fornecedores, notas internas ou dados pessoais além do necessário à proposta.
8. Entregar download em HTML e JPG, com os mesmos recursos embutidos (fonte, logo, imagem) e funcionamento fora da sessão; a prévia e o anexo persistido continuam PNG.

## Não objetivos

- Publicação automática em WhatsApp, Instagram ou TikTok.
- Envio da proposta por e-mail ou WhatsApp a partir do Packager.
- Editor gráfico, upload de fotos reais ou templates adicionais.
- Histórico de versões da lâmina; continua a existir apenas a última versão salva.
- Alteração das regras financeiras, do motor de cálculo ou da autenticação.
- Uso da lâmina de cotação como peça pública de divulgação.
- Inclusão das notas livres `localTaxNotes`, `extraServicesNotes` ou `customNotes` na primeira versão.

## Anti-objetivos

- Reutilizar o template de pacote sem o cliente no título: deixaria de ser uma proposta identificada.
- Enviar o nome do cliente ou qualquer dado pessoal à IA.
- Recalcular preço no template ou converter moeda duas vezes.
- Publicar uma nova prévia sem os dados que o template exigir; a versão já salva continua a ser um registo baixável.
- Duplicar o cálculo financeiro, o contrato de itens ou as regras de conteúdo público.
- Refatorar a lâmina de pacote de forma que mude a peça visual ou o fluxo existente.
- Generalizar as tabelas de anexo de pacote em produção nesta primeira entrega.

## Histórias de usuário

1. Como operadora, quero iniciar a lâmina no detalhe da cotação para preparar a proposta sem repetir dados.
2. Como operadora, quero que a lâmina mostre o nome do cliente para identificar a proposta.
3. Como operadora, quero que o título mostre o destino principal na segunda linha.
4. Como operadora, quero que a data da cotação venha do formulário, editável, para datar a proposta.
5. Como operadora, quero ver o preço total para o número de viajantes da cotação.
6. Como operadora, quero ver o total da proposta e, se o responsável quiser, o valor por pessoa como linha secundária.
7. Como operadora, quero que a nota de quarto duplo apareça apenas quando a cotação inclui hospedagem, para não afirmar uma condição que não existe.
8. Como operadora, quero ver o período da viagem, a origem, o destino e os passageiros.
9. Como operadora, quero revisar e editar os serviços apresentados, como na lâmina de pacote.
10. Como operadora, quero gerar uma imagem do destino e um subtítulo com IA, com revisão visual sem caixas de confirmação.
11. Como operadora, quero que o subtítulo e a imagem não recebam dados do cliente nem da cotação.
12. Como operadora, quero ver uma prévia fiel antes de salvar e baixar, sem precisar marcar aceites.
13. Como operadora, quero baixar HTML e JPG da última versão salva sem gerar outra imagem de IA.
14. Como operadora, quero que salvar uma nova lâmina substitua a anterior.
15. Como operadora, quero ser avisada quando faltar cliente, data da cotação, datas, origem, destino ou preço, com indicação do que corrigir na cotação.
16. Como operadora, quero que uma cotação arquivada preserve a lâmina salva e permita baixá-la.
17. Como operadora, quero que a exclusão de uma cotação sem operação financeira também remova os ficheiros da lâmina.
18. Como responsável pelo projeto, quero que a lâmina de pacote continue a funcionar exatamente como hoje.
19. Como responsável pelo projeto, quero que a nova persistência não altere os registos de pacotes existentes.
20. Como responsável pelo projeto, quero testes isolados e nenhuma operação em produção sem autorização específica.

## Abordagens consideradas

### 1. Duplicar o fluxo inteiro

Copiar `PackageFlyerCreator`, a Edge Function, as tabelas e as RPCs, mudando apenas os nomes. É a via mais rápida e a que menos toca no fluxo de pacotes. O custo é manter duas cópias de uma casca de ~440 linhas, duas orquestrações de renderização, dois conjuntos de SQL e duas rotinas de limpeza. Rejeitada para a interface e para o pipeline, porque contraria o pedido de máximo reaproveitamento e multiplica o risco de divergência.

### 2. Generalizar tudo

Um único creator, um único modelo com discriminador, tabelas/RPCs com um dono polimórfico (`package` ou `quotation`) e uma única Edge Function. É a solução mais limpa a longo prazo, mas mexe nas tabelas e no fluxo que já estão em produção, incluindo a chave primária de `package_flyer_attachments`, as FKs e as RPCs de publicação. Rejeitada para a primeira entrega por risco desproporcional.

### 3. Escolhida: compartilhar o que é estável, isolar a persistência

- Compartilhar a casca de estado e os controlos da interface, a derivação comercial, os helpers de markup, o contrato de itens, a IA, o worker, o bucket, a fila de limpeza, o modelo de prévia/publicação e a conversão JPG do download.
- Isolar a persistência da cotação em `quotation_flyer_operations`, `quotation_flyer_attachments`, RPCs próprias e uma Edge Function `quotation-flyer`, reusando o bucket e a fila comuns.
- Manter o mesmo formato 9:16, a mesma viewport de 1080 × 1920 e o mesmo renderer, com um discriminador de template; a cotação usa o layout do anexo, não a caixa cinza do pacote.

Essa via maximiza o reaproveitamento sem obrigar a migrar os anexos de pacote. O fluxo de pacote é o primeiro consumidor da casca extraída; os testes existentes são o portão de regressão.

## Decisões de produto e template

- **Formato:** 9:16, 1080 × 1920, com as mesmas margens seguras de 250 px no topo e no rodapé usadas na lâmina de pacote.
- **Identidade:** para a cotação, vale o template anexo: mesma foto de fundo, Poppins, navy, laranja e cartões brancos, com hero, barra de dados, cartões de voos/hospedagem, bloco navy de investimento, CTA e rodapé legal. A caixa cinza com valor/período/serviços/subtítulo continua a ser a composição da lâmina de pacote, não da cotação. Nada de hex, fonte ou espaçamento soltos; usar os tokens do kit Travel.
- **Conteúdo da peça:**
  - hero com foto, logo S23, data da cotação (apenas a data) e etiqueta “PROPOSTA DE VIAGEM”;
  - título em duas linhas: cliente em branco e destino em laranja, com subtítulo comercial;
  - barra de dados: datas, viajantes e rota;
  - cartão de voos: companhia, ida/regresso com data, rota e horários, tarifa e bagagem;
  - cartão de hospedagem: hotel, período, noites, regime, incluídos e não incluídos;
  - bloco de investimento: total e pagamento;
  - CTA “Fale com a S23 para reservar” e rodapé legal.
- **Cliente, referência e validade:** o cliente é a primeira linha do título e é obrigatório para gerar a lâmina. A referência não é exibida no template; fica no ficheiro/metadados. Não há validade na peça.
- **Data da cotação:** campo próprio no formulário, pré-preenchido com a data da cotação (`created_at`), editável e exibido em `DD/MM/AAAA` no badge do topo.
- **Preço:** o total é o `salePrice` (ou `priceTotal`) da cotação, exibido no bloco de investimento com o formato da app (`formatMoney`, ex.: `€ 700,00`). O template anexo não mostra o valor por pessoa.
- **Pagamento:** o bloco “PAGAMENTO” usa `depositAmount` e `balanceDueDate` estruturados; o total continua em `salePrice`. O texto `paymentConditions` não alimenta o bloco.
- **Não incluído:** o bloco usa a lista nova `notIncluded`; `localTaxNotes`/`extraServicesNotes`/`customNotes` não são a fonte da peça (ficam preservados nos dados antigos).
- **Quarto duplo:** a nota “por pessoa em quarto duplo” aparece quando a cotação inclui hospedagem. Sem hospedagem, usar “por pessoa”. A decisão de mostrar sempre a nota na lâmina de pacote não é transferida automaticamente para a cotação.
- **Passageiros:** adultos e crianças contam como pagantes, segundo o motor financeiro; bebés entram no rótulo da viagem, mas não no divisor do valor por pessoa.
- **Lâmina salva:** é um snapshot imutável. Alterações posteriores na cotação não bloqueiam o download da versão salva; apenas a geração de uma nova prévia é bloqueada. A interface usa o mesmo estado curto da lâmina de pacote (“Lâmina salva nesta cotação.” / “Ainda não há uma lâmina salva nesta cotação.”); a versão e a data continuam nos metadados, sem destaque. Não há aviso automático de desatualização na v1.
- **Status:** qualquer status pode gerar a lâmina. Uma cotação arquivada mantém a lâmina salva e permite baixá-la; gerar uma nova lâmina não desarquiva a cotação.
- **Fora da peça:** status comercial, pacote de origem, taxa de câmbio, custos, fornecedores, margens, observações internas e os campos antigos de notas.
- **Nome do ficheiro:** `lamina-cotacao-<referencia>-<destino>.jpg` para a imagem e `.html` para o HTML, com sanitização; a referência pode ficar no nome do ficheiro mesmo sem aparecer na peça.
- **Sem caixas de confirmação:** não há “Revisei a imagem”, “Revisei o subtítulo” nem “Revisei a prévia final”. A sugestão de IA, a prévia final e o salvamento são liberados pelas validações de conteúdo, não por aceites.
- **Rótulos:** “Gerar imagem e subtítulo” na primeira geração, “Gerar nova sugestão” nas seguintes, “Gerar lâmina” para a prévia final no servidor, “Salvar lâmina na cotação” / “Substituir a lâmina salva” e os downloads “HTML” e “IMAGEM”.
- **Download:** o servidor continua a armazenar e a devolver PNG; o botão “IMAGEM” converte o PNG em JPG no cliente antes de descarregar. O HTML permanece inalterado. A conversão reutiliza o helper da lâmina de pacote e falha com mensagem se não produzir JPEG.

## Desenho inicial (superado pelo template anexo)

Esta composição foi a primeira referência para a cotação e ficou superada pelo template anexo de 2026-11-11; mantém-se como histórico. O template em vigor está na secção “Template anexo e mapeamento”. O desenho faz parte da entrega; o mockup 1080 × 1920 deve ser produzido sobre o template anexo, não sobre esta caixa cinza.

```
┌──────────────────────────────────────┐
│ [logo]  Proposta de viagem  www.s23  │  navy
│ Para Marina Alves      Ref. COT-…    │  navy, segunda linha
├──────────────────────────────────────┤
│ Lisboa            ✈            Açores│  terracota
├──────────────────────────────────────┤
│ ┌ caixa cinza (--flyer-panel 0.60) ─┐│
│ │ € 4.800 total                     ││
│ │ para 2 adultos                    ││  valor branco
│ │ € 2.400 por pessoa em quarto duplo││
│ │ Válida até 30 de novembro de 2026 ││
│ │ 30% de entrada · saldo em 5x      ││
│ │                                   ││
│ │ 12 a 19 de dezembro de 2026       ││
│ │                                   ││
│ │ ✓ Aéreo com bagagem               ││
│ │ ✓ Hospedagem com café da manhã    ││
│ │ ✓ Transfer                        ││
│ │                                   ││
│ │ “subtítulo comercial revisado”    ││
│ └───────────────────────────────────┘│
├──────────────────────────────────────┤
│ Valores sujeitos a alteração  contacto│  navy
└──────────────────────────────────────┘
```

- O cabeçalho navy usa duas linhas: marca/“Proposta de viagem”/website e cliente/referência.
- A caixa cinza começa sob a faixa terracota e agrupa valor, validade, condições de pagamento, período, serviços e subtítulo, como na lâmina de pacote atual. Cabeçalho e rota ficam fora.
- Cliente, referência, total, por pessoa, passageiros e validade são os dados novos em relação ao template de pacote.
- O período fica em uma linha própria dentro da caixa; as condições de pagamento ficam no bloco de valor, não em uma faixa separada.
- O espaçamento entre período e serviços e entre serviços e subtítulo segue a regra atual: uma linha completa da tipografia dos serviços além do gap, inclusive no modo compacto. O espaçamento interno do valor não é reduzido quando houver mais serviços.
- Com 6 serviços e rótulos longos, a caixa usa o modo compacto existente; o mockup e os testes de overflow decidem se o bloco de valor precisa de ajuste, sem remover total, validade ou passageiros.
- A secção da lâmina salva e os botões de download ficam fora do bloco condicionado ao modelo local, para continuarem acessíveis quando faltar cliente/validade ou a validade tiver vencido.

## Template anexo e mapeamento

O template aprovado em 2026-11-11 (“Proposta de viagem”) substitui, para a cotação, a composição de caixa cinza descrita acima. A caixa cinza continua a ser a lâmina de pacote. O template de cotação é uma folha de proposta:

```
hero com foto + logo + data + etiqueta “PROPOSTA DE VIAGEM”
título “{duração em palavras} em {destino}” + subtítulo
barra branca: DATAS | VIAJANTES | ROTA
dois cartões brancos: VOOS (ida/regresso) | HOSPEDAGEM (hotel, noites, incluído, não incluído)
bloco navy: INVESTIMENTO TOTAL | PAGAMENTO
CTA laranja: “Fale com a S23 para reservar”
rodapé legal
```

### Mapeamento dos campos

| Elemento do template | Campo/fonte atual | Situação |
| --- | --- | --- |
| Logo S23 | asset do kit | existe |
| Foto do destino | imagem gerada/revisada na lâmina | existe (flyer) |
| Data da cotação (apenas a data) | novo campo `proposalDate` no formulário | pré-preenchido com `created_at`, editável; exibir `DD/MM/AAAA` |
| “PROPOSTA DE VIAGEM” | copy fixa | existe |
| Título (duas linhas) | `client_name` + `destination` | existe; linha 1 cliente, linha 2 destino |
| Subtítulo “Paris na primavera…” | subtítulo da IA editado na lâmina | existe (flyer; não é campo do formulário) |
| DATAS | `startDate` / `endDate` | existe; formatar “02 ABR — 05 ABR 2027” |
| VIAJANTES | `adults` / `children` / `infants` | existe; formatar plural |
| ROTA | `origin` / `destination` | existe |
| Companhia “VOOS EASYJET” | `ServiceItem.carrier` | existe no tipo; o editor não expõe, mas o dado legado está preenchido |
| IDA · data | `startDate` | derivar; opcional `ServiceItem.departureDate` |
| IDA · rota “OPO — ORY” | `ServiceItem.description` (ida) | existe; extrair os códigos entre parênteses; fallback origem/destino |
| IDA · horários | `ServiceItem.departureTime` / `arrivalTime` | existe e está exposto |
| REGRESSO · data | `endDate` | derivar; opcional `ServiceItem.departureDate` |
| REGRESSO · rota “ORY — OPO” | `ServiceItem.description` (volta) | existe; extrair os códigos entre parênteses |
| REGRESSO · horários | `ServiceItem.departureTime` / `arrivalTime` | existe |
| “Tarifa para 2 adultos” | passageiros | derivar |
| “Bagagem de mão incluída” | `ServiceItem.notes` | existe; usar a nota do transporte |
| “HOSPEDAGEM” | `ServiceItem.type = 'accommodation'` | existe |
| “3 NOITES” | `durationNights` | derivar; opcional `ServiceItem.nights` |
| “Ibis Paris Alésia…” | `ServiceItem.description` | existe (autocomplete de hotel) |
| Datas do hotel | `startDate` / `endDate` | derivar; opcional `ServiceItem.checkIn` / `checkOut` |
| “Café da manhã” | `ServiceItem.mealPlan` | existe; formatar sem o código |
| “INCLUÍDO” | lista derivada dos serviços + editor “Serviços apresentados” | existe; a curadoria fica na lâmina |
| “NÃO INCLUÍDO” | novo campo `notIncluded` (lista) | criar; até 3 linhas, editável no formulário |
| “INVESTIMENTO TOTAL” | `salePrice` / `financials.salePrice` | existe; usar `formatMoney` da app |
| “PAGAMENTO” | novos campos `depositAmount` + `balanceDueDate` | criar; o texto `paymentConditions` não alimenta o bloco |
| “Consulte-nos sobre outras saídas e datas” | copy fixa | existe |
| CTA “Fale com a S23 para reservar” | copy fixa | existe |
| Rodapé legal | copy fixa | existe |
| Cliente | `client_name` | existe; é a primeira linha do título |
| Referência | `reference` | existe; não é exibida no template; fica no ficheiro/metadados |
| Validade | — | fora da peça; não criar campo |

### Campos a criar

O template usa os campos atuais para o topo e os serviços, mas precisa de quatro campos novos no formulário:

- `QuotationData.proposalDate?: string` — “Data da cotação”, ISO; pré-preenchido com `created_at`, editável; exibir `DD/MM/AAAA`.
- `QuotationData.depositAmount?: number` — “Sinal”, na moeda da cotação.
- `QuotationData.balanceDueDate?: string` — “Restante até”, data ISO; exibir `DD/MM`.
- `QuotationData.notIncluded?: string[]` — “Não incluído”, até 3 linhas de 100 caracteres.
- `ServiceItem.route` **não é necessário**: a rota de ida/volta sai do `description` do serviço de transporte, extraindo os códigos entre parênteses (“Voo de ida Porto (OPO) para Paris (ORY)” → “OPO — ORY”). Se a descrição não tiver códigos, usar a origem/destino da cotação.
- Opcionais, só se a cotação tiver mais de um voo/hotel ou datas diferentes: `ServiceItem.departureDate`, `arrivalDate`, `checkIn`, `checkOut`, `nights`, `baggage`. Para o caso de uma perna e um hotel, derivar de `startDate`/`endDate`/`durationNights` e usar `notes` para bagagem.
- `paymentConditions`, `localTaxNotes`, `extraServicesNotes` e `customNotes` ficam preservados nos dados antigos, mas não alimentam o bloco novo; a operadora passa a usar `depositAmount`/`balanceDueDate` e `notIncluded`.

### Campos a renomear no formulário

| Hoje | Proposta |
| --- | --- |
| Data de Partida | Ida |
| Data de Retorno | Regresso |
| Origem da Cotação | Origem |
| Destino Principal da Cotação | Destino |
| Rota / Cia Aérea de Ida/Volta | Serviço de ida / Serviço de volta (rota e companhia) |
| Destino Específico do Hotel | Cidade do hotel |
| Regime de Acomodação | Regime / pensão |
| Observação (do serviço) | Bagagem / tarifa (transporte) ou Observações do serviço |
| Duração (Dias) / Duração (Noites) | Dias / Noites |
| Condição de Pagamento (Entrada / Saldo) | Sinal + Restante até (dois campos) |
| Taxa Local na Hospedagem | Não incluído (lista) |
| Serviços Extras / Opcionais | Não incluído (lista) |
| Observações Comerciais para o Cliente / Condições da Cotação | Observações / rodapé da proposta |
| Taxa de Câmbio (Manual) | Câmbio (1 EUR = X BRL) |
| Nome do Cliente / Solicitante | Cliente (1.ª linha do título) |
| Destino Principal da Cotação | Destino (2.ª linha do título) |
| Moeda da Cotação | Moeda |

### Decisões resolvidas

- **Data do topo:** novo campo `proposalDate` no formulário, pré-preenchido com `created_at`, editável.
- **Validade:** fora da peça; não criar campo.
- **Não incluído:** lista nova `notIncluded`.
- **Detalhes dos serviços:** aceite a proposta: rota do `description`, companhia de `carrier`, datas/noites do cabeçalho; campos por serviço só se necessário.
- **Moeda:** formato da app (`formatMoney`).
- **Subtítulo:** continua a ser o campo gerado/editado na lâmina, não do formulário.
- **Referência:** fora do template; o badge mostra apenas a data da cotação.

## Decisões de dados

- **Data da cotação:** acrescentar `proposalDate?: string` (ISO `YYYY-MM-DD`) a `QuotationData`; o formulário pré-preenche com `created_at` e permite editar; a lâmina exibe `DD/MM/AAAA`.
- **Cliente e referência:** usar `quotations.client_name` (primeira linha do título; obrigatório). `quotations.reference` fica no ficheiro/metadados e não é exibida no template. Sem validade.
- **Moeda:** usar `quotations.currency`. O `financials.currency` do snapshot deve coincidir; se não coincidir, a lâmina bloqueia com uma mensagem para rever e salvar a cotação. Formatar com `formatMoney` da app (`€ 700,00`).
- **Passageiros:** a barra usa um rótulo com adultos/crianças/bebés; a tarifa do voo usa o número de pagantes (adultos + crianças).
- **Serviços:** reutilizar a derivação e a normalização da lâmina de pacote para a lista “INCLUÍDO”. Para os cartões de voos e hospedagem, derivar `transport.outbound`/`inbound` e `lodging` a partir dos `ServiceItem` de transporte e acomodação. A rota de ida/volta é extraída do `description` (códigos entre parênteses, ex.: “Voo de ida Porto (OPO) para Paris (ORY)” → “OPO — ORY”); usar `carrier` para a companhia e as datas/horas do serviço ou da cotação. O editor de itens continua com 6 itens e 40 caracteres por rótulo.
- **Pagamento:** acrescentar `depositAmount?: number` (sinal, moeda da cotação) e `balanceDueDate?: string` (ISO) a `QuotationData`. O bloco “PAGAMENTO” usa esses valores; o total continua em `salePrice`. `paymentConditions` fica como observação antiga, sem alimentar o bloco.
- **Não incluído:** acrescentar `notIncluded?: string[]` (até 3 linhas, 100 caracteres) a `QuotationData`; é a única fonte do bloco. `localTaxNotes`/`extraServicesNotes`/`customNotes` ficam preservados, sem alimentar a peça.
- **Datas:** `data.dates.startDate` e `endDate` válidos são obrigatórios, como na lâmina de pacote.
- **Origem e destino:** obrigatórios, com os mesmos limites de comprimento da lâmina de pacote.
- **Duplicação de cotação:** o snapshot copia `proposalDate`, `depositAmount`, `balanceDueDate` e `notIncluded`; a operadora pode editar a data e o sinal na nova cotação.

## Decisões de segurança e persistência

- **Edge Function própria:** `quotation-flyer`, autenticada com `requireUser`, com as ações `current`, `download`, `preview` e `publish`.
- **Modelo canônico no servidor:** o handler lê a cotação em `quotations` com o JWT do utilizador (RLS), constrói o modelo a partir dos dados persistidos e nunca aceita preço, sinal, não incluídos, cliente ou data da cotação enviados pelo browser. O browser envia apenas `quotationId`, `expectedRevision`, `requestId`, imagem, subtítulo e itens revistos.
- **IA:** reutilizar `generate-flyer-ai` sem alterações. A chamada continua a receber apenas destino e indicação opcional; o nome do cliente, a data, o sinal e os não incluídos nunca são enviados. O estado atual é imagem com `gemini-nano-banana-2.1` em 9:16/1K (PNG ou JPEG) e subtítulo com `gemini-3.6-flash`, com nova tentativa nesse modelo e frase neutra validada como último recurso; não alterar esse comportamento nesta entrega.
- **Renderer:** o worker passa a aceitar um discriminador `template` (`package` ou `quotation`). Sem o campo, assume `package`, preservando o contrato atual. O template de cotação usa o mesmo viewport 1080 × 1920, valida o modelo e devolve `s23-flyer-v1` com HTML e PNG. O renderer é publicado manualmente com `npx wrangler@3 deploy --config workers/flyer-renderer/wrangler.jsonc`; o push para `main` publica a SPA, não o renderer.
- **Tabelas novas:** `quotation_flyer_operations` e `quotation_flyer_attachments`, com FK para `quotations` e `on delete cascade`, RLS ativa e acesso apenas a `service_role`.
- **Fila compartilhada:** reutilizar `package_flyer_cleanup_queue`, acrescentando `owner_kind` com default `package` e valores `package`/`quotation`. As funções de claim e finish da cotação gravam e consomem esse discriminador; a rotina de limpeza processa os dois tipos e chama o finish correspondente.
- **Bucket compartilhado:** reutilizar `s23-package-flyers` (nome histórico, privado, 12 MiB, HTML/PNG). Os caminhos da cotação seguem `<quotationId>/<requestId>.html|png`; não mover objetos existentes nem renomear o bucket nesta entrega.
- **Trigger de exclusão:** antes de apagar uma cotação, enfileirar os objetos das suas operações de lâmina. A exclusão de cotações com operação financeira continua bloqueada pela regra atual.
- **Concorrência:** usar `quotations.updated_at` e `expectedRevision` no CAS, como o pacote faz com `packages.updated_at`. Conflito devolve erro e mantém a versão ativa. A publicação é idempotente por `requestId`.
- **Última versão:** nova lâmina substitui a anterior; não há histórico.
- **Privacidade:** se o cliente for exibido, o anexo contém o nome do cliente. O bucket é privado, o download passa pela Edge Function autenticada, não há URLs públicas e o nome do cliente não entra em logs. A peça não deve ser reutilizada como divulgação pública.
- **Notas internas:** custos, margens, fornecedores, identificadores, observações internas e notas livres continuam fora do modelo público.

## Contrato do modelo da cotação

```ts
interface QuotationFlyerModel {
  version: 1;
  template: 'quotation';
  clientName: string; // primeira linha do título
  proposalDate: string; // do formulário, formatada DD/MM/AAAA
  subtitle?: string;
  origin: string;
  destination: string; // segunda linha do título
  dates: { period: string; start: string; end: string };
  passengers: {
    adults: number;
    children: number;
    infants: number;
    label: string; // ex.: "2 adultos"
  };
  transport: {
    outbound: TransportLeg;
    inbound: TransportLeg;
  } | null;
  lodging: {
    name: string;
    dateRange: string;
    nights: string;
    mealPlan?: string;
  } | null;
  included: FlyerItem[];
  notIncluded: string[];
  price: {
    total: { amount: number; currency: Currency; formatted: string };
    perPerson?: { amount: number; currency: Currency; formatted: string };
  };
  deposit?: { amount: number; currency: Currency; formatted: string };
  balanceDueDate?: string; // formatada DD/MM
  imageUrl?: string;
}

interface TransportLeg {
  carrier: string;
  date: string; // formatada, ex.: "02/04/2027"
  route: string; // ex.: "OPO — ORY", extraída do description
  departureTime?: string;
  arrivalTime?: string;
  fareLabel?: string; // ex.: "Tarifa para 2 adultos"
  baggage?: string; // ex.: "Bagagem de mão incluída"
}
```

Limites mínimos a validar no cliente e no servidor:

- `clientName`: 1–60 caracteres, sem caracteres de controlo; é obrigatório.
- `proposalDate`, `dates.start`, `dates.end`, `transport.*.date`: 1–10 caracteres formatados.
- `origin`/`destination`: 2–45 caracteres; a soma continua limitada a 55, como no pacote.
- `dates.period`: até 40 caracteres.
- `passengers.label`: até 40 caracteres.
- `transport.*.carrier`: até 40; `route`: até 30; horários: até 5; `fareLabel`/`baggage`: até 60.
- `lodging.name`: até 60; `dateRange`: até 30; `nights`: até 20; `mealPlan`: até 40.
- `included`: até 6, rótulos de 1 a 40 caracteres, com as regras de `flyerItemsContract`.
- `notIncluded`: até 3 linhas, 1–100 caracteres cada, com sanitização de texto público (pode conter preço de item não incluído, mas não custos internos).
- `price.total.formatted`: até 20 caracteres; `price.perPerson.formatted`, se existir, até 20.
- `deposit.formatted`: até 20 caracteres.
- `balanceDueDate`: até 10 caracteres formatados.
- `subtitle`: 3–100 caracteres, com `validSubtitle`.

O worker valida os mesmos limites e rejeita chaves desconhecidas, como já faz com o modelo de pacote.

## API da Edge Function

Corpo mínimo por ação:

- `current`: `{ action: 'current', quotationId }`.
- `download`: `{ action: 'download', quotationId, format: 'html' | 'png' }`.
- `preview`: `{ action: 'preview', quotationId, expectedRevision, requestId, image, subtitle, items }`.
- `publish`: `{ action: 'publish', quotationId, expectedRevision, requestId }`.

Respostas e erros seguem o contrato da `package-flyer`: prévia em Base64, revisão esperada, conflito de revisão, prévia expirada, anexo indisponível e falha de renderização. As mensagens trocam “pacote” por “cotação”. A ação `download` continua a devolver PNG ou HTML; o botão “IMAGEM” converte o PNG em JPG no cliente.

## Mapa de implementação

### Serviços e componentes

- `src/services/flyerCommercialModel.ts` (novo): extrair a derivação de origem, destino, período, preço, passageiros, serviços, itens e condições de pagamento hoje em `packageFlyerService.ts`; `createPackageFlyer` passa a ser um wrapper.
- `src/services/quotationFlyerService.ts` (novo): `createQuotationFlyer(quote)`, com as guardas de dados e a derivação do título (cliente + destino), transporte (ida/regresso a partir de `description`, `carrier`, datas/horas), hospedagem, incluídos, `notIncluded`, total, `depositAmount`/`balanceDueDate` e `proposalDate` do formulário. Cliente é obrigatório; a referência não é exibida; o badge mostra a data da cotação.
- `src/services/flyerMarkupShared.ts` (novo): `escapeHtml`, ícones, foto, logo, formatação de datas e o rodapé comum extraídos de `packageFlyerMarkup.ts`; a composição da cotação é um layout novo, não a caixa cinza do pacote.
- `src/services/quotationFlyerMarkup.ts` (novo): markup do template anexo: hero, etiqueta, título/subtítulo, barra de datas/viajantes/rota, cartões de voos e hospedagem, bloco de investimento, CTA e rodapé legal.
- `src/services/quotationFlyerAttachmentService.ts` (novo): `getCurrentQuotationFlyer`, `createQuotationFlyerServerPreview`, `publishQuotationFlyer`, `downloadSavedQuotationFlyer`.
- `src/services/flyerDownload.ts` (novo): extrair `convertPngToJpg` e a geração do nome do ficheiro hoje locais em `PackageFlyerCreator.tsx`; a cotação usa o mesmo helper e o prefixo `lamina-cotacao-...`, com a referência e o destino vindos da cotação para o download da versão salva funcionar mesmo quando o modelo local está inválido.
- `src/components/flyers/useFlyerCreator.ts` (novo): máquina de estados e handlers comuns (IA, subtítulo, itens, prévia, publicação, downloads, conversão JPG, limpeza de URLs), sem estado de aceites.
- `src/components/flyers/FlyerControls.tsx`, `FlyerItemsEditor.tsx`, `FlyerServerPreview.tsx`, `FlyerSavedDownloads.tsx` (novos): controlos e apresentação comuns, com os rótulos atuais e sem caixas de confirmação.
- `src/components/packages/PackageFlyerCreator.tsx`: passa a consumir a casca e os controlos comuns, mantendo a API pública `{ package, open, showToggle }` e o comportamento atual (sem aceites, “Gerar nova sugestão”, “Gerar lâmina”, HTML/IMAGEM com JPG).
- `src/components/quotes/QuotationFlyerCreator.tsx` (novo): adapta a cotação à casca, com copy própria, resumo de texto próprio e `QuotationFlyerTemplate`. O resumo inclui cliente, data da cotação, transporte, hospedagem, incluídos, não incluídos, total e sinal/restante; a referência fica fora da peça. A secção da lâmina salva e os downloads usam `FlyerSavedDownloads` fora do bloco condicionado ao modelo local.
- `src/components/quotes/QuotationFlyerTemplate.tsx` (novo): hero, barra de dados, cartões de voos e hospedagem, bloco de investimento, CTA e rodapé legal.
- `src/components/quotes/quotationFlyer.css` (novo): layout completo do template anexo, não apenas modificadores da caixa cinza; usa os tokens do kit Travel, Poppins, navy/laranja e os cartões brancos. A página da cotação importa o CSS da cotação; o worker importa o CSS da cotação e o da lâmina de pacote (para o template package).
- `src/pages/quotes/QuoteDetailPage.tsx`: botão “Criar lâmina”, estado `flyerOpen`, import do CSS e do creator. A página já tem cliente e referência; passa a exibir a data da cotação, o sinal/restante e o não incluído na secção comercial.
- `src/pages/quotes/QuoteFormPage.tsx`: acrescentar “Data da cotação” (pré-preenchida com `created_at`, editável), “Sinal”, “Restante até” e “Não incluído” (lista); renomear os labels indicados na secção “Campos a renomear”; preservar no rascunho (`QuoteDraft`). `paymentConditions`/`localTaxNotes`/`extraServicesNotes`/`customNotes` ficam como legado, sem alimentar o bloco novo.
- `src/components/packages/PackageServicesEditor.tsx`: ajustar o label dos transportes para “Serviço de ida/volta (rota e companhia)” e da observação para “Bagagem / tarifa”; a rota continua a sair do texto do serviço.
- `src/types/index.ts`: `QuotationData.proposalDate?`, `depositAmount?`, `balanceDueDate?`, `notIncluded?: string[]`; `QuoteDraft` com os mesmos campos; sem `validUntil`. Opcionais por serviço só se houver vários voos/hotéis: `departureDate`, `arrivalDate`, `checkIn`, `checkOut`, `nights`, `baggage`.

### Backend

- `supabase/functions/_shared/quotationFlyerModel.ts` (novo): modelo canônico do servidor, a partir da cotação persistida.
- `supabase/functions/_shared/flyerPipeline.ts` (novo): extrair a orquestração comum da `package-flyer` (leitura limitada, validação de imagem, hash, renderer, upload, RPCs, idempotência). A `package-flyer` passa a ser um configurador da pipeline, com os testes de persistência existentes como portão.
- `supabase/functions/quotation-flyer/index.ts` e `handler.ts` (novos): configuração da cotação sobre a pipeline.
- `workers/flyer-renderer/src/index.ts`: discriminador `template`, import do CSS e do markup da cotação, validação do modelo da cotação, mesma viewport 1080 × 1920. Publicar com `npx wrangler@3 deploy --config workers/flyer-renderer/wrangler.jsonc`; o push para `main` não atualiza o renderer.
- `supabase/migrations/<timestamp>_quotation_flyer_attachments.sql` (novo): tabelas, índices, RLS/grants, RPCs, `owner_kind` na fila, trigger de exclusão da cotação e comentários.
- `supabase/functions/cleanup-package-flyer/index.ts`: processar também os claims/finishes da cotação.

### Documentação

- `docs/LAMINA-CONTRATO.md`: secção da lâmina de cotação, modelo, privacidade, template anexo, decisões aprovadas e mapeamento de campos; referência visual `preview-cotacao-9x16.png`.
- `docs/LAMINA-IA.md`: confirmar que a IA continua a receber apenas destino/indicação e que o nome do cliente nunca é enviado; corrigir a nota do modelo para o estado atual (`gemini-nano-banana-2.1` + `gemini-3.6-flash`), que está desatualizada em relação ao handler.
- Registar a decisão de JPG no design de download existente (`docs/superpowers/specs/2026-11-10-package-flyer-jpg-download-design.md`) e a de espaçamento/painel (`2026-11-11-flyer-spacing-panel-design.md`) como referências da cotação.

## Testes

- Modelo da cotação: título cliente/destino, data da cotação, transporte (companhia, rota extraída do `description`, datas, horários, bagagem), hospedagem (hotel, período, noites, regime), incluídos, `notIncluded`, total, `depositAmount`/`balanceDueDate`, moeda coincidente, passageiros, origem/destino, datas, textos internos e limites de comprimento.
- Markup: template 9:16 com hero, etiqueta, título cliente/destino, subtítulo, barra DATAS/VIAJANTES/ROTA, cartões de voos/hospedagem, incluídos/não incluídos, investimento, pagamento, CTA e rodapé; ausência de dados internos; escape de HTML; listas densas.
- Estados da lâmina salva: com dados obrigatórios em falta, a prévia é bloqueada mas a versão salva continua visível e baixável.
- Formulário: data da cotação editável, sinal/restante, lista de não incluídos, validação e preservação no rascunho; labels renomeados.
- Formatação: `formatMoney` da app (`€ 700,00`), datas `DD/MM/AAAA` e `DD/MM`; título cliente/destino.
- Paridade: a extração dos helpers não altera a saída do template de pacote; os testes existentes de `test_package_flyer` e do fluxo browser continuam a passar, incluindo o agrupamento na caixa cinza, o respiro e o download JPG.
- Fluxo browser: abrir a lâmina a partir de uma cotação, gerar IA, editar subtítulo/itens, gerar prévia final, salvar, baixar HTML e “IMAGEM” (JPG), recarregar a versão salva e testar erros dos dados obrigatórios. Não deve haver caixas de confirmação.
- Conversão: o botão “IMAGEM” entrega MIME JPEG e extensão `.jpg`, a partir do PNG devolvido pelo servidor; falhas de conversão mostram erro e não descarregam um ficheiro mal rotulado.
- Persistência: ações `current`, `download`, `preview`, `publish`; conflito de revisão; prévia expirada; idempotência; caminho inválido; hash; limite de tamanho; modelo inválido; RLS/grants; trigger de exclusão; limpeza dos dois tipos.
- Worker: modelo de pacote sem `template` continua válido; modelo de cotação válido; campos desconhecidos e limites rejeitados; PNG 1080 × 1920. Verificar o deployment manual (`wrangler@3`) e comparar `created_on` com a hora do build, porque o push não atualiza o renderer.
- Testes isolados, sem criar, alterar ou apagar dados no projeto compartilhado. Não executar a suíte completa sem avaliar cada caso. Não instalar dependências para contornar a ausência de `tsx`.

## Sequência sugerida

1. Aprovar esta especificação, o template anexo e as decisões de campos (feito em 2026-11-11).
2. Usar a referência visual aprovada `preview-cotacao-9x16.png` como base do template.
3. Extrair a casca de estado/controlos, os helpers de markup e o helper de download JPG, com os testes da lâmina de pacote verdes.
4. Acrescentar os campos da cotação (data, sinal, restante até, não incluído), ajustar labels e a leitura dos dados existentes (cliente/destino no título, rota no serviço, companhia em `carrier`).
5. Implementar `createQuotationFlyer` e o template do anexo, com testes de modelo e markup.
6. Adaptar o worker com o discriminador de template e validar a paridade do pacote; publicar o renderer com `wrangler@3` antes de ativar a cotação.
7. Criar a migration, as RPCs, a fila com `owner_kind`, o trigger e a Edge Function `quotation-flyer`.
8. Integrar o creator no detalhe da cotação e o download, incluindo a lâmina salva independente do modelo.
9. Cobrir o fluxo browser, a persistência, a conversão JPG e a limpeza.
10. Atualizar a documentação.
11. Publicar na ordem: renderer com `wrangler@3`, migration/RPCs, Edge Function, frontend. O push para `main` publica a SPA, não o renderer. Sem `db push`; confirmar `migration list` e pedir autorização específica para operações em produção.

## Fora de escopo

- Formatos diferentes de 9:16.
- PDF.
- Envio automático da proposta.
- Histórico de lâminas.
- Inclusão de notas livres internas na peça.
- Generalização das tabelas de anexo de pacote.
- Alterações de autenticação, RLS de tabelas existentes ou regras financeiras.
- Commit, push, deploy, migration remota ou operação em dados compartilhados sem pedido explícito.

## Notas

- A lâmina de cotação é uma proposta identificada para um cliente real; não deve ser tratada como peça pública. O anexo contém dados pessoais e permanece privado.
- O nome do bucket `s23-package-flyers` é histórico. Reutilizá-lo evita mover objetos existentes; a dívida de nome fica registada.
- A lâmina salva é um snapshot: continua baixável depois de a cotação mudar. Só a geração de uma nova prévia exige cliente e preço atuais. A interface deve manter a secção da lâmina salva fora do bloco com erros do modelo local.
- O template de cotação não mostra valor por pessoa; se for incluído, a nota “por pessoa em quarto duplo” depende de haver hospedagem. A decisão “sempre” da lâmina de pacote não é transferida automaticamente.
- A referência visual aprovada é `preview-cotacao-9x16.png` (1080 × 1920). As decisões de campos estão na secção “Decisões aprovadas em 2026-11-11”.
- Prévia de análise feita com a COT-2026-059: título “Sandra Colognesi” + “Paris”; rotas extraídas de “Voo de ida Porto (OPO) para Paris (ORY)” e “Voo de volta Paris (ORY) para Porto (OPO)”; pagamento “250€ de sinal + restante do valor até 20/03”; taxa local “34€” no não incluído. O subtítulo usado na prévia é de exemplo e a imagem foi gerada para análise; a lâmina real gera e permite editar ambos.
- A moeda na peça final segue `formatMoney` da app (`€ 700,00`); o mockup mostra `700,00 €` por fidelidade ao anexo, mas a implementação usa o formato da app.
- A lista `notIncluded` é a fonte do bloco “Não incluído”; os campos antigos de notas ficam preservados nos dados, sem alimentar a peça.
- O 4:5 foi considerado, mas o responsável confirmou 9:16 para envio por WhatsApp; o 1:1 continua fora de escopo.
- A ordem de publicação importa: o renderer novo deve aceitar o modelo de pacote sem `template` antes de a Edge Function da cotação entrar em serviço. O renderer é publicado com `npx wrangler@3 deploy --config workers/flyer-renderer/wrangler.jsonc`; o push em `main` publica a SPA, não o renderer.
- O download JPG é uma conversão no cliente sobre o PNG do servidor; não altera o formato persistido, o renderer ou a Edge Function.
- `docs/LAMINA-IA.md` ainda descreve o modelo `gemini-2.5-flash-image`; o handler atual usa `gemini-nano-banana-2.1` e `gemini-3.6-flash`. Corrigir essa nota sem confundir com a implementação da cotação.
- Os testes existentes da lâmina de pacote são o portão de regressão; a cotação não deve alterar a peça de pacote.
- Este documento não autoriza implementação, deploy ou operações em produção. A aprovação do responsável é o portão para o plano de implementação.
