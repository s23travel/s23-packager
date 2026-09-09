import { supabase } from '../lib/supabase';
import {
  FavoriteService,
  FavoriteServiceType,
  CreateFavoriteServiceInput,
  UpdateFavoriteServiceInput,
} from '../types';

export interface ListServicesFilters {
  type?: FavoriteServiceType | 'all';
  active?: boolean | 'all';
  search?: string;
}

export const favoriteServicesService = {
  /**
   * Lista serviços com filtros opcionais por tipo, status e busca textual.
   */
  async listServices(filters?: ListServicesFilters): Promise<FavoriteService[]> {
    let query = supabase
      .from('favorite_services')
      .select('*')
      .order('name', { ascending: true });

    if (filters?.type && filters.type !== 'all') {
      query = query.eq('type', filters.type);
    }

    if (filters?.active !== undefined && filters.active !== 'all') {
      query = query.eq('active', filters.active);
    }

    if (filters?.search && filters.search.trim().length >= 2) {
      const term = filters.search.trim();
      query = query.or(
        `name.ilike.%${term}%,country.ilike.%${term}%,city.ilike.%${term}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao listar serviços:', error);
      throw new Error(error.message);
    }

    return (data || []) as FavoriteService[];
  },

  /**
   * Busca serviços ativos para autocomplete.
   * Mínimo 2 caracteres, máximo 5 resultados, ordenado por nome.
   */
  async searchServices(query: string, type?: FavoriteServiceType): Promise<FavoriteService[]> {
    const term = query.trim();
    if (term.length < 2) return [];

    let q = supabase
      .from('favorite_services')
      .select('*')
      .eq('active', true)
      .or(
        `name.ilike.%${term}%,country.ilike.%${term}%,city.ilike.%${term}%`
      )
      .order('name', { ascending: true })
      .limit(5);

    if (type) {
      q = q.eq('type', type);
    }

    const { data, error } = await q;

    if (error) {
      console.error('Erro ao pesquisar serviços:', error);
      throw new Error(error.message);
    }

    return (data || []) as FavoriteService[];
  },

  /**
   * Obtém um serviço pelo ID.
   */
  async getServiceById(id: string): Promise<FavoriteService | null> {
    const { data, error } = await supabase
      .from('favorite_services')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error(`Erro ao obter serviço ${id}:`, error);
      throw new Error(error.message);
    }

    return data as FavoriteService;
  },

  /**
   * Cria um novo serviço no catálogo.
   */
  async createService(input: CreateFavoriteServiceInput): Promise<FavoriteService> {
    const payload = {
      type: input.type,
      name: input.name.trim(),
      country: input.country.trim(),
      city: input.city?.trim() || null,
      notes: input.notes?.trim() || null,
      active: input.active !== undefined ? input.active : true,
    };

    const { data, error } = await supabase
      .from('favorite_services')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar serviço:', error);
      throw new Error(error.message);
    }

    return data as FavoriteService;
  },

  /**
   * Atualiza um serviço existente.
   */
  async updateService(id: string, input: UpdateFavoriteServiceInput): Promise<FavoriteService> {
    const payload: Record<string, unknown> = {};

    if (input.type !== undefined) payload.type = input.type;
    if (input.name !== undefined) payload.name = input.name.trim();
    if (input.country !== undefined) payload.country = input.country.trim();
    if (input.city !== undefined) payload.city = input.city?.trim() || null;
    if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;
    if (input.active !== undefined) payload.active = input.active;

    const { data, error } = await supabase
      .from('favorite_services')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Erro ao atualizar serviço ${id}:`, error);
      throw new Error(error.message);
    }

    return data as FavoriteService;
  },

  /**
   * Desativa um serviço (soft delete). Não realiza DELETE físico.
   * Serviços inativos deixam de aparecer no autocomplete.
   * Pacotes já criados não são afetados.
   */
  async deactivateService(id: string): Promise<FavoriteService> {
    return favoriteServicesService.updateService(id, { active: false });
  },

  /**
   * Ativa um serviço previamente inativo.
   * Volta a disponibilizar o serviço no autocomplete.
   */
  async activateService(id: string): Promise<FavoriteService> {
    return favoriteServicesService.updateService(id, { active: true });
  },

  /**
   * Exclui permanentemente um serviço do catálogo (DELETE físico).
   * Pacotes e cotações mantêm snapshots próprios e não são alterados.
   */
  async deleteService(id: string): Promise<void> {
    const { error } = await supabase
      .from('favorite_services')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Erro ao excluir serviço ${id}:`, error);
      throw new Error(error.message);
    }
  },
};

