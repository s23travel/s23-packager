# Arquitetura e Visão Técnica - Packager

## 1. Visão Geral

O **Packager** é uma ferramenta interna focada em otimizar a criação, precificação e distribuição de pacotes e cotações da S23.

### Fluxo Operacional Futuro
```
[Pacote Base]
     │
     ▼
[Cotação Personalizada]
     │
     ▼
[Cálculos Financeiros]
     │
     ├──► [Mensagem WhatsApp Formatada]
     ├──► [Conteúdo do Website]
     ├──► [Geração de Markdown]
     └──► [Sincronização S23 Manager]
```

---

## 2. Camadas do Sistema

### Frontend (SPA)
- **Framework**: React 18 com TypeScript em modo estrito.
- **Build Tool**: Vite (otimizado para fast refresh local e bundles ultra rápidos para deploy estático).
- **Roteamento**: React Router (com suporte a fallback SPA `_redirects` no Cloudflare Pages).
- **Design**: CSS modularizado com tokens semânticos (sem excesso de camadas utilitárias ou dependências de terceiros pesadas).

### Backend e Dados (Futuro)
- **Supabase**: PostgreSQL gerenciado para persistência relacional de pacotes, itinerários, cotações e tabelas de preços.
- **Edge Functions**: Execução serverless rápida para integrações futuras.

### Hospedagem
- **Cloudflare Pages**: Hospedagem global de alta performance para a aplicação estática com baixíssima latência.

---

## 3. Modelo de Dados (Fase 2 - Supabase PostgreSQL)

O modelo relacional do Packager foi desenhado para equilibrar integridade referencial com máxima agilidade nas alterações dos componentes de pacotes e cotações.

### 3.1 Tabela `packages` (Pacotes Base)
- **Finalidade**: Armazena o pacote base criado ou pesquisado pela S23 (ex.: "Tasmânia Selvagem 10 Dias", "Safari Tanzânia Clássico").
- **Campos**:
  - `id` (`UUID`, PK, padrão `gen_random_uuid()`): Identificador único imutável.
  - `reference` (`TEXT`, NOT NULL): Código ou referência de identificação interna.
  - `name` (`TEXT`, NOT NULL): Nome comercial do pacote.
  - `status` (`TEXT`, NOT NULL): Ciclo de vida (`draft`, `active`, `archived`).
  - `data` (`JSONB`, NOT NULL): Estrutura flexível contendo os componentes do pacote (itinerário, hotelaria base, serviços incluídos/excluídos, notas operacionais).
  - `base_currency` (`TEXT`, NOT NULL): Moeda padrão do pacote (`EUR` ou `BRL`).
  - `created_at` / `updated_at` (`TIMESTAMPTZ`): Rastreabilidade temporal com trigger automático de atualização.

### 3.2 Tabela `quotations` (Cotações com Snapshot Independente)
- **Finalidade**: Representa uma proposta/cotação comercial direcionada a um cliente específico, originada a partir de um pacote base.
- **Campos**:
  - `id` (`UUID`, PK, padrão `gen_random_uuid()`): Identificador único da cotação.
  - `package_id` (`UUID`, FK `packages(id) ON DELETE SET NULL`): Vínculo com o pacote de origem para fins de histórico e rastreabilidade.
  - `reference` (`TEXT`, NOT NULL): Código de referência da cotação (ex.: `COT-2026-001`).
  - `client_name` (`TEXT`, NULL): Nome do cliente ou agência solicitante.
  - `status` (`TEXT`, NOT NULL): Estado comercial (`draft`, `sent`, `accepted`, `rejected`, `archived`).
  - `data` (`JSONB`, NOT NULL): **Snapshot completo e independente** da cotação no momento em que foi gerada.
  - `currency` (`TEXT`, NOT NULL): Moeda da cotação (`EUR` ou `BRL`).
  - `exchange_rate` (`NUMERIC(12, 6)`, NULL): Taxa de câmbio aplicada (inserida manualmente quando aplicável).
  - `exchange_rate_date` (`DATE`, NULL): Data de referência do câmbio utilizado.
  - `created_at` / `updated_at` (`TIMESTAMPTZ`): Rastreabilidade temporal com trigger automático.

### 3.3 Regra Fundamental do Snapshot e Uso de JSONB
- **Imutabilidade Histórica**: Uma cotação é uma fotografia no tempo. Alterações futuras no pacote original (`packages`) **não afetam** cotações já emitidas (`quotations`).
- **Autossuficiência**: O campo `data` (JSONB) da cotação armazena todos os itens, valores unitários, margens e textos necessários para reproduzir a proposta original sem depender de joins com tabelas mutáveis.
- **Evolução Sem Overengineering**: Optou-se conscientemente por não criar tabelas separadas para hotéis, vôos, traslados e passageiros nesta etapa. O `JSONB` acomoda a diversidade de formatos de fornecedores mantendo o schema leve e de alta performance.

### 3.4 Estratégia de Moedas (Multi-Currency)
- Moedas suportadas nativamente no schema: **EUR** e **BRL**.
- Câmbio informado manualmente pelo operador e registrado na cotação (`exchange_rate` e `exchange_rate_date`).
- Sem integrações bancárias ou APIs de cotação automáticas nesta etapa, preservando previsibilidade e simplicidade.

---

## 4. Estratégia de Evolução Incremental

1. **Fase 1**: Fundação técnica, ambiente, roteamento básico e design tokens. *(Concluída)*
2. **Fase 2**: Modelagem de dados Supabase e migrations base. *(Concluída)*
3. **Fase 3**: CRUD de Pacotes e Cotações com Snapshot Independente. *(Concluída)*
4. **Fase 4**: Motor Financeiro Determinístico + Multi-Moeda. *(Concluída)*
5. **Fase 5**: Geração Determinística de Mensagem para WhatsApp. *(Concluída)*
6. **Fase 6**: Polimento, automações e deploy em produção.

---

## 5. Motor Financeiro Determinístico e Multi-Moeda (Fase 4)

A Fase 4 substitui cálculos manuais e planilhas por um motor financeiro determinístico, puramente implementado em TypeScript (`src/services/financeService.ts`), sem dependências de IA, serviços externos ou bibliotecas pesadas.

### 5.1 Regra Fundamental do Determinismo
- **Zero IA em cálculos**: Nenhuma conta ou estimativa matemática é terceirizada para modelos de IA.
- **Funções Puras**: Todas as operações de cálculo (`calculateCosts`, `calculatePricePerPerson`, `calculateProfit`, `calculateProfitPercent`, `calculateFinancialSummary`, `convertCurrency`) recebem argumentos imutáveis e retornam resultados estritamente previsíveis e reproduzíveis.
- **Proteção Numérica**: Tratamento contra divisões por zero, valores ausentes, preços zerados e margens negativas, garantindo que `NaN` ou `Infinity` nunca sejam gerados ou renderizados na interface.

### 5.2 Estrutura de Componentes de Custo
Cada pacote e cotação organiza seus custos em uma lista de componentes (`CostComponent`):
- `id`: Identificador único do item.
- `category`: Categoria operacional:
  1. `outbound_transport` (Transporte de ida)
  2. `inbound_transport` (Transporte de volta)
  3. `lodging` (Hospedagem)
  4. `services` (Serviços adicionais / transfers / passeios)
  5. `taxes` (Impostos e taxas turísticas)
  6. `other` (Outros custos)
- `description`: Descrição detalhada do custo.
- `amount`: Valor monetário unitário.
- `currency`: Moeda de origem do item (`EUR` ou `BRL`).
- `quantity`: Quantidade aplicável (padrão 1).
- `notes`: Observações adicionais opcionais.

### 5.3 Fórmulas Matemáticas Implementadas

#### A. Custo Total (`totalCost`)
$$\text{totalCost} = \sum_{i} \text{roundMoney}(\text{amount}_i \times \text{quantity}_i \xrightarrow{\text{convert}} \text{targetCurrency})$$
- O custo total é calculado automaticamente pela soma dos componentes e não pode ser sobrescrito manualmente quando houver componentes registrados.

#### B. Preço de Venda (`salePrice`) e Preço por Pessoa (`pricePerPerson`)
- O preço de venda total (`salePrice`) é a entrada principal da precificação comercial.
- O divisor para preço por pessoa é determinado pelos passageiros pagantes:
  $$\text{payingPassengers} = \text{adults} + \text{children}$$
  $$\text{divisor} = \begin{cases} \text{payingPassengers} & \text{se } \text{payingPassengers} > 0 \\ 1 & \text{caso contrário} \end{cases}$$
- **Convenção de turismo**: Bebês (`infants`) não entram no divisor do pacote base pois viajam no colo/berço sem ocupação tarifária integral.
  $$\text{pricePerPerson} = \text{roundMoney}\left(\frac{\text{salePrice}}{\text{divisor}}\right)$$

#### C. Lucro Bruto (`profit`)
$$\text{profit} = \text{roundMoney}(\text{salePrice} - \text{totalCost})$$
- Suporta lucro positivo, nulo ou negativo (quando custos superam o preço de venda).

#### D. Margem de Lucro Percentual (`profitPercent`)
$$\text{profitPercent} = \begin{cases} \text{roundPercent}\left(\frac{\text{profit}}{\text{salePrice}} \times 100\right) & \text{se } \text{salePrice} > 0 \\ 0 & \text{se } \text{salePrice} \le 0 \end{cases}$$

### 5.4 Convenção Unificada de Câmbio e Multi-Moeda
- **Convenção Oficial do Packager**: **`1 EUR = X BRL`** (ex.: `1 EUR = 6.20 BRL`).
- **EUR para BRL**: $\text{amount} \times \text{exchangeRate}$
- **BRL para EUR**: $\text{amount} / \text{exchangeRate}$
- **Validação Estrita**:
  - Se todos os itens estiverem na mesma moeda da cotação, nenhuma conversão é exigida.
  - Se houver qualquer componente em moeda diferente e a taxa manual não tiver sido informada (`!exchangeRate || exchangeRate <= 0`), o motor bloqueia o cálculo do custo total, retorna erro explicativo e alerta o operador na interface.
  - O câmbio é exclusivamente uma entrada manual congelada no registro, sem chamadas a APIs bancárias instáveis ou externas.

### 5.5 Independência Financeira das Quotations
- Ao gerar uma cotação a partir de um pacote (`createQuotationFromPackage`), todo o bloco financeiro (`financials`) é clonado em profundidade (`deep-clone`).
- A cotação preserva seu snapshot de componentes, moeda base, preço de venda, lucro e margem naquele instante.
- Alterações posteriores nos custos ou preços do pacote base nunca alteram silenciosamente cotações emitidas no passado.

---

## 6. Geração Determinística de Mensagens WhatsApp (Fase 5)

A Fase 5 substitui a redação manual de mensagens para clientes pelo gerador determinístico comercial do WhatsApp (`src/services/whatsappService.ts`).

### 6.1 Princípio da Não Utilização de IA
- **Geração 100% Determinística**: O texto é montado exclusivamente a partir de funções TypeScript puras e templates padronizados.
- **Zero Alucinações**: O sistema nunca inventa horários, companhias aéreas, hotéis, condições de pagamento ou taxas que não existam explicitamente na cotação.
- **Previsibilidade Absoluta**: O mesmo snapshot da cotação sempre gerará exatamente a mesma mensagem.

### 6.2 Fonte Exclusiva dos Dados: Snapshot da Cotação
- O gerador consome exclusivamente o objeto `Quotation` e seu campo `data` (snapshot).
- **Sem Recálculo**: O preço e os valores são lidos do snapshot financeiro da cotação, nunca recalculados pelo gerador.
- **Desacoplamento do Package de Origem**: Alterações posteriores no pacote base jamais afetam a mensagem gerada a partir da cotação existente.

### 6.3 Tratamento Estrito de Campos Opcionais
- Se uma informação opcional não existir (ex.: hotel, transfer, horários de voo, condições de entrada, taxas locais, serviços extras), a respectiva linha é **completamente omitida**.
- **Nenhum Placeholder**: É terminantemente proibida a aparição de marcadores como `[hotel]`, `[horário]`, `undefined`, `null` ou `NaN`.

### 6.4 Confidencialidade e Separação de Dados Internos
A mensagem é destinada ao cliente final. O gerador aplica uma barreira de confidencialidade estrita, impedindo que os seguintes dados sejam expostos:
- Custos internos e markup;
- Lucro bruto ou margem percentual;
- Nome de fornecedores (`supplier`);
- Taxas de conversão interna ou componentes de custo analíticos;
- IDs internos ou referências técnicas do banco de dados.

### 6.5 Experiência do Usuário (UI)
- Componente [`WhatsAppMessagePreview.tsx`](file:///c:/Users/ptmaralvoli/Documents/Antigravity/packager/src/components/whatsapp/WhatsAppMessagePreview.tsx) exibe pré-visualização fidedigna do texto formatado com emojis.
- Botão integrado "Copiar Mensagem" que utiliza a Clipboard API do navegador com feedback visual instantâneo.

---

## 7. Backend de IA, Gemini Grounding e Modelo Estruturado de Conteúdo (Fase 6A)

A Fase 6A implementa o backend seguro de inteligência artificial para pesquisa factual e estruturação editorial de pacotes de viagem destinados ao website da S23 (`www.s23.travel/pacotes`).

### 7.1 Documentos Oficiais de Referência Editorial
As regras de redação, estilo, SEO, campos obrigatórios e estrutura de pacotes respeitam estritamente a documentação prévia da S23:
1. `docs/perplexity_space.txt`: Persona, tom comercial persuasivo (PT-BR), regras de dados comerciais soberanos, regras de imagens e itens obrigatórios.
2. `docs/COMO_ADICIONAR_PACOTE.md`: Estrutura de campos de frontmatter e regras da página interna de pacotes.
3. `docs/ARQUITETURA_CARDS.md`: Mecanismo de publicação de pacotes via Markdown e renderização estática.
4. `docs/ARQUITETURA_MANAGER.md`: Gestão editorial de conteúdo.

### 7.2 Arquitetura de Segurança do Backend
- **Chamada Segura**: A API do Google Gemini **NUNCA** é chamada pelo navegador/frontend.
- **Edge Function Supabase**: Toda solicitação passa pela função serverless `generate-content` hospedada no Supabase.
- **Isolamento de Secrets**: A chave `GEMINI_API_KEY` reside exclusivamente nos secrets de ambiente da Supabase Edge Function (`Deno.env.get('GEMINI_API_KEY')`).
- **Prevenção de Vazamento**: Custos internos, lucros, margens, markups, dados de fornecedores e UUIDs de banco são **expurgados deterministicamente** antes do envio para a IA (`buildContentGenerationInput`).

### 7.3 Hierarquia de Confiança dos Dados
O sistema adota uma hierarquia estrita de 3 níveis:
1. **NÍVEL 1 — DADOS COMERCIAIS DA S23 (Soberanos)**:
   - Preço oficial, datas da viagem, origem, destino, hotel, número de noites, configuração de passageiros, itens incluídos/não incluídos, condições de pagamento e taxas.
   - **Regra**: A IA NÃO tem permissão para alterar, estimar ou substituir nenhum dado comercial do Nível 1.
2. **NÍVEL 2 — PESQUISA FACTUAL WEB (Google Search Grounding)**:
   - A ferramenta `googleSearch` do Gemini pesquisa dados contextuais e factuais atualizados sobre o destino (clima, atrações turísticas, cultura local, documentação necessária para brasileiros).
   - Não interfere nos preços ou condições comerciais.
3. **NÍVEL 3 — GERAÇÃO EDITORIAL ESTRUTURADA**:
   - Gemini redige textos persuasivos e comerciais nos campos editoriais (`title`, `excerpt`, `subtitle`, `sobre.text`, `infoDestino`, `seoTitle`, `seoDescription`).

### 7.4 Classificação dos Campos do Conteúdo
Os campos do modelo `StructuredPackageContent` dividem-se em 3 categorias operacionais:
- **A) Campos Comerciais Soberanos (Nível 1)**:
  - `price`: Lido diretamente do snapshot financeiro da cotação/pacote (`salePrice`).
  - `pagamento.observacao`: Frase obrigatória exata: `"Valor por pessoa. Consulte-nos sobre personalizações, pagamento parcelado ou em outras moedas."`.
  - `incluso`: Contém obrigatoriamente os serviços contratados mais o item fixo da S23: `{ icon: "gift", title: "Guia exclusivo S23", desc: "Nossas dicas práticas." }`.
  - `duracao` / `origem` / `date`: Derivados estritamente dos transportes e datas aprovadas.
- **B) Campos Editoriais Gerados pela IA (Nível 2 e 3)**:
  - `title`: Título comercial chamativo.
  - `category`: Sugerida pela IA ou selecionada pelo operador.
  - `excerpt`: Resumo de 1 a 2 frases para o card.
  - `slug`: Slug amigável validado (`^[a-z0-9]+(-[a-z0-9]+)*$`).
  - `subtitle`: Frase de destaque no topo.
  - `sobre`: Bloco descritivo do destino (`title`, `text`).
  - `infoDestino`: Localização, clima, cultura, documentação.
  - `seoTitle` / `seoDescription`: Metadados otimizados para busca.
- **C) Campos sob Controle do Operador**:
  - `heroImage` e `cardImage`: Imagens permanentes HTTPS válidas (o Markdown final depende de validação manual de imagens).
  - `published`: Padrão `false`.
  - `featured`: Padrão `false`.
  - `ctaLabel`: Padrão `"Quero garantir minha vaga"`.

### 7.5 Validação Determinística e Tratamento de Erros
- A função pura `validateStructuredContent` inspeciona cada campo do JSON retornado antes de qualquer persistência.
- Se a IA omitir campos obrigatórios, violar o padrão de slug, omitir o item fixo S23 ou divergir do preço comercial soberano, a resposta é **rejeitada imediatamente** com mensagens de erro acionáveis.
- Se a secret `GEMINI_API_KEY` não estiver configurada no Supabase, a Edge Function retorna código `GEMINI_API_KEY_MISSING` e a UI orienta claramente o operador sobre onde configurar o secret, sem travar a aplicação nem vazar informações sensíveis.

---

## 8. Geração e Validação Determinística de Markdown para o Website (Fase 6B)

A Fase 6B é responsável por transformar o conteúdo estruturado e validado (`StructuredPackageContent`) em um arquivo Markdown `.md` perfeitamente compatível com o ecossistema estático do website S23 (`content/pacotes/*.md`).

### 8.1 Princípio da Separação: IA vs. Markdown Generator
- **O Gemini NUNCA gera Markdown**: A inteligência artificial atua exclusivamente na pesquisa factual e redação estruturada (`StructuredPackageContent` em JSON).
- **Gerador 100% Determinístico**: O código TypeScript puro [`markdownService.ts`](file:///c:/Users/ptmaralvoli/Documents/Antigravity/packager/src/services/markdownService.ts) serializa os dados estruturados de maneira reproduzível e previsível. Dado exatamente o mesmo input, o Markdown gerado é bit-a-bit idêntico.

### 8.2 Estrutura Oficial do Arquivo Markdown
O arquivo gerado obedece estritamente à documentação de referência (`docs/COMO_ADICIONAR_PACOTE.md`, `docs/ARQUITETURA_MANAGER.md`, `docs/ARQUITETURA_CARDS.md` e `docs/perplexity_space.txt`):
1. **Delimitadores Frontmatter**: Bloco YAML delimitado por `---` na primeira linha e fechado por `---`.
2. **Ordem Padronizada dos Campos**:
   - `title`, `slug`, `category`
   - `heroImage`, `cardImage`
   - `price` (número puro ou texto com moeda entre aspas)
   - `date`, `excerpt`
   - `published`, `featured`
   - Campos avançados (`subtitle`, `duracao`, `origem`, `ctaLabel`, `imagemDestaque`)
   - Blocos estruturados:
     - `incluso`: lista de itens com `icon`, `title` e `desc`.
     - `naoIncluso`: lista simples de strings.
     - `sobre`: bloco de apresentação com `title`, `text` e opcional `image`.
     - `infoDestino`: metadados de localização, cultura, clima e documentação.
     - `roteiro`: lista diária de programação real (`title`, `desc`).
     - `pagamento`: condições comerciais (`valor`, `formas`, `observacao`).
     - `customInfo`: observações complementares opcionais.
     - `seoTitle`, `seoDescription`: metadados para motores de busca.
3. **Corpo do Markdown**: Texto de apresentação posicionado logo abaixo do fechamento do cabeçalho.

### 8.3 Regras Inegociáveis de Negócio da S23
- **Item Fixo Obrigatório**: O array `incluso` contém obrigatoriamente:
  ```yaml
  - icon: "gift"
    title: "Guia exclusivo S23"
    desc: "Nossas dicas práticas."
  ```
- **Observação Oficial de Pagamento**: O campo `pagamento.observacao` contém obrigatoriamente a frase:
  `"Valor por pessoa. Consulte-nos sobre personalizações, pagamento parcelado ou em outras moedas."`

### 8.4 Regras de Serialização YAML
- **Aspas e Escape Seguro**: Valores de texto são formatados com aspas duplas padronizadas (`formatYamlString`), tratando caracteres especiais (`:`, `"`, quebras de linha, emojis e acentuação).
- **Indentação Estrita**: 2 espaços para objetos e listas, sem uso de caracteres de tabulação (`\t`).
- **Valores Numéricos e Booleanos**: Booleanos (`true`/`false`) e preços numéricos são serializados sem aspas conforme exigido pelo parser YAML do website. Preços em texto (ex.: `"610 €"`, `"R$ 18.900"`) são serializados entre aspas.

### 8.5 Camada de Validação Especializada do Markdown
O módulo [`markdownValidationService.ts`](file:///c:/Users/ptmaralvoli/Documents/Antigravity/packager/src/services/markdownValidationService.ts) realiza uma segunda barreira de validação independente:
- Verifica integridade dos delimitadores `---` e sintaxe YAML.
- Exige todos os campos obrigatórios para publicação.
- **Tolerância Zero no Preço**: Compara o `price` do Markdown diretamente com o preço do `StructuredPackageContent`. Diferenças mesmo de €1 ou R$1 rejeitam o arquivo.
- **Detecção de Dados Confidenciais**: Varredura contra termos internos como `totalCost`, `cost`, `lucro`, `profit`, `margem`, `profitPercent`, `markup`, `supplier` e identificadores UUID internos de banco.
- **Ausência de Placeholders**: Bloqueia marcadores como `[hotel]`, `[data]`, `undefined`, `null` e `NaN`.

### 8.6 Nomenclatura e Download do Arquivo
- **Regra de Nomenclatura**: O arquivo é nomeado estritamente como `<slug>.md` derivado do slug aprovado (ex.: `elas-viajam-maiorca-2026.md`).
- **Download no Navegador**: Disponibilizado via Blob (`text/markdown;charset=utf-8`) com acionamento do download nativo no cliente.
- **Cópia Instantânea**: Botão com integração à Clipboard API para copiar o conteúdo Markdown completo.

### 8.7 Papel Futuro do Manager (Fase Futura)
O arquivo `.md` gerado pela Fase 6B é o formato de entrada exato consumido pelo **S23 Manager** (`/manager`) e pelo repositório do website (`content/pacotes/`). A integração direta via GitHub Contents API e publicação automática será tratada na etapa posterior, preservando nesta fase o download manual e a revisão do operador.
