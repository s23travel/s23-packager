import { PackageDraft } from '../types';

const DRAFT_STORAGE_KEY = 'packager_novo_pacote_draft_v1';

/**
 * Salva o rascunho completo do formulário de Novo Pacote no sessionStorage.
 * Nunca inclui segredos, tokens ou senhas.
 */
export function savePackageDraft(draft: Omit<PackageDraft, 'savedAt'>): void {
  try {
    const payload: PackageDraft = {
      ...draft,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[packageDraftService] Falha ao salvar rascunho:', err);
  }
}

/**
 * Recupera o rascunho armazenado no sessionStorage, validando sua estrutura básica.
 * Retorna null se não houver rascunho ou se estiver corrompido.
 */
export function getPackageDraft(): PackageDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    // Validação de sanidade estrutural
    if (typeof parsed.reference !== 'string' || typeof parsed.name !== 'string') {
      return null;
    }

    return parsed as PackageDraft;
  } catch (err) {
    console.warn('[packageDraftService] Falha ao recuperar rascunho:', err);
    return null;
  }
}

/**
 * Remove o rascunho temporário do sessionStorage.
 */
export function clearPackageDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (err) {
    console.warn('[packageDraftService] Falha ao limpar rascunho:', err);
  }
}

/**
 * Verifica se existe um rascunho ativo.
 */
export function hasPackageDraft(): boolean {
  try {
    return Boolean(sessionStorage.getItem(DRAFT_STORAGE_KEY));
  } catch {
    return false;
  }
}
