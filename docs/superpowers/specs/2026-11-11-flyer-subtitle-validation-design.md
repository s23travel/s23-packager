# Lâminas — validação e recuperação definitiva do subtítulo

## Intenção

Impedir que uma frase de IA razoável seja rejeitada por conter palavras comuns de viagem e interrompa uma geração cuja imagem é válida.

## Diagnóstico

`AI_SUBTITLE_INVALID` só é retornado depois que a frase inicial e a tentativa de recuperação falham em `validSubtitle`. O contrato atual rejeita palavras isoladas como “hotel”, “voos”, “seguro” e “hospedagem”, mesmo sem afirmar que estejam incluídas. Os logs não guardam texto gerado, então não identificam qual palavra acionou o filtro. A falha ocorre no handler Supabase; não é erro de interface.

## Abordagens

- Afrouxar a lista de palavras — escolhido pelo utilizador: deixar de bloquear vocabulário turístico isolado, mantendo limites de formato e a rejeição de afirmações comerciais concretas.
- Manter o filtro e usar frase neutra fixa — seguro e previsível, mas descarta a frase criativa mesmo quando só contém uma palavra legítima de viagem.
- Remover toda validação — rejeitado por permitir preço, inclusões ou promessas comerciais na lâmina.

## Desenho

- Manter o subtítulo entre 3 e 100 caracteres e limitar a pontuação/texto aceitos.
- Substituir o bloqueio de nomes de serviços por regras para afirmações concretas de preço, pagamento, gratuidade ou inclusão/garantia de serviços. Palavras descritivas isoladas não bloqueiam.
- Continuar a pedir uma nova frase ao modelo de texto quando a primeira for inválida. Se ambas falharem por estrutura/comprimento ou por uma promessa concreta, usar uma frase neutra fixa validada como último recurso; não deixar o subtítulo interromper a geração da imagem.
- Nunca registrar texto da IA, destino, prompt, imagem ou chave nos logs. Registar só a categoria de rejeição e se houve fallback.
- Testar frases legítimas com vocabulário de hotel/aéreo/seguro, e rejeições explícitas de preço, gratuidade, inclusões e garantias; testar também o fallback e o handler completo offline.
- Alterar apenas contrato compartilhado, handler, testes e documentação de lâminas. Sem migrations. Publicação da função só após aprovação e testes; commit/push separado conforme autorização habitual.

## Fora de escopo

Não alterar imagem, modelo comercial da lâmina, prompts visuais, autenticação, anexos ou persistência.
