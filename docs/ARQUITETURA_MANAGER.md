# Arquitetura do Manager (`/manager`)

Documento técnico da área administrativa do site. Ele cobre **autenticação,
server functions, fluxo de publicar / editar / excluir e dependências**.

A arquitetura de **conteúdo** (como os arquivos Markdown viram páginas em
`/blog`, `/destinos` e `/pacotes`) está em `docs/ARQUITETURA_CARDS.md`.
O Manager é apenas uma camada de publicação sobre aquela mesma fonte de verdade:
editar os arquivos direto no GitHub continua sendo equivalente.

---

## Visão geral

```text
Navegador (/manager)
   │  UI: abas Publicar / Gerenciar + modal de edição
   ▼
Server functions (createServerFn, TanStack Start)
   │  sessão encriptada em cookie (senha única)
   ▼
GitHubService (.server)  ── GitHub Contents API ──▶ repositório
   │
   ▼
content/{blog,destinos,pacotes}/*.md
   │  novo commit dispara build
   ▼
Cloudflare Pages → site atualizado
```

Não existe banco de dados: **o repositório é o CMS**. Toda escrita é um commit.

---

## Camadas e arquivos

| Camada | Arquivo | Responsabilidade |
| ------ | ------- | ---------------- |
| UI | `src/routes/manager.tsx` | Tela de login, abas Publicar/Gerenciar, busca e paginação da listagem |
| UI | `src/components/manager/ContentEditor.tsx` | Modal de edição: campos simples, checkboxes, editores JSON e corpo Markdown |
| RPC | `src/lib/manager.functions.ts` | Login/logout, sessão e **publicação** |
| RPC | `src/lib/manager-content.functions.ts` | **Listar** e **excluir** conteúdo |
| RPC | `src/lib/manager-edit.functions.ts` | **Carregar** e **salvar** edição |
| Orquestração | `src/lib/manager-content.server.ts` | Listagem/exclusão contra o GitHub |
| Orquestração | `src/lib/manager-edit.server.ts` | Leitura + merge + gravação com `sha` |
| Fachada | `src/lib/manager.server.ts` | Re-exporta helpers do GitHubService (compatibilidade) |
| Serviço | `src/lib/services/github.service.server.ts` | Única porta de saída para a API do GitHub |
| Serviço | `src/lib/services/markdown.service.ts` | Parse / build / validação de frontmatter + corpo |
| Tipos | `src/lib/services/content.types.ts` | Tipos compartilhados das seções |
| Client-safe | `src/lib/manager-content.sections.ts` | Metadados das seções usados na UI |

Regra de fronteira: arquivos `*.server.ts` nunca são importados pela UI —
a UI só conversa com `*.functions.ts`.

---

## Autenticação

- **Senha única** em `MANAGER_PASSWORD`, comparada por digest SHA-256 (tempo
  constante) — a senha nunca trafega de volta nem aparece em log.
- Sessão em cookie encriptado (`useSession`), nome `s23-manager`, validade **8h**,
  `httpOnly`, `secure`, `sameSite: "lax"` (necessário para funcionar dentro do
  iframe de preview).
- Segredo de assinatura em `MANAGER_SESSION_SECRET`.
- Toda server function protegida chama a verificação de sessão antes de qualquer
  I/O e lança `UNAUTHORIZED` quando a sessão expirou. A UI trata esse erro
  pedindo novo login em vez de quebrar a tela.

### Variáveis de ambiente

| Variável | Uso |
| -------- | --- |
| `MANAGER_PASSWORD` | Senha de acesso ao `/manager` |
| `MANAGER_SESSION_SECRET` | Chave de encriptação do cookie de sessão |
| `GITHUB_TOKEN` | Token com permissão de escrita em `contents` |
| `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH` | Sobrescrevem o destino padrão dos commits |

---

## Fluxos

### 1. Publicar

1. A UI monta o Markdown (frontmatter + corpo) e chama `managerPublish`.
2. O slug é resolvido nesta ordem: campo explícito → `title` → primeiro `# H1`
   → `title:` do frontmatter. Precisa casar com `^[a-z0-9]+(-[a-z0-9]+)*$`.
3. `GET` no caminho `content/<seção>/<slug>.md`:
   - **200** → arquivo já existe; só prossegue com `overwrite`, reaproveitando o `sha`.
   - **404** → roda um diagnóstico de acesso (owner/repo/branch/token) antes de
     assumir que é arquivo novo. É isso que transforma um 404 genérico em uma
     mensagem acionável.
4. Injeta `publishDate` (hoje) quando ausente — é o campo usado na ordenação
   cronológica das listagens — e `date` para o Blog, por compatibilidade.
5. `PUT` cria/atualiza o arquivo e retorna slug, caminho e link do commit.

### 2. Gerenciar (listar e excluir)

- `managerListContent` devolve os arquivos da pasta da seção; a UI aplica busca
  por texto e paginação de 10 itens.
- `managerDeleteContent` remove o arquivo pelo `sha` atual.
- Sessão expirada na listagem devolve `unauthorized: true` (não lança), para a
  tela conseguir pedir login sem perder o estado.

### 3. Editar

1. `managerGetContent` baixa o arquivo, separa frontmatter e corpo e devolve o
   `sha`. O frontmatter atravessa o limite RPC como **JSON serializado**.
2. O `ContentEditor` mostra campos simples, checkboxes (`published`, `featured`)
   e editores JSON para blocos estruturados (`incluso`, `pagamento`, `roteiro`…).
   Campos obrigatórios de Pacotes (`heroImage`, `cardImage`, `sobre`) são
   marcados com `*`.
3. `managerUpdateContent` faz merge preservando **campos desconhecidos** do
   frontmatter e grava com o `sha` recebido. Se o arquivo mudou no repositório
   nesse meio-tempo, o GitHub rejeita e o conflito é reportado.

---

## Adicionar uma nova seção

As seções são declaradas em dois lugares:
`SECTIONS` em `src/lib/manager.functions.ts` (server) e
`MANAGE_SECTION_OPTIONS` em `src/lib/manager-content.sections.ts` (client).
Acrescentar a chave nos dois, junto com o `z.enum` dos validadores, é suficiente —
o restante do fluxo é genérico.

---

## Decisões de arquitetura

- **Sem banco de dados**: o histórico, o rollback e o diff já vêm do Git.
- **Um único serviço de GitHub**: mudanças de autenticação, headers ou
  diagnóstico acontecem em um arquivo só.
- **Server functions fatiadas por caso de uso** (publicar / gerenciar / editar):
  reduz o risco de uma alteração em um fluxo quebrar os outros.
- **Preservar campos desconhecidos na edição**: o Manager nunca destrói um campo
  criado à mão no Markdown.
- **`sha` obrigatório na escrita**: evita sobrescrita cega de alterações
  concorrentes.
