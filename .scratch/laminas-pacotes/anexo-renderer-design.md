# Desenho: anexar a última lâmina com renderização confiável

Status: aprovado, implementado e validado; SPA ainda não publicada

## Intenção

Permitir recuperar do pacote a última lâmina salva em HTML e PNG, sem nova geração de IA, e garantir que os dois arquivos correspondem ao mesmo modelo revisado. A regra comercial continua derivada do pacote; a IA só fornece imagem e subtítulo que a operadora revisa.

## Objetivos

- Impedir que HTML/PNG arbitrários enviados pelo navegador substituam uma lâmina válida.
- Renderizar ambos os artefatos de uma representação canônica, usando template versionado e recursos confiáveis.
- Preservar a versão ativa se gerar, enviar, validar ou publicar a nova falhar; tolerar retries e concorrência.
- Manter um único anexo atual por pacote e preparar reconciliação/limpeza automática.
- Manter alterações de DB e Storage em migrações locais até que o responsável autorize sua aplicação.

## Não objetivos

- Alterar ou publicar o Worker `s23-packager` que atende `packager.s23.travel`.
- Aplicar migration, criar bucket, gravar pacote de teste ou operar dados compartilhados sem nova autorização.
- Publicar no WhatsApp ou redes sociais.

## Abordagens consideradas

1. **Cloudflare Browser Run em Worker separado — escolhida.** Uma Edge Function Supabase autenticada valida sessão e pacote, cria um modelo público canônico, chama por canal serviço-a-serviço um Worker isolado com Browser Rendering e recebe PNG/HTML criados a partir do mesmo documento confiável. A Edge Function envia os artefatos a paths imutáveis num bucket privado e publica atomicamente o ponteiro da última versão numa transação Postgres. Preserva o template browser com maior fidelidade, mas adiciona serviço, segredo de integração, processamento cobrado e configuração operacional.
2. **Renderização em SVG/WASM na Edge Function — rejeitada por agora.** Evita um serviço extra, mas exigiria reimplementar o template CSS como SVG e manter duas versões visuais; Supabase documenta 2 segundos de CPU por pedido e 256 MB, e alerta sobre limites em processamento de imagem. Risco maior de não reproduzir fielmente a peça ou exceder limites.
3. **Aceitar e validar os arquivos enviados pelo cliente — rejeitada.** Os testes reproduziram PNG truncado e HTML com SVG ativo que passam pelas verificações atuais; uma RPC que confere só existência permite substituir a versão válida. Validação de formato/MIME no browser não é uma fronteira confiável.

## Arquitetura proposta

1. A UI envia à Edge Function apenas o ID do pacote, a imagem raster da IA revisada, o subtítulo revisado, uma chave idempotente e a revisão esperada. A Edge Function devolve uma prévia PNG final produzida pelo servidor; a UI só oferece publicar o anexo depois da confirmação explícita dessa prévia.
2. A Edge Function chama `requireUser`, recusa usuário anônimo, lê o pacote sob autorização, valida os dados e produz o modelo comercial canônico. O modelo é recalculado a partir do pacote; preço, moeda, datas, origem, destino, pagamentos e itens não são confiados ao browser. A imagem é limitada em bytes/dimensões e validada; o subtítulo é texto escapado, nunca markup.
3. A Edge Function chama somente o Worker dedicado `s23-flyer-renderer` por autenticação serviço-a-serviço. O Worker recebe um schema fechado, imagem em bytes e versão de template; não busca URL arbitrária, não recebe HTML/CSS do usuário e não contém credenciais Supabase.
4. O Worker constrói o HTML com o template/assets versionados, bloqueia scripts e rede e abre o documento isolado com Browser Rendering. Retorna o HTML autônomo e um PNG 1080×1920 rasterizado dessa mesma página. Nenhum browser público acessa o endpoint diretamente.
5. Na prévia, a Edge Function valida contrato/dimensões e grava HTML/PNG em paths imutáveis privados, marcando a operação staged sem mover o ponteiro atual. Após a confirmação, uma RPC transacional aplica lock/CAS, aponta para esse par, aposenta a versão anterior e cria tombstones de limpeza. Idempotência reconcilia timeout sem apagar objeto ativo. HTML é entregue como anexo, nunca executado na origem da SPA.
6. Um Worker agendado chama operação server-only para remover tombstones pela Storage API; operações staged abandonadas expiram em 24 horas. A rotina/configuração existe apenas localmente, mas **não é agendada nem ativada externamente sem aprovação e validação posterior**.

## Ambiente e validação

- O Cloudflare MCP confirmou um Worker existente `s23-packager` no hostname `packager.s23.travel`; ele permanece intocado. Preparar outro Worker, dedicado e workers.dev, com Browser Rendering binding e cron apenas configurado localmente.
- Foi feita uma chamada Browser Run com HTML fictício: o serviço retornou PNG 1080×1920, sem alterar recurso persistente. Isso prova que a integração MCP/browser funciona, não que o Worker de aplicação ou o pipeline com Supabase esteja implantado.
- O usuário declarou que a conta está no plano Free. O endpoint de subscriptions exigiu escopo Billing Read, não concedido; portanto o plano efetivo e o uso não puderam ser confirmados via API. Browser Run Free documenta 10 minutos por dia; Paid inclui 10 horas mensais e cobra o excedente. A fatura total não é conhecida.
- Testes determinísticos com pacotes/imagens fictícios e serviços Storage/Auth/Browser Binding simulados cobrem adulteração, tamanhos/formatos, modelo, pares de artefatos, CAS, falha em cada etapa, timeout, retry idempotente, concorrência, exclusão e reconciliação. O bundle do Worker passa por `wrangler deploy --dry-run`; o smoke Browser Run fictício verifica somente o serviço remoto, não a integração do Worker.
- Nenhum teste de mock valida JWT real, RLS/grants, Storage, Browser Binding remoto, worker schedule, cleanup ou consistência transacional real. Este checkout aponta para produção e não há DEV isolado. Aplicar migration, criar bucket, implantar novo Worker/funções, configurar secrets/schedule e gravar/remover um pacote de teste **exigem autorização explícita específica**.

## Chamadas de implementação

- Isolar o renderer em diretório/projeto Worker próprio, com configuração Wrangler local e binding Browser; não editar o Worker de produção.
- A autenticação e o acesso ao banco ficam na Edge Function Supabase existente em arquitetura, com service-role somente no servidor e autorização explícita do pacote. `FLYER_RENDERER_URL`, `FLYER_RENDERER_SHARED_SECRET` e `FLYER_CLEANUP_SHARED_SECRET` são secrets/configuração server-side; no Worker, `RENDERER_SHARED_SECRET`, `CLEANUP_FUNCTION_URL` e `CLEANUP_SHARED_SECRET`. Nenhum valor real vai ao Git.
- O renderer é fonte da verdade dos bytes salvos; nem output de exportação browser nem URL assinada fornecidos pelo cliente são aceitos para publicação.
- A prévia final grava um par staged privado. O usuário confirma a imagem PNG; apenas a chamada seguinte publica o ponteiro para esses bytes. Staged não confirmado vence em 24 horas.
- Migração é forward-only e versionada localmente segundo o fluxo atual do repositório; não executar `db push` nem aplicá-la na produção nesta etapa.
- Novas tabelas públicas têm RLS e grants próprios; funções `SECURITY DEFINER` exigem checagem explícita de usuário/argumentos, `search_path` fixo, ACLs restritas e revisão de policies permissivas concorrentes. A limpeza usa Storage API, não DELETE SQL em `storage.objects`.

## Arquivos e validação local

- Renderer: `workers/flyer-renderer/` (`wrangler.jsonc`, `src/index.ts`, `src/assets.d.ts`). Nome proposto `s23-flyer-renderer`, binding `BROWSER`, cron `0 3 * * *` apenas na configuração local.
- Backend: `supabase/functions/package-flyer/`, `supabase/functions/cleanup-package-flyer/`, `supabase/functions/_shared/packageFlyerModel.ts`.
- Frontend: `src/services/packageFlyerAttachmentService.ts`, `src/services/packageFlyerMarkup.ts`, `src/components/packages/PackageFlyerTemplate.tsx`, `src/components/packages/PackageFlyerCreator.tsx`.
- Migration: `supabase/migrations/20261109201258_package_flyer_attachments.sql` (não aplicada).
- Modelo: `createPackageFlyerServerModel` reutiliza `createPackageFlyer`, o mesmo cálculo da prévia local, para não existirem duas regras comerciais. `tsconfig` ganhou `allowImportingTsExtensions` e os imports compartilhados foram ajustados para `.ts`.
- Executado nesta etapa: `npm exec -- tsc --noEmit`; `deno check` das duas Edge Functions; `deno run --no-config tests/test_package_flyer_persistence.ts` (modelo, escaping, imagem inválida, campo forjado, prévia, saída de renderer adulterada, conflito, concorrência, publicação, idempotência, falha de Storage); `node tests/package_flyer_flow.runner.mjs` (fluxo de UI com APIs simuladas); `npx wrangler deploy --config workers/flyer-renderer/wrangler.jsonc --dry-run` (bundle 527 KiB gzip 258 KiB).
- Não executado: deploy, secrets, migration aplicada, bucket criado, cron ativado, Browser Binding remoto, Storage/RLS reais.

## Implantação (executada em 2026-11-09)

1. Migration `20261109201258_package_flyer_attachments` aplicada; bucket privado criado. Correção forward `20261109234000_fix_package_flyer_cleanup_ambiguity` aplicada em seguida.
2. Worker `s23-flyer-renderer` publicado em `https://s23-flyer-renderer.contato-83c.workers.dev/render` com Browser Run e cron diário. Wrangler 4 falhou no endpoint novo `workers/workers` (HTTP 500); `wrangler@3` publicou pelo endpoint legado. Registar isto ao atualizar o Wrangler.
3. Secrets do Worker `RENDERER_SHARED_SECRET`, `CLEANUP_FUNCTION_URL`, `CLEANUP_SHARED_SECRET` definidos.
4. `package-flyer`, `cleanup-package-flyer` e `generate-flyer-ai` publicados; `FLYER_RENDERER_URL`, `FLYER_RENDERER_SHARED_SECRET`, `FLYER_CLEANUP_SHARED_SECRET` definidos.
5. Teste real com pacote fictício aprovado: prévia 1080×1920, revisão 1, download HTML/PNG verificados, substituição para revisão 2, limpeza do par antigo, exclusão do pacote e tombstones, fila vazia. Worker sem credencial devolve 401. Pacote/utilizador de teste removidos.
6. Pendente: publicar a SPA (push para `main`) para a UI usar o anexo.

## Aprovação e limites

1. Aplicar a migration pelo procedimento de release aprovado; ela falha de propósito se já existir bucket incompatível.
2. Publicar o Worker: `npx wrangler deploy --config workers/flyer-renderer/wrangler.jsonc` (cria também o cron).
3. Definir secrets do Worker `RENDERER_SHARED_SECRET`, `CLEANUP_FUNCTION_URL`, `CLEANUP_SHARED_SECRET`.
4. Publicar `package-flyer` e `cleanup-package-flyer`; definir `FLYER_RENDERER_URL`, `FLYER_RENDERER_SHARED_SECRET`, `FLYER_CLEANUP_SHARED_SECRET`.
5. Testar com um pacote fictício revisado e verificar Storage privado, conflito de revisão, download do par e limpeza de um tombstone.

## Aprovação e limites

O responsável aprovou usar Cloudflare Browser Rendering e a integração Cloudflare, informando que pretende começar no Free. A integração confirmou o Worker `s23-packager` de produção, que permanece intocado, e um Browser Run smoke fictício retornou PNG 1080×1920. O plano não pôde ser verificado pela integração porque o escopo Billing Read não está autorizado. O desenho está aprovado para código local e testes simulados; implantação, secrets, migration aplicada, provisionamento de bucket, agendamento de cleanup e gravação/remoção de pacote de teste em PROD continuam exigindo autorização específica.
