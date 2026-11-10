# Download da lâmina em JPG — design

## Intenção

O botão de download da lâmina deve oferecer JPG real, não apenas trocar o texto enquanto entrega PNG. A prévia e o anexo armazenado continuam sendo PNG; HTML não muda.

## Abordagens

- **Renomear apenas o botão:** simples, mas anuncia JPG e baixa PNG; rejeitada por ser enganosa.
- **Converter no cliente no download (escolhida):** mantém o renderer, a prévia, o armazenamento e contratos remotos existentes; converte a lâmina PNG já baixada para JPEG antes de iniciar o download.
- **Mudar renderer e armazenamento para JPG:** altera o formato persistido, publicação, validação e potencialmente histórico dos anexos; escopo maior sem benefício necessário para o pedido.

## Comportamento e limites

- O botão passa a dizer “Baixar JPG” e o nome do arquivo termina em `.jpg`.
- O cliente converte o PNG baixado usando Canvas/Blob em `image/jpeg`; falhas de descodificação/conversão exibem erro e não iniciam um download falsamente rotulado.
- Prévia aprovada, artefacto persistido, caminho de download remoto e botão HTML permanecem inalterados.
- Validar o fluxo com teste determinístico da conversão/seleção de formato e verificar o fluxo existente sem executar suites que acedam ao Supabase remoto.

## Critérios de aceite

O botão anuncia JPG, o arquivo descarregado tem MIME JPEG e extensão `.jpg`, e os anexos PNG armazenados/prévias continuam funcionando sem migração nem alteração de serviços remotos.
