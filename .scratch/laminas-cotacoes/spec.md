# Especificação: lâminas de cotações

Status: draft

## Problema

A operadora precisa enviar ao cliente uma proposta de viagem visual, com o nome do cliente, a referência da cotação, a validade, o preço total e por pessoa, os serviços e as condições comerciais. Hoje a lâmina existe apenas para pacotes e é uma peça pública de divulgação: não tem cliente, referência, validade nem total. Montar a proposta fora do Packager repete dados e arrisca divergências de preço, datas e serviços.

## Solução

No detalhe de uma cotação, oferecer a ação **Criar lâmina**. O fluxo é o mesmo da lâmina de pacote — sugestão de imagem e subtítulo por IA, revisão humana, prévia final gerada no servidor, salvamento da última versão e download em HTML ou PNG —, mas com um template 9:16 próprio para propostas a clientes reais. O template mantém a identidade S23 Travel e acrescenta os dados da cotação.

O objetivo é reaproveitar ao máximo os componentes existentes sem alterar o comportamento da lâmina de pacote: a casca de estado e os controlos da interface, a derivação comercial, os helpers de markup, o renderer Cloudflare, o bucket, a fila de limpeza e o contrato de itens. A persistência da cotação fica isolada em tabelas e RPCs próprias, reusando a mesma fila e o mesmo bucket.

## Objetivos

1. Criar uma lâmina de proposta a partir de uma cotação existente, sem repetir o cadastro.
2. Mostrar no detalhe da cotação a ação **Criar lâmina**, no mesmo padrão da ação do pacote.
3. Reutilizar o máximo possível de `PackageFlyerCreator`, `packageFlyerService`, `packageFlyerMarkup`, `flyerItemsContract`, `flyerAiContract`, `generate-flyer-ai`, do worker `flyer-renderer` e da infraestrutura de anexos.
4. Produzir uma peça 9:16 em 1080 × 1920 com a identidade S23 Travel e as margens de segurança já usadas na lâmina de pacote.
5. Exibir cliente, referência, validade, total, valor por pessoa, passageiros, período, serviços, subtítulo e condições de pagamento.
6. Manter a mesma segurança da lâmina de pacote: modelo comercial construído no servidor, renderer confiável, prévia staged, publicação CAS, apenas a última versão e limpeza automática.
7. Não expor custos, margens, fornecedores, notas internas ou dados pessoais além do necessário à proposta.
8. Entregar download em PNG e HTML com os mesmos recursos embutidos (fonte, logo, imagem) e funcionamento fora da sessão.

## Não objetivos

- Publicação automática em WhatsApp, Instagram ou TikTok.
- Envio da proposta por e-mail ou WhatsApp a partir do Packager.
- Editor gráfico, upload de fotos reais ou templates adicionais.
- Histórico de versões da lâmina; continua a existir apenas a última versão salva.
- Alteração das regras financeiras, do motor de cálculo ou da autenticação.
- Uso da lâmina de cotação como peça pública de divulgação.
- Inclusão das notas livres `localTaxNotes`, `extraServicesNotes` ou `customNotes` na primeira versão.

## Anti-objetivos

- Reutilizar o template de pacote sem cliente, referência e validade: deixaria de ser uma proposta identificada.
- Enviar o nome do cliente, a referência ou qualquer dado pessoal à IA.
- Recalcular preço no template ou converter moeda duas vezes.
- Publicar uma proposta com validade vencida ou sem cliente identificado.
- Duplicar o cálculo financeiro, o contrato de itens ou as regras de conteúdo público.
- Refatorar a lâmina de pacote de forma que mude a peça visual ou o fluxo existente.
- Generalizar as tabelas de anexo de pacote em produção nesta primeira entrega.

## Histórias de usuário

1. Como operadora, quero iniciar a lâmina no detalhe da cotação para preparar a proposta sem repetir dados.
2. Como operadora, quero que a lâmina mostre o nome do cliente para identificar a proposta.
3. Como operadora, quero que a lâmina mostre a referência da cotação para o cliente e a equipa falarem do mesmo documento.
4. Como operadora, quero que a lâmina mostre a validade da proposta para evitar enviar uma condição vencida.
5. Como operadora, quero ver o preço total para o número de viajantes da cotação.
6. Como operadora, quero ver também o valor por pessoa para o cliente comparar a condição comercial.
7. Como operadora, quero que a nota de quarto duplo apareça apenas quando a cotação inclui hospedagem, para não afirmar uma condição que não existe.
8. Como operadora, quero ver o período da viagem, a origem, o destino e os passageiros.
9. Como operadora, quero revisar e editar os serviços apresentados, como na lâmina de pacote.
10. Como operadora, quero gerar uma imagem do destino e um subtítulo com IA, com revisão obrigatória.
11. Como operadora, quero que o subtítulo e a imagem não recebam dados do cliente nem da cotação.
12. Como operadora, quero ver uma prévia fiel antes de salvar e baixar.
13. Como operadora, quero baixar HTML e PNG da última versão salva sem gerar outra imagem de IA.
14. Como operadora, quero que salvar uma nova lâmina substitua a anterior.
15. Como operadora, quero ser avisada quando faltar cliente, validade, datas, origem, destino ou preço, com indicação do que corrigir na cotação.
16. Como operadora, quero que uma cotação arquivada preserve a lâmina salva e permita baixá-la.
17. Como operadora, quero que a exclusão de uma cotação sem operação financeira também remova os ficheiros da lâmina.
18. Como responsável pelo projeto, quero que a lâmina de pacote continue a funcionar exatamente como hoje.
19. Como responsável pelo projeto, quero que a nova persistência não altere os registos de pacotes existentes.
20. Como responsável pelo projeto, quero testes isolados e nenhuma operação em produção sem autorização específica.

## Abordagens consideradas

### 1. Duplicar o fluxo inteiro

Copiar `PackageFlyerCreator`, a Edge Function, as tabelas e as RPCs, mudando apenas os nomes. É a via mais rápida e a que menos toca no fluxo de pacotes. O custo é manter duas cópias de uma casca de 460 linhas, duas orquestrações de renderização, dois conjuntos de SQL e duas rotinas de limpeza. Rejeitada para a interface e para o pipeline, porque contraria o pedido de máximo reaproveitamento e multiplica o risco de divergência.

### 2. Generalizar tudo

Um único creator, um único modelo com discriminador, tabelas/RPCs com um dono polimórfico (`package` ou `quotation`) e uma única Edge Function. É a solução mais limpa a longo prazo, mas mexe nas tabelas e no fluxo que já estão em produção, incluindo a chave primária de `package_flyer_attachments`, as FKs e as RPCs de publicação. Rejeitada para a primeira entrega por risco desproporcional.

### 3. Escolhida: compartilhar o que é estável, isolar a persistência

- Compartilhar a casca de estado e os controlos da interface, a derivação comercial, os helpers de markup, o contrato de itens, a IA, o worker, o bucket, a fila de limpeza e o modelo de prévia/publicação.
- Isolar a persistência da cotação em `quotation_flyer_operations`, `quotation_flyer_attachments`, RPCs próprias e uma Edge Function `quotation-flyer`, reusando o bucket e a fila comuns.
- Manter o mesmo formato 9:16, a mesma viewport de 1080 × 1920 e o mesmo renderer, com um discriminador de template.

Essa via maximiza o reaproveitamento sem obrigar a migrar os anexos de pacote. O fluxo de pacote é o primeiro consumidor da casca extraída; os testes existentes são o portão de regressão.

## Decisões de produto e template

- **Formato:** 9:16, 1080 × 1920, com as mesmas margens seguras de 250 px no topo e no rodapé usadas na lâmina de pacote.
- **Identidade:** mesma foto de fundo, Poppins, cabeçalho navy, caixa terracota da rota, preço branco, caixa semitransparente de serviços/subtítulo e rodapé com contacto e aviso. Nada de hex, fonte ou espaçamento soltos; usar os tokens do kit Travel.
- **Conteúdo da peça:**
  - cabeçalho de marca com logo, slogan e website;
  - bloco de cliente e referência: “Para {cliente}” e “Ref. {referência}”;
  - rota origem → destino;
  - preço total em destaque, com “para {passageiros}” e o valor por pessoa em linha secundária;
  - validade da proposta;
  - período da viagem;
  - serviços apresentados e subtítulo comercial, na mesma caixa e com o mesmo editor;
  - condições de pagamento reconhecidas;
  - rodapé com aviso e contacto.
- **Preço:** o total é o `salePrice` (ou `priceTotal`) da cotação; o valor por pessoa é `pricePerPerson` (ou `calculatePricePerPerson(total, passageiros)`). O total fica em destaque; o valor por pessoa é secundário e é omitido quando só há um passageiro pagante. A consistência entre total, por pessoa e passageiros é validada como na lâmina de pacote.
- **Quarto duplo:** a nota “por pessoa em quarto duplo” aparece quando a cotação inclui hospedagem. Sem hospedagem, usar “por pessoa”. A decisão de mostrar sempre a nota na lâmina de pacote não é transferida automaticamente para a cotação.
- **Passageiros:** adultos e crianças contam como pagantes, segundo o motor financeiro; bebés entram no rótulo da viagem, mas não no divisor do valor por pessoa.
- **Cliente e validade:** obrigatórios para gerar a lâmina. Sem cliente ou validade, a prévia é bloqueada com uma mensagem acionável e um atalho para editar a cotação.
- **Validade vencida:** bloqueia a geração de uma nova prévia/publicação. A mensagem pede para atualizar a validade na cotação. A comparação é inclusiva e feita por data UTC (`validUntil >= hoje`), como as datas de viagem, para que cliente e servidor produzam o mesmo resultado.
- **Lâmina salva:** é um snapshot imutável. Alterações posteriores na cotação ou o vencimento da validade não bloqueiam o download da versão salva; apenas a geração de uma nova prévia é bloqueada. A interface mostra a versão e a data de salvamento. Não há aviso automático de desatualização na v1, seguindo o comportamento da lâmina de pacote.
- **Status:** qualquer status pode gerar a lâmina. Uma cotação arquivada mantém a lâmina salva e permite baixá-la; gerar uma nova lâmina não desarquiva a cotação.
- **Fora da peça:** status comercial, pacote de origem, taxa de câmbio, custos, fornecedores, margens e as notas livres `localTaxNotes`, `extraServicesNotes` e `customNotes`.
- **Nome do ficheiro:** `lamina-cotacao-<referencia>-<destino>.<ext>`, com sanitização.
- **Copy da interface:** “Criar lâmina”, “Prévia da lâmina”, “Lâmina salva nesta cotação · versão N”, “Salvar lâmina na cotação”, “Substituir a lâmina salva”.

## Desenho do template

O desenho faz parte da entrega; não há um mockup de cotação aprovado no repositório. A ordem de blocos abaixo é a referência para o mockup 1080 × 1920 e para a implementação. Um mockup visual deve ser produzido e aprovado antes de codificar o template; ele pode ajustar espaçamentos e a composição, mas não os dados nem a ordem de leitura.

```
┌──────────────────────────────────────┐
│ [logo]  Proposta de viagem  www.s23  │  navy
│ Para Marina Alves      Ref. COT-…    │  navy, segunda linha
├──────────────────────────────────────┤
│ Lisboa            ✈            Açores│  terracota
├──────────────────────────────────────┤
│ € 4.800 total                        │
│ para 2 adultos                       │  preço branco
│ € 2.400 por pessoa em quarto duplo   │
│ Válida até 30 de novembro de 2026    │
├──────────────────────────────────────┤
│ 12 a 19 de dezembro de 2026          │
├──────────────────────────────────────┤
│ ✓ Aéreo com bagagem                  │
│ ✓ Hospedagem com café da manhã       │  caixa semitransparente
│ ✓ Transfer                           │
│ “subtítulo comercial revisado”       │
├──────────────────────────────────────┤
│ 30% de entrada · saldo em 5x         │  condições de pagamento
├──────────────────────────────────────┤
│ Valores sujeitos a alteração  contacto│  navy
└──────────────────────────────────────┘
```

- O cabeçalho navy usa duas linhas para não gastar um bloco inteiro com cliente e referência.
- Cliente, referência, total, por pessoa, passageiros e validade são os blocos novos em relação ao template de pacote.
- O período fica em uma linha própria; as condições de pagamento, quando existirem, ficam em uma faixa curta antes do rodapé.
- Com 6 serviços e rótulos longos, a caixa de itens usa o modo compacto existente; o mockup e os testes de overflow decidem se o período/pagamento precisam de ajuste.
- A secção da lâmina salva e os botões de download ficam fora do bloco condicionado ao modelo local, para continuarem acessíveis quando faltar cliente/validade ou a validade tiver vencido.

## Decisões de dados

- **Validade:** acrescentar `validUntil?: string` (data ISO `YYYY-MM-DD`) a `QuotationData`. O campo é editável no formulário da cotação e exibido no detalhe, na secção de condições comerciais. Não há valor automático por defeito; a operadora preenche. Cotações existentes continuam válidas e só precisam do campo quando se gera a lâmina. A data é inclusiva e comparada por UTC no cliente e no servidor.
- **Cliente:** usar `quotations.client_name`. É obrigatório para a lâmina.
- **Referência:** usar `quotations.reference`, com limite de 20 caracteres e o formato já usado pelo Packager.
- **Moeda:** usar `quotations.currency`. O `financials.currency` do snapshot deve coincidir; se não coincidir, a lâmina bloqueia com uma mensagem para rever e salvar a cotação. Não converter de novo no template.
- **Passageiros:** `priceLabel` lista os pagantes (adultos + crianças) e é usado na linha do preço; `travelLabel` inclui bebés e é usado na composição da viagem. O divisor do valor por pessoa continua a ser adultos + crianças, como em `calculatePricePerPerson`.
- **Serviços:** reutilizar a derivação e a normalização da lâmina de pacote, incluindo a exclusão de termos internos, valores, contactos e serviços não confirmados. O editor de itens continua com 6 itens e 40 caracteres por rótulo.
- **Condições de pagamento:** reutilizar a mesma sanitização de texto público da lâmina de pacote. Ausência ou texto não reconhecido gera aviso, não bloqueia.
- **Datas:** `data.dates.startDate` e `endDate` válidos são obrigatórios, como na lâmina de pacote.
- **Origem e destino:** obrigatórios, com os mesmos limites de comprimento da lâmina de pacote.
- **Duplicação de cotação:** o snapshot copia `validUntil`; se a validade estiver vencida, a lâmina bloqueia e pede atualização. Não criar um valor novo automaticamente.

## Decisões de segurança e persistência

- **Edge Function própria:** `quotation-flyer`, autenticada com `requireUser`, com as ações `current`, `download`, `preview` e `publish`.
- **Modelo canônico no servidor:** o handler lê a cotação em `quotations` com o JWT do utilizador (RLS), constrói o modelo a partir dos dados persistidos e nunca aceita preço, cliente, validade ou referência enviados pelo browser. O browser envia apenas `quotationId`, `expectedRevision`, `requestId`, imagem, subtítulo e itens revistos.
- **IA:** reutilizar `generate-flyer-ai` sem alterações. A chamada continua a receber apenas destino e indicação opcional; o nome do cliente, a referência e a validade nunca são enviados.
- **Renderer:** o worker passa a aceitar um discriminador `template` (`package` ou `quotation`). Sem o campo, assume `package`, preservando o contrato atual. O template de cotação usa o mesmo viewport 1080 × 1920, valida o modelo e devolve `s23-flyer-v1` com HTML e PNG.
- **Tabelas novas:** `quotation_flyer_operations` e `quotation_flyer_attachments`, com FK para `quotations` e `on delete cascade`, RLS ativa e acesso apenas a `service_role`.
- **Fila compartilhada:** reutilizar `package_flyer_cleanup_queue`, acrescentando `owner_kind` com default `package` e valores `package`/`quotation`. As funções de claim e finish da cotação gravam e consomem esse discriminador; a rotina de limpeza processa os dois tipos e chama o finish correspondente.
- **Bucket compartilhado:** reutilizar `s23-package-flyers` (nome histórico, privado, 12 MiB, HTML/PNG). Os caminhos da cotação seguem `<quotationId>/<requestId>.html|png`; não mover objetos existentes nem renomear o bucket nesta entrega.
- **Trigger de exclusão:** antes de apagar uma cotação, enfileirar os objetos das suas operações de lâmina. A exclusão de cotações com operação financeira continua bloqueada pela regra atual.
- **Concorrência:** usar `quotations.updated_at` e `expectedRevision` no CAS, como o pacote faz com `packages.updated_at`. Conflito devolve erro e mantém a versão ativa. A publicação é idempotente por `requestId`.
- **Última versão:** nova lâmina substitui a anterior; não há histórico.
- **Privacidade:** o anexo contém o nome do cliente. O bucket é privado, o download passa pela Edge Function autenticada, não há URLs públicas e o nome do cliente não entra em logs. A peça não deve ser reutilizada como divulgação pública.
- **Notas internas:** custos, margens, fornecedores, identificadores, observações internas e notas livres continuam fora do modelo público.

## Contrato do modelo da cotação

```ts
interface QuotationFlyerModel {
  version: 1;
  template: 'quotation';
  reference: string;
  clientName: string;
  origin: string;
  destination: string;
  period: string;
  validity: string; // formatada em pt-BR
  price: {
    total: { amount: number; currency: Currency; formatted: string };
    perPerson: { amount: number; currency: Currency; formatted: string };
  };
  passengers: {
    adults: number;
    children: number;
    infants: number;
    priceLabel: string; // adultos + crianças, base do valor por pessoa
    travelLabel: string; // adultos + crianças + bebés, composição da viagem
  };
  items: FlyerItem[];
  paymentConditions?: string;
  subtitle?: string;
  imageUrl?: string;
}
```

Limites mínimos a validar no cliente e no servidor:

- `reference`: 1–20 caracteres.
- `clientName`: 1–60 caracteres, sem caracteres de controlo.
- `origin`/`destination`: 2–45 caracteres; a soma continua limitada a 55, como no pacote.
- `period`: até 70 caracteres.
- `validity`: data ISO válida; a exibição formatada tem até 40 caracteres.
- `price.total.formatted` e `price.perPerson.formatted`: até 20 caracteres.
- `passengers.priceLabel` e `passengers.travelLabel`: até 40 caracteres cada.
- `items`: até 6, rótulos de 1 a 40 caracteres, com as regras de `flyerItemsContract`.
- `paymentConditions`: até 100 caracteres, após a sanitização existente.
- `subtitle`: 3–100 caracteres, com `validSubtitle`.

O worker valida os mesmos limites e rejeita chaves desconhecidas, como já faz com o modelo de pacote.

## API da Edge Function

Corpo mínimo por ação:

- `current`: `{ action: 'current', quotationId }`.
- `download`: `{ action: 'download', quotationId, format: 'html' | 'png' }`.
- `preview`: `{ action: 'preview', quotationId, expectedRevision, requestId, image, subtitle, items }`.
- `publish`: `{ action: 'publish', quotationId, expectedRevision, requestId }`.

Respostas e erros seguem o contrato da `package-flyer`: prévia em Base64, revisão esperada, conflito de revisão, prévia expirada, anexo indisponível e falha de renderização. As mensagens trocam “pacote” por “cotação”.

## Mapa de implementação

### Serviços e componentes

- `src/services/flyerCommercialModel.ts` (novo): extrair a derivação de origem, destino, período, preço, passageiros, serviços, itens e condições de pagamento hoje em `packageFlyerService.ts`; `createPackageFlyer` passa a ser um wrapper.
- `src/services/quotationFlyerService.ts` (novo): `createQuotationFlyer(quote)`, com as guardas de cliente, referência, validade, moeda, total e passageiros.
- `src/services/flyerMarkupShared.ts` (novo): `escapeHtml`, ícones, foto, cabeçalho, rodapé e caixa de itens extraídos de `packageFlyerMarkup.ts`, preservando a saída atual.
- `src/services/quotationFlyerMarkup.ts` (novo): markup do template de cotação, usando os helpers e as classes base.
- `src/services/quotationFlyerAttachmentService.ts` (novo): `getCurrentQuotationFlyer`, `createQuotationFlyerServerPreview`, `publishQuotationFlyer`, `downloadSavedQuotationFlyer`.
- `src/components/flyers/useFlyerCreator.ts` (novo): máquina de estados e handlers comuns (IA, revisões, itens, prévia, publicação, downloads, limpeza de URLs).
- `src/components/flyers/FlyerControls.tsx`, `FlyerItemsEditor.tsx`, `FlyerServerPreview.tsx`, `FlyerSavedDownloads.tsx` (novos): controlos e apresentação comuns.
- `src/components/packages/PackageFlyerCreator.tsx`: passa a consumir a casca e os controlos comuns, mantendo a API pública `{ package, open, showToggle }` e o comportamento atual.
- `src/components/quotes/QuotationFlyerCreator.tsx` (novo): adapta a cotação à casca, com copy própria, resumo de texto próprio e `QuotationFlyerTemplate`. A secção da lâmina salva e os downloads usam `FlyerSavedDownloads` fora do bloco condicionado ao modelo local.
- `src/components/quotes/QuotationFlyerTemplate.tsx` (novo).
- `src/components/quotes/quotationFlyer.css` (novo): modificadores sobre as classes base da lâmina, sem duplicar tokens. A página da cotação importa `packageFlyer.css` (base) e `quotationFlyer.css`; o worker importa os dois.
- `src/pages/quotes/QuoteDetailPage.tsx`: botão “Criar lâmina”, estado `flyerOpen`, import do CSS e do creator; exibição da validade.
- `src/pages/quotes/QuoteFormPage.tsx`: campo “Validade da proposta”, carregamento, gravação em `data.validUntil` e preservação no rascunho (`QuoteDraft`).
- `src/types/index.ts`: `QuotationData.validUntil?: string` e `QuoteDraft.validUntil?: string`.

### Backend

- `supabase/functions/_shared/quotationFlyerModel.ts` (novo): modelo canônico do servidor, a partir da cotação persistida.
- `supabase/functions/_shared/flyerPipeline.ts` (novo): extrair a orquestração comum da `package-flyer` (leitura limitada, validação de imagem, hash, renderer, upload, RPCs, idempotência). A `package-flyer` passa a ser um configurador da pipeline, com os testes de persistência existentes como portão.
- `supabase/functions/quotation-flyer/index.ts` e `handler.ts` (novos): configuração da cotação sobre a pipeline.
- `workers/flyer-renderer/src/index.ts`: discriminador `template`, import do CSS e do markup da cotação, validação do modelo da cotação, mesma viewport 1080 × 1920.
- `supabase/migrations/<timestamp>_quotation_flyer_attachments.sql` (novo): tabelas, índices, RLS/grants, RPCs, `owner_kind` na fila, trigger de exclusão da cotação e comentários.
- `supabase/functions/cleanup-package-flyer/index.ts`: processar também os claims/finishes da cotação.

### Documentação

- `docs/LAMINA-CONTRATO.md`: secção da lâmina de cotação, modelo, privacidade, validade e decisões de template.
- `docs/LAMINA-IA.md`: confirmar que a IA continua a receber apenas destino/indicação e que o nome do cliente nunca é enviado.

## Testes

- Modelo da cotação: cliente e validade obrigatórios, validade vencida, limites UTC (ontem/hoje/amanhã), moeda coincidente, total e por pessoa consistentes, rótulos de passageiros, origem/destino, datas, serviços, itens, condições de pagamento, textos internos e limites de comprimento.
- Markup: template 9:16 com cliente, referência, validade, total, por pessoa, passageiros, rota, período, itens e rodapé; ausência de dados internos; escape de HTML; modo compacto com lista densa.
- Estados da lâmina salva: com cliente/validade em falta ou validade vencida, a prévia é bloqueada mas a versão salva continua visível e baixável.
- Paridade: a extração dos helpers não altera a saída do template de pacote; os testes existentes de `test_package_flyer` continuam a passar.
- Fluxo browser: abrir a lâmina a partir de uma cotação, gerar IA, revisar, editar itens, gerar prévia final, salvar, baixar HTML/PNG, recarregar a versão salva e testar erros de cliente/validade.
- Persistência: ações `current`, `download`, `preview`, `publish`; conflito de revisão; prévia expirada; idempotência; caminho inválido; hash; limite de tamanho; modelo inválido; RLS/grants; trigger de exclusão; limpeza dos dois tipos.
- Worker: modelo de pacote sem `template` continua válido; modelo de cotação válido; campos desconhecidos e limites rejeitados; PNG 1080 × 1920.
- Testes isolados, sem criar, alterar ou apagar dados no projeto compartilhado. Não executar a suíte completa sem avaliar cada caso. Não instalar dependências para contornar a ausência de `tsx`.

## Sequência sugerida

1. Aprovar esta especificação e a ordem de blocos do template.
2. Produzir e aprovar um mockup 1080 × 1920 do template de cotação com dados fictícios.
3. Extrair a casca de estado/controlos e os helpers de markup, com os testes da lâmina de pacote verdes.
4. Acrescentar `validUntil` ao tipo, ao formulário e ao detalhe da cotação.
5. Implementar `createQuotationFlyer` e o template 9:16, com testes de modelo e markup.
6. Adaptar o worker com o discriminador de template e validar a paridade do pacote.
7. Criar a migration, as RPCs, a fila com `owner_kind`, o trigger e a Edge Function `quotation-flyer`.
8. Integrar o creator no detalhe da cotação e o download, incluindo a lâmina salva independente do modelo.
9. Cobrir o fluxo browser, a persistência e a limpeza.
10. Atualizar a documentação.
11. Publicar na ordem: worker backward-compatible, migration/RPCs, Edge Function, frontend. Sem `db push`; confirmar `migration list` e pedir autorização específica para operações em produção.

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
- Cotações existentes não têm validade. A lâmina bloqueia até a operadora editar a cotação e preencher o campo; não inventar uma validade.
- A lâmina salva é um snapshot: continua baixável depois de a cotação mudar ou a validade vencer. Só a geração de uma nova prévia exige cliente, validade e preço atuais. A interface deve manter a secção da lâmina salva fora do bloco com erros do modelo local.
- O template de cotação não reaproveita a decisão “por pessoa em quarto duplo sempre” da lâmina de pacote: a nota depende de haver hospedagem.
- O desenho do template é parte da entrega; a ordem de blocos desta especificação é a referência e um mockup 1080 × 1920 deve ser aprovado antes de codificar.
- A ordem de publicação importa: o worker novo deve aceitar o modelo de pacote sem `template` antes de a Edge Function da cotação entrar em serviço.
- Este documento não autoriza implementação, deploy ou operações em produção. A aprovação do responsável é o portão para o plano de implementação.
