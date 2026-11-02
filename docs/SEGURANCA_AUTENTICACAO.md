# Restrição de acesso do Packager

## Estado

Em 2026-11-02, a migration `20261102170622_restrict_packager_access.sql` foi aplicada em PROD e registrada no ledger. As duas Edge Functions foram publicadas, o cadastro público desabilitado e o login anônimo confirmado como desativado. Consultas de catálogo confirmaram as restrições nas nove tabelas e 13 RPCs; chamadas anônimas à tabela `packages`, à RPC de saldos e às duas funções retornaram HTTP 401. Não foram feitos testes de escrita nem validados os fluxos autenticados em PROD por esta operação.

As duas funções de IA estão com `verify_jwt = false` no gateway; a autenticação de usuário é verificada pelos handlers publicados. A função remota `publish-package`, fora deste repositório, também está com `verify_jwt = false` e sua implementação consultada não aparenta validar o usuário: permanece inalterada e exige revisão urgente, pois interage com o GitHub. As configurações de Auth e os objetos futuros devem ser monitorados separadamente.

O modelo desejado dá acesso compartilhado aos dados para todos os usuários permanentes cadastrados. Não há isolamento entre usuários. As configurações de Auth e as políticas precisam ser mantidas em conjunto: quem conseguir criar uma conta permanente terá acesso completo.

## O que muda

- As nove tabelas da aplicação têm RLS ativado e permitem acesso apenas a usuários com `auth.uid()` e claim `is_anonymous` igual a `false`. Em sete tabelas concede-se CRUD; `financial_operations` e `financial_transactions` continuam somente leitura direta, com escrita pelas RPCs.
- Revogam-se os privilégios de tabela de `PUBLIC`, `anon` e `authenticated`, concedendo novamente apenas os necessários ao último. `TRUNCATE` não é permitido ao usuário autenticado. `service_role` mantém seus privilégios anteriores.
- As 13 RPCs financeiras existentes recebem validação de usuário permanente no início dos corpos `SECURITY DEFINER`; `PUBLIC` e `anon` perdem execução, e `authenticated` e `service_role` a conservam. A migration falha se alguma assinatura estiver ausente, se o formato do corpo não permitir a inserção ou se o conjunto de políticas não for o esperado; ela não compara integralmente os corpos das RPCs. As funções de trigger deixam de ser executáveis por papéis públicos, sem alterar os triggers.
- `generate-content` e `import-package-image` consultam o Supabase Auth para validar o token antes de processar qualquer conteúdo ou chamar a IA. Falhas de autenticação retornam 401; indisponibilidade da validação retorna 503. Uma chave pública, isoladamente, não é uma sessão.
- Em `supabase/config.toml`, cadastro público e login anônimo estão desabilitados **para o ambiente local**. Essa alteração de arquivo não modifica o projeto remoto.

## Verificações para futuras publicações

1. Confirmar que a nova SPA com login esteja publicada e funcional antes de bloquear `anon`; a versão anterior da SPA deixará de acessar os dados.
2. Auditar todos os consumidores do projeto Supabase, incluindo integrações externas e rotinas que usam a chave `anon`. A restrição bloqueará esses consumidores até serem adaptados; não alterar permissões sem identificar os impactos.
3. No projeto remoto, desabilitar cadastro público em Auth e confirmar que login anônimo está desativado. Isso é uma operação separada da migration. Conferir os usuários existentes e a criação administrativa de novas contas; usuários permanentes existentes mantêm o acesso. Desativar cadastro não revoga contas já criadas.
4. Verificar a configuração de exposição de schemas, outras tabelas/views/funções e permissões efetivas em PROD, além da versão e configuração remota das Edge Functions. A migration se limita aos objetos do Packager conhecidos; não protege objetos externos ou futuros automaticamente. Rever privilégios padrão de novos objetos.
5. Confirmar o ledger com `migration list` e o estado por catálogo antes de aplicar qualquer SQL. Não usar `supabase db push` para reconciliar o histórico. Planejar aplicação da migration, deploy das duas Edge Functions e eventual rollback como operações separadas e autorizadas.
6. Validar primeiro num projeto DEV isolado: consultas e mutações sem sessão, sessão anônima do Auth, usuário permanente, expiração/saída, acesso `service_role`, as 13 RPCs, triggers, importação e geração por IA. Para funções, testar também chamadas só com chave pública e Auth indisponível. Não executar testes de escrita no projeto PROD.
7. Após publicação autorizada, verificar por catálogo políticas/grants, configuração de Auth e gateway e testar cuidadosamente o fluxo autorizado. Não enviar tokens ou dados de clientes para logs ou documentação.

## Teste local sem Supabase

`deno test --node-modules-dir=none --allow-read tests/test_auth_security_local.ts` usa PostgreSQL em memória via PGlite (dependência de teste temporária, baixada pelo cache do Deno) e respostas simuladas para o Auth. Não conecta ao Supabase nem testa o gateway, o runtime implantado, as integrações externas ou a configuração real de Auth. A simulação remove apenas o comando de criação da extensão `pgcrypto`, pois o PostgreSQL usado no teste já fornece `gen_random_uuid()`.
