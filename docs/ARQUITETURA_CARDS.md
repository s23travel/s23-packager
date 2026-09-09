# Arquitetura de conteúdo: /blog, /destinos e /pacotes

Documento técnico sobre como as três seções de conteúdo do site são publicadas,
lidas e renderizadas. Todas seguem hoje **o mesmo padrão**: Markdown em `content/`,
uma engine de leitura em `src/lib/`, listagem com filtro por URL e template dinâmico.

---

## Fluxo geral

```text
Manager (/manager)
      ↓  commit via GitHub Contents API
GitHub (repositório)
      ↓
content/
  blog/       *.md
  destinos/   *.md
  pacotes/    *.md
      ↓  import.meta.glob(..., { query: "?raw", eager: true })
Engines (src/lib/blog.ts · destinos.ts · pacotes.ts)
      ↓
Templates (src/routes/*.index.tsx e *.$slug.tsx)
      ↓
Build Vite → Cloudflare Pages
```

Toda leitura é resolvida em **tempo de build**: não há I/O de filesystem em runtime,
o que mantém a aplicação compatível com SSR/edge.

---

## Visão geral rápida

| Seção      | Origem dos dados                         | Página de detalhe            | Filtros                    |
| ---------- | ---------------------------------------- | ---------------------------- | -------------------------- |
| /blog      | `content/blog/*.md`                      | ✅ template + Markdown       | URL (`?categoria=`)        |
| /destinos  | `content/destinos/*.md`                  | ✅ template + Markdown       | URL (`?categoria=`)        |
| /pacotes   | `content/pacotes/*.md`                   | ✅ template + Markdown       | busca por texto + categoria|

Em todas as seções as **categorias são derivadas dos próprios arquivos** `.md` —
não existe lista fixa em código.

---

## 1. /blog — artigo livre

### Arquivos envolvidos

```
content/blog/*.md              ← 1 arquivo por artigo
src/lib/blog.ts                ← engine: glob + parse do frontmatter
src/routes/blog.tsx            ← layout (apenas <Outlet />)
src/routes/blog.index.tsx      ← listagem com filtro por categoria
src/routes/blog.$slug.tsx      ← template dinâmico /blog/:slug
```

- O **nome do arquivo vira o slug** da URL.
- Frontmatter carrega apenas metadados (`title`, `category`, `date`, `excerpt`,
  `heroImage`, `gallery`, `video`, `faq`, `relatedBanner`…); o corpo Markdown é o
  artigo em si, renderizado com `react-markdown` + `remark-gfm`.
- A listagem usa `Route.useSearch()` com `zodValidator` para ler `?categoria=`,
  deixando o filtro compartilhável e indexável.

Guia de conteúdo: `docs/COMO_ADICIONAR_MATERIA_BLOG.md`.

---

## 2. /destinos — landing page padronizada

### Arquivos envolvidos

```
content/destinos/*.md            ← 1 arquivo por destino
src/lib/destinos.ts              ← engine + categorias derivadas
src/routes/destinos.tsx          ← layout (apenas <Outlet />)
src/routes/destinos.index.tsx    ← listagem com filtro por categoria
src/routes/destinos.$slug.tsx    ← template dinâmico /destinos/:slug
```

- O frontmatter carrega **quase todo o conteúdo estruturado**: `name`, `country`,
  `category`, `shortDesc`, `heroImage`, `resumo`, `atracoes`, `infoUteis`,
  `perfis`, `comoChegar`, `faq`, `cta`, `seoTitle`, `seoDescription`.
- O corpo Markdown é apenas a seção "Sobre o destino".
- Cada bloco do template só é renderizado quando o campo existe no frontmatter.

Guia de conteúdo: `docs/COMO_ADICIONAR_DESTINO.md`.

---

## 3. /pacotes — produto comercial

### Arquivos envolvidos

```
content/pacotes/*.md             ← 1 arquivo por pacote
src/lib/pacotes.ts               ← engine + categorias derivadas + formatação de preço
src/routes/pacotes.tsx           ← layout (apenas <Outlet />)
src/routes/pacotes.index.tsx     ← listagem com busca por texto e seletor de categoria
src/routes/pacotes.$slug.tsx     ← template dinâmico /pacotes/:slug
```

- Frontmatter combina metadados de card (`title`, `category`, `excerpt`, `price`,
  `date`, `cardImage`, `published`, `featured`) e blocos da página interna
  (`incluso`, `naoIncluso`, `sobre`, `roteiro`, `pagamento`, SEO).
- `price` é numérico e formatado pela engine para exibição no card.
- `published: false` esconde o pacote da listagem e da navegação.
- Pacote de referência com todos os blocos preenchidos:
  `content/pacotes/elas-viajam-islandia-2026.md`.

Guia de conteúdo: `docs/COMO_ADICIONAR_PACOTE.md`.

---

## Publicação pelo Manager

Este documento descreve a arquitetura de **conteúdo**. O Manager em si
(autenticação, server functions, fluxos de publicar/editar/excluir e
dependências) está documentado em `docs/ARQUITETURA_MANAGER.md`.

A área administrativa `/manager` cobre as três seções (Blog, Destinos e Pacotes):

- **Publicar** — monta o Markdown (frontmatter + corpo) e cria o arquivo no
  repositório via GitHub Contents API.
- **Gerenciar** — lista os arquivos de cada pasta de `content/`, permite **editar**
  (carrega o arquivo, preserva campos desconhecidos e grava com o `sha` atual) e
  **excluir**.

Camadas envolvidas:

```
src/routes/manager.tsx                     ← UI (abas Publicar / Gerenciar)
src/components/manager/ContentEditor.tsx   ← modal de edição
src/lib/manager*.functions.ts              ← server functions
src/lib/manager*.server.ts                 ← orquestração
src/lib/services/github.service.server.ts  ← toda a comunicação com o GitHub
src/lib/services/markdown.service.ts       ← parse / build / validate do Markdown
src/lib/services/content.types.ts          ← tipos compartilhados das seções
```

Editar arquivos diretamente em `content/` pelo GitHub continua válido — o Manager é
apenas uma camada de conveniência sobre a mesma fonte de verdade.

Detalhes de cada camada acima: `docs/ARQUITETURA_MANAGER.md`.

---

## Decisões de arquitetura

- **`import.meta.glob` com `eager: true`**: embute o conteúdo cru em build, sem
  filesystem em runtime — funciona em SSR/edge (Cloudflare Pages).
- **`content/` fora de `src/`**: reforça que é conteúdo, não código; qualquer
  pessoa não-dev consegue editar.
- **Categorias derivadas dos arquivos**: uma nova categoria surge apenas por
  escrever `category:` em um `.md`, sem cadastro nem alteração de código.
- **Filtro na URL**: em `/blog` e `/destinos` a categoria é um search param
  validado com Zod (compartilhável e indexável). Em `/pacotes` a busca por texto e
  a categoria vivem no estado da listagem.
- **Um template por seção**: 1 template + N arquivos Markdown, em vez de 1 arquivo
  de rota por conteúdo.

---

## Nota histórica

A antiga seção `/grupos` guardava as viagens em módulos TypeScript
(`src/data/grupos.ts` e `src/data/cruzeiros.ts`) e tinha rotas próprias. Ela foi
substituída pela seção `/pacotes` em Markdown. As rotas antigas permanecem no
projeto apenas para não quebrar links já divulgados; **nenhum conteúdo novo deve
ser criado por ali** — todo pacote novo entra em `content/pacotes/`.
