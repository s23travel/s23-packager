# Data de última atualização nas lâminas

## Intenção
Ao imprimir a lâmina de uma Cotação ou de um Pacote, exibir no canto superior direito a data do último salvamento do registo, em vez da data de criação.

## Objetivos e limites
- Usar `updated_at` como origem da data e `created_at` como fallback.
- Aplicar a mesma regra às lâminas de cotação e pacote.
- Não alterar schema, dados, outros campos de datas da viagem ou a publicação dos serviços.
- Validar com testes offline; não executar testes que escrevam no Supabase.

## Abordagens consideradas
- **Preferida:** alimentar os modelos da lâmina com a data de atualização persistida, preservando fallback para criação. Reflete o último salvamento e não duplica estado.
- Definir a data durante a impressão: incorreto, pois representa a impressão e não o salvamento.
- Guardar uma data manual no conteúdo: duplica timestamp e pode divergir de `updated_at`.

## Decisões e implementação
O fluxo usa modelos separados para cotação e pacote, com validação de contrato no renderer. Propagar `updated_at` (e fallback `created_at`) desde os registos lidos pelo backend aos dois modelos, atualizar a apresentação nos templates/renderer e ajustar os testes offline dos contratos e modelos.

## Ainda a cargo da implementação
Manter o formato visual atual da data e garantir que os contratos da prévia e da lâmina renderizada no servidor aceitam e exibem o novo campo.
