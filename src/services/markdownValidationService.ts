// Serviço de Validação de Arquivo Markdown para o Website S23 (Fase 6B)
// Responsável por garantir que o arquivo .md final gerado:
// 1. Possua frontmatter YAML válido e delimitado por '---'.
// 2. Tenha todos os campos obrigatórios segundo docs/COMO_ADICIONAR_PACOTE.md e docs/ARQUITETURA_MANAGER.md.
// 3. Preserve com exatidão matemática os dados comerciais soberanos (preço, datas, origem, moeda).
// 4. Não contenha placeholders ([hotel], [data]), undefined, null ou NaN.
// 5. Não exponha informações internas (custos, lucro, margem, markup, fornecedores, IDs).
// 6. Contenha o item fixo da S23 e a frase obrigatória de pagamento.

import { StructuredPackageContent } from '../types';
import { S23_FIXED_INCLUSO_ITEM } from './markdownService';

export interface MarkdownValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  extractedFrontmatter?: Record<string, any>;
  extractedBody?: string;
}

/**
 * Termos proibidos que caracterizam vazamento de informações comerciais internas ou técnicas.
 */
const RESTRICTED_INTERNAL_TERMS = [
  'totalcost',
  'cost',
  'custo',
  'profit',
  'lucro',
  'margem',
  'profitpercent',
  'markup',
  'supplier',
  'fornecedor',
  'exchangerate',
  'câmbio interno',
];

/**
 * Expressões de placeholders proibidos.
 */
const PLACEHOLDER_REGEX = /\[(hotel|nome|data|horário|aeroporto|destino|valor|preço|descrição|resumo|transporte)\]/i;

/**
 * Valida o arquivo Markdown gerado contra todas as regras do S23.
 */
export function validatePackageMarkdown(
  markdown: string,
  originalContent?: StructuredPackageContent
): MarkdownValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!markdown || typeof markdown !== 'string' || !markdown.trim()) {
    return { valid: false, errors: ['O conteúdo Markdown está vazio ou indefinido.'] };
  }

  // 1. Verificação de delimitadores do frontmatter '---'
  const frontmatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/);
  if (!frontmatterMatch) {
    return {
      valid: false,
      errors: [
        'Estrutura inválida: o arquivo deve iniciar com "---", conter o bloco frontmatter YAML e fechar com "---".',
      ],
    };
  }

  const rawFrontmatter = frontmatterMatch[1];
  const bodyText = frontmatterMatch[2] ? frontmatterMatch[2].trim() : '';

  // 2. Verificação de Ausência de 'undefined', 'null' ou 'NaN'
  if (markdown.includes('undefined')) {
    errors.push("O arquivo Markdown contém o valor proibido 'undefined'.");
  }
  if (markdown.includes('NaN')) {
    errors.push("O arquivo Markdown contém o valor proibido 'NaN'.");
  }
  if (/\bnull\b/.test(markdown)) {
    errors.push("O arquivo Markdown contém o valor proibido 'null'.");
  }

  // 3. Verificação de Placeholders
  if (PLACEHOLDER_REGEX.test(markdown)) {
    errors.push('O arquivo Markdown contém marcadores/placeholders não preenchidos (ex: [hotel], [data]).');
  }

  // 4. Verificação de Dados Confidenciais / Internos
  // Verifica linhas do frontmatter por chaves proibidas
  const lines = rawFrontmatter.split(/\r?\n/);
  for (const line of lines) {
    const keyMatch = line.match(/^\s*([a-zA-Z0-9_-]+):/);
    if (keyMatch) {
      const keyLower = keyMatch[1].toLowerCase();
      if (RESTRICTED_INTERNAL_TERMS.includes(keyLower)) {
        errors.push(`Informação interna proibida identificada no frontmatter: '${keyMatch[1]}'`);
      }
    }
  }

  // Verifica IDs internos de UUID no markdown (ex: 8-4-4-4-12)
  const uuidRegex = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
  if (uuidRegex.test(markdown)) {
    errors.push('O arquivo Markdown contém identificadores internos do banco de dados (UUID).');
  }

  // 5. Parser de Frontmatter para checagem estrutural
  const frontmatter: Record<string, any> = {};
  parseYamlLines(lines, frontmatter);

  // 6. Campos Obrigatórios Gerais
  if (!frontmatter.title || typeof frontmatter.title !== 'string' || !frontmatter.title.trim()) {
    errors.push("Campo obrigatório 'title' ausente ou vazio no frontmatter.");
  }
  if (!frontmatter.category || typeof frontmatter.category !== 'string' || !frontmatter.category.trim()) {
    errors.push("Campo obrigatório 'category' ausente ou vazio no frontmatter.");
  }
  if (!frontmatter.excerpt || typeof frontmatter.excerpt !== 'string' || !frontmatter.excerpt.trim()) {
    errors.push("Campo obrigatório 'excerpt' ausente ou vazio no frontmatter.");
  }
  if (!frontmatter.slug || typeof frontmatter.slug !== 'string' || !frontmatter.slug.trim()) {
    errors.push("Campo obrigatório 'slug' ausente ou vazio no frontmatter.");
  } else {
    const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    if (!slugRegex.test(frontmatter.slug)) {
      errors.push(`O slug '${frontmatter.slug}' é inválido. Use apenas letras minúsculas, números e hífens.`);
    }
  }

  // 7. Validação de Imagens Obrigatórias no Frontmatter
  if (frontmatter.heroImage === undefined) {
    errors.push("Campo obrigatório 'heroImage' ausente no frontmatter.");
  }
  if (frontmatter.cardImage === undefined) {
    errors.push("Campo obrigatório 'cardImage' ausente no frontmatter.");
  }

  // 8. Tipagem dos Booleans
  if (frontmatter.published !== true && frontmatter.published !== false) {
    errors.push("O campo 'published' deve ser um booleano (true ou false).");
  }
  if (frontmatter.featured !== true && frontmatter.featured !== false) {
    errors.push("O campo 'featured' deve ser um booleano (true ou false).");
  }

  // 9. Bloco Obrigatório 'sobre'
  if (!frontmatter.sobre || typeof frontmatter.sobre !== 'object') {
    errors.push("Bloco obrigatório 'sobre' ausente ou malformatado.");
  } else {
    if (!frontmatter.sobre.title || typeof frontmatter.sobre.title !== 'string') {
      errors.push("Subcampo 'sobre.title' ausente no frontmatter.");
    }
    if (!frontmatter.sobre.text || typeof frontmatter.sobre.text !== 'string') {
      errors.push("Subcampo 'sobre.text' ausente no frontmatter.");
    }
  }

  // 10. Bloco Obrigatório 'pagamento'
  if (!frontmatter.pagamento || typeof frontmatter.pagamento !== 'object') {
    errors.push("Bloco obrigatório 'pagamento' ausente ou malformatado.");
  } else {
    if (!frontmatter.pagamento.observacao || typeof frontmatter.pagamento.observacao !== 'string' || !frontmatter.pagamento.observacao.trim()) {
      errors.push("A observação de pagamento no bloco 'pagamento' é obrigatória e deve estar preenchida.");
    }
  }

  // 11. Bloco 'incluso' e presença do item fixo S23
  if (!Array.isArray(frontmatter.incluso)) {
    errors.push("O campo 'incluso' deve ser uma lista de itens no frontmatter.");
  } else {
    const hasFixedS23 = frontmatter.incluso.some(
      (item: any) =>
        item &&
        typeof item === 'object' &&
        item.title?.trim() === S23_FIXED_INCLUSO_ITEM.title
    );
    if (!hasFixedS23) {
      errors.push(
        `O item fixo obrigatório da S23 ('${S23_FIXED_INCLUSO_ITEM.title}') não foi encontrado no bloco 'incluso'.`
      );
    }
  }

  // 12. Validação contra o StructuredPackageContent original (se fornecido)
  if (originalContent) {
    // Preço
    if (frontmatter.price === undefined) {
      errors.push("Campo obrigatório 'price' ausente no frontmatter.");
    } else {
      const origPrice = originalContent.price;
      const frontPrice = frontmatter.price;

      if (typeof origPrice === 'number') {
        const frontPriceNum = Number(frontPrice);
        if (isNaN(frontPriceNum) || Math.abs(frontPriceNum - origPrice) > 0.001) {
          errors.push(
            `Divergência estrita no preço: original é ${origPrice}, mas o Markdown contém ${frontPrice}. Não é permitida tolerância comercial.`
          );
        }
      } else {
        // Formato string comercial (ex: "610 €" ou "R$ 18.900")
        const cleanOrig = String(origPrice).replace(/\s+/g, ' ').trim();
        const cleanFront = String(frontPrice).replace(/\s+/g, ' ').trim();
        if (cleanOrig !== cleanFront) {
          errors.push(
            `Divergência estrita no preço em texto: original é "${origPrice}", mas o Markdown contém "${frontPrice}".`
          );
        }
      }
    }

    // Slug
    if (frontmatter.slug !== originalContent.slug) {
      errors.push(
        `Divergência de slug: o original é '${originalContent.slug}', mas o Markdown contém '${frontmatter.slug}'.`
      );
    }

    // Título
    if (frontmatter.title !== originalContent.title) {
      errors.push(
        `Divergência no título: o original é "${originalContent.title}", mas o Markdown contém "${frontmatter.title}".`
      );
    }

    // Origem (se houver)
    if (originalContent.origem && frontmatter.origem !== originalContent.origem) {
      errors.push(
        `Divergência na origem: original é "${originalContent.origem}", mas o Markdown contém "${frontmatter.origem}".`
      );
    }

    // Duração (se houver)
    if (originalContent.duracao && frontmatter.duracao !== originalContent.duracao) {
      errors.push(
        `Divergência na duração: original é "${originalContent.duracao}", mas o Markdown contém "${frontmatter.duracao}".`
      );
    }

    // Data (se houver)
    if (originalContent.date && frontmatter.date !== originalContent.date) {
      errors.push(
        `Divergência na data: original é "${originalContent.date}", mas o Markdown contém "${frontmatter.date}".`
      );
    }

    // Observação de pagamento (se definida no originalContent)
    if (originalContent.pagamento?.observacao && frontmatter.pagamento?.observacao) {
      if (frontmatter.pagamento.observacao.trim() !== originalContent.pagamento.observacao.trim()) {
        errors.push(
          `Divergência na observação de pagamento: original é "${originalContent.pagamento.observacao}", mas o Markdown contém "${frontmatter.pagamento.observacao}".`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    extractedFrontmatter: frontmatter,
    extractedBody: bodyText,
  };
}

/**
 * Parser simples e determinístico para o frontmatter YAML dos pacotes S23.
 */
function parseYamlLines(lines: string[], target: Record<string, any>): void {
  let currentArrayKey = '';
  let currentObjKey = '';
  let currentSubItem: Record<string, any> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Ignora linhas vazias ou comentários
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Detecta item de lista com subcampos (ex: '  - icon: "..."' ou '  - "..."')
    if (rawLine.startsWith('  - ')) {
      const itemContent = rawLine.slice(4).trim();

      if (!target[currentArrayKey]) {
        target[currentArrayKey] = [];
      }

      // É uma string simples em array?
      if (itemContent.startsWith('"') || (!itemContent.includes(':') && !itemContent.startsWith('icon:'))) {
        target[currentArrayKey].push(parseYamlValue(itemContent));
        currentSubItem = null;
        continue;
      }

      // É início de um objeto no array
      currentSubItem = {};
      target[currentArrayKey].push(currentSubItem);

      if (itemContent.includes(':')) {
        const colonIdx = itemContent.indexOf(':');
        const k = itemContent.slice(0, colonIdx).trim();
        const v = parseYamlValue(itemContent.slice(colonIdx + 1).trim());
        currentSubItem[k] = v;
      }
      continue;
    }

    // Detecta continuação de propriedades de um objeto dentro de array (indentação 4 espaços: '    desc: "..."')
    if (rawLine.startsWith('    ') && currentSubItem) {
      const subContent = rawLine.trim();
      const colonIdx = subContent.indexOf(':');
      if (colonIdx > 0) {
        const k = subContent.slice(0, colonIdx).trim();
        const v = parseYamlValue(subContent.slice(colonIdx + 1).trim());
        currentSubItem[k] = v;
      }
      continue;
    }

    // Detecta propriedades de objeto simples (indentação 2 espaços: '  title: "..."')
    if (rawLine.startsWith('  ') && !rawLine.startsWith('  - ') && currentObjKey) {
      const subContent = rawLine.trim();
      const colonIdx = subContent.indexOf(':');
      if (colonIdx > 0) {
        const k = subContent.slice(0, colonIdx).trim();
        const valStr = subContent.slice(colonIdx + 1).trim();

        if (!target[currentObjKey]) {
          target[currentObjKey] = {};
        }

        if (valStr === '') {
          // Sub-array dentro de objeto (ex: pagamento.formas:)
          currentArrayKey = k;
          target[currentObjKey][k] = [];
        } else {
          target[currentObjKey][k] = parseYamlValue(valStr);
        }
      }
      continue;
    }

    // Detecta sub-itens de sub-arrays em objetos (indentação 4 espaços: '    - "..."')
    if (rawLine.startsWith('    - ') && currentObjKey && currentArrayKey) {
      const itemVal = parseYamlValue(rawLine.slice(6).trim());
      if (Array.isArray(target[currentObjKey]?.[currentArrayKey])) {
        target[currentObjKey][currentArrayKey].push(itemVal);
      }
      continue;
    }

    // Chaves de nível raiz (ex: 'title: "..."' ou 'sobre:')
    const colonIdx = rawLine.indexOf(':');
    if (colonIdx > 0) {
      const key = rawLine.slice(0, colonIdx).trim();
      const valStr = rawLine.slice(colonIdx + 1).trim();

      currentSubItem = null;

      if (valStr === '') {
        // Objeto ou array raiz
        if (key === 'incluso' || key === 'naoIncluso' || key === 'roteiro') {
          currentArrayKey = key;
          currentObjKey = '';
          target[key] = [];
        } else {
          currentObjKey = key;
          currentArrayKey = '';
          target[key] = {};
        }
      } else {
        currentObjKey = '';
        currentArrayKey = '';
        target[key] = parseYamlValue(valStr);
      }
    }
  }
}

/**
 * Converte valor escalar YAML para tipo nativo TypeScript (string, number, boolean).
 */
function parseYamlValue(val: string): any {
  const trimmed = val.trim();

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;

  // Aspas duplas
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }

  // Aspas simples
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }

  // Número
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== '') {
    return num;
  }

  return trimmed;
}
