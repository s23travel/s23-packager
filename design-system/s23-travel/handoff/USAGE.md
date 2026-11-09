# USAGE — S23 Travel para o agente de código

Kit de handoff para OpenCode (e qualquer agente que leia arquivos). Deriva
inteiramente do pacote principal; não há valores novos aqui.

## Ordem de leitura

1. `tokens.css` — os tokens. Se você só puder ler um arquivo, leia este.
2. `components.html` — a referência visual de todos os estados.
3. `../DESIGN.md` — o contrato completo (regras, voz, acessibilidade).

## Como importar

Copie `tokens.css` e a pasta `../fonts/` mantendo-os lado a lado, e link:

```html
<link rel="stylesheet" href="/tokens.css">
```

`tokens.css` é idêntico a `../colors_and_type.css`. Não edite um sem o outro.

## Regras de composição

- Fundo de página `--color-bg`; nunca creme, bege ou terracota como fundo.
- Terracota é acento: `--color-primary-strong` para texto, `--color-primary`
  para preenchimento de CTA, `--color-accent` para display e ornamento.
- Poppins em toda a UI. Instrument Serif só em display ≥24px, nunca em corpo,
  botão, preço ou label.
- Corpo em 16px; 12px só em legenda e selo. Caixa alta com tracking ≥0.06em.
- Espaçamento e raio vêm dos tokens. Nada de valores avulsos.
- Um `h1` por página; um CTA primário por viewport.
- Card: raio 16px, borda hairline, `--shadow-1` em repouso, `--shadow-2` no
  hover com `translateY(-2px)`.
- Toda ação tem hover, focus-visible, active e disabled. Listas têm loading e
  empty. Erro sempre com texto, nunca só cor.
- Faixas navy usam `--color-inverse-bg` e texto branco. Não existe dark mode.

## Nunca

- `#D4641C` como fundo de texto pequeno (3.72:1) ou como corpo de texto claro.
- Instrument Serif em UI.
- `outline: none` sem substituto; alvo menor que 44px.
- Redesenhar o logo; usar `travel.jpg` (terceiro) no produto.
- Inventar preço, métrica, certificação ou número de Cadastur.
- Gradiente roxo, sombra preta dura, card com borda esquerda colorida.
- Emoji como ícone funcional. Use SVG linear de traço 1.75.

## Checklist antes de entregar

- [ ] Todos os valores vêm de `var(--...)`.
- [ ] Contraste de texto ≥4.5:1 (≥3:1 em ≥24px e ícones).
- [ ] Foco visível em todo elemento interativo.
- [ ] Estados default, hover, focus, active, disabled implementados.
- [ ] Loading e empty nas listas e formulários.
- [ ] `aria-label` em ícones, `aria-busy` em carregamento, `role="alert"` em erro.
- [ ] Corpo ≥16px, medida ≤68ch, hierarquia de headings correta.
- [ ] `prefers-reduced-motion` respeitado.
- [ ] Copy real em português do Brasil, sem lorem ipsum.
