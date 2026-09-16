# Arquitetura de Serviços Unificados e Adapter Legado (Fase 1)

Este documento descreve a especificação do novo modelo unificado de serviços e as regras de normalização determinística dos dados legados de `PackageData` e `QuotationData`.

---

## 1. Visão Geral

Historicamente, o Packager fragmentava as informações de uma viagem entre diferentes estruturas:
- Destino aninhado em `lodging[0].destination`;
- Transporte estruturado em `outboundTransport` / `inboundTransport`;
- Custos de transporte, hotel e adicionais distribuídos em `financials.components`;
- Hotéis em `lodging[]`;
- Anotações de taxas locais e condições de pagamento em texto livre (`additionalInfo`, `localTaxNotes`, `paymentConditions`).

A **Fase 1** estabelece a fundação representacional da **Lista Única de Serviços** (`ServiceItem`) e uma função de adaptação determinística em memória (`normalizeLegacyToNewStructure()`), sem modificar o banco de dados, migrations, formulários de UI ou fluxos de IA.

---

## 2. Tipos Fundamentais

### 2.1 `ServiceType`
Enumeração estrita com os tipos suportados:
- `outbound_transport`: Transporte de ida (voos, trens, etc.)
- `inbound_transport`: Transporte de volta
- `accommodation`: Hospedagem
- `transfer`: Traslado / transfer
- `insurance`: Seguro-viagem
- `additional`: Serviços adicionais, ingressos, passeios, aluguel de carro
- `taxes`: Impostos e taxas turísticas
- `other`: Outros custos

### 2.2 `ServiceItem`
Entidade consolidada que preserva a capacidade financeira completa e dados específicos de cada serviço:

```typescript
export interface ServiceItem {
  id: string; // UUID v4 gerado via crypto.randomUUID()
  type: ServiceType;
  description: string;
  currency: Currency;
  amount: number;
  quantity: number;
  notes?: string;

  // Específicos para transporte (ida / volta)
  carrier?: string;
  departureTime?: string; // HH:MM
  arrivalTime?: string;   // HH:MM

  // Específicos para hospedagem
  destination?: string;
  mealPlan?: string;

  // Metadados de rastreabilidade e reversibilidade
  sourceField?: string;
  legacyComponentId?: string;
  legacyCategory?: string;
  isCustomized?: boolean;
}
```

---

## 3. Destino em Nível Superior

O destino passa a ser um campo de alto nível na raiz dos dados (`destination`):
- O adapter extrai `lodging[0].destination` como valor padrão.
- **Tratamento de Múltiplos Hotéis / Destinos Conflitantes**:
  - Se houver múltiplos hotéis com destinos idênticos, normaliza sem conflito.
  - Se houver hotéis com destinos distintos (ex.: Hotel em Paris e Hotel em Nice), o adapter **NÃO** escolhe silenciosamente um deles. Ele preenche `destination: "Paris / Nice"`, marca `destinationConflict: true` e preserva a lista completa em `destinationConflictDetails`.

---

## 4. Adapter Determinístico (`normalizeLegacyToNewStructure`)

A função `normalizeLegacyToNewStructure(legacyData)` opera exclusivamente em memória:
- Não altera o objeto original recebido (imutabilidade garantida).
- Não executa chamadas de rede ou queries de banco.
- Não utiliza modelos de IA.

### 4.1 Regras de Conversão por Categoria

1. **Transporte de Ida (`outbound_transport`)**:
   - Cruza `outboundTransport` com o componente de `financials.components` com `category = 'outbound_transport'`.
   - Preserva `route`, `carrier`, `departureTime`, `arrivalTime`, `amount`, `currency`, `quantity`.
   - Se os horários não existirem nos campos estruturados, o adapter tenta extrair com regex determinístico a partir de `notes` (ex.: `"15:15-18:40"` -> `departureTime: "15:15"`, `arrivalTime: "18:40"`).
   - Quaisquer notas adicionais remanescentes são preservadas em `notes`.

2. **Transporte de Volta (`inbound_transport`)**:
   - Aplica a mesma regra de consolidação de `inboundTransport` e componente de custo correspondente.

3. **Hospedagem (`accommodation`)**:
   - Para **CADA** item em `lodging[]`, é gerado um `ServiceItem` independente do tipo `accommodation`. Hotéis nunca são consolidados silenciosamente.
   - Associa o custo correspondente em `financials.components` por nome/descrição ou índice posicional.
   - Preserva `name`, `destination`, `mealPlan`, `roomType`, `nights`, custo, moeda e notas.

4. **Serviços (`services`)**:
   - Classificação estrita baseada em palavras-chave no texto (sem IA):
     - Menção a `"seguro"` -> `insurance`
     - Menção a `"transfer"`, `"traslado"`, `"transfere"` -> `transfer`
     - Demais casos (ex.: `"Bilhete Parque Warner"`, `"Carro classe económica"`, `"Visita guiada"`) -> `additional`

5. **Impostos e Taxas (`taxes`)**:
   - Componentes estruturados da categoria `taxes` viram `ServiceItem` do tipo `taxes`.
   - Textos livres informativos (ex.: `"Tx.local: 60€"`) **NÃO** são transformados em custos numéricos estruturados automaticamente para evitar criação de custos fantasmas.

6. **Outros Custos (`other`)**:
   - Componentes com categorias legadas ou desconhecidas são convertidos com segurança para `other`.

---

## 5. Preservação de Textos Livres e Casos Especiais

- **`additionalInfo` (Packages)**: Mantido intacto na raiz da estrutura normalizada.
- **`localTaxNotes` e `paymentConditions` (Quotations)**: Preservados integralmente sem unificação forçada.
- **`financials`**: O resumo financeiro (`salePrice`, `totalCost`, `profit`, `profitPercent`) é preservado integralmente para garantir retrocompatibilidade com o motor de cálculo.

---

## 6. Validação e Testes Automatizados

A suíte `tests/test_services_structure_phase1.ts` valida 26 cenários cobrindo todos os requisitos estabelecidos, incluindo:
- Casos sem serviços, transportes com horários estruturados ou em notes, hospedagens únicas e múltiplas;
- Classificação de seguro, transfer, adicionais, impostos e custos desconhecidos;
- Preservação estrita de `additionalInfo`, `localTaxNotes` e `paymentConditions`;
- Garantia de que a função é pura em memória e não descarta nenhum dado.
