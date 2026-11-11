# 04 — Template 9:16 da cotação (markup, React e CSS)

Status: ready-for-agent
Blocked by: 03

Especificação: `.scratch/laminas-cotacoes/spec.md` («Template anexo e mapeamento», «Decisões de produto e template»). Referência visual: `.scratch/laminas-cotacoes/preview-cotacao-9x16.png` (1080 × 1920).

## Objetivo

Implementar o template aprovado da cotação: markup partilhado (usado pelo worker), componente React de prévia e CSS 9:16 com a identidade S23 Travel, fiel ao PNG aprovado.

## Ficheiros

- `src/services/flyerMarkupShared.ts` (novo): extrair de `packageFlyerMarkup.ts` `escapeHtml`, `icon()`/ícones, foto (`imageUrl` seguro), logo e helpers de data. `packageFlyerMarkup.ts` passa a consumir estes helpers com markup idêntico.
- `src/services/quotationFlyerMarkup.ts` (novo): `renderQuotationFlyerMarkup(model, logoUrl)` com:
  - hero (foto de fundo, logo com borda fina, badge só com a data `DD/MM/AAAA`), etiqueta «PROPOSTA DE VIAGEM», bloco de título a descer no hero;
  - título: cliente em branco (linha 1), destino em laranja (linha 2), sem duração; subtítulo;
  - barra branca `DATAS | VIAJANTES | ROTA`;
  - cartão `VOOS`: companhia, IDA e REGRESSO com data, rota, horários, tarifa e bagagem; caixa de bagagem e régua afastadas da divisória central;
  - cartão `HOSPEDAGEM`: hotel, período, noites, regime; `INCLUÍDO` e `NÃO INCLUÍDO` logo após o conteúdo;
  - bloco navy `INVESTIMENTO TOTAL` com ícone de cartão de crédito e valor; `PAGAMENTO` com sinal e «restante até DD/MM»;
  - CTA «Fale com a S23 para reservar», linha «Consulte-nos sobre outras saídas e datas» e rodapé legal;
  - grupo investimento/CTA/rodapé a 150 px do fundo no ficheiro 1080 × 1920.
- `src/components/quotes/QuotationFlyerTemplate.tsx` (novo): mesma composição em React, consumindo `QuotationFlyerModel` e o mesmo CSS.
- `src/components/quotes/quotationFlyer.css` (novo): layout completo; apenas tokens `var(--…)` do kit Travel (`design-system/s23-travel/colors_and_type.css`), Poppins, navy/laranja e cartões brancos. Sem hex/fonte/espaçamento soltos. Contraste ≥ 4.5:1 no corpo; respeitar `prefers-reduced-motion`.
- `packageFlyerMarkup.ts`: extração sem alterar o HTML produzido.
- Se necessário, ajustar `PackageFlyerTemplate.tsx` apenas para importar helpers (sem mudança visual).

## Regras visuais aprovadas (memória «Lâminas de cotações: ajustes visuais 9:16»)

- Nome do cliente em branco; destino em laranja.
- Logo com borda fina; logo e data 50 px abaixo do topo (1080×1920).
- Badge só com a data, mesma família Poppins, próximo do tamanho dos valores das secções.
- Fontes maiores em voos, tarifa/bagagem, hospedagem, incluídos/não incluído, investimento e pagamento.
- Caixa de bagagem e régua abaixo de «VOOS» longe da divisória central.
- Ícone de cartão de crédito no investimento.
- A caixa central não estica; o grupo inferior fica a 150 px do fundo.
- Uma linha de respiro entre blocos.

## Testes

- Novo `tests/test_quotation_flyer.tsx` (offline, `renderToStaticMarkup`): hero, etiqueta, cliente e destino em linhas distintas, datas, viajantes, rota, cartões, incluídos/não incluídos, total, sinal/restante, CTA e rodapé; ausência de `paymentConditions`/`localTaxNotes`/referência/validade; escape de HTML em cliente/subtítulo/itens; listas densas (6 incluídos, 3 não incluídos) sem lançar.
- Comparação visual manual: renderizar a fixture e comparar com `preview-cotacao-9x16.png` (guardar PNG de conferência em `.scratch/laminas-cotacoes/`).
- `npx tsx tests/test_package_flyer.tsx` verde (markup do pacote inalterado).
- `npx tsc --noEmit`.

## Critérios de aceitação

- O markup da cotação e o componente React partilham a mesma estrutura/classes.
- Nenhum valor de cor/tamanho literal no CSS novo.
- O template de pacote continua igual.
