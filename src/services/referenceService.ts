/**
 * Serviço utilitário para cálculo e formatação determinística
 * de referências sequenciais para Pacotes (PK) e Cotações (COT).
 *
 * Formato padrão: PREFIX-YYYY-NNN (ex.: PK-2026-001, COT-2026-001)
 */

export type ReferencePrefix = 'PK' | 'COT';

/**
 * Calcula a próxima referência sequencial baseada nos registros existentes.
 *
 * @param prefix 'PK' para Pacotes, 'COT' para Cotações
 * @param existingReferences Lista de referências já cadastradas
 * @param currentYear Ano corrente do sistema (padrão: ano local atual)
 */
export function getNextSequentialReference(
  prefix: ReferencePrefix,
  existingReferences: string[],
  currentYear: number = new Date().getFullYear()
): string {
  // Regex estrita: prefixo correspondente, ano corrente e parte numérica (3 ou mais dígitos)
  const regex = new RegExp(`^${prefix}-${currentYear}-(\\d+)$`);
  let maxNum = 0;

  for (const ref of existingReferences) {
    if (!ref || typeof ref !== 'string') continue;
    const match = ref.trim().match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  // Formata com no mínimo 3 dígitos, sem truncar números acima de 999 (ex.: 001, 010, 100, 1000)
  const formattedNumber = nextNum < 1000 ? String(nextNum).padStart(3, '0') : String(nextNum);

  return `${prefix}-${currentYear}-${formattedNumber}`;
}
