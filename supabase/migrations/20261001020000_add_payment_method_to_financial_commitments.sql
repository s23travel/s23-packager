-- Migration: 20261001020000_add_payment_method_to_financial_commitments.sql
-- Descrição: Adiciona o campo payment_method aos compromissos financeiros (transfer, card, payment_link, cash, other)

ALTER TABLE financial_commitments
ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (
  payment_method IS NULL OR payment_method IN ('transfer', 'card', 'payment_link', 'cash', 'other')
);

COMMENT ON COLUMN financial_commitments.payment_method IS 'Método previsto de pagamento: transfer, card, payment_link, cash, other';
