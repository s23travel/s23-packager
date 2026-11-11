# 05 — Renderer: discriminador de template

Status: ready-for-agent
Blocked by: 04

Especificação: `.scratch/laminas-cotacoes/spec.md` («Decisões de segurança e persistência → Renderer», «Testes → Worker»).

## Objetivo

O worker `s23-flyer-renderer` passa a renderizar dois templates no mesmo viewport 1080 × 1920: `package` (atual, default quando `template` está ausente) e `quotation`.

## Ficheiros

- `workers/flyer-renderer/src/index.ts`:
  - aceitar no body `{ template?: 'package' | 'quotation', model, image }`; sem `template` = `package`;
  - validar o modelo da cotação com a mesma rigidez do pacote: chaves permitidas do contrato (sem `template` no modelo, o discriminador é do envelope), limites da spec e rejeição de chaves desconhecidas;
  - `createHtml` escolhe `renderQuotationFlyerMarkup` + `quotationFlyer.css` ou `renderPackageFlyerMarkup` + `packageFlyer.css` (importar ambos os CSS; `travelTokens` continua comum);
  - manter `version: 's23-flyer-v1'`, CSP, viewport, validação do PNG 1080 × 1920 e erros atuais;
  - garantir que um pedido sem `template` produz exatamente o mesmo HTML/PNG de hoje.
- `workers/flyer-renderer/src/assets.d.ts` se preciso.
- Não alterar `wrangler.jsonc` (mesmo nome, bindings e cron).

## Testes

- Extrair a validação para funções testáveis se necessário; novo `tests/test_flyer_renderer_templates.ts` (offline) que verifique: modelo de pacote sem `template` válido; modelo de cotação válido; template desconhecido rejeitado; chaves desconhecidas e limites rejeitados nos dois modelos; `createHtml` do pacote inalterado face ao markup atual.
- `npx tsc --noEmit`.
- `npx tsx tests/test_package_flyer.tsx` verde.

## Critérios de aceitação

- O contrato de pacote fica retrocompatível (sem `template`).
- O HTML da cotação embute fontes, logo e imagem; funciona sem rede.
- Nenhuma alteração de deployment neste ticket (publicação na fase final, com `npx wrangler@3 deploy`).
