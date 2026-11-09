# S23 Travel — Design System Contract

> **Warm Journey & Editorial Horizons**
> Contrato visual do S23 Travel (viagens sob medida entre Brasil e Portugal).
> Este documento, junto de `colors_and_type.css`, é suficiente para qualquer
> agente construir telas fiéis à marca. Leia este arquivo antes de escrever UI.

Versão do contrato: 1.0 · Evidência primária: `source_examples/original-DESIGN.md`,
logos em `assets/`, captura de `www.s23.travel` e posts de `@s23_travel`.

---

## 1. Contexto do produto (Product context)

O S23 Travel vende **viagens cuidadas, não pacotes**. A marca organiza roteiros
internacionais para famílias e viajantes brasileiros e portugueses, com
atendimento humano próximo, suporte em português dos dois lados do Atlântico e
transparência de preço. A interface existe para reduzir a ansiedade da escolha,
não para impressionar com efeitos.

**Princípios, em ordem de prioridade:**

1. **Confiança antes de encanto.** Azul-marinho profundo sustenta navegação,
   cabeçalhos e rodapé; o terracota aparece como convite, nunca como alarme.
2. **Calor humano com precisão editorial.** Poppins resolve a operação
   (destinos, filtros, preços, suporte). Instrument Serif entra apenas em
   momentos narrativos e de campanha, com itálico quando a voz é inspiracional.
3. **Clareza de destino.** Toda tela responde "para onde eu vou, com quem falo
   e quanto custa". Nada de metáfora no lugar de informação.
4. **Leveza solar.** Superfícies claras, sombras ambientes baixas, bordas
   discretas. A profundidade vem da fotografia e do contraste tonal, não de
   drop shadows pesados.
5. **Acessibilidade como padrão de hospitalidade.** Contraste, foco visível e
   áreas de toque generosas fazem parte da promessa de cuidado.

**Público:** viajantes de 30 a 65 anos, famílias com crianças, casais em lua de
mel, brasileiros indo à Europa e portugueses vindo ao Brasil. Contexto de uso:
celular, conexão instável, decisão emocional e comparativa. Português do Brasil
como idioma principal, com versões em português europeu.

**Componentes reais do produto:** header navy com logotipo circular, hero de
campanha com selo "Presentes no Brasil & Portugal", barra de busca com filtros
(Pesquisar destinos / Regiões / Ordenar), grade de cards de destino com selo
("Em alta", "Mais procurado"), link "Conhecer destino →", paginação, rodapé
navy com CADASTUR e contatos (+55 / +351), botão flutuante de atendimento
WhatsApp.

---

## 2. Cor (Color)

**Fonte:** `source_examples/original-DESIGN.md` (prosa de marca), `assets/Logo_Principal.png`, `assets/Logo_Secundario.png` e `assets/screenshot-1794165842684.png`.

Todas as cores vivem em `colors_and_type.css` como tokens semânticos. Componentes
**nunca** usam hex cru; usam `var(--color-*)`.

### 2.1 Papéis

| Papel | Token | Hex | Onde usar |
| --- | --- | --- | --- |
| Fundo de página | `--color-bg` | `#F8FAFB` | canvas claro |
| Superfície de card | `--color-surface` | `#FFFFFF` | cards, filtros, modais |
| Superfície tingida | `--color-surface-tint` | `#DCEBF4` | faixas suaves, hover de item |
| Azul atmosférico | `--color-surface-strong` | `#A3CBE1` | tags de voo, ícones, faixas |
| Texto principal | `--color-text` | `#101D42` | corpo, títulos (15.7:1 no fundo) |
| Texto denso | `--color-text-strong` | `#161D1E` | trechos longos em superfície tingida |
| Texto secundário | `--color-text-muted` | `#574238` | metadados, apoio (8.9:1 no fundo) |
| Terracota de marca | `--color-accent` | `#D4641C` | palavra destacada, selo, filete, ícone |
| Preenchimento de CTA | `--color-primary` | `#B0500F` | botão primário (5.25:1 com branco) |
| Hover de CTA | `--color-primary-hover` | `#D4641C` | realce de marca no hover |
| Pressed de CTA | `--color-primary-active` | `#7C3400` | estado pressionado |
| Terracota em texto | `--color-primary-strong` | `#9A4100` | links e texto sobre claro (6.7:1) |
| Navy institucional | `--color-secondary` | `#101D42` | header, rodapé, faixas noturnas |
| Navy rico | `--color-inverse-bg-raised` | `#152340` | submenus, cards sobre navy |
| WhatsApp acessível | `--color-whatsapp` | `#128C4A` | launcher de atendimento |
| Erro | `--color-error` | `#BA1A1A` | mensagens e bordas inválidas |
| Sucesso | `--color-success` | `#128C4A` | confirmação de envio |

### 2.2 Pares de contraste homologados

Razões calculadas com WCAG 2.1 (sRGB). Use apenas pares aprovados:

| Texto | Fundo | Razão | Uso permitido |
| --- | --- | --- | --- |
| `#FFFFFF` | `#B0500F` | **5.25:1** | botão primário, texto 15px/600 |
| `#FFFFFF` | `#9A4100` | **6.71:1** | CTA forte, selo preenchido |
| `#FFFFFF` | `#7C3400` | **8.94:1** | estado pressed |
| `#101D42` | `#F8FAFB` | **15.71:1** | corpo em canvas |
| `#574238` | `#F8FAFB` | **8.95:1** | texto secundário |
| `#FFFFFF` | `#101D42` | **16.45:1** | header/rodapé |
| `#101D42` | `#A3CBE1` | **9.55:1** | tag de voo, faixa clara |
| `#101D42` | `#DCEBF4` | **13.50:1** | superfície tingida |
| `#D4641C` | `#101D42` | **4.42:1** | destaque em hero navy (≥24px) |
| `#FC7C3F` | `#101D42` | **6.34:1** | realce decorativo sobre navy |
| `#FFFFFF` | `#128C4A` | **4.31:1** | launcher, ícone e rótulo curto |
| `#101D42` | `#25D366` | **8.30:1** | glifo sobre verde de marca |
| `#FFFFFF` | `#BA1A1A` | **6.46:1** | mensagem de erro |
| `#93000A` | `#FFDAD6` | **7.4:1** | erro em faixa suave |

**Restrições obrigatórias**

- Branco sobre `#D4641C` rende apenas **3.72:1**: use esse par **somente** em
  texto ≥24px ou elementos gráficos. Para qualquer controle com texto pequeno,
  o preenchimento é `#B0500F`.
- Texto terracota sobre branco (`#D4641C`) rende **3.72:1**: em corpo de texto
  use `#9A4100`. `#D4641C` é cor de display e de ornamento.
- `#A3CBE1` é fundo e ornamento; não é cor de texto.
- `#25D366` é a cor do símbolo WhatsApp. O launcher acessível usa `#128C4A`
  com glifo branco; `#25D366` só aparece no selo/marca d'água.
- **Não existe tema escuro homologado.** As referências não trazem dark mode; a
  seção navy é uma faixa tonal da interface clara, não um tema. Não invente um.

---

## 3. Tipografia (Typography)

**Fonte:** `fonts/Poppins/` e `fonts/Instrument_Serif/` (arquivos reais + OFL), tokens do frontmatter de `original-DESIGN.md` e post `assets/SaveClip.App_841064118_17924180043431769_4097732360085032466_n.jpg`.

### 3.1 Famílias e arquivos

| Família | Papel | Arquivos | Pesos |
| --- | --- | --- | --- |
| **Poppins** | UI, títulos, corpo, controles, dados | `fonts/Poppins/Poppins-*.ttf` (18 arquivos, com itálicos) | 100–900 |
| **Instrument Serif** | display editorial e citações | `fonts/Instrument_Serif/InstrumentSerif-Regular.ttf`, `-Italic.ttf` | 400 |

Ambas são OFL 1.1; os `OFL.txt` acompanham as pastas. Os `@font-face` estão em
`colors_and_type.css` com `font-display: swap` e caminhos relativos.

### 3.2 Decisão sobre Instrument Serif

O `DESIGN.md` original usava Poppins em tudo, mas o próprio texto pedia
"graceful display serifs para momentos narrativos" e as fontes foram entregues
no pacote. Os posts de `@s23_travel` usam serifa editorial em itálico
("Ainda não sabe onde passar o *réveillon*?"), o que confirma o papel. Portanto:

- **Instrument Serif é a voz editorial da marca**, não uma alternativa de corpo.
- Usos permitidos: manchete de campanha, título de editorial, citação de
  viajante, número-herói de prova social, capa de material.
- Proibido: corpo de texto, labels, botões, tabelas, preços, inputs, navegação,
  qualquer texto abaixo de 24px.
- Emparelhamento: no máximo Poppins 700 + Instrument Serif 400 na mesma tela.
  A serifa nunca recebe peso sintético; se precisar de ênfase, use itálico.

### 3.3 Escala

| Token | Tamanho | Leading | Tracking | Peso | Uso |
| --- | --- | --- | --- | --- | --- |
| `--text-display` | 40 → 56px | 1.06 | −0.02em | 700 | hero de campanha |
| `--text-editorial` | 36 → 56px | 1.12 | −0.01em | 400 serif | manchete editorial |
| `--text-h1` | 32 → 40px | 1.15 | −0.015em | 700 | título de página |
| `--text-h2` | 28px | 1.20 | −0.01em | 600 | seção |
| `--text-h3` | 22px | 1.30 | −0.005em | 600 | subtítulo |
| `--text-title` | 18px | 1.35 | 0 | 700 | título de card |
| `--text-body-lg` | 18px | 1.60 | 0 | 400 | introdução |
| `--text-body` | 16px | 1.65 | 0 | 400 | corpo padrão |
| `--text-small` | 14px | 1.55 | 0 | 400 | metadados, apoio |
| `--text-caption` | 12px | 1.45 | +0.01em | 400 | legenda, validade |
| `--text-label` | 12px | 1.00 | **+0.08em** | 700 | selos, sobrescrito |
| `--text-button` | 15px | 1.20 | +0.01em | 600 | controles |

Regras duras:

- Corpo nunca abaixo de **16px**; o original pedia 15px, ajustado para leitura
  em celular. Metadados usam 14px; 12px é exclusivo de legenda e selo.
- **Todo texto em caixa alta precisa de tracking ≥ +0.06em.** Os selos da marca
  usam `+0.08em`.
- Display e h1 levam tracking negativo; corpo e texto pequeno levam 0 ou
  positivo. Nunca aplique tracking negativo em texto pequeno.
- Largura de linha: `--measure` (68ch) para prosa, `--measure-narrow` (46ch)
  para textos sobre imagem. Nunca justifique texto.
- No máximo **três pesos** por tela: 400 (ler), 600 (conduzir), 700 (anunciar).
  Pesos 800/900 existem na família mas não são usados em UI.

### 3.4 Destaque de marca em headline

Palavras de acolhimento dentro de uma headline ("com o **cuidado** que você
merece") recebem `--color-accent` mantendo peso e tamanho do resto da frase.
Em hero navy, o terracota é permitido em ≥24px; em fundo claro, use
`--color-primary-strong` no mesmo papel.

---

## 4. Espaçamento e grid (Spacing and grid)

**Fonte:** `original-DESIGN.md` (§Layout & Spacing: gutter, margin, space-*, grid de 12/8/4 colunas, container 1240px) e `assets/Captura de tela_8-11-2026_192433_www.s23.travel.jpeg`.

Base **8pt** com subpasso de 4px. Nada de valores arbitrários.

| Token | Valor | Uso |
| --- | --- | --- |
| `--space-3xs` | 4px | ajuste óptico, gap de ícone |
| `--space-2xs` | 8px | gap de selo, padding de chip |
| `--space-xs` | 12px | gap interno de lista |
| `--space-sm` | 16px | padding de botão, gap de card |
| `--space-md` | 24px | padding de card (desktop) |
| `--space-lg` | 32px | gap de grade |
| `--space-xl` | 40px | ritmo vertical mobile |
| `--space-2xl` | 64px | ritmo vertical desktop |
| `--space-3xl` | 96px | abertura de página de campanha |

**Grid**

- Desktop (≥1200px): 12 colunas, gutter 24px, container máximo 1240px
  centralizado, margem de página 48px. Catálogo de destinos em 3 colunas
  (4 colunas cada).
- Tablet (768–1199px): 8 colunas, gutter 20px, margem 32px, catálogo em 2
  colunas.
- Mobile (<768px): 4 colunas, gutter 16px, margem 20px, tudo em 1 coluna.

Ritmo entre seções: `--space-2xl` no desktop, `--space-xl` no mobile. Padding
interno de card: `--space-md`; a mídia do topo sangra até as bordas.

---

## 5. Raios, sombras e bordas (Shape and elevation)

**Fonte:** `original-DESIGN.md` (§Shapes e §Elevation) e cards da captura da página de destinos.

**Raios** — a marca é pill-first.

| Token | Valor | Uso |
| --- | --- | --- |
| `--radius-sm` | 8px | inputs, selects, tags pequenas |
| `--radius-md` | 12px | botões retangulares, chips |
| `--radius-lg` | 16px | cards de destino, mídia |
| `--radius-xl` | 24px | barras de busca, painéis |
| `--radius-2xl` | 32px | blocos de destaque, faixas de campanha |
| `--radius-pill` | 9999px | CTA, selos, paginação, launcher |

**Sombras** — ambientes e solares, nunca duras.

| Token | Valor | Uso |
| --- | --- | --- |
| `--shadow-1` | `0 4px 16px -2px rgba(16,29,66,.05)` | card em repouso |
| `--shadow-2` | `0 12px 30px -4px rgba(16,29,66,.12)` | hover de card, popover |
| `--shadow-3` | `0 8px 28px rgba(16,29,66,.16)` | nav fixa, launcher |
| `--shadow-focus` | `0 0 0 3px rgba(212,100,28,.35)` | anel de foco |

**Bordas**

- Card em repouso: `1px solid rgba(199,206,208,.55)` **mais** `--shadow-1`.
- Divisor silencioso: `1px solid #E9EDEF`.
- Sobre navy: `1.5px solid rgba(255,255,255,.75)` em contorno de botão fantasma.
- Sobre claro: `1.5px solid #101D42`.
- Nunca use borda esquerda colorida como destaque de card.

---

## 6. Componentes (Components)

**Fonte:** `original-DESIGN.md` (§Components), hero e página de destinos de www.s23.travel, e os logos oficiais.

Todo componente herda os tokens. Os estados obrigatórios são **default,
hover, focus-visible, active, disabled, loading, error e empty** (vazio quando
o componente lista conteúdo).

### 6.1 Botão primário (pill)

- **Anatomia:** rótulo 15px/600 + ícone opcional de 16px à direita, gap 8px.
- **Métrica:** altura 48px, padding 0 24px, raio pill.
- **Cores:** fundo `--color-primary`, texto `--color-on-primary`. No botão
  padrão de 15px o preenchimento **não** clareia para `#D4641C` no hover
  (3.72:1 reprovaria); o hover adiciona `--shadow-2` e `translateY(-1px)`.
  Clarear para `#D4641C` só é permitido quando o rótulo é ≥18px/700. O realce
  coral (`--color-accent-glow`) entra como brilho externo sutil, nunca como
  preenchimento de texto pequeno.
- **Estados:** hover (levantar 1px + sombra); focus-visible (outline 2px
  `--color-focus` + offset 3px); active (fundo `--color-primary-active`,
  `translateY(0)`); disabled (fundo `--color-disabled-bg`, texto
  `--color-disabled-text`, sem sombra, `cursor: not-allowed`); loading (spinner
  branco de 16px, rótulo "Enviando…", `aria-busy="true"`, largura preservada).
- **Acessibilidade:** alvo mínimo 44×44px; nunca apenas cor para indicar estado.

### 6.2 Botão fantasma (outline)

Fundo transparente, contorno `1.5px` em `#101D42` (claro) ou
`rgba(255,255,255,.75)` (navy), texto na cor oposta. Hover: tinta de 5% navy ou
10% branco. Mesmos estados e foco do primário. Ícone opcional à esquerda.

### 6.3 Botão de ícone circular

44×44px, raio pill, contorno `--color-border-strong`, ícone 20px em
`--color-text`. Sobre navy, contorno branco 28%. `aria-label` obrigatório.

### 6.4 Selo de destino (badge)

Fundo `--color-primary-strong` (`#9A4100`), texto branco 12px/700, tracking
`+0.08em`, caixa alta, `padding: 4px 12px`, raio pill, posicionado 16px do topo
e da esquerda da mídia. Variante "Em alta" usa o mesmo preenchimento; variante
neutra usa `--color-surface-strong` com texto `#101D42`. Nunca use
`#D4641C` como fundo de selo com texto de 12px (3.72:1 reprova).

### 6.5 Indicador regional

Chip frosted sobre a foto: fundo `rgba(16,29,66,.55)`, texto branco 12px/600,
tracking `+0.04em`, raio pill, altura 28px, com ponto terracota de 6px antes do
texto. Exemplo de copy: "Presentes no Brasil & Portugal".

### 6.6 Card de destino

- **Anatomia:** mídia 16:10 com sangria no topo e laterais → corpo com padding
  24px → local (18px/700) → UF/país (14px, `--color-text-muted`) → descrição
  14px, 2 linhas com clamp → link "Conhecer destino →" 15px/600 em
  `--color-primary-strong`.
- **Caixa:** fundo branco, raio 16px, `--border-hairline`, `--shadow-1`,
  `overflow: hidden`.
- **Hover:** `--shadow-2`, `translateY(-2px)`, mídia com `scale(1.03)` em
  320ms; link ganha sublinhado. Nada de mudar texto para cinza.
- **Estados:** foco (anel no card inteiro quando o card é link), loading
  (esqueleto com shimmer em `--color-surface-sunken`), empty (bloco de 3
  colunas vira estado vazio com ícone de bússola, título "Ainda não temos
  destinos aqui" e CTA "Falar com um especialista").
- **Conteúdo real:** Andes/Cordilheira (Chile), Costa Verde (Brasil), Dubai
  (Emirados Árabes Unidos), Londres (Reino Unido), Nordeste (Brasil), Marrakech
  (Marrocos), Paris (França), Recife (Brasil), Rio de Janeiro (Brasil).

### 6.7 Barra de busca e filtros

Container branco, raio 24px, `--shadow-1`, padding 8px, divisórias verticais de
1px entre campos. Campo de texto: ícone de busca 20px, placeholder "Pesquisar
destinos…", 15px, sem borda. Selects "Regiões" e "Ordenar" com 15px/500. Botão
de busca é o primário compacto (altura 44px, padding 0 20px). Em mobile, os
campos empilham e o botão ocupa 100%.
Estados: foco (anel `2px rgba(212,100,28,.25)` + borda `#B0500F`), erro (borda
`--color-error`, mensagem 14px abaixo com ícone), disabled (fundo
`--color-disabled-bg`), loading (spinner no botão).

### 6.8 Header global

Fundo `--color-secondary`, altura 72px (64px mobile), container 1240px. Logo
circular + wordmark à esquerda; links brancos 15px/500 com sublinhado terracota
de 2px no item ativo; CTA pill terracota à direita. Sticky com `--shadow-3` ao
rolar. Mobile (≤767px): links e CTA somem e entra um botão “Menu” de 44px
(à direita) que abre um painel suspenso claro com alvos de 44px, construído com
`<details>` nativo — sem JavaScript. Em produção com JS, evolua para painel navy
de tela cheia com foco preso ao painel e botão de fechar com `aria-label`.
Nunca use header branco com texto solto.

### 6.9 Rodapé

Fundo `--color-inverse-bg-deep`, texto branco. Colunas: marca + CADASTUR,
links rápidos, contato (+55 / +351), redes sociais. Títulos de coluna em
12px/700 caixa alta `+0.08em`; links em 14px com `rgba(255,255,255,.72)`.
Divisor `rgba(255,255,255,.16)`. Linha legal em 12px.

### 6.10 Launcher de atendimento

Fixo a 24px da base e da direita, 56×56px, raio pill, fundo
`--color-whatsapp` (`#128C4A`), glifo branco 28px, `--shadow-3`. Hover: fundo
`#0E7A40` + `scale(1.04)`. Foco: anel de 3px branco + contorno navy.
`aria-label="Falar com um especialista no WhatsApp"`. Em mobile, sobe para não
cobrir a barra de navegação.

### 6.11 Paginação

Botões circulares de 44px; ativo em `--color-primary-strong` com texto branco;
demais em `--color-surface` com borda `--color-border`; setas com 44px de alvo.
Estado desabilitado em `--color-disabled-text`.

### 6.12 Mensagens e vazios

- Erro: faixa `--color-error-bg` com texto `--color-error-text`, ícone de
  alerta, 14px, raio 12px.
- Sucesso: faixa `#E6F5EC` com texto `#0B5D31` e ícone de check.
- Vazio: bloco centrado, ícone 32px em `--color-surface-strong`, título 18px,
  apoio 14px em `--color-text-muted` e uma ação primária.

---

## 7. Movimento (Motion)

**Fonte:** inferido do produto (site estático, sem animação documentada) e alinhado às durações de interação do baseline de design; não há biblioteca de motion nas referências.

| Token | Valor | Uso |
| --- | --- | --- |
| `--duration-fast` | 160ms | cor, borda, opacidade |
| `--duration-base` | 220ms | sombra, card hover |
| `--duration-slow` | 320ms | mídia, painéis, menu |
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | entrada e hover |
| `--ease-in` | `cubic-bezier(.4,0,1,1)` | saída |
| `--ease-emphasized` | `cubic-bezier(.2,.8,.2,1)` | transição de página/painel |

Regras: microinterações entre 150–300ms; entradas ≤400ms; saída a 60–70% da
entrada; itens de lista em cascata de 40ms; `translateY` máximo de 2px em
hover de card. Movimento existe para explicar mudança de estado, hierarquia ou
causalidade — nunca como decoração. Com `prefers-reduced-motion: reduce`,
transições caem para 0.01ms e nenhuma animação essencial pode depender de
movimento.

---

## 8. Acessibilidade

- Contraste mínimo 4.5:1 para corpo e 3:1 para texto grande, ícones e gráficos
  essenciais. Os pares homologados estão na seção 2.2; qualquer par novo precisa
  ser medido.
- Foco **sempre visível**: `outline: 2px solid #9A4100; outline-offset: 3px` em
  claro; anel branco de 3px sobre navy. Nunca `outline: none`.
- Teclado: ordem de tabulação segue a leitura; menu mobile prende o foco;
  Esc fecha; o primeiro elemento focável é o "pular para o conteúdo".
- Semântica: `header/nav/main/footer`, um `h1` por página, hierarquia sem
  saltos, `aria-label` em botões de ícone, `aria-current="page"` na navegação,
  `aria-busy` em carregamento, `role="status"` em mensagens dinâmicas.
- Formulários: label visível ou `aria-label`, `autocomplete` correto em
  e-mail/telefone, erro ligado por `aria-describedby` e resumo de erro no topo.
- Imagens: alt descritivo em conteúdo, alt vazio em ornamento. Logo com
  `alt="S23 Travel"`.
- Alvos de toque ≥44×44px e ≥8px de separação.
- Texto sobre foto sempre com scrim (`--scrim-hero`) ou sobreposição sólida.
- Zoom de 200% sem perda de conteúdo; nada de largura fixa em px para texto.

---

## 9. Voz e tom (Voice and tone)

**Fonte:** copy real do hero e do rodapé em `assets/screenshot-1794165842684.png`, títulos de destino na captura do site e legendas dos posts de @s23_travel.

Fala como um concierge experiente: caloroso, direto, sem superlativos vazios.
Português do Brasil, "você", frases curtas. Trata o cliente como viajante, não
como "lead". Nunca promete o que não controla.

| Faça | Evite |
| --- | --- |
| "Onde você quer ir?" | "Descubra destinos incríveis!" |
| "Fale com um especialista" | "Clique aqui" |
| "Atendimento em português nos dois lados do Atlântico" | "Suporte 24/7 de excelência" |
| "A partir de R$ 4.890 por pessoa, com aéreo" | "Preços imperdíveis" |
| "Ainda não temos destinos nessa região" | "Nenhum resultado encontrado." |

Números são reais e verificáveis ou marcados como exemplo. Nunca invente prova
social, certificação ou preço.

---

## 10. Antipadrões (Anti-patterns)

**Fonte:** padrões visuais ausentes nas referências, somados aos antipadrões do baseline de design (o que a marca nunca fez no site e nas campanhas).

- Fundo creme/bege/terracota lavado como superfície padrão — o canvas é
  `#F8FAFB`; terracota é acento.
- Gradiente roxo, ou gradiente em toda camada.
- Inter, Roboto ou Arial como display. Poppins é a voz; Instrument Serif é a
  pausa editorial.
- Card com borda esquerda colorida como callout.
- Ícone ao lado de todo título; vários botões sólidos para a mesma ação.
- Hover que clareia texto até virar cinza.
- Texto branco pequeno sobre `#D4641C`.
- Serifa em corpo, em botão ou em preço.
- Caixa alta sem tracking; display sem tracking negativo.
- Sombra dura preta, borda de 2px por toda parte, canto 0px.
- Emoji como ícone funcional. Use um único conjunto de ícones lineares com
  traço de 1.75px.
- Pessoa ou cena desenhada em SVG como decoração.
- Métricas inventadas ("10× mais rápido", "99,9% de satisfação").
- Placeholder cinza sem tratamento. Se não houver foto, use a moldura editorial
  do sistema com o nome do destino e declare a pendência.

---

## 11. Proveniência e decisões (Provenance)

Detalhamento completo, arquivo por arquivo, em `context/provenance.md`.

- **Paleta:** o `DESIGN.md` de origem trazia duas camadas — uma rampa tonal
  Material (`surface #f4fafd`, `primary #9a4100`) e uma paleta de marca em prosa
  (`#D4641C`, `#101D42`, `#A3CBE1`, `#C7CED0`, `#F8FAFB`). A camada de marca é
  canônica; a rampa tonal virou superfícies de apoio. Onde as duas divergem,
  `context/provenance.md` registra a escolha.
- **Contraste:** o botão primário foi escurecido de `#D4641C` para `#B0500F`
  para atingir 5.25:1 com texto de 15px. O launcher passou de `#25D366` para
  `#128C4A` pelo mesmo motivo.
- **Corpo:** 15px → 16px para leitura em celular.
- **Instrument Serif:** promovida a display editorial (seção 3.2).
- **Dark mode:** não existe nas referências; não foi inventado.
- **Fotografia de destino:** o acervo entregue são peças de campanha com texto
  queimado, não fotos limpas de destino. Os cards usam a moldura editorial do
  sistema até que o acervo fotográfico seja adicionado
  (`context/open-questions.md`).

Detalhamento completo em `context/provenance.md`.

---

## 12. Como usar (How to use)

```html
<link rel="stylesheet" href="./colors_and_type.css" />
```

```css
.cta {
  font: 600 var(--text-button) / var(--text-button-leading) var(--font-sans);
  letter-spacing: var(--text-button-tracking);
  color: var(--color-on-primary);
  background: var(--color-primary);
  border: 0;
  border-radius: var(--radius-pill);
  min-height: 48px;
  padding: 0 var(--space-md);
  transition: var(--transition-control);
}
.cta:hover { background: var(--color-primary-hover); box-shadow: var(--shadow-2); }
```

Checklist de revisão: `SKILL.md` §5.
