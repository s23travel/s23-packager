import { normalizeLegacyToNewStructure } from './legacyAdapterService';
import {
  ContentGenerationInput,
  Currency,
  Package,
  PackageData,
  Quotation,
  SanitizedWebServiceItem,
  ServiceItem,
  StructuredPackageContent,
  WebsiteContentPayload,
} from '../types';

export const OBRIGATORIO_PAGAMENTO_OBSERVACAO =
  'Valor por pessoa. Consulte-nos sobre personalizações, pagamento parcelado ou em outras moedas.';

export const OBRIGATORIO_ITEM_INCLUSO_S23 = {
  icon: 'gift',
  title: 'Guia exclusivo S23',
  desc: 'Nossas dicas práticas.',
};

/**
 * Sanitiza observações de serviços para publicação web (Fase 6A).
 * Se a nota contiver termos de custos, fornecedores, localizadores, códigos internos
 * ou qualquer indício de backoffice, a nota é omitida (retorna undefined).
 */
export function sanitizePublicNote(note?: string | null): string | undefined {
  if (!note || typeof note !== 'string') return undefined;
  const trimmed = note.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  const internalBlacklist = [
    'custo', 'cost', 'net', 'bruto', 'líquido', 'liquido',
    'fornecedor', 'supplier', 'operadora', 'parceiro',
    'b2b', 'comissao', 'comissão', 'markup', 'margem', 'profit',
    'pnr', 'locator', 'localizador', 'gds', 'voucher interno',
    'reserva b2b', 'bloqueio', 'tarifa acordo', 'tarifa confidencial',
    'privado', 'interno', 'não divulgar', 'nao divulgar', 'sigiloso',
  ];

  for (const term of internalBlacklist) {
    if (lower.includes(term)) {
      return undefined; // Não envia nota potencialmente interna
    }
  }

  return trimmed;
}

/**
 * Constrói explicitamente o payload comercial sanitizado a partir de PackageData (Fase 6A).
 * Garante que dados operacionais sejam derivados de services[] e que custos/lucros/fornecedores
 * NUNCA cheguem à IA.
 */
export function buildWebsiteContentPayload(
  packageData: PackageData,
  metadata?: { id?: string; name?: string; reference?: string; currency?: Currency }
): WebsiteContentPayload {
  // 1. Determina destination e services: se novo, usa direto; se legado, normaliza em memória
  let destination = packageData.destination?.trim() || '';
  let services = Array.isArray(packageData.services) ? packageData.services : [];

  if (services.length === 0) {
    const normalized = normalizeLegacyToNewStructure(packageData);
    services = normalized.services || [];
    if (!destination && normalized.destination) {
      destination = normalized.destination;
    }
  }

  // 2. Extrai preço de venda comercial público (NUNCA custos ou margens)
  const publicSalePrice =
    typeof packageData.financials?.salePrice === 'number'
      ? packageData.financials.salePrice
      : typeof packageData.financials?.priceTotal?.amount === 'number'
      ? packageData.financials.priceTotal.amount
      : 0;

  // 3. Mapeia estritamente metadados descritivos públicos para SanitizedWebServiceItem
  const sanitizedServices: SanitizedWebServiceItem[] = services.map((s: ServiceItem) => {
    return {
      type: s.type,
      description: s.description,
      destination: s.destination || undefined,
      carrier: s.carrier || undefined,
      departureTime: s.departureTime || undefined,
      arrivalTime: s.arrivalTime || undefined,
      quantity: s.quantity && s.quantity > 1 ? s.quantity : undefined,
      mealPlan: s.mealPlan || undefined,
      notes: sanitizePublicNote(s.notes),
    };
  });

  return {
    packageName: metadata?.name || '',
    reference: metadata?.reference || '',
    destination,
    dates: packageData.dates,
    passengers: packageData.passengers,
    durationDays: packageData.dates?.durationDays,
    durationNights: packageData.dates?.durationNights,
    services: sanitizedServices,
    publicSalePrice,
    currency: metadata?.currency || packageData.financials?.currency || 'EUR',
    paymentConditions: packageData.paymentConditions,
    customNotes: packageData.customNotes,
  };
}

/**
 * Constrói o input seguro para a IA a partir de um Package ou Quotation.
 * Garante que custos internos, lucro, margem e dados confidenciais NUNCA sejam enviados à IA.
 */
export function buildContentGenerationInput(source: {
  package?: Package;
  quotation?: Quotation;
}): ContentGenerationInput {
  if (source.quotation) {
    const q = source.quotation;
    const d = q.data || {};

    const dest =
      d.destination?.trim() ||
      d.lodging?.[0]?.destination?.trim() ||
      d.outboundTransport?.route?.split('→')[1]?.trim() ||
      d.outboundTransport?.route?.split('-')[1]?.trim() ||
      d.originPackageName ||
      q.reference;

    const origin =
      d.outboundTransport?.route?.split('→')[0]?.trim() ||
      d.outboundTransport?.route?.split('-')[0]?.trim() ||
      '';

    const salePrice =
      typeof d.financials?.salePrice === 'number'
        ? d.financials.salePrice
        : typeof d.financials?.priceTotal?.amount === 'number'
        ? d.financials.priceTotal.amount
        : 0;

    const includedServices: string[] = [];
    if (d.outboundTransport?.route) {
      includedServices.push(`Transporte de ida: ${d.outboundTransport.route}`);
    }
    if (d.inboundTransport?.route) {
      includedServices.push(`Transporte de volta: ${d.inboundTransport.route}`);
    }
    if (d.lodging?.[0]?.name) {
      includedServices.push(
        `Hospedagem em ${d.lodging[0].name} (${d.lodging[0].mealPlan || 'Regime padrão'})`
      );
    }
    if (d.transferService) {
      includedServices.push(d.transferService);
    }
    d.additionalServices
      ?.filter((s) => s.included)
      .forEach((s) => includedServices.push(s.name));

    const notIncludedServices: string[] = [];
    if (d.localTaxNotes) {
      notIncludedServices.push(`Taxa local na hospedagem: ${d.localTaxNotes}`);
    }
    d.additionalServices
      ?.filter((s) => !s.included)
      .forEach((s) => notIncludedServices.push(s.name));

    return {
      sourceType: 'quotation',
      sourceId: q.id,
      reference: q.reference,
      name: d.originPackageName || q.reference,
      destination: dest,
      origin: origin || undefined,
      durationDays: d.dates?.durationDays,
      startDate: d.dates?.startDate,
      endDate: d.dates?.endDate,
      hotelName: d.lodging?.[0]?.name,
      mealPlan: d.lodging?.[0]?.mealPlan,
      nights: d.lodging?.[0]?.nights || d.dates?.durationNights,
      salePrice,
      publicSalePrice: salePrice,
      currency: q.currency,
      includedServices,
      notIncludedServices,
      paymentConditions: d.paymentConditions,
      customNotes: d.customNotes,
      localTaxNotes: d.localTaxNotes,
      transferService: d.transferService,
    };
  }

  if (source.package) {
    const p = source.package;
    const d = p.data || {};

    // 1. Gera o payload comercial sanitizado (utiliza services[] ou normaliza legado em memória)
    const payload = buildWebsiteContentPayload(d, {
      id: p.id,
      name: p.name,
      reference: p.reference,
      currency: p.base_currency,
    });

    // 2. Extrai dados contextuais dos serviços sanitizados
    const outboundService = payload.services.find((s) => s.type === 'outbound_transport');
    const inboundService = payload.services.find((s) => s.type === 'inbound_transport');
    const lodgingServices = payload.services.filter((s) => s.type === 'accommodation');
    const primaryLodging = lodgingServices[0];

    // Origem extraída do transporte de ida
    let origin = '';
    if (outboundService?.description) {
      const parts = outboundService.description.split(/→|-/);
      if (parts.length > 1) {
        origin = parts[0].trim();
      }
    }

    // 3. Constrói a lista comercial de serviços inclusos e não inclusos
    const includedServices: string[] = [];

    if (outboundService) {
      let desc = `Transporte de ida: ${outboundService.description}`;
      const details: string[] = [];
      if (outboundService.carrier) details.push(outboundService.carrier);
      if (outboundService.departureTime) details.push(`partida ${outboundService.departureTime}`);
      if (details.length > 0) desc += ` (${details.join(', ')})`;
      includedServices.push(desc);
    }

    if (inboundService) {
      let desc = `Transporte de volta: ${inboundService.description}`;
      const details: string[] = [];
      if (inboundService.carrier) details.push(inboundService.carrier);
      if (inboundService.departureTime) details.push(`partida ${inboundService.departureTime}`);
      if (details.length > 0) desc += ` (${details.join(', ')})`;
      includedServices.push(desc);
    }

    for (const h of lodgingServices) {
      let desc = `Hospedagem em ${h.description}`;
      if (h.mealPlan) {
        desc += ` (${h.mealPlan})`;
      }
      includedServices.push(desc);
    }

    for (const s of payload.services) {
      if (s.type === 'transfer') {
        includedServices.push(`Transfer: ${s.description}`);
      } else if (s.type === 'insurance') {
        includedServices.push(`Seguro-viagem: ${s.description}`);
      } else if (s.type === 'additional') {
        includedServices.push(s.description);
      } else if (s.type === 'other') {
        includedServices.push(s.description);
      }
    }

    // Suporte a campo avulso transferService em registros legados
    if (d.transferService?.trim()) {
      const exists = includedServices.some((s) => s.toLowerCase().includes(d.transferService!.trim().toLowerCase()));
      if (!exists) {
        includedServices.push(d.transferService.trim());
      }
    }

    const notIncludedServices: string[] = [];
    const taxServices = payload.services.filter((s) => s.type === 'taxes');
    for (const t of taxServices) {
      notIncludedServices.push(t.description);
    }
    if (d.localTaxNotes) {
      notIncludedServices.push(`Taxa local na hospedagem: ${d.localTaxNotes}`);
    }

    const dest = payload.destination || primaryLodging?.destination || p.name;

    return {
      sourceType: 'package',
      sourceId: p.id,
      reference: p.reference,
      name: p.name,
      destination: dest,
      origin: origin || undefined,
      durationDays: payload.durationDays,
      startDate: payload.dates?.startDate,
      endDate: payload.dates?.endDate,
      hotelName: primaryLodging?.description,
      mealPlan: primaryLodging?.mealPlan,
      nights: payload.durationNights || primaryLodging?.quantity,
      salePrice: payload.publicSalePrice,
      publicSalePrice: payload.publicSalePrice,
      currency: payload.currency,
      services: payload.services,
      includedServices,
      notIncludedServices,
      paymentConditions: payload.paymentConditions,
      customNotes: payload.customNotes,
      localTaxNotes: d.localTaxNotes,
      transferService: d.transferService,
    };
  }

  throw new Error('Nenhuma fonte de dados (Package ou Quotation) fornecida.');
}

export interface ValidationResult {
  valid: boolean;
  data?: StructuredPackageContent;
  errors: string[];
}

/**
 * Valida deterministicamente a resposta de conteúdo estruturado gerada pela IA
 * assegurando conformidade estrita com as regras da S23 em /docs.
 */
export function validateStructuredContent(
  raw: unknown,
  input?: ContentGenerationInput
): ValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['A resposta fornecida não é um objeto JSON válido.'] };
  }

  const obj = raw as Record<string, any>;

  // 1. Campos Obrigatórios Gerais
  if (!obj.title || typeof obj.title !== 'string' || !obj.title.trim()) {
    errors.push('Campo obrigatório ausente ou inválido: title');
  }

  if (!obj.category || typeof obj.category !== 'string' || !obj.category.trim()) {
    errors.push('Campo obrigatório ausente ou inválido: category');
  }

  if (!obj.excerpt || typeof obj.excerpt !== 'string' || !obj.excerpt.trim()) {
    errors.push('Campo obrigatório ausente ou inválido: excerpt');
  }

  if (!obj.slug || typeof obj.slug !== 'string' || !obj.slug.trim()) {
    errors.push('Campo obrigatório ausente ou inválido: slug');
  } else {
    const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    if (!slugRegex.test(obj.slug.trim())) {
      errors.push(
        `O slug '${obj.slug}' é inválido. Deve conter apenas letras minúsculas, números e hífens.`
      );
    }
  }

  // 2. Validação do Bloco Sobre (Obrigatório segundo COMO_ADICIONAR_PACOTE.md)
  if (!obj.sobre || typeof obj.sobre !== 'object') {
    errors.push('Bloco obrigatório ausente ou inválido: sobre');
  } else {
    if (!obj.sobre.title || typeof obj.sobre.title !== 'string') {
      errors.push('Subcampo obrigatório ausente em sobre: title');
    }
    if (!obj.sobre.text || typeof obj.sobre.text !== 'string') {
      errors.push('Subcampo obrigatório ausente em sobre: text');
    }
  }

  // 3. Validação do Bloco Pagamento (Obrigatório)
  if (!obj.pagamento || typeof obj.pagamento !== 'object') {
    errors.push('Bloco obrigatório ausente ou inválido: pagamento');
  } else {
    if (obj.pagamento.observacao !== OBRIGATORIO_PAGAMENTO_OBSERVACAO) {
      errors.push(
        `A observação de pagamento deve ser exatamente: "${OBRIGATORIO_PAGAMENTO_OBSERVACAO}"`
      );
    }
  }

  // 4. Validação de Itens Inclusos (Deve conter o item fixo S23)
  if (!Array.isArray(obj.incluso)) {
    errors.push('O campo incluso deve ser um array de itens.');
  } else {
    const hasFixedItem = obj.incluso.some(
      (item: any) =>
        item &&
        typeof item === 'object' &&
        item.title?.trim() === OBRIGATORIO_ITEM_INCLUSO_S23.title
    );
    if (!hasFixedItem) {
      errors.push(
        `O item fixo '${OBRIGATORIO_ITEM_INCLUSO_S23.title}' é obrigatório e deve estar presente no array incluso.`
      );
    }
  }

  // 5. SEO Obrigatório
  if (!obj.seoTitle || typeof obj.seoTitle !== 'string') {
    errors.push('Campo SEO ausente ou inválido: seoTitle');
  }
  if (!obj.seoDescription || typeof obj.seoDescription !== 'string') {
    errors.push('Campo SEO ausente ou inválido: seoDescription');
  }

  // 6. Integridade Comercial contra Alucinação (Hierarquia Nível 1)
  if (input) {
    if (input.hotelName && obj.sobre?.text) {
      // Se houver hotel, verificar coerência básica se aplicável
    }
    // Preço deve corresponder estritamente ao valor comercial soberano (sem tolerância de 1€ ou 1R$)
    if (input.salePrice > 0 && obj.price !== undefined) {
      const priceNum = typeof obj.price === 'number' ? obj.price : parseFloat(obj.price);
      if (Number.isFinite(priceNum) && Math.abs(priceNum - input.salePrice) > 0.001) {
        errors.push(
          `O preço retornado (${obj.price}) diverge do preço comercial oficial (${input.salePrice}). A IA não pode alterar dados comerciais.`
        );
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const validData: StructuredPackageContent = {
    title: String(obj.title).trim(),
    category: String(obj.category).trim(),
    excerpt: String(obj.excerpt).trim(),
    slug: String(obj.slug).trim(),
    price: obj.price ?? (input ? input.salePrice : 0),
    published: typeof obj.published === 'boolean' ? obj.published : false,
    featured: typeof obj.featured === 'boolean' ? obj.featured : false,
    heroImage: obj.heroImage || undefined,
    cardImage: obj.cardImage || undefined,
    imagemDestaque: obj.imagemDestaque || undefined,
    subtitle: obj.subtitle ? String(obj.subtitle).trim() : undefined,
    duracao: obj.duracao ? String(obj.duracao).trim() : undefined,
    origem: obj.origem ? String(obj.origem).trim() : undefined,
    date: obj.date ? String(obj.date).trim() : undefined,
    ctaLabel: obj.ctaLabel ? String(obj.ctaLabel).trim() : 'Quero garantir minha vaga',
    customInfo: obj.customInfo ? String(obj.customInfo).trim() : undefined,
    incluso: obj.incluso,
    naoIncluso: Array.isArray(obj.naoIncluso) ? obj.naoIncluso : [],
    sobre: obj.sobre,
    infoDestino: obj.infoDestino || undefined,
    roteiro: Array.isArray(obj.roteiro) ? obj.roteiro : undefined,
    pagamento: obj.pagamento,
    seoTitle: String(obj.seoTitle).trim(),
    seoDescription: String(obj.seoDescription).trim(),
  };

  return { valid: true, data: validData, errors: [] };
}
