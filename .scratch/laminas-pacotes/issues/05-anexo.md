# Salvar e recuperar a última lâmina

Status: resolved
Blocked by: 02, 03, 04

## Objetivo

Disponibilizar persistência segura para a última lâmina salva de cada pacote e sua recuperação sem nova geração de IA. Renderizar no servidor o HTML e o PNG do mesmo modelo canônico. Uma nova gravação substitui a anterior; alterações do pacote não alteram a lâmina já salva.

## Critérios

- Construir um Worker próprio `s23-flyer-renderer` com binding Browser Run. Não alterar o Worker de produção `s23-packager`.
- O Worker aceita apenas um contrato JSON fechado e recursos raster limitados; escapa texto e gera HTML/CSS controlados pelo servidor, e PNG por screenshot da mesma página com JavaScript e rede externos desativados.
- Edge Function `save-package-flyer` valida o JWT/user permanente, consulta o pacote autorizado, recalcula os dados comerciais do lado servidor e invoca o renderer somente com assinatura serviço-a-serviço. Nunca confiar no modelo de preço/serviços nem em HTML/PNG enviados do cliente.
- A Edge Function cria uma prévia final primeiro, grava HTML/PNG imutáveis em estado staged privado e retorna o PNG para revisão. Só uma ação autenticada posterior, com a mesma chave idempotente, publica o ponteiro da versão atual via transação/CAS; falha em qualquer passo não aposenta a versão anterior. Downloads retornam ambos artefatos da mesma revisão.
- Retry com o mesmo ID reconcilia status e digests sem sobrescrever silenciosamente um arquivo imutável; conflitantes preservam versão ativa e geram tombstone.
- Preparar tombstones duráveis para versões substituídas, uploads falhados e previews staged abandonados (expiração em 24h), além de função server-only para limpeza automática usando a Storage API e Worker cron/schedule local. O schedule só poderá ser ativado após autorização posterior.
- Criar migration e configuração Worker localmente. Não aplicar migration, criar bucket, instalar secrets, implantar Worker/Edge Function, gravar/apagar pacote, nem consultar dados reais neste ticket.
- Testar APIs/handlers com package/renderer/auth/Storage mocks, adversarial files, concorrência, retries, arquivos incompletos e igualdade do modelo/snapshot. Um smoke Browser Run fictício pode validar apenas o binding de navegador, não RLS/Storage real.
- Registrar permissões e pipeline real de limpeza como não validados até haver DEV isolado ou autorização específica para prova em PROD.

Referência: `../spec.md`, `../anexo-renderer-design.md` e decisão de manter apenas o último anexo.

## Comentários

- 2026-11-09: implementado e validado. A Edge Function final é `package-flyer` (prévia/publicação/consulta/download) em vez de `save-package-flyer`.
- Migration `20261109201258_package_flyer_attachments` aplicada em PROD; o bucket privado `s23-package-flyers` foi criado e as ACLs ficaram restritas a `service_role`.
- A função de limpeza `claim_package_flyer_cleanup` precisou de correção forward (`20261109234000_fix_package_flyer_cleanup_ambiguity`) por ambiguidade entre a coluna e o parâmetro de saída no `ON CONFLICT`.
- Worker `s23-flyer-renderer` publicado em workers.dev com Browser Run e cron diário; secrets e URL configurados. O Worker `s23-packager` de produção não foi alterado.
- Teste real em PROD com pacote fictício: prévia 1080×1920, publicação da revisão 1, download HTML/PNG íntegros, substituição para revisão 2, limpeza do par antigo, exclusão do pacote e dos tombstones, fila final vazia. Pacote e utilizador de teste removidos; nenhum dado de cliente foi usado.
