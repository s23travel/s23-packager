import { supabase } from '../lib/supabase';
import { PackageWebsiteContent, StructuredPackageContent } from '../types';

export const packageWebsiteContentService = {
  /**
   * Obtém a última versão salva do conteúdo de website para um Pacote Base.
   * Retorna null se nenhuma versão foi salva ainda.
   */
  async getPackageWebsiteContent(packageId: string): Promise<PackageWebsiteContent | null> {
    if (!packageId) return null;

    const { data, error } = await supabase
      .from('package_website_contents')
      .select('*')
      .eq('package_id', packageId)
      .maybeSingle();

    if (error) {
      console.error(`Erro ao buscar conteúdo de website para o pacote ${packageId}:`, error);
      throw new Error(`Falha ao carregar conteúdo salvo do website: ${error.message}`);
    }

    return (data as PackageWebsiteContent) || null;
  },

  /**
   * Salva atomicamente a última versão validada do conteúdo de website do Pacote Base.
   * Utiliza upsert baseado na constraint UNIQUE(package_id).
   */
  async savePackageWebsiteContent(
    packageId: string,
    content: StructuredPackageContent,
    markdown: string,
    filename: string
  ): Promise<PackageWebsiteContent> {
    if (!packageId) {
      throw new Error('packageId é obrigatório para salvar o conteúdo de website.');
    }

    const payload = {
      package_id: packageId,
      content,
      markdown,
      filename,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('package_website_contents')
      .upsert(payload, { onConflict: 'package_id' })
      .select()
      .single();

    if (error) {
      console.error(`Erro ao salvar conteúdo de website para o pacote ${packageId}:`, error);
      throw new Error(`Falha ao persistir conteúdo do website: ${error.message}`);
    }

    return data as PackageWebsiteContent;
  },

  /**
   * Remove o conteúdo de website de um Pacote Base (se necessário)
   */
  async deletePackageWebsiteContent(packageId: string): Promise<void> {
    if (!packageId) return;

    const { error } = await supabase
      .from('package_website_contents')
      .delete()
      .eq('package_id', packageId);

    if (error) {
      console.error(`Erro ao remover conteúdo de website para o pacote ${packageId}:`, error);
      throw new Error(`Falha ao remover conteúdo do website: ${error.message}`);
    }
  },
};
