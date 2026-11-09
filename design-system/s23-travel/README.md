# S23 Travel — Design System

Pacote autossuficiente de design system para copiar em repositórios e usar como
contrato visual. Sem build, sem dependências, sem JavaScript obrigatório.

## Product Overview

**S23 Travel** is the source product: a tailor-made travel agency operating
between Brazil and Portugal, selling curated international itineraries to
families and couples with Portuguese-language support on both sides of the
Atlantic. This package is the product's visual contract — a product overview,
its primary surfaces and core capabilities — ready to be copied into a
repository and handed to a coding agent.

**Product context.** S23 Travel é uma agência de viagens sob medida entre Brasil e Portugal: roteiros internacionais para famílias e casais, com atendimento em português dos dois lados do Atlântico, suporte no destino e preço transparente.

O S23 Travel é uma agência de viagens sob medida entre Brasil e Portugal:
roteiros internacionais para famílias e casais, com atendimento em português dos
dois lados do Atlântico, suporte no destino e preço transparente.

**Primary surfaces.**

- Site institucional e catálogo de destinos (`www.s23.travel`): hero de
  campanha, barra de busca com filtros, grade de cards de destino, paginação,
  rodapé com Cadastur e contatos.
- Atendimento: launcher de WhatsApp e formulário "Fale com um especialista".
- Conteúdo: editorial de campanha (réveillon, destinos sazonais) e posts de
  `@s23_travel`.

**Core capabilities.**

- Buscar e filtrar destinos por região e ordenação.
- Apresentar roteiro, país, descrição curta e caminho para o detalhe.
- Transmitir confiança (navy), calor (terracota) e clareza de preço.
- Levar ao atendimento humano sem atrito, em qualquer tela.

A linguagem visual é **Warm Journey & Editorial Horizons**: Poppins na operação,
Instrument Serif no editorial, terracota como convite, navy como confiança.

## Source and context

| Referência | Onde está | Uso |
| --- | --- | --- |
| `DESIGN.md` de origem | `source_examples/original-DESIGN.md` | evidência primária de cores, tipo, grid e componentes |
| Logos oficiais | `assets/Logo_Principal.png`, `Logo_Secundario.png`, `Logo_Circulo.png` | aplicação direta, sem redesenho |
| Favicon | `assets/Favicon.png` | aba do navegador |
| Hero do site | `assets/screenshot-1794165842684.png` | header, selo regional, CTAs, voz |
| Página de destinos | `assets/Captura de tela_8-11-2026_192433_www.s23.travel.jpeg` | cards, busca, paginação, rodapé |
| Posts de campanha | `assets/SaveClip.App_*.jpg` | papel editorial da serifa, tom de voz |
| Fontes | `fonts/Poppins/`, `fonts/Instrument_Serif/` | famílias completas + OFL 1.1 |

Rastreabilidade completa em `context/provenance.md`; lacunas em
`context/open-questions.md`.

## Package contents

```
DESIGN.md                  contrato completo (leia primeiro)
colors_and_type.css        155 tokens + 20 @font-face
SKILL.md                   guia operacional para agentes de código
README.md                  este arquivo
fonts/                     Poppins (18 .ttf) + Instrument Serif (2 .ttf) + OFL
assets/                    logos, favicon, capturas e criativos originais
preview/                   11 cards de revisão (ver manifesto abaixo)
ui_kits/app/               homepage aplicada + app.css + components/ + README
context/                   provenance.md e open-questions.md
source_examples/           original-DESIGN.md e README
handoff/                   tokens.css, components.html, USAGE.md, README.md
build/                     tokens.json e README (sem etapa de build)
```

## Preview manifest

Preview cards (`preview/*.html`) para revisão e para orientar agentes futuros.
Cada card carrega `colors_and_type.css` e, quando aplicável, os assets reais.

| Card | Para que serve |
| --- | --- |
| `preview/colors.html` | primitivas, papéis semânticos e pares de contraste |
| `preview/colors-primary.html` | foco na rampa terracota e no que é proibido |
| `preview/typography.html` | famílias, escala, tracking e specimen |
| `preview/typography-specimens.html` | foco em Poppins + Instrument Serif |
| `preview/spacing.html` | escala, grid e ritmo aplicado |
| `preview/spacing-tokens.html` | foco na escala de 8 pontos e breakpoints |
| `preview/radius-shadows.html` | raios, elevação e bordas |
| `preview/components.html` | biblioteca com todos os estados |
| `preview/components-buttons.html` | foco nos oito estados do botão |
| `preview/brand-assets.html` | logos, regras de uso e inventário |
| `preview/applied-ui.html` | composição aplicada desktop + mobile |

Abra primeiro `preview/colors.html`, `preview/typography.html` e
`preview/components.html`.

### UI kit aplicado

`ui_kits/app/index.html` é a homepage real, com CSS embutido para revisão e
referências aos snippets em `ui_kits/app/components/` (`buttons`, `cards`,
`search-form`, `badges`, `navigation`, `footer`, `feedback`). Instruções em
`ui_kits/app/README.md`.

### Assets, fontes e build

- `assets/` mantém os nomes originais; `travel.jpg` e as peças "Travel Agency
  Software…" / "Travel Banner Template…" são de terceiros e estão fora do uso.
- `fonts/` mantém os `OFL.txt` ao lado de cada família.
- `build/tokens.json` é export somente leitura; o CSS é a fonte de verdade.
  Não há etapa de build.

## Reuse workflow

1. Copie `colors_and_type.css` e `fonts/` para o repositório, lado a lado.
2. Linke `/colors_and_type.css` no `<head>`.
3. Leia `DESIGN.md` (ou `handoff/USAGE.md`) antes de codar.
4. Parta de `ui_kits/app/components/` e substitua o conteúdo pelo conteúdo real
   do produto.
5. Revise com o checklist de `SKILL.md` §5 e abra `handoff/components.html`
   para comparar estados.
6. Para um pacote mínimo, use `handoff/` — mesma verdade, menos arquivos.

## Fontes e licenças

Poppins e Instrument Serif são distribuídas sob SIL Open Font License 1.1; os
`OFL.txt` acompanham os arquivos. Nenhuma fonte é carregada de CDN.

## Limites conhecidos

- Não há tema escuro nas referências; nenhum foi inventado.
- O acervo não inclui fotografias limpas de destino; os cards usam a moldura
  editorial do sistema até o acervo existir.
- O wordmark "s23 travel" é texto; só o símbolo foi entregue como imagem.
- Contatos, número de Cadastur e preços não estavam nas referências.
