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
 * Observação comercial obrigatória para o bloco 'pagamento'.
 */
export const S23_OBLIGATORY_PAYMENT_NOTE =
  'Valor por pessoa. Consulte-nos sobre personalizações, pagamento parcelado ou em outras moedas.';

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
export function generatePackageMarkdown(content: StructuredPackageContent): string {
  const lines: string[] = [];

  // Delimitador inicial do frontmatter
  lines.push('---');

  // 1. Metadados Principais (Ordem recomendada em docs/COMO_ADICIONAR_PACOTE.md)
  lines.push(`title: ${formatYamlString(content.title)}`);
  lines.push(`slug: ${formatYamlString(content.slug)}`);
  lines.push(`category: ${formatYamlString(content.category)}`);

  // Imagens
  lines.push(`heroImage: ${formatYamlString(content.heroImage || '')}`);
  lines.push(`cardImage: ${formatYamlString(content.cardImage || '')}`);

  // Preço (numérico sem aspas, ou string com moeda entre aspas)
  if (typeof content.price === 'number') {
    lines.push(`price: ${content.price}`);
  } else {
    // Se for string numérica pura, converte se apropriado, ou formata com aspas
    const num = Number(content.price);
    if (!isNaN(num) && !String(content.price).includes(' ') && !String(content.price).includes('€') && !String(content.price).includes('R$')) {
      lines.push(`price: ${num}`);
    } else {
      lines.push(`price: ${formatYamlString(String(content.price))}`);
    }
  }

  // Data e Excerpt
  if (content.date) {
    lines.push(`date: ${formatYamlString(content.date)}`);
  }
  lines.push(`excerpt: ${formatYamlString(content.excerpt)}`);

  // Booleans de publicação
  lines.push(`published: ${content.published ? 'true' : 'false'}`);
  lines.push(`featured: ${content.featured ? 'true' : 'false'}`);

  // 2. Campos Avançados da Página Interna
  if (content.subtitle) {
    lines.push(`subtitle: ${formatYamlString(content.subtitle)}`);
  }
  if (content.duracao) {
    lines.push(`duracao: ${formatYamlString(content.duracao)}`);
  }
  if (content.origem) {
    lines.push(`origem: ${formatYamlString(content.origem)}`);
  }
  if (content.ctaLabel) {
    lines.push(`ctaLabel: ${formatYamlString(content.ctaLabel)}`);
  }
  if (content.imagemDestaque) {
    lines.push(`imagemDestaque: ${formatYamlString(content.imagemDestaque)}`);
  }

  // 3. Bloco 'incluso'
  // Garante a presença e preservação do item fixo S23
  lines.push('incluso:');
  const items = [...(content.incluso || [])];
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
  if (content.naoIncluso && content.naoIncluso.length > 0) {
    lines.push('naoIncluso:');
    for (const item of content.naoIncluso) {
      lines.push(`  - ${formatYamlString(item)}`);
    }
  }

  // 5. Bloco 'sobre' (Obrigatório)
  lines.push('sobre:');
  lines.push(`  title: ${formatYamlString(content.sobre.title)}`);
  lines.push(`  text: ${formatYamlString(content.sobre.text)}`);
  if (content.sobre.image) {
    lines.push(`  image: ${formatYamlString(content.sobre.image)}`);
  }

  // 6. Bloco 'infoDestino' (Opcional)
  if (content.infoDestino) {
    const hasInfo =
      content.infoDestino.localizacao ||
      content.infoDestino.idiomaCultura ||
      content.infoDestino.clima ||
      content.infoDestino.documentacao;

    if (hasInfo) {
      lines.push('infoDestino:');
      if (content.infoDestino.localizacao) {
        lines.push(`  localizacao: ${formatYamlString(content.infoDestino.localizacao)}`);
      }
      if (content.infoDestino.idiomaCultura) {
        lines.push(`  idiomaCultura: ${formatYamlString(content.infoDestino.idiomaCultura)}`);
      }
      if (content.infoDestino.clima) {
        lines.push(`  clima: ${formatYamlString(content.infoDestino.clima)}`);
      }
      if (content.infoDestino.documentacao) {
        lines.push(`  documentacao: ${formatYamlString(content.infoDestino.documentacao)}`);
      }
    }
  }

  // 7. Bloco 'roteiro' (Opcional, somente se houver programação real)
  if (content.roteiro && content.roteiro.length > 0) {
    lines.push('roteiro:');
    for (const dia of content.roteiro) {
      lines.push(`  - title: ${formatYamlString(dia.title)}`);
      if (dia.desc) {
        lines.push(`    desc: ${formatYamlString(dia.desc)}`);
      }
    }
  }

  // 8. Bloco 'pagamento' (Obrigatório)
  lines.push('pagamento:');
  if (content.pagamento?.valor) {
    lines.push(`  valor: ${formatYamlString(content.pagamento.valor)}`);
  }
  if (content.pagamento?.formas && content.pagamento.formas.length > 0) {
    lines.push('  formas:');
    for (const forma of content.pagamento.formas) {
      lines.push(`    - ${formatYamlString(forma)}`);
    }
  }
  // Preserva estritamente a observação oficial da S23
  lines.push(`  observacao: ${formatYamlString(S23_OBLIGATORY_PAYMENT_NOTE)}`);

  // 9. Custom Info (se houver)
  if (content.customInfo) {
    lines.push(`customInfo: ${formatYamlString(content.customInfo)}`);
  }

  // 10. SEO
  lines.push(`seoTitle: ${formatYamlString(content.seoTitle)}`);
  lines.push(`seoDescription: ${formatYamlString(content.seoDescription)}`);

  // Delimitador final do frontmatter
  lines.push('---');

  // 11. Corpo do Markdown
  // O corpo representa o texto de apresentação do pacote
  const bodyText = content.sobre?.text || content.excerpt || '';
  lines.push('');
  lines.push(bodyText);
  lines.push('');

  return lines.join('\n');
}
