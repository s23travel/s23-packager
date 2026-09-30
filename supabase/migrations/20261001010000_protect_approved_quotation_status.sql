-- Migration: 20261001010000_protect_approved_quotation_status.sql
-- Descrição: Protege o ciclo de vida de cotações aprovadas com operação financeira vinculada.
-- Garante que quando uma cotação possuir operação financeira, seu status permaneça 'accepted',
-- bloqueando alterações para 'draft', 'sent', 'rejected' ou 'archived'.

CREATE OR REPLACE FUNCTION check_quotation_status_protection()
RETURNS TRIGGER AS $$
BEGIN
  -- Se houver tentativa de alterar o status para algo diferente de 'accepted'
  IF (NEW.status IS DISTINCT FROM 'accepted') THEN
    -- Verifica se existe operação financeira associada a esta cotação
    IF EXISTS (
      SELECT 1 FROM financial_operations 
      WHERE quotation_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cotação possui operação financeira vinculada e deve permanecer com status "accepted". Alterações para "%" não são permitidas.', NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_approved_quotation_status ON quotations;
CREATE TRIGGER trg_protect_approved_quotation_status
  BEFORE UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION check_quotation_status_protection();
