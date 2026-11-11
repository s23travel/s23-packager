# Mapa de implementação: lâminas de cotações

Status: ready-for-agent

Referência: `spec.md`, decisões aprovadas em 2026-11-11.
Referência visual: `preview-cotacao-9x16.png` (1080 × 1920).

## Tarefas

| # | Tarefa | Depende de |
| --- | --- | --- |
| 01 | Campos da cotação | — |
| 02 | Casca do flyer partilhada e download JPG | — |
| 03 | Modelo comercial e modelo da cotação | 01 |
| 04 | Template 9:16 (markup, React, CSS) | 03 |
| 05 | Renderer com discriminador de template | 04 |
| 06 | Migration de persistência | — |
| 07 | Edge Function `quotation-flyer` | 03, 06 |
| 08 | Integração da UI no detalhe da cotação | 02, 04, 07 |
| 09 | Documentação e verificação final | 05, 06, 07, 08 |

## Ordem

1. **Campos da cotação**
   - `QuotationData`/`QuoteDraft`: `proposalDate`, `depositAmount`, `balanceDueDate`, `notIncluded`.
   - `QuoteFormPage`: data da cotação (pré-preenchida com `created_at`, editável), sinal, restante até, lista de não incluídos; labels alinhados.
   - `QuoteDetailPage`: exibir data da cotação, sinal/restante e não incluídos.
   - Testes de tipos/rascunho.

2. **Casca e download partilhados**
   - Extrair `useFlyerCreator`, controlos e `convertPngToJpg` sem alterar a lâmina de pacote.
   - Portão: testes existentes da lâmina de pacote e fluxo browser verdes.

3. **Modelo da cotação**
   - `createQuotationFlyer`: título cliente/destino, data, transporte, hospedagem, incluídos, `notIncluded`, total, sinal/restante.
   - Rota do `description`, companhia de `carrier`, datas/noites do cabeçalho.
   - Testes de modelo e formatação (`formatMoney` da app).

4. **Template 9:16**
   - Markup/CSS do template aprovado; prévia React e comparação com o PNG.
   - Ajustes visuais aprovados: nome branco, logo fino, data só com valor, fontes maiores, cartão no investimento, grupo inferior a 150 px.

5. **Renderer**
   - `template: 'quotation'` no worker; markup/CSS da cotação; viewport 1080 × 1920; validação do PNG.
   - Garantir o modelo de pacote sem `template`; testes de paridade.
   - Publicação manual com `npx wrangler@3 deploy --config workers/flyer-renderer/wrangler.jsonc`.

6. **Persistência e Edge Function**
   - Migration `quotation_flyer_*`, RPCs, `owner_kind` na fila, trigger de exclusão.
   - Edge Function `quotation-flyer` sobre a pipeline comum; testes de persistência/RLS/limpeza.

7. **Integração e testes**
   - Botão “Criar lâmina” no detalhe da cotação; creator; lâmina salva fora do bloco de erros.
   - Fluxo browser, download JPG, estados de erro.

8. **Documentação e publicação**
   - `docs/LAMINA-CONTRATO.md`, `docs/LAMINA-IA.md`.
   - Ordem: renderer (wrangler@3), migration/RPCs, Edge Function, frontend. Sem `db push`.

## Riscos

- Refactor da casca não pode mudar a lâmina de pacote; os testes existentes são o portão.
- Migration isolada para não tocar nas tabelas de pacote.
- Renderer não é atualizado pelo push; confirmar o deployment.
- O sinal/restante e o não incluído são campos novos; não reutilizar `paymentConditions`/notas antigas na peça.
- 9:16 e envio prioritário por WhatsApp; sem validade/referência na peça.
