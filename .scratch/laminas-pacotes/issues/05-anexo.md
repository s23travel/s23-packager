# Salvar e recuperar a última lâmina

Status: deferred
Blocked by: 02, 03, 04

## Objetivo

Disponibilizar persistência segura para a última lâmina salva de cada pacote e sua recuperação sem nova geração de IA. Uma nova gravação substitui a anterior; alterações do pacote não alteram a lâmina já salva.

## Critérios

- Usuários autorizados podem recuperar e baixar a versão salva; acesso anônimo é negado conforme o modelo do aplicativo. Não criar permissões globais indevidas nem expor segredo no frontend.
- A substituição deve preservar a última versão válida se qualquer etapa falhar; lidar explicitamente com arquivos órfãos e exclusão do pacote sem apagar dados não relacionados.
- Verificar as limitações de grants, RLS e Storage em documentação atual; preparar alterações locais de schema sem aplicá-las remotamente.
- Testar comportamento, erros e contratos usando simulações. Não aplicar migrations, criar buckets ou escrever em produção; registrar a validação real como pendente.

Referência: `../spec.md` e decisão de manter apenas o último anexo.

## Motivo do adiamento

Foi reproduzido que arquivos enviados pelo browser podem contornar validações de cliente: PNG truncado e HTML ativo podem chegar à RPC, que verifica somente existência antes de trocar a versão corrente. A implementação proposta está preservada em commits locais nas branches `work/lamina-anexo`, mas não foi integrada. Há lacunas de validação no servidor e de operação da limpeza automática. O responsável decidiu adiar persistência/anexos na primeira entrega. Retomar somente após escolher e aprovar uma fronteira de renderer/validação confiável e obter um ambiente onde Storage, RLS, permissões, concorrência e limpeza possam ser validados sem risco para clientes.
