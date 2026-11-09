# Lacunas e perguntas abertas

Itens sem evidência suficiente nas referências. Nenhum foi inventado como se
fosse fato; onde havia caminho seguro, registramos a decisão e o desvio.

## Bloqueiam qualidade final

1. **Fotografias de destino.** O acervo entregue contém peças de campanha do
   Instagram com texto queimado, não fotos limpas. Faltam imagens de Chile,
   Brasil, Emirados Árabes Unidos, Reino Unido e Marrocos em 16:10.
   *Decisão provisória:* cards usam a moldura editorial `.s23-media` (navy, céu
   ou terracota, com linhas topográficas e o nome do destino em Instrument
   Serif). Não é um placeholder cinza; é um estado desenhado. Ao receber o
   acervo, troque a moldura pela foto e mantenha o selo no canto.

2. **Wordmark.** Existe apenas o símbolo (nuvem + S23). O "s23 travel" do header
   está descrito na captura, mas não foi entregue como vetor. Hoje é texto em
   Poppins 600. Se houver o arquivo oficial, substitua o texto por SVG.

3. **Tema escuro.** Não há dark mode nas referências. Não foi criado. Se for
   necessário, ele precisa de paleta própria validada (não basta inverter o
   claro).

## Conteúdo a confirmar

4. **Navegação.** A captura mostra "Início, Viagens, Destinos, Serviços, Blog";
   o `DESIGN.md` de origem cita outras seções. Usamos a captura. Confirmar os
   rótulos finais e as rotas.

5. **Telefones e e-mail.** `+55 11 4002-8922`, `+351 21 000 0000` e
   `ola@s23.travel` são exemplos plausíveis, não dados confirmados. Substituir
   pelos contatos reais antes de publicar.

6. **CADASTUR.** A referência cita a certificação, mas não o número. Exibimos
   "Cadastur ativo" sem número; não inventamos registro.

7. **Preços e duração dos roteiros.** Nenhum valor foi encontrado. Os cards não
   exibem preço; as descrições citam noites apenas quando a referência citava
   ("8 noites", "10 noites"). Confirmar com o catálogo real.

8. **Campanha réveillon 2027.** A copy "Cinco destinos, cinco formas de começar
   2027" vem do post (S8). O ano deve ser confirmado antes de publicar.

9. **Idioma.** O produto é pt-BR; a referência menciona presença em Portugal.
   Falta a versão pt-PT e a decisão de roteamento por locale.

## Decisões que o time pode rever

10. **Botão primário mais escuro (`#B0500F`).** Necessário para AA em 15px.
    Se a marca exigir `#D4641C` no preenchimento, o rótulo precisa ir a
    ≥18px/700 — o que muda a escala de botões.

11. **Corpo em 16px** (a referência pedia 15px). Reverter só com teste de
    leitura em telas pequenas.

12. **Pesos.** A família Poppins tem 100–900, mas a UI usa 400/600/700.
    Um peso 500 aparece em links de navegação. Pesos 800/900 ficam reservados a
    campanha impressa.

13. **Instrument Serif em itálico** aparece em campanha. Em produto, o uso está
    restrito a display ≥24px; se a marca quiser serifa em produto, isso precisa
    ser decidido explicitamente.

## Arquivos de referência não usados

14. `assets/travel.jpg` (Fareentips), `assets/Travel Agency Software…jpeg` e
    `assets/Travel Banner Template…jpeg` são peças de terceiros. Origem e licença
    não foram fornecidas; ficam fora do produto.
