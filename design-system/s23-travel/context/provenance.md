# Proveniência

Registro de onde veio cada valor e cada decisão. Sempre que houver conflito
entre fontes, a resolução está explicitada aqui.

## Fontes

| Código | Arquivo | O que é |
| --- | --- | --- |
| S1 | `source_examples/original-DESIGN.md` | `DESIGN.md` de origem (frontmatter tonal + prosa de marca) |
| S2 | `assets/Logo_Principal.png` (600×600) | símbolo navy, nuvem branca, monograma terracota |
| S3 | `assets/Logo_Secundario.png` (600×600) | símbolo terracota, monograma navy |
| S4 | `assets/Logo_Circulo.png` (557×557) | símbolo circular navy |
| S5 | `assets/Favicon.png` (128×128) | ícone de aba |
| S6 | `assets/screenshot-1794165842684.png` (1888×1016) | hero do site www.s23.travel |
| S7 | `assets/Captura de tela_8-11-2026_192433_www.s23.travel.jpeg` (1763×2972) | página de destinos do site |
| S8 | `assets/SaveClip.App_841064118_17924180043431769_4097732360085032466_n.jpg` | post de campanha réveillon |
| S9 | `fonts/Poppins/*` e `fonts/Instrument_Serif/*` | famílias completas + OFL |

## Cor

| Token | Valor | Evidência | Nota |
| --- | --- | --- | --- |
| `--s23-navy-900` | `#101D42` | S1 prosa ("Secondary #101D42 - Deep Navy"); S2/S4; S6 header | canônico |
| `--s23-navy-800` | `#152340` | S1 prosa (`brand-midnight`) | camada tonal |
| `--s23-navy-700` | `#162E61` | S1 prosa (`brand-navy-rich`) | camada tonal |
| `--s23-navy-950` | `#0B1533` | derivado do navy 900 para rodapé | **derivado**, ver open-questions |
| `--s23-terracotta-600` | `#D4641C` | S1 prosa ("Primary #D4641C"); S2/S4 | cor de marca |
| `--s23-terracotta-700` | `#B0500F` | derivado de `#D4641C` | **derivado** para AA (5.25:1) |
| `--s23-terracotta-800` | `#9A4100` | S1 frontmatter (`primary: '#9a4100'`) | usado em texto/selo |
| `--s23-terracotta-900` | `#7C3400` | derivado | estado pressed |
| `--s23-coral-500` | `#FC7C3F` | S1 prosa (`brand-coral-bright`) | só brilho |
| `--s23-sky-300` | `#A3CBE1` | S1 prosa ("Tertiary #A3CBE1") | fundo/ornamento |
| `--s23-sky-100` | `#DCEBF4` | frontmatter (`primary-fixed` `#ffdbcb` não; `tertiary-fixed` `#c0e8ff`); valor intermediário | **derivado** do azul-céu |
| `--s23-slate-400` | `#C7CED0` | S1 prosa ("Neutral #C7CED0") | bordas |
| `--s23-slate-200` | `#E9EDEF` | derivado | divisor sutil |
| `--s23-paper` | `#F8FAFB` | S1 prosa (`surface-bg`) | canvas |
| `--s23-cloud` | `#F4FAFD` | S1 frontmatter (`surface`) | canvas alternativo |
| `--s23-ink` | `#161D1E` | S1 frontmatter (`on-surface`) | texto denso |
| `--s23-ink-warm` | `#574238` | S1 frontmatter (`on-surface-variant`) | texto secundário |
| `--s23-whatsapp-brand` | `#25D366` | S1 prosa (`whatsapp-green`) | marca d'água |
| `--s23-green-700` | `#128C4A` | derivado | **derivado** para 4.31:1 |
| `--s23-error` | `#BA1A1A` | frontmatter (`error`) | estado |
| `--s23-error-container` | `#FFDAD6` | frontmatter (`error-container`) | fundo de erro |
| `--s23-on-error-container` | `#93000A` | frontmatter (`on-error-container`) | texto de erro |

### Conflito resolvido

O frontmatter de S1 descreve uma rampa tonal Material (`surface #f4fafd`,
`primary #9a4100`, `secondary #515d85`, `tertiary #396174`) enquanto a prosa do
mesmo arquivo descreve a paleta de marca (`#D4641C`, `#101D42`, `#A3CBE1`,
`#C7CED0`). O site (S6/S7) confirma a paleta de marca: header navy, CTAs
terracota, selos terracota. **Decisão:** prosa + site são canônicos para marca;
a rampa Material vira superfícies de apoio (`--s23-cloud`, `--s23-ink`,
`--s23-ink-warm`, erro). Os tons `#515d85` e `#396174` não entram: não aparecem
em nenhuma tela capturada.

## Tipografia

| Decisão | Evidência |
| --- | --- |
| Poppins como família de UI | S1 (todos os tokens usam Poppins); S6/S7 |
| Instrument Serif como display editorial | S1 prosa ("graceful display serifs"); S9 (arquivos entregues); S8 (post usa serifa em itálico) |
| Pesos 400/500/600/700 na UI | S1 (`body 400`, `label-button 600`, `headline 700`); demais pesos não usados |
| Escala 40–56px no display | S1 (`display-hero 48/56`), ampliada com `clamp` para responsividade |
| Corpo 16px | S1 pedia 15px (`body-md`); elevado para 16px por legibilidade mobile — **desvio registrado** |
| Selo 12px/700 `+0.08em` | S1 (`label-badge 12px/700/+0.04em`); tracking elevado para 0.08em por regra de caixa alta — **desvio registrado** |
| Título de card 18px/700 | S1 (`title-card`) |
| Caption 12px | S1 (`caption`) |

## Espaçamento, grid, raio e sombra

| Token | Valor | Evidência |
| --- | --- | --- |
| `--space-*` | 4, 8, 12, 16, 24, 32, 40, 64, 96 | S1 (`space-xxs` 0.25rem … `space-2xl` 4rem; `space-xl` 2.5rem) |
| Gutter | 24px desktop / 16px mobile | S1 (`gutter 1.5rem`, `gutter-mobile 1rem`) |
| Margem | 48px desktop / 20px mobile | S1 (`margin 3rem`, `margin-mobile 1.25rem`) |
| Container | 1240px | S1 (§Layout: "max container width of 1240px") |
| Grid | 12 / 8 / 4 colunas | S1 (§Layout) |
| Raio de card | 16px | S1 (§Components: "16px border-radius") |
| Raio de input | 8px | S1 (§Components: "8px corner radius") |
| Pill | 9999px | S1 (§Shapes) |
| `--shadow-1` | `0 4px 16px -2px rgba(16,29,66,.05)` | S1 (§Elevation, Level 1) |
| `--shadow-2` | `0 12px 30px -4px rgba(16,29,66,.12)` | S1 (Level 2) |
| `--shadow-3` | `0 8px 28px rgba(16,29,66,.16)` | S1 (Level 3) |
| Scrim de hero | `#101D42` 65% → 25% | S1 (§Elevation, Hero Image Overlays) |

## Componentes

| Componente | Evidência |
| --- | --- |
| Header navy com logo circular e CTA pill | S6 (captura do hero), S1 §Components |
| Selo "• Presentes no Brasil & Portugal" | S6 |
| Headline com palavra em terracota | S6 ("cuidado"), S1 §Typography |
| Botões "Quero planejar minha viagem →" / "Conhecer os destinos" | S6 |
| Barra de busca com Regiões/Ordenar | S7 |
| Card 16:10 com selo, país, descrição e "Conhecer destino →" | S7, S1 §Components |
| Paginação circular | S7 |
| Rodapé navy com CADASTUR e +55/+351 | S1 §Components, S7 |
| Launcher verde de WhatsApp | S6/S7 (canto inferior direito) |

## Acessibilidade

| Mudança | Motivo |
| --- | --- |
| CTA `#D4641C` → `#B0500F` | branco sobre terracota = 3.72:1 (reprova AA em 15px) |
| Selo `#D4641C` → `#9A4100` | mesmo motivo, texto de 12px |
| Launcher `#25D366` → `#128C4A` | branco sobre `#25D366` = 2.0:1; `#128C4A` = 4.31:1 |
| Corpo 15 → 16px | legibilidade mobile |
| Raios de contraste calculados | WCAG 2.1, sRGB |

## O que não entrou

- `travel.jpg` (Fareentips) e as peças "Travel Agency Software…" e "Travel
  Banner Template…": conteúdo de terceiros sem licença registrada. Ficam em
  `assets/` apenas como referência e estão proibidos no produto.
- Tons `#515d85` (secondary) e `#396174` (tertiary) da rampa Material: sem
  evidência em tela.
- Tema escuro: não existe nas fontes.
