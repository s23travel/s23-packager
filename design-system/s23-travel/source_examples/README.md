# source_examples

## O que está aqui

`original-DESIGN.md` — o `DESIGN.md` entregue na referência, preservado
verbatim (incluindo o frontmatter tonal e eventuais caracteres corrompidos por
codificação). É a evidência primária do contrato e serve para auditoria: todo
valor do pacote deve poder ser rastreado até ele, até um arquivo de imagem ou
até uma decisão registrada em `context/provenance.md`.

## O que não existia na referência

A pasta de referência continha apenas `DESIGN.md`, imagens/peças de campanha e as
fontes — **nenhum código de componente, CSS de produção ou repositório**.
Portanto não há exemplo de código de terceiro para preservar; os snippets em
`ui_kits/app/components/` foram escritos para este pacote usando os tokens
extraídos.

Os únicos exemplos visuais reais preservados são:

- `assets/screenshot-1794165842684.png` — hero de www.s23.travel;
- `assets/Captura de tela_8-11-2026_192433_www.s23.travel.jpeg` — página de
  destinos;
- `assets/SaveClip.App_*.jpg` — posts de @s23_travel;
- `assets/Logo_*.png` e `assets/Favicon.png`.

Eles são consumidos diretamente em `preview/brand-assets.html`, sem redesenho.
