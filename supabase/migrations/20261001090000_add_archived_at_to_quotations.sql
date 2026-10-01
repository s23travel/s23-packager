-- Migration: 20261001090000_add_archived_at_to_quotations.sql
-- Descrição: Adiciona campo de arquivamento (exclusão lógica) para cotações
-- preservando integralmente o histórico financeiro associado.

-- 1. Adicionar coluna archived_at
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Criar índice para consultas eficientes de cotações não arquivadas (padrão)
CREATE INDEX IF NOT EXISTS idx_quotations_archived_at ON quotations(archived_at);

-- 3. Trigger defensivo: bloqueia arquivamento de cotação com operação financeira ativa
CREATE OR REPLACE FUNCTION trg_check_quotation_archive()
RETURNS TRIGGER AS $$
BEGIN
  -- Se está sendo arquivada (archived_at passando de NULL para valor preenchido)
  IF NEW.archived_at IS NOT NULL AND (OLD.archived_at IS NULL OR OLD.archived_at IS DISTINCT FROM NEW.archived_at) THEN
    -- Bloqueia se existir operação financeira ativa (não cancelada)
    IF EXISTS (
      SELECT 1 FROM financial_operations
      WHERE quotation_id = NEW.id
        AND status != 'cancelled'
    ) THEN
      RAISE EXCEPTION 'Não é permitido arquivar cotação com operação financeira ativa. A operação precisa ser cancelada previamente.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_quotation_archive_trigger ON quotations;
CREATE TRIGGER check_quotation_archive_trigger
  BEFORE UPDATE OF archived_at ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_quotation_archive();

COMMENT ON COLUMN quotations.archived_at IS 'Data/hora de arquivamento da cotação. Cotações arquivadas não aparecem nas listagens normais.';
