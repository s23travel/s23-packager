import { supabase } from '../lib/supabase';
import { Package, CreatePackageInput, UpdatePackageInput } from '../types';

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
    const payload = {
      reference: input.reference.trim(),
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

    if (input.reference !== undefined) payload.reference = input.reference.trim();
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
