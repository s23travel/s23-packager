# Criar prévia da lâmina no pacote

Status: resolved
Blocked by: none

## Objetivo

Adicionar a entrada de criação da lâmina ao detalhe do pacote e oferecer uma prévia 9:16 fiel à referência, inicialmente com recursos de exemplo locais. Definir uma interface pública estável para os dados comerciais e o modelo visual, consumível pela geração, exportação e persistência posteriores.

## Critérios

- Mapeamento e validação usam dados do pacote, normalização legada e motor financeiro existentes; não inventam valores, parcelas ou itens nem expõem dados internos.
- Respeitar a nota fixa “por pessoa em quarto duplo”, o visual aprovado, as áreas seguras e os tokens/fontes do kit Travel; a interface interna preserva o kit Packager.
- Itens confirmados têm ícones apropriados; indicar dados ausentes e falhas com texto, sem produzir oferta enganosa.
- Com dados fictícios, testar criação e prévia pela interface pública; não executar chamadas reais de escrita ou IA neste ticket.
- A interface da prévia deve permitir integrar geração, exportação e anexo sem duplicar o template; documentar seu contrato ao concluir.

Referência: `../spec.md` e `../referencia-visual.png`.
