# 03 — Modelo comercial partilhado e modelo da cotação

Status: ready-for-agent
Blocked by: 01

Especificação: `.scratch/laminas-cotacoes/spec.md` («Contrato do modelo da cotação», «Decisões de dados», «Mapa de implementação → Serviços e componentes»).

## Objetivo

Criar `createQuotationFlyer(quote)` com todos os dados do template 9:16, reaproveitando a derivação comercial da lâmina de pacote sem alterar a saída do pacote.

## Ficheiros

- `src/services/flyerCommercialModel.ts` (novo): extrair de `packageFlyerService.ts` os helpers puros reutilizáveis — validação/formatação de datas (`validDate`, `displayDate`, `displayPeriod`), mapa de regimes (`mealPlans`), sanitização de condições de pagamento, e a derivação serviço→item (`items`, `normalizeItemLabel`/`itemContentProblem`, tratamento de legado). `packageFlyerService.createPackageFlyer` passa a consumir estes helpers com **saída idêntica**.
- `src/services/quotationFlyerService.ts` (novo): `createQuotationFlyer(quote: Quotation): QuotationFlyerResult`, com `QuotationFlyerModel` e `TransportLeg` exatamente como no contrato da spec (sem `reference`, sem validade, sem `paymentConditions`).
- `src/services/packageFlyerService.ts`: só muda para usar os helpers extraídos.
- `src/types/index.ts`: `ServiceItem` continua sem `route`; não criar campos por serviço nesta entrega.

## Derivação

- **Título:** `clientName` = `quotation.client_name` (obrigatório, 1–60, sem caracteres de controlo); `destination` = `data.destination` normalizado (2–45; soma origem+destino ≤ 55).
- **`proposalDate`:** `data.proposalDate` quando válida; fallback `quotation.created_at` (data local); formatar `DD/MM/AAAA`.
- **Datas:** `data.dates.startDate/endDate` válidas e `end >= start`; `dates.period` no formato curto do template («02 ABR — 05 ABR 2027»). Criar formatação própria no modelo (dia de 2 dígitos, mês abreviado em maiúsculas, ano no fim; repetir o ano só quando muda).
- **Passageiros:** `data.passengers`; `label` com adultos/crianças/bebés no plural correto (ex.: «2 adultos», «2 adultos · 1 criança»); pagantes = adultos + crianças.
- **Transporte:** primeiro `outbound_transport` e primeiro `inbound_transport` em `data.services` (usar `normalizeLegacyToNewStructure` quando `services` não for array). `carrier` de `ServiceItem.carrier` (fallback: «Voo»); `route` extraída dos códigos entre parênteses do `description` («Voo de ida Porto (OPO) para Paris (ORY)» → «OPO — ORY»), com fallback para origem/destino da cotação; `date` = `startDate` (ida) / `endDate` (volta); `departureTime`/`arrivalTime`; `fareLabel` = «Tarifa para N adultos» (ou «N pagantes»); `baggage` = `notes` do transporte sanitizado.
- **Hospedagem:** primeiro `accommodation`; `name` da `description` (sem códigos entre parênteses), `dateRange` = datas do hotel, `nights` = `durationNights` do cabeçalho (fallback: diferença de datas), `mealPlan` formatado pelo mapa de regimes.
- **Incluídos:** mesma derivação de itens do pacote (`included`, até 6, rótulos ≤ 40), com os serviços da cotação.
- **Não incluído:** `data.notIncluded` filtrado (≤ 3 linhas, ≤ 100 caracteres, sem termos internos via regra de conteúdo público); nunca ler `localTaxNotes`/`extraServicesNotes`/`customNotes`.
- **Preço:** `data.financials.salePrice ?? priceTotal.amount`; moeda `quotation.currency`; `financials.currency` divergente = erro; `formatted` com `formatMoney` da app.
- **Sinal:** `data.depositAmount` > 0 → `deposit.formatted`; `balanceDueDate` → `DD/MM`. Ausentes ou inválidos → sem bloco, com aviso (não bloqueia a peça).
- **Erros bloqueantes:** cliente, destino/origem, datas, preço, moeda divergente. **Avisos:** fonte ausente, sinal ausente, lista de não incluídos vazia, serviços omitidos.

## Testes

- Novo `tests/test_quotation_flyer.ts` (offline) com fixture inspirada na COT-2026-059: cliente «Sandra Colognesi», Paris, 2027-04-02→2027-04-05, 2 adultos, easyJet OPO–ORY/ORY–OPO, hotel «Ibis Paris Alésia Montparnasse 14ème», 3 noites, BB, 700 EUR, sinal 250, restante 2027-03-20, não incluídos com taxa local.
  - verificar título, data `11/11/2026` (ou a do fixture), rotas extraídas, companhia, horários, bagagem, hospedagem, noites, regime, incluídos, não incluídos, total `€ 700,00`, sinal `€ 250,00`, `20/03`;
  - verificar que `paymentConditions`, `localTaxNotes`, `customNotes` não aparecem no modelo;
  - verificar erros para cliente/destino/datas/preço ausentes e moeda divergente;
  - verificar limites de comprimento.
- `npx tsx tests/test_package_flyer.tsx` e `npx tsx tests/test_package_flyer_persistence.ts` verdes (pacote inalterado).
- `npx tsc --noEmit`.

## Critérios de aceitação

- `createQuotationFlyer` devolve o contrato completo e não expõe dados internos.
- `createPackageFlyer` mantém comportamento e output.
- Nenhuma dependência nova.
