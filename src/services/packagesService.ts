import { supabase } from '../lib/supabase';
import { Package, CreatePackageInput, UpdatePackageInput } from '../types';
import { getNextSequentialReference } from './referenceService';

export const packagesService = {
  /**
   * Lista todos os pacotes ordenados pelos mais recentes
   */
  async listPackages(): Promise<Package[]> {
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao listar pacotes:', error);
      throw new Error(error.message);
    }

    return (data || []) as Package[];
  },

  /**
   * Calcula a próxima referência sequencial PK-YYYY-NNN para pacotes
   */
  async getNextReference(year?: number): Promise<string> {
    const { data, error } = await supabase
      .from('packages')
      .select('reference');

    if (error) {
      console.error('Erro ao buscar referências de pacotes:', error);
      throw new Error(error.message);
    }

    const refs = (data || []).map((row: { reference: string }) => row.reference);
    return getNextSequentialReference('PK', refs, year);
  },

  /**
   * Verifica se uma referência de pacote está disponível (não utilizada por outro registro)
   */
  async isReferenceAvailable(reference: string, excludeId?: string): Promise<boolean> {
    const clean = reference.trim();
    if (!clean) return false;

    let query = supabase.from('packages').select('id').eq('reference', clean);
    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao verificar disponibilidade da referência do pacote:', error);
      throw new Error(error.message);
    }

    return (data || []).length === 0;
  },

  /**
   * Obtém um pacote pelo ID
   */
  async getPackageById(id: string): Promise<Package | null> {
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error(`Erro ao obter pacote ${id}:`, error);
      throw new Error(error.message);
    }

    return data as Package;
  },

  /**
   * Cria um novo pacote base
   */
  async createPackage(input: CreatePackageInput): Promise<Package> {
    const reference = input.reference ? input.reference.trim() : await this.getNextReference();

    const isAvailable = await this.isReferenceAvailable(reference);
    if (!isAvailable) {
      throw new Error('Esta referência já está em uso. Informe outra referência.');
    }

    const payload = {
      reference,
      name: input.name.trim(),
      status: input.status || 'draft',
      data: input.data || {},
      base_currency: input.base_currency || 'EUR',
    };

    const { data, error } = await supabase
      .from('packages')
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
      console.error('Erro ao criar pacote:', error);
      throw new Error(error.message);
    }

    return data as Package;
  },

  /**
   * Atualiza um pacote existente
   */
  async updatePackage(id: string, input: UpdatePackageInput): Promise<Package> {
    const payload: Record<string, unknown> = {};

    if (input.reference !== undefined) {
      const reference = input.reference.trim();
      const isAvailable = await this.isReferenceAvailable(reference, id);
      if (!isAvailable) {
        throw new Error('Esta referência já está em uso. Informe outra referência.');
      }
      payload.reference = reference;
    }
    if (input.name !== undefined) payload.name = input.name.trim();
    if (input.status !== undefined) payload.status = input.status;
    if (input.data !== undefined) payload.data = input.data;
    if (input.base_currency !== undefined) payload.base_currency = input.base_currency;

    const { data, error } = await supabase
      .from('packages')
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
      console.error(`Erro ao atualizar pacote ${id}:`, error);
      throw new Error(error.message);
    }

    return data as Package;
  },

  /**
   * Remove um pacote
   */
  async deletePackage(id: string): Promise<void> {
    const { error } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Erro ao deletar pacote ${id}:`, error);
      throw new Error(error.message);
    }
  },
};
