import { supabase } from '../lib/supabase';
import { Quotation, CreateQuotationInput, UpdateQuotationInput, QuotationData } from '../types';
import { packagesService } from './packagesService';
import { getNextSequentialReference } from './referenceService';

export const quotationsService = {
  /**
   * Lista todas as cotações com ordenação por data de criação descrescente
   * e inclui o nome do pacote de origem quando disponível.
   */
  async listQuotations(): Promise<Quotation[]> {
    const { data, error } = await supabase
      .from('quotations')
      .select(`
        *,
        packages:package_id ( name, reference )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao listar cotações:', error);
      throw new Error(error.message);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      package_id: row.package_id,
      reference: row.reference,
      client_name: row.client_name,
      status: row.status,
      data: row.data || {},
      currency: row.currency,
      exchange_rate: row.exchange_rate,
      exchange_rate_date: row.exchange_rate_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      origin_package_name: row.packages?.name || row.data?.originPackageName,
    })) as Quotation[];
  },

  /**
   * Calcula a próxima referência sequencial COT-YYYY-NNN para cotações
   */
  async getNextReference(year?: number): Promise<string> {
    const { data, error } = await supabase
      .from('quotations')
      .select('reference');

    if (error) {
      console.error('Erro ao buscar referências de cotações:', error);
      throw new Error(error.message);
    }

    const refs = (data || []).map((row: { reference: string }) => row.reference);
    return getNextSequentialReference('COT', refs, year);
  },

  /**
   * Verifica se uma referência de cotação está disponível (não utilizada por outro registro)
   */
  async isReferenceAvailable(reference: string, excludeId?: string): Promise<boolean> {
    const clean = reference.trim();
    if (!clean) return false;

    let query = supabase.from('quotations').select('id').eq('reference', clean);
    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao verificar disponibilidade da referência da cotação:', error);
      throw new Error(error.message);
    }

    return (data || []).length === 0;
  },

  /**
   * Obtém uma cotação por ID
   */
  async getQuotationById(id: string): Promise<Quotation | null> {
    const { data, error } = await supabase
      .from('quotations')
      .select(`
        *,
        packages:package_id ( name, reference )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error(`Erro ao obter cotação ${id}:`, error);
      throw new Error(error.message);
    }

    const row = data as any;
    return {
      id: row.id,
      package_id: row.package_id,
      reference: row.reference,
      client_name: row.client_name,
      status: row.status,
      data: row.data || {},
      currency: row.currency,
      exchange_rate: row.exchange_rate,
      exchange_rate_date: row.exchange_rate_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      origin_package_name: row.packages?.name || row.data?.originPackageName,
    } as Quotation;
  },

  /**
   * Cria uma cotação manual avulsa
   */
  async createQuotation(input: CreateQuotationInput): Promise<Quotation> {
    const reference = input.reference ? input.reference.trim() : await this.getNextReference();

    const isAvailable = await this.isReferenceAvailable(reference);
    if (!isAvailable) {
      throw new Error('Esta referência já está em uso. Informe outra referência.');
    }

    const payload = {
      package_id: input.package_id || null,
      reference,
      client_name: input.client_name ? input.client_name.trim() : null,
      status: input.status || 'draft',
      data: input.data || {},
      currency: input.currency || 'EUR',
      exchange_rate: input.exchange_rate || null,
      exchange_rate_date: input.exchange_rate_date || null,
    };

    const { data, error } = await supabase
      .from('quotations')
      .insert([payload])
      .select()
      .single();

    if (error) {
      if (
        error.code === '23505' ||
        error.message?.includes('duplicate key') ||
        error.message?.includes('violates unique constraint')
      ) {
        throw new Error('Esta referência já está em uso. Informe outra referência.');
      }
      console.error('Erro ao criar cotação:', error);
      throw new Error(error.message);
    }

    return data as Quotation;
  },

  /**
   * Criação de cotação derivada de um pacote através de snapshot independente.
   * 
   * REGRA FUNDAMENTAL DO SNAPSHOT:
   * 1. Busca os dados atuais do package.
   * 2. Realiza clonagem profunda (deep-clone) de package.data para quotation.data.
   * 3. Registra package_id original para rastreabilidade histórica.
   * 4. Gera referência única.
   * 5. Mantém client_name inicialmente vazio e status como 'draft'.
   * 6. Preserva a moeda base do pacote.
   * 7. O snapshot gerado é 100% autônomo: alterações futuras no package NÃO afetam a cotação.
   */
  async createQuotationFromPackage(packageId: string): Promise<Quotation> {
    const pkg = await packagesService.getPackageById(packageId);

    if (!pkg) {
      throw new Error(`Pacote de origem com ID ${packageId} não encontrado.`);
    }

    // Clonagem profunda dos dados para assegurar isolamento completo do snapshot
    const clonedPackageData = JSON.parse(JSON.stringify(pkg.data || {}));

    const quotationSnapshot: QuotationData = {
      ...clonedPackageData,
      snapshotCreatedAt: new Date().toISOString(),
      originPackageName: pkg.name,
      originPackageReference: pkg.reference,
    };

    const reference = await this.getNextReference();

    const payload = {
      package_id: pkg.id,
      reference,
      client_name: null,
      status: 'draft' as const,
      data: quotationSnapshot,
      currency: pkg.base_currency,
      exchange_rate: null,
      exchange_rate_date: null,
    };

    const { data, error } = await supabase
      .from('quotations')
      .insert([payload])
      .select()
      .single();

    if (error) {
      if (
        error.code === '23505' ||
        error.message?.includes('duplicate key') ||
        error.message?.includes('violates unique constraint')
      ) {
        throw new Error('Esta referência já está em uso. Informe outra referência.');
      }
      console.error('Erro ao clonar cotação a partir do pacote:', error);
      throw new Error(error.message);
    }

    return data as Quotation;
  },

  /**
   * Atualiza uma cotação de forma independente sem afetar o pacote original
   */
  async updateQuotation(id: string, input: UpdateQuotationInput): Promise<Quotation> {
    const payload: Record<string, unknown> = {};

    if (input.reference !== undefined) {
      const reference = input.reference.trim();
      const isAvailable = await this.isReferenceAvailable(reference, id);
      if (!isAvailable) {
        throw new Error('Esta referência já está em uso. Informe outra referência.');
      }
      payload.reference = reference;
    }
    if (input.client_name !== undefined) payload.client_name = input.client_name ? input.client_name.trim() : null;
    if (input.status !== undefined) payload.status = input.status;
    if (input.data !== undefined) payload.data = input.data;
    if (input.currency !== undefined) payload.currency = input.currency;
    if (input.exchange_rate !== undefined) payload.exchange_rate = input.exchange_rate;
    if (input.exchange_rate_date !== undefined) payload.exchange_rate_date = input.exchange_rate_date;

    const { data, error } = await supabase
      .from('quotations')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (
        error.code === '23505' ||
        error.message?.includes('duplicate key') ||
        error.message?.includes('violates unique constraint')
      ) {
        throw new Error('Esta referência já está em uso. Informe outra referência.');
      }
      console.error(`Erro ao atualizar cotação ${id}:`, error);
      throw new Error(error.message);
    }

    return data as Quotation;
  },

  /**
   * Remove uma cotação
   */
  async deleteQuotation(id: string): Promise<void> {
    const { error } = await supabase
      .from('quotations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Erro ao deletar cotação ${id}:`, error);
      throw new Error(error.message);
    }
  },
};
