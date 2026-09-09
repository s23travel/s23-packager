# Como adicionar um novo pacote na página /pacotes

Guia passo a passo para publicar um novo pacote de viagem no site S23.
Você não precisa saber programar — basta seguir a receita abaixo.

---

## 1. Onde ficam os pacotes

Todos os pacotes ficam dentro da pasta:

```
content/pacotes/
```

Cada pacote é **um único arquivo** com a extensão `.md` (Markdown).
Cada arquivo `.md` = um pacote publicado.

Também é possível criar/editar pacotes pela área administrativa `/manager`, na seção **Pacotes**.

---

## 2. Nome do arquivo (MUITO IMPORTANTE)

O nome do arquivo vira o endereço (URL) do pacote no site.

Exemplo:
- Arquivo: `elas-viajam-peru-2026.md`
- URL final: `https://seusite.com/pacotes/elas-viajam-peru-2026`

Regras do nome do arquivo:
- Use **apenas letras minúsculas** (a-z), números e hífens `-`.
- **Não** use espaços, acentos, cedilha (ç), maiúsculas ou caracteres especiais.
- **Não** repita um nome que já exista na pasta.
- Termine sempre com `.md`.

✅ Bom: `elas-viajam-islandia-2026.md`
❌ Ruim: `Elas Viajam Islândia.md`

---

## 3. Estrutura do arquivo

Todo arquivo tem **duas partes**:

1. **Cabeçalho (frontmatter)** — dados do pacote, entre duas linhas `---`.
2. **Conteúdo** — o texto descritivo do pacote, abaixo do cabeçalho.

### Modelo completo (copie e cole)

```markdown
---
title: "Elas Viajam: Peru"
slug: "elas-viajam-peru-2026"
category: "Américas"
heroImage: "https://link-da-imagem-de-capa.jpg"
cardImage: "https://link-da-imagem-do-card.jpg"
price: 18900
date: "Agosto 2026"
excerpt: "Frase curta que aparece no card da listagem."
sobre:
  title: "Sobre o Peru"
  text: "Texto de um ou dois parágrafos sobre o destino."
  image: "https://link-da-imagem-do-bloco-sobre.jpg"
published: true
featured: false
---

Escreva aqui o texto de apresentação do pacote.
```

---

## 4. Campos do cabeçalho

### Obrigatórios
- `title` — Nome do pacote (entre aspas).
- `category` — Categoria usada no filtro da página `/pacotes` (ex.: `"Europa"`, `"Américas"`, `"Cruzeiros"`, `"Elas Viajam"`).
- `excerpt` — Resumo curto exibido no card.
- `heroImage` — Imagem de capa da página interna (`https://...` ou `/imagem.jpg` na pasta `public/`).
- `cardImage` — Imagem do card na listagem (`https://...` ou `/imagem.jpg` na pasta `public/`).
- `sobre` — Bloco de apresentação do destino (veja o formato em 4.1). Pelo menos um dos subcampos (`title`, `text` ou `image`) deve estar preenchido.

O Manager bloqueia o salvamento de pacotes sem `heroImage`, `cardImage` ou `sobre`.

### Opcionais (básicos)
- `slug` — Endereço personalizado. Se omitido, é usado o nome do arquivo.
- `price` — Valor numérico ou texto com moeda. Exemplos: `18900`, `"R$ 18.900"`, `"599 €"`, `"US$ 1200"`. Se for apenas número, o site formata como R$. Se o pacote tiver preço em Euro ou Dólar, use aspas: `"599 €"`.
- `customInfo` — Campo de texto livre (Markdown) para informações personalizadas que não se encaixam nos outros blocos (ex: detalhes de traslados, observações específicas de um pacote sem roteiro).
- `date` — Período da viagem em texto livre. Ex.: `"Agosto 2026"`.
- `published` — Use `false` para esconder o pacote do site. Se omitido, o pacote é publicado.
- `featured` — `true` marca o pacote como destaque.

---

## 4.1 Campos avançados da página interna

Com exceção de `sobre` (obrigatório), todos são **opcionais**: cada bloco só aparece na página quando o campo existe.
O pacote `elas-viajam-islandia-2026.md` é o modelo completo de referência.

### Texto e cabeçalho

| Campo | Tipo | Para que serve | Exemplo |
| --- | --- | --- | --- |
| `subtitle` | texto | Frase convidativa abaixo do título, no topo da página. | `"Uma jornada entre vulcões, geleiras e auroras."` |
| `duracao` | texto | Duração exibida no resumo da viagem. | `"10 dias • 8 noites"` |
| `origem` | texto | Cidade de saída do grupo. | `"São Paulo/SP"` |
| `ctaLabel` | texto | Texto do botão de contato. Se omitido, usa o padrão do site. | `"Quero garantir minha vaga"` |
| `imagemDestaque` | URL | Imagem larga usada como destaque no meio da página. | `"https://.../foto.jpg"` |

### `incluso` — lista de itens inclusos

Lista de objetos com `title` (obrigatório), `desc` (opcional) e `icon` (opcional).

```yaml
incluso:
  - icon: "plane"
    title: "Passagem aérea"
    desc: "Voo internacional ida e volta, com taxas."
  - icon: "bed"
    title: "Hospedagem"
    desc: "8 noites em hotéis 4 estrelas."
```

Ícones sugeridos: `plane`, `bed`, `coffee`, `camera`, `shield`, `car`, `users`, `gift`.
Se o ícone for omitido ou desconhecido, o site usa um ícone padrão.

### `naoIncluso` — lista simples de textos

```yaml
naoIncluso:
  - "Despesas pessoais e compras"
  - "Bebidas alcoólicas"
  - "Taxas locais e gorjetas"
```

### `sobre` — bloco de apresentação do destino (OBRIGATÓRIO)

```yaml
sobre:
  title: "Sobre a Islândia"
  text: "Texto de um ou dois parágrafos sobre o destino."
  image: "https://.../destino.jpg"
```

Pelo menos um dos subcampos (`title`, `text` ou `image`) deve estar preenchido.

### `roteiro` — dia a dia da viagem (OPCIONAL)

Se o pacote não for uma excursão com roteiro (ex: apenas hotel + aéreo), basta omitir este campo ou deixá-lo vazio (`roteiro: []`). A seção não aparecerá no site.

Lista de objetos com `title` (obrigatório) e `desc` (opcional). Use um item por dia.

```yaml
roteiro:
  - title: "Dia 1 — Embarque no Brasil"
    desc: "Encontro do grupo no aeroporto e embarque."
  - title: "Dia 2 — Chegada a Reykjavík"
    desc: "Traslado ao hotel e jantar de boas-vindas."
```

### `pagamento` — condições comerciais

```yaml
pagamento:
  valor: "R$ 42.900,00 por pessoa em quarto duplo"
  formas:
    - "À vista com 5% de desconto"
    - "Entrada de 30% + saldo em até 10x"
  observacao: "Valores sujeitos a variação cambial."
```

Use este bloco para o texto comercial detalhado; o campo `price` continua sendo o
valor numérico usado no card da listagem.

### SEO

| Campo | Tipo | Para que serve |
| --- | --- | --- |
| `seoTitle` | texto | Título da aba/Google. Ideal até 60 caracteres. Se omitido, usa o `title`. |
| `seoDescription` | texto | Descrição nos resultados de busca. Ideal até 160 caracteres. Se omitida, usa o `excerpt`. |


---

## 5. Como criar uma nova categoria

As categorias do filtro são geradas **automaticamente** a partir dos arquivos em `content/pacotes/`.

Para criar uma nova categoria (ex.: `"Ásia"`), basta escrever `category: "Ásia"` em qualquer arquivo `.md`. A opção aparece sozinha no filtro da página `/pacotes` — nenhuma alteração de código é necessária.

A opção **"Todos"** é sempre a primeira e as demais ficam em ordem alfabética.

Escreva a categoria **exatamente igual** nos demais arquivos (mesmas letras e acentos), senão será criada uma categoria duplicada com grafia diferente.

---

## 6. Imagens

Duas opções:

**A — imagem hospedada na internet:** cole a URL completa (`https://...`, terminando em `.jpg`, `.png` ou `.webp`).

**B — imagem no projeto:** coloque o arquivo em `public/` e use o caminho `/nome-da-imagem.jpg`.

Proporções recomendadas:
- `heroImage`: 1920×1080 px (16:9).
- `cardImage`: 1200×900 px (4:3).

---

## 7. Passo a passo prático

1. Abra a pasta `content/pacotes/`.
2. Copie um arquivo existente (ex.: `elas-viajam-peru-2026.md`) e renomeie.
3. Preencha os campos do cabeçalho.
4. Escreva o texto do pacote abaixo dos `---`.
5. Salve o arquivo.
6. O pacote aparece automaticamente em `/pacotes` e em `/pacotes/nome-do-arquivo`.

---

## 8. Boas práticas

- Mantenha o `excerpt` com 1 ou 2 frases — cards ficam mais bonitos.
- Use sempre o mesmo padrão de nome de arquivo: `nome-do-pacote-ano`.
- Prefira imagens horizontais e de boa resolução.
- Só mude o `slug` antes de divulgar o link; alterar depois quebra links já compartilhados.
- Use `published: false` enquanto o pacote estiver em preparação.

---

## 9. Erros comuns

- ❌ Esquecer de fechar o cabeçalho com `---`.
- ❌ Escrever `price: 18.900` com ponto — o campo deve ser número puro `18900` ou texto com aspas `"18.900 €"`. O YAML não aceita pontos em números sem aspas.
- ❌ Título com dois-pontos `:` sem aspas.
- ❌ Nome do arquivo com espaços, acentos ou maiúsculas.
- ❌ Categoria escrita de formas diferentes (`"Elas viajam"` vs `"Elas Viajam"`).
- ❌ Link de imagem quebrado ou começando com `http://`.

---

## 10. Exemplos de referência

Veja os arquivos já publicados em `content/pacotes/`:
- `elas-viajam-peru-2026.md`
- `singapura-bali-2026.md`
- `rota-do-proposito-2026.md`
