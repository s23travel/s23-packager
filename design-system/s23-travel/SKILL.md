---
name: s23-travel-design-system
description: Contrato visual e pacote de design system da S23 Travel (viagens entre Brasil e Portugal): tokens de cor e tipografia, Poppins + Instrument Serif, previews e UI kit aplicado. Use ao construir ou revisar qualquer interface da marca.
user-invocable: true
---

# SKILL.md — S23 Travel Design System

## What is inside

Um pacote autossuficiente, sem build e sem dependências:

- `DESIGN.md` — contrato completo (contexto, cor, tipografia, espaçamento,
  componentes, movimento, acessibilidade, voz, antipadrões, proveniência).
- `colors_and_type.css` — 155 tokens e 20 `@font-face` locais.
- `fonts/` — Poppins (18 arquivos) e Instrument Serif (2), com `OFL.txt`.
- `assets/` — logos, favicon, capturas do site e posts de campanha originais.
- `preview/` — 11 cards focados (cor, tipografia, espaçamento, raios/sombras,
  componentes, marca, interface aplicada + 4 cards de foco).
- `ui_kits/app/` — homepage aplicada completa e 7 snippets em `components/`.
- `handoff/` — tokens, fixture autônomo e guia curto para outro repositório.
- `context/` — proveniência e lacunas; `source_examples/` — referência verbatim.

## Source context

As referências vieram da pasta de design do produto: o `DESIGN.md` de origem
(frontmatter tonal + prosa de marca), três logos, favicon, captura do hero de
www.s23.travel, captura da página de destinos, posts de `@s23_travel` e as
fontes completas. Não havia código de componente nem CSS de produção; os
snippets foram escritos para este pacote a partir dos tokens extraídos.
Conflitos e decisões estão em `context/provenance.md`; lacunas em
`context/open-questions.md`.

## When to use

Use este pacote sempre que a tarefa envolver o S23 Travel: páginas de destino,
hero de campanha, busca e filtros, cards de roteiro, áreas de atendimento,
materiais editoriais e revisão de consistência de marca. Não use os tokens para
outra marca e não importe peças de terceiros do acervo (`travel.jpg`).

## How to use

1. Leia `DESIGN.md`, depois `colors_and_type.css`.
2. Copie `colors_and_type.css` e `fonts/` mantendo a estrutura relativa e link
   o CSS no `<head>`.
3. Comece pelos snippets de `ui_kits/app/components/`; componha com o grid de
   12 colunas e o ritmo de 8 pontos.
4. Rode o checklist da seção 5 antes de entregar.

### Ordem de leitura detalhada

1. `DESIGN.md` — contrato completo.
2. `colors_and_type.css` — única fonte de valores.
3. `preview/components.html` — todos os estados renderizados.
4. `preview/applied-ui.html` e `ui_kits/app/index.html` — composição real.
5. `context/provenance.md` e `context/open-questions.md`.

### Importar os tokens

```html
<link rel="stylesheet" href="/colors_and_type.css">
```

- O CSS carrega 20 `@font-face` apontando para `./fonts/...` com
  `font-display: swap`. Se mover o CSS, mova `fonts/` junto.
- Não copie hex para componentes. Use `var(--color-*)`.
- Com Tailwind, mapeie os tokens no tema; não crie uma segunda paleta.

## Design system highlights

- **Terracota `#D4641C`** é acento e display; preenchimento de CTA em texto
  pequeno usa `#B0500F` (5.25:1) e texto/selo usa `#9A4100` (6.71:1).
- **Navy `#101D42`** sustenta header, rodapé e leitura (16.45:1 com branco).
- **Poppins** opera a UI; **Instrument Serif** narra, só em display ≥24px — o
  itálico aparece nas campanhas de `@s23_travel`.
- Pill-first: CTA, selo e paginação em `9999px`; cards em 16px; inputs em 8px.
- Elevação solar: sombras em navy a 5–16%, nunca preto duro.
- Um tema só (claro) com faixas navy; não existe dark mode.

## 3. Regras de composição

1. **Uma coluna de leitura.** Prosa em `max-width: var(--measure)` (68ch).
   Texto sobre imagem em `--measure-narrow` (46ch).
2. **Ritmo.** Seções com `--space-2xl` no desktop e `--space-section-mobile`
   no celular. Nunca invente espaçamento fora da escala.
3. **Grid.** 12 colunas, container 1240px, gutter 24px. Catálogo em 3 / 2 / 1
   colunas (desktop / tablet / mobile).
4. **Hierarquia.** Um `h1` por página. Poppins 700 anuncia, 600 conduz, 400 lê.
   Instrument Serif só em display ≥24px.
5. **Ação.** Uma ação primária por viewport. Secundárias em fantasma.
6. **Profundidade.** Repouso `--shadow-1` + borda hairline; hover `--shadow-2`.
7. **Tema.** Canvas `--color-bg`. Faixas navy usam `--color-inverse-bg` com
   texto branco.
8. **Mídia.** Fotos em moldura `--radius-lg`, proporção 16:10, `--shadow-1`.
   Sem foto limpa, use a moldura editorial `.s23-media` — nunca um retângulo
   cinza.
9. **Estados.** Todo interativo tem default, hover, focus-visible, active,
   disabled. Listas têm loading e empty.
10. **Copy.** Português do Brasil, "você", frases curtas, números verificáveis.

## 4. O que nunca fazer

- Usar `#D4641C` como fundo de texto pequeno ou cor de corpo sobre claro.
- Usar Instrument Serif em corpo, botão, preço, label ou navegação.
- Remover `:focus-visible` ou usar `outline: none` sem substituto visível.
- Inventar tema escuro, gradiente roxo, fundo creme ou sombra preta.
- Criar selo com borda esquerda colorida ou ícone ao lado de todo título.
- Misturar famílias de ícones (o pacote usa traço linear de 1.75).
- Redesenhar, recolorir ou recortar o logo; usar `travel.jpg` no produto.
- Prometer métricas, certificações ou preços que não estão no conteúdo real.
- Publicar caixa alta sem `letter-spacing: 0.06em` ou mais.
- Deixar card ou botão sem foco e sem nome acessível.

## 5. Checklist de revisão

**Cor**

- [ ] Nenhum hex solto em componente; tudo via `var(--color-*)`.
- [ ] Texto pequeno sobre terracota usa `#B0500F` ou `#9A4100`.
- [ ] Pares de contraste conferem com `DESIGN.md` §2.2.

**Tipografia**

- [ ] Poppins em toda UI; Instrument Serif só ≥24px.
- [ ] Corpo ≥16px; 12px só em legenda/selo.
- [ ] Caixa alta com tracking ≥0.06em; display com tracking negativo.
- [ ] No máximo três pesos por tela.

**Layout**

- [ ] Espaçamentos e raios vêm dos tokens.
- [ ] Container 1240px e grid 12/8/4.
- [ ] Nada de sobreposição absoluta de conteúdo; só overlays ancorados.

**Componentes**

- [ ] Estados default, hover, focus-visible, active, disabled presentes.
- [ ] Loading e empty em listas e formulários.
- [ ] Alvos ≥44×44px; `aria-label` em ícones; `aria-busy` em carregamento.
- [ ] Erro ligado por `aria-describedby` e com texto, não só cor.

**Movimento**

- [ ] Durações 150–320ms; entrada ease-out, saída ease-in.
- [ ] `prefers-reduced-motion` respeitado.

**Conteúdo**

- [ ] Copy real, em português, sem lorem ipsum e sem métrica inventada.
- [ ] Logos originais, com área de respiro.
