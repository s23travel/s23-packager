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
5. **Fase 5**: Exportações (WhatsApp, Markdown, Website, S23 Manager).
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
