import { supabase } from '../lib/supabase';
import { Quotation, CreateQuotationInput, UpdateQuotationInput, QuotationData } from '../types';
import { packagesService } from './packagesService';
import { getNextSequentialReference } from './referenceService';

export const quotationsService = {
  /**
   * Lista todas as cotações com ordenação por data de criação descrescente
   * e inclui o nome do pacote de origem quando disponível.
   */
  /**
   * Lista todas as cotações com ordenação por data de criação descrescente
   * e inclui o nome do pacote de origem quando disponível.
   * Por padrão, filtra cotações ativas (archived_at IS NULL).
   */
  async listQuotations(options?: { includeArchived?: boolean; archivedOnly?: boolean }): Promise<Quotation[]> {
    let query = supabase
      .from('quotations')
      .select(`
        *,
        packages:package_id ( name, reference )
      `);

    if (options?.archivedOnly) {
      query = query.not('archived_at', 'is', null);
    } else if (!options?.includeArchived) {
      query = query.is('archived_at', null);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao listar cotações:', error);
      throw new Error(error.message);
    }

    // Busca rápida das operações financeiras vinculadas para integridade referencial e status
    const opStatusMap = new Map<string, 'active' | 'cancelled'>();
    try {
      const { data: ops } = await supabase
        .from('financial_operations')
        .select('quotation_id, status');
      if (ops && Array.isArray(ops)) {
        for (const op of ops) {
          if (op.quotation_id) {
            opStatusMap.set(op.quotation_id, op.status as 'active' | 'cancelled');
          }
        }
      }
    } catch (e) {
      console.warn('Aviso ao carregar operações financeiras vinculadas:', e);
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
      archived_at: row.archived_at || null,
      origin_package_name: row.packages?.name || row.data?.originPackageName,
      has_financial_operation: opStatusMap.has(row.id),
      financial_operation_status: opStatusMap.get(row.id) || null,
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

    // Busca status da operação financeira vinculada se houver
    let hasOp = false;
    let opStatus: 'active' | 'cancelled' | null = null;
    try {
      const { data: op } = await supabase
        .from('financial_operations')
        .select('id, status')
        .eq('quotation_id', id)
        .maybeSingle();
      if (op) {
        hasOp = true;
        opStatus = op.status as 'active' | 'cancelled';
      }
    } catch (e) {
      console.warn('Aviso ao carregar operação financeira da cotação:', e);
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
      archived_at: row.archived_at || null,
      origin_package_name: row.packages?.name || row.data?.originPackageName,
      has_financial_operation: hasOp,
      financial_operation_status: opStatus,
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

    if (input.status === 'accepted') {
      throw new Error(
        'Não é permitido criar cotação diretamente com status aprovado. Salve como rascunho e utilize approveQuotationAndCreateOperation.'
      );
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
    if (input.status !== undefined) {
      if (input.status === 'accepted') {
        const { data: op } = await supabase
          .from('financial_operations')
          .select('id')
          .eq('quotation_id', id)
          .maybeSingle();

        if (!op) {
          throw new Error(
            'Não é permitido aprovar cotação por atualização simples de status. Utilize approveQuotationAndCreateOperation.'
          );
        }
      } else {
        // Bloqueia alteração para draft, sent, rejected ou archived quando a cotação possuir operação financeira
        const { data: op } = await supabase
          .from('financial_operations')
          .select('id')
          .eq('quotation_id', id)
          .maybeSingle();

        if (op) {
          throw new Error(
            `Cotação possui operação financeira vinculada e deve permanecer com status "accepted". Alterações para "${input.status}" não são permitidas.`
          );
        }
      }
      payload.status = input.status;
    }
    if (input.data !== undefined) payload.data = input.data;
    if (input.currency !== undefined) payload.currency = input.currency;
    if (input.exchange_rate !== undefined) payload.exchange_rate = input.exchange_rate;
    if (input.exchange_rate_date !== undefined) payload.exchange_rate_date = input.exchange_rate_date;
    if (input.archived_at !== undefined) {
      if (input.archived_at !== null) {
        const { data: op } = await supabase
          .from('financial_operations')
          .select('id, status')
          .eq('quotation_id', id)
          .maybeSingle();

        if (op && op.status === 'active') {
          throw new Error(
            'Não é permitido arquivar uma cotação com operação financeira ativa. O cancelamento deve ser realizado previamente no módulo financeiro.'
          );
        }
      }
      payload.archived_at = input.archived_at;
    }

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
   * Arquiva uma cotação logicamente (preenche archived_at).
   * Regras:
   * - Permitido somente se não houver operação financeira OU se a operação estiver cancelada.
   * - Proibido se a operação financeira estiver ativa.
   */
  async archiveQuotation(id: string): Promise<Quotation> {
    const { data: op, error: opErr } = await supabase
      .from('financial_operations')
      .select('id, status')
      .eq('quotation_id', id)
      .maybeSingle();

    if (opErr) {
      console.error(`Erro ao verificar operação financeira para arquivamento ${id}:`, opErr);
      throw new Error(opErr.message);
    }

    if (op && op.status === 'active') {
      throw new Error(
        'Não é permitido arquivar uma cotação com operação financeira ativa. Realize o cancelamento financeiro antes de arquivar.'
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('quotations')
      .update({ archived_at: now })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Erro ao arquivar cotação ${id}:`, error);
      throw new Error(error.message);
    }

    return data as Quotation;
  },

  /**
   * Desarquiva uma cotação (remove archived_at).
   */
  async unarchiveQuotation(id: string): Promise<Quotation> {
    const { data, error } = await supabase
      .from('quotations')
      .update({ archived_at: null })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Erro ao desarquivar cotação ${id}:`, error);
      throw new Error(error.message);
    }

    return data as Quotation;
  },

  /**
   * Verifica se uma cotação possui operação financeira vinculada
   */
  async hasFinancialOperation(id: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('financial_operations')
        .select('id')
        .eq('quotation_id', id)
        .maybeSingle();

      if (error) {
        console.error(`Erro ao verificar operação financeira da cotação ${id}:`, error);
        return false;
      }
      return Boolean(data);
    } catch {
      return false;
    }
  },

  /**
   * Remove uma cotação sem operação financeira vinculada.
   * Se houver operação financeira vinculada (FK RESTRICT), a exclusão física é bloqueada
   * para preservar o histórico contábil e de auditoria.
   */
  async deleteQuotation(id: string): Promise<void> {
    // 1. Verificação preventiva no serviço consultando a operação e seu status
    try {
      const { data: op } = await supabase
        .from('financial_operations')
        .select('id, status')
        .eq('quotation_id', id)
        .maybeSingle();

      if (op) {
        if (op.status === 'cancelled') {
          throw new Error(
            'Esta cotação possui uma operação financeira vinculada ao histórico contábil e não pode ser excluída fisicamente. Utilize a opção de arquivamento para ocultá-la das listagens normais.'
          );
        } else {
          throw new Error(
            'Esta cotação possui uma operação financeira vinculada e não pode ser excluída para preservar o histórico financeiro.'
          );
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('operação financeira vinculada')) {
        throw err;
      }
    }

    // 2. Executa a exclusão física
    const { error } = await supabase
      .from('quotations')
      .delete()
      .eq('id', id);

    if (error) {
      // 3. Tratamento defensivo caso ocorra violação de foreign key constraint do PostgreSQL
      const msg = error.message || '';
      const code = (error as any).code || '';
      if (
        code === '23503' ||
        msg.includes('financial_operations') ||
        msg.includes('foreign key constraint') ||
        msg.includes('violates foreign key')
      ) {
        throw new Error(
          'Esta cotação possui uma operação financeira vinculada e não pode ser excluída para preservar o histórico financeiro.'
        );
      }

      console.error(`Erro ao deletar cotação ${id}:`, error);
      throw new Error(error.message);
    }
  },
};
