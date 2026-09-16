import { QuoteDraft } from '../types';

const DRAFT_STORAGE_KEY = 'packager_nova_cotacao_draft_v1';

/**
 * Salva o rascunho completo do formulário de Nova Cotação no sessionStorage.
 * Nunca inclui segredos, tokens ou senhas.
 */
export function saveQuoteDraft(draft: Omit<QuoteDraft, 'savedAt'>): void {
  try {
    const payload: QuoteDraft = {
      ...draft,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[quoteDraftService] Falha ao salvar rascunho:', err);
  }
}

/**
 * Recupera o rascunho armazenado no sessionStorage, validando sua estrutura básica.
 * Retorna null se não houver rascunho ou se estiver corrompido.
 */
export function getQuoteDraft(): QuoteDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    // Validação de sanidade estrutural
    if (typeof parsed.reference !== 'string') {
      return null;
    }

    return parsed as QuoteDraft;
  } catch (err) {
    console.warn('[quoteDraftService] Falha ao recuperar rascunho:', err);
    return null;
  }
}

/**
 * Remove o rascunho temporário do sessionStorage.
 */
export function clearQuoteDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (err) {
    console.warn('[quoteDraftService] Falha ao limpar rascunho:', err);
  }
}

/**
 * Verifica se existe um rascunho ativo.
 */
export function hasQuoteDraft(): boolean {
  try {
    return Boolean(sessionStorage.getItem(DRAFT_STORAGE_KEY));
  } catch {
    return false;
  }
}
