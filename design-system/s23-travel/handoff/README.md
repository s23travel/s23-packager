# handoff — S23 Travel

Quatro arquivos para levar o design system a um repositório.

| Arquivo | O que é |
| --- | --- |
| `tokens.css` | cópia fiel de `../colors_and_type.css` (155 tokens + 20 `@font-face`) |
| `components.html` | fixture autônomo com todos os componentes e estados; sem build |
| `USAGE.md` | ordem de leitura, regras e checklist para o agente |
| `README.md` | este mapa |

## Copiar para um repositório

```
seu-repo/
  tokens.css            <- copie handoff/tokens.css
  fonts/                <- copie ../fonts/ inteiro (Poppins + Instrument_Serif + OFL)
  <seu código>
```

No HTML:

```html
<link rel="stylesheet" href="/tokens.css">
```

O `components.html` já carrega `./tokens.css` inline (cópia com caminhos de fonte
ajustados para `../fonts/`), então ele funciona sozinho quando está em
`handoff/` ao lado de `../fonts/` e `../assets/`. Se mover o arquivo, ajuste
esses dois caminhos.

## O que não copiar

- `assets/travel.jpg` e as peças de terceiros: sem licença registrada.
- Qualquer valor fora de `tokens.css` / `colors_and_type.css`.
- Tema escuro: não existe neste sistema.

## Origem

Todos os valores derivam de `../colors_and_type.css`; qualquer divergência é
bug. As decisões e lacunas estão em `../context/provenance.md` e
`../context/open-questions.md`.
