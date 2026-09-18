// Serviço Determinístico de Geração de Markdown para o Website S23 (Fase 6B)
// Conforme especificações oficiais em:
// - docs/COMO_ADICIONAR_PACOTE.md
// - docs/ARQUITETURA_MANAGER.md
// - docs/ARQUITETURA_CARDS.md
// - docs/perplexity_space.txt

import { StructuredPackageContent } from '../types';

/**
 * Item fixo e obrigatório da S23 para o array 'incluso'.
 */
export const S23_FIXED_INCLUSO_ITEM = {
  icon: 'gift',
  title: 'Guia exclusivo S23',
  desc: 'Nossas dicas práticas.',
};

/**
 * Observação comercial obrigatória padrão para o bloco 'pagamento'.
 */
export const S23_OBLIGATORY_PAYMENT_NOTE =
  'Valor por pessoa em quarto duplo. Consulte-nos sobre personalizações.';

/**
 * Aviso padrão para o final da descrição do destino (Apresentação Geral).
 */
export const S23_DESTINATION_DISCLAIMER =
  'Anúncio gerado por rotina informática. Confirme informações e condições junto à S23 antes da contratação.';

/**
 * Anexa o aviso padrão de rotina informática ao final do texto sem duplicar.
 */
export function appendDestinationDisclaimer(text?: string): string {
  if (!text || !text.trim()) {
    return S23_DESTINATION_DISCLAIMER;
  }
  const trimmed = text.trim();
  if (trimmed.includes(S23_DESTINATION_DISCLAIMER)) {
    return trimmed;
  }
  return `${trimmed}\n\n${S23_DESTINATION_DISCLAIMER}`;
}

export interface MarkdownGenerationOptions {
  packageData?: any;
  carriers?: string[];
  hotelNames?: string[];
  flightTimes?: string[];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitiza e generaliza deterministicamente o conteúdo público antes da geração de Markdown.
 * NUNCA altera o pacote original ou os dados internos do sistema.
 */
export function sanitizePublicMarkdownContent(
  content: StructuredPackageContent,
  options?: MarkdownGenerationOptions
): StructuredPackageContent {
  // Extrai lista de cias aéreas, horários e hotéis a partir das opções ou de packageData
  const carriersToSanitize = new Set<string>();
  const hotelNamesToSanitize = new Set<string>();
  const flightTimesToSanitize = new Set<string>();

  // Cias comuns
  ['ryanair', 'tap', 'latam', 'azul', 'gol', 'iberia', 'lufthansa', 'easyjet', 'emirates', 'air france', 'klm'].forEach(c => carriersToSanitize.add(c.toLowerCase()));

  if (options?.carriers) {
    options.carriers.forEach(c => c && carriersToSanitize.add(c.trim().toLowerCase()));
  }

  if (options?.hotelNames) {
    options.hotelNames.forEach(h => h && hotelNamesToSanitize.add(h.trim().toLowerCase()));
  }

  if (options?.flightTimes) {
    options.flightTimes.forEach(t => t && flightTimesToSanitize.add(t.trim().toLowerCase()));
  }

  if (options?.packageData) {
    const pd = options.packageData;
    if (Array.isArray(pd.services)) {
      pd.services.forEach((s: any) => {
        if (s.carrier) carriersToSanitize.add(String(s.carrier).trim().toLowerCase());
        if (s.departureTime) flightTimesToSanitize.add(String(s.departureTime).trim().toLowerCase());
        if (s.arrivalTime) flightTimesToSanitize.add(String(s.arrivalTime).trim().toLowerCase());
        if (s.type === 'accommodation' && s.description) {
          hotelNamesToSanitize.add(String(s.description).trim().toLowerCase());
        }
      });
    }
    if (Array.isArray(pd.lodging)) {
      pd.lodging.forEach((l: any) => {
        if (l.name) hotelNamesToSanitize.add(String(l.name).trim().toLowerCase());
      });
    }
  }

  const sanitizeGeneralText = (text?: string): string => {
    if (!text || typeof text !== 'string') return '';
    let result = text;

    // 1. Remove faixas de horários de voos (ex: 15:05 → 19:20 ou 15:05 - 19:20)
    result = result.replace(/\b[0-2]?[0-9]:[0-5][0-9]\s*(?:→|->|-|à|a)\s*[0-2]?[0-9]:[0-5][0-9]\b/gi, '');

    // 2. Remove horários específicos cadastrados ou em contexto de voo
    for (const timeStr of flightTimesToSanitize) {
      if (!timeStr) continue;
      const timeRegex = new RegExp(`\\b${escapeRegex(timeStr)}\\b`, 'gi');
      result = result.replace(timeRegex, '');
    }
    // Remove horários isolados remanescentes de partida/chegada
    result = result.replace(/(?:partida|chegada|saída|pouso|às|as)\s+[0-2]?[0-9]:[0-5][0-9]/gi, '');
    result = result.replace(/\b[0-2]?[0-9]:[0-5][0-9]\b/g, (match) => {
      // Se for um horário específico rastreado nos serviços
      if (flightTimesToSanitize.has(match.toLowerCase())) return '';
      return match;
    });

    // 3. Remove/generaliza nomes de companhias aéreas
    for (const carrier of carriersToSanitize) {
      if (!carrier) continue;
      const carrierRegex = new RegExp(`\\b${escapeRegex(carrier)}\\b`, 'gi');
      result = result.replace(carrierRegex, 'transporte aéreo');
    }

    // 4. Remove/generaliza nomes específicos de hotel
    for (const hotel of hotelNamesToSanitize) {
      if (!hotel) continue;
      const hotelRegex = new RegExp(escapeRegex(hotel), 'gi');
      result = result.replace(hotelRegex, 'hospedagem selecionada');
    }

    // Limpa pontuações órfãs como parênteses vazios ou espaços duplos
    result = result
      .replace(/\(\s*\)/g, '')
      .replace(/\[\s*\]/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,;:])/g, '$1')
      .trim();

    return result;
  };

  // Sanitiza itens inclusos
  const cleanIncluso = (content.incluso || []).map((item) => {
    let cleanTitle = sanitizeGeneralText(item.title);
    let cleanDesc = sanitizeGeneralText(item.desc);

    // Se for item de hospedagem, garantir generalização do título
    if (item.icon === 'bed' || cleanTitle.toLowerCase().includes('hotel')) {
      for (const hotel of hotelNamesToSanitize) {
        if (cleanTitle.toLowerCase().includes(hotel)) {
          cleanTitle = 'Hospedagem em hotel';
        }
      }
      if (/^hotel\s+/i.test(cleanTitle)) {
        cleanTitle = 'Hospedagem em hotel';
      }
    }

    // Se for item de voo, garantir que não sobre companhia aérea ou horários
    if (item.icon === 'plane') {
      cleanTitle = cleanTitle
        .replace(/transporte aéreo\s+transporte aéreo/gi, 'transporte aéreo')
        .replace(/voo da transporte aéreo/gi, 'voo')
        .trim();
    }

    return {
      ...item,
      title: cleanTitle || item.title,
      desc: cleanDesc,
    };
  });

  // Sanitiza bloco sobre e anexa o aviso padrão
  const cleanSobreText = appendDestinationDisclaimer(sanitizeGeneralText(content.sobre?.text));

  return {
    ...content,
    title: sanitizeGeneralText(content.title),
    subtitle: content.subtitle ? sanitizeGeneralText(content.subtitle) : undefined,
    excerpt: sanitizeGeneralText(content.excerpt),
    incluso: cleanIncluso,
    roteiro: content.roteiro?.map((dia) => ({
      ...dia,
      title: sanitizeGeneralText(dia.title),
      desc: sanitizeGeneralText(dia.desc),
    })),
    sobre: {
      ...content.sobre,
      title: sanitizeGeneralText(content.sobre?.title),
      text: cleanSobreText,
    },
    customInfo: content.customInfo ? sanitizeGeneralText(content.customInfo) : undefined,
  };
}

/**
 * Serializa uma string em formato seguro para YAML (usando aspas duplas e escape padrão JSON/YAML).
 */
export function formatYamlString(value: string): string {
  return JSON.stringify(value);
}

/**
 * Retorna o nome do arquivo Markdown derivado exclusivamente do slug validado.
 * Regra: [nome-do-slug].md
 */
export function getMarkdownFileName(content: { slug: string }): string {
  const cleanSlug = content.slug.trim().toLowerCase();
  return `${cleanSlug}.md`;
}

/**
 * Gera de forma 100% determinística o conteúdo do arquivo Markdown (.md)
 * com frontmatter YAML e corpo descritivo a partir do StructuredPackageContent validado.
 */
export function generatePackageMarkdown(
  content: StructuredPackageContent,
  options?: MarkdownGenerationOptions
): string {
  // Aplica generalização determinística para o Markdown público sem afetar dados originais
  const cleanContent = sanitizePublicMarkdownContent(content, options);

  const lines: string[] = [];

  // Delimitador inicial do frontmatter
  lines.push('---');

  // 1. Metadados Principais (Ordem recomendada em docs/COMO_ADICIONAR_PACOTE.md)
  lines.push(`title: ${formatYamlString(cleanContent.title)}`);
  lines.push(`slug: ${formatYamlString(cleanContent.slug)}`);
  lines.push(`category: ${formatYamlString(cleanContent.category)}`);

  // Imagens
  lines.push(`heroImage: ${formatYamlString(cleanContent.heroImage || '')}`);
  lines.push(`cardImage: ${formatYamlString(cleanContent.cardImage || '')}`);

  // Preço (numérico sem aspas, ou string com moeda entre aspas)
  if (typeof cleanContent.price === 'number') {
    lines.push(`price: ${cleanContent.price}`);
  } else {
    // Se for string numérica pura, converte se apropriado, ou formata com aspas
    const num = Number(cleanContent.price);
    if (!isNaN(num) && !String(cleanContent.price).includes(' ') && !String(cleanContent.price).includes('€') && !String(cleanContent.price).includes('R$')) {
      lines.push(`price: ${num}`);
    } else {
      lines.push(`price: ${formatYamlString(String(cleanContent.price))}`);
    }
  }

  // Data e Excerpt
  if (cleanContent.date) {
    lines.push(`date: ${formatYamlString(cleanContent.date)}`);
  }
  lines.push(`excerpt: ${formatYamlString(cleanContent.excerpt)}`);

  // Booleans de publicação
  lines.push(`published: ${cleanContent.published ? 'true' : 'false'}`);
  lines.push(`featured: ${cleanContent.featured ? 'true' : 'false'}`);

  // 2. Campos Avançados da Página Interna
  if (cleanContent.subtitle) {
    lines.push(`subtitle: ${formatYamlString(cleanContent.subtitle)}`);
  }
  if (cleanContent.duracao) {
    lines.push(`duracao: ${formatYamlString(cleanContent.duracao)}`);
  }
  if (cleanContent.origem) {
    lines.push(`origem: ${formatYamlString(cleanContent.origem)}`);
  }
  if (cleanContent.ctaLabel) {
    lines.push(`ctaLabel: ${formatYamlString(cleanContent.ctaLabel)}`);
  }
  if (cleanContent.imagemDestaque) {
    lines.push(`imagemDestaque: ${formatYamlString(cleanContent.imagemDestaque)}`);
  }

  // 3. Bloco 'incluso'
  // Garante a presença e preservação do item fixo S23
  lines.push('incluso:');
  const items = [...(cleanContent.incluso || [])];
  const hasFixed = items.some((i) => i.title.trim() === S23_FIXED_INCLUSO_ITEM.title);
  if (!hasFixed) {
    items.push(S23_FIXED_INCLUSO_ITEM);
  }

  for (const item of items) {
    if (item.icon) {
      lines.push(`  - icon: ${formatYamlString(item.icon)}`);
      lines.push(`    title: ${formatYamlString(item.title)}`);
    } else {
      lines.push(`  - title: ${formatYamlString(item.title)}`);
    }
    if (item.desc) {
      lines.push(`    desc: ${formatYamlString(item.desc)}`);
    }
  }

  // 4. Bloco 'naoIncluso'
  if (cleanContent.naoIncluso && cleanContent.naoIncluso.length > 0) {
    lines.push('naoIncluso:');
    for (const item of cleanContent.naoIncluso) {
      lines.push(`  - ${formatYamlString(item)}`);
    }
  }

  // 5. Bloco 'sobre' (Obrigatório)
  lines.push('sobre:');
  lines.push(`  title: ${formatYamlString(cleanContent.sobre.title)}`);
  lines.push(`  text: ${formatYamlString(cleanContent.sobre.text)}`);
  if (cleanContent.sobre.image) {
    lines.push(`  image: ${formatYamlString(cleanContent.sobre.image)}`);
  }

  // 6. Bloco 'infoDestino' (Opcional)
  if (cleanContent.infoDestino) {
    const hasInfo =
      cleanContent.infoDestino.localizacao ||
      cleanContent.infoDestino.idiomaCultura ||
      cleanContent.infoDestino.clima ||
      cleanContent.infoDestino.documentacao;

    if (hasInfo) {
      lines.push('infoDestino:');
      if (cleanContent.infoDestino.localizacao) {
        lines.push(`  localizacao: ${formatYamlString(cleanContent.infoDestino.localizacao)}`);
      }
      if (cleanContent.infoDestino.idiomaCultura) {
        lines.push(`  idiomaCultura: ${formatYamlString(cleanContent.infoDestino.idiomaCultura)}`);
      }
      if (cleanContent.infoDestino.clima) {
        lines.push(`  clima: ${formatYamlString(cleanContent.infoDestino.clima)}`);
      }
      if (cleanContent.infoDestino.documentacao) {
        lines.push(`  documentacao: ${formatYamlString(cleanContent.infoDestino.documentacao)}`);
      }
    }
  }

  // 7. Bloco 'roteiro' (Opcional, somente se houver programação real)
  if (cleanContent.roteiro && cleanContent.roteiro.length > 0) {
    lines.push('roteiro:');
    for (const dia of cleanContent.roteiro) {
      lines.push(`  - title: ${formatYamlString(dia.title)}`);
      if (dia.desc) {
        lines.push(`    desc: ${formatYamlString(dia.desc)}`);
      }
    }
  }

  // 8. Bloco 'pagamento' (Obrigatório)
  lines.push('pagamento:');
  if (cleanContent.pagamento?.valor) {
    lines.push(`  valor: ${formatYamlString(cleanContent.pagamento.valor)}`);
  }
  if (cleanContent.pagamento?.formas && cleanContent.pagamento.formas.length > 0) {
    lines.push('  formas:');
    for (const forma of cleanContent.pagamento.formas) {
      lines.push(`    - ${formatYamlString(forma)}`);
    }
  }
  // Utiliza a observação salva/editada pelo operador, ou o padrão oficial da S23
  const paymentNote =
    (cleanContent.pagamento?.observacao && cleanContent.pagamento.observacao.trim())
      ? cleanContent.pagamento.observacao.trim()
      : S23_OBLIGATORY_PAYMENT_NOTE;
  lines.push(`  observacao: ${formatYamlString(paymentNote)}`);

  // 9. Custom Info (se houver)
  if (cleanContent.customInfo) {
    lines.push(`customInfo: ${formatYamlString(cleanContent.customInfo)}`);
  }

  // 10. SEO
  lines.push(`seoTitle: ${formatYamlString(cleanContent.seoTitle)}`);
  lines.push(`seoDescription: ${formatYamlString(cleanContent.seoDescription)}`);

  // Delimitador final do frontmatter
  lines.push('---');

  // 11. Corpo do Markdown
  // O corpo representa o texto de apresentação do pacote (com aviso no final)
  const bodyText = cleanContent.sobre?.text || cleanContent.excerpt || '';
  lines.push('');
  lines.push(bodyText);
  lines.push('');

  return lines.join('\n');
}
