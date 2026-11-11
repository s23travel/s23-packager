# 08 — Integração da lâmina no detalhe da cotação

Status: done
Blocked by: 02, 04, 07
Commit: 6c19f8b

Especificação: `.scratch/laminas-cotacoes/spec.md` («Mapa de implementação → Serviços e componentes»).

## Objetivo

Ligar a cotação ao template e à Edge Function: botão «Criar lâmina» no detalhe, creator próprio sobre a casca partilhada, prévia, publicação e downloads HTML/JPG.

## Ficheiros

- `src/services/quotationFlyerAttachmentService.ts` (novo): `getCurrentQuotationFlyer`, `createQuotationFlyerServerPreview`, `publishQuotationFlyer`, `downloadSavedQuotationFlyer` contra `functions.invoke('quotation-flyer')`, com os mesmos tipos/erros do serviço de pacote.
- `src/components/quotes/QuotationFlyerCreator.tsx` (novo): usa `useFlyerCreator`, `FlyerControls`, `FlyerItemsEditor`, `FlyerServerPreview`, `FlyerSavedDownloads` e `QuotationFlyerTemplate`; `createQuotationFlyer(quote)` para o modelo local; copy «lâmina/cotação»; resumo de texto com cliente, data, transporte, hospedagem, incluídos, não incluídos, total e sinal/restante.
- `src/components/quotes/quotationFlyer.css`: importado pela página/detalhe (o creator não duplica CSS).
- `src/pages/quotes/QuoteDetailPage.tsx`: botão «Criar lâmina» no padrão da página de pacote, estado `flyerOpen` e `<QuotationFlyerCreator quotation={quote} open={flyerOpen} />`.
- Nome de download `lamina-cotacao-<referencia>-<destino>.jpg|html`, com referência/destino vindos da cotação (para a versão salva funcionar mesmo com modelo local inválido).

## Regras de interface

- A secção «lâmina salva» e os downloads ficam **fora** do bloco condicionado ao modelo local: com cliente/data/preço em falta, a prévia é bloqueada mas a versão salva continua visível e baixável.
- Sem caixas de confirmação; rótulos aprovados; «IMAGEM» entrega JPG real convertido do PNG.
- Nenhum dado interno (custos, fornecedor, margens, `paymentConditions`, notas antigas) aparece no resumo ou na peça.
- Funciona com cotação arquivada, sem a desarquivar.

## Testes

- Novo `tests/package_flyer_flow.browser.tsx`-equivalente: `tests/quotation_flyer_flow.browser.tsx` + runner offline com APIs simuladas, cobrindo: abrir a lâmina numa cotação; gerar IA; editar subtítulo/itens; gerar prévia; salvar/substituir; baixar HTML e JPG (MIME `image/jpeg`, extensão `.jpg`); recarregar a versão salva; erros de dados obrigatórios mantendo a lâmina salva acessível; ausência de caixas de confirmação.
- Teste offline do serviço de anexos com `fetch` falso (mensagens e ações).
- `npx tsc --noEmit`; testes de pacote verdes.
- **Não executar testes que escrevem no Supabase** nem testes live.

## Critérios de aceitação

- O fluxo da cotação espelha o do pacote e não regride o pacote.
- Conversão JPG valida o resultado antes de descarregar.
- Nenhum link público/URL partilhável é exposto.
