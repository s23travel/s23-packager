# Condições de pagamento no pacote

Status: resolved
Blocked by: none

## Objetivo

Permitir que a operadora cadastre e edite as condições de pagamento no pacote, preservando os valores já presentes, os rascunhos e os demais dados. Usar o campo textual existente sem inventar parcelas nem alterar cálculos financeiros.

## Critérios

- Pacotes novos, edição e restauração de rascunho preservam o texto cadastrado; campos ausentes ou legados continuam funcionando.
- Salvar o formulário não descarta outras informações do pacote nem modifica cotações existentes.
- Testar comportamentos por interfaces públicas com dados fictícios, sem chamadas de escrita ao Supabase real.
- Não rodar `npm test`, não instalar `tsx` para contornar sua ausência e não tocar em dados de produção.

Referência: `../spec.md`, seções Solução, Decisões de implementação e Decisões de teste.
