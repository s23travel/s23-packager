-- Migration: 20260930210000_create_financial_foundation.sql
-- Descrição: Fundação técnica do módulo financeiro (Fase 1)
-- Criação das tabelas relacionais independentes da cotação:
-- 1. financial_accounts (Contas financeiras EUR/BRL, cartões, caixa)
-- 2. financial_operations (Operação financeira 1:1 com cotação aprovada)
-- 3. financial_operation_services (Serviços da operação, desacoplados da cotação)
-- 4. financial_commitments (Compromissos previstos: a receber de cliente e a pagar a fornecedores)
-- 5. financial_transactions (Movimentações reais de caixa: recebimento, pagamento, transferência, reembolso)

-- 1. Tabela: financial_accounts
CREATE TABLE IF NOT EXISTS financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  type TEXT NOT NULL CHECK (type IN ('bank_account', 'cash', 'credit_card', 'other')),
  currency TEXT NOT NULL CHECK (currency IN ('EUR', 'BRL')),
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_active ON financial_accounts(active);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_currency ON financial_accounts(currency);

DROP TRIGGER IF EXISTS tr_financial_accounts_set_updated_at ON financial_accounts;
CREATE TRIGGER tr_financial_accounts_set_updated_at
BEFORE UPDATE ON financial_accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and authenticated all on financial_accounts" ON financial_accounts;
CREATE POLICY "Allow anon and authenticated all on financial_accounts"
ON financial_accounts
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

COMMENT ON TABLE financial_accounts IS 'Contas financeiras da S23 (ex.: Caixa Portugal em EUR, Caixa Brasil em BRL, cartões)';

-- 2. Tabela: financial_operations
CREATE TABLE IF NOT EXISTS financial_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_financial_operations_quotation_id UNIQUE (quotation_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_operations_quotation_id ON financial_operations(quotation_id);
CREATE INDEX IF NOT EXISTS idx_financial_operations_status ON financial_operations(status);

DROP TRIGGER IF EXISTS tr_financial_operations_set_updated_at ON financial_operations;
CREATE TRIGGER tr_financial_operations_set_updated_at
BEFORE UPDATE ON financial_operations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE financial_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and authenticated all on financial_operations" ON financial_operations;
CREATE POLICY "Allow anon and authenticated all on financial_operations"
ON financial_operations
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

COMMENT ON TABLE financial_operations IS 'Operação financeira atrelada exclusivamente a uma única cotação aprovada';

-- 3. Tabela: financial_operation_services
CREATE TABLE IF NOT EXISTS financial_operation_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES financial_operations(id) ON DELETE CASCADE,
  original_service_id TEXT,
  type TEXT NOT NULL,
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  supplier_name TEXT,
  cost_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost_amount >= 0),
  cost_currency TEXT NOT NULL DEFAULT 'EUR' CHECK (cost_currency IN ('EUR', 'BRL')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_operation_services_operation_id ON financial_operation_services(operation_id);
CREATE INDEX IF NOT EXISTS idx_financial_operation_services_status ON financial_operation_services(status);

DROP TRIGGER IF EXISTS tr_financial_operation_services_set_updated_at ON financial_operation_services;
CREATE TRIGGER tr_financial_operation_services_set_updated_at
BEFORE UPDATE ON financial_operation_services
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE financial_operation_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and authenticated all on financial_operation_services" ON financial_operation_services;
CREATE POLICY "Allow anon and authenticated all on financial_operation_services"
ON financial_operation_services
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

COMMENT ON TABLE financial_operation_services IS 'Serviços independentes de uma operação financeira para controle de fornecimento e execução';

-- 4. Tabela: financial_commitments
CREATE TABLE IF NOT EXISTS financial_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES financial_operations(id) ON DELETE CASCADE,
  operation_service_id UUID REFERENCES financial_operation_services(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
  counterparty_name TEXT NOT NULL CHECK (length(trim(counterparty_name)) > 0),
  counterparty_type TEXT NOT NULL DEFAULT 'client' CHECK (counterparty_type IN ('client', 'supplier', 'other')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'BRL')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'partially_settled', 'settled', 'cancelled')),
  expected_date DATE,
  expected_account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_commitments_operation_id ON financial_commitments(operation_id);
CREATE INDEX IF NOT EXISTS idx_financial_commitments_status ON financial_commitments(status);
CREATE INDEX IF NOT EXISTS idx_financial_commitments_type ON financial_commitments(type);
CREATE INDEX IF NOT EXISTS idx_financial_commitments_expected_date ON financial_commitments(expected_date);

DROP TRIGGER IF EXISTS tr_financial_commitments_set_updated_at ON financial_commitments;
CREATE TRIGGER tr_financial_commitments_set_updated_at
BEFORE UPDATE ON financial_commitments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE financial_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and authenticated all on financial_commitments" ON financial_commitments;
CREATE POLICY "Allow anon and authenticated all on financial_commitments"
ON financial_commitments
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

COMMENT ON TABLE financial_commitments IS 'Compromissos previstos a receber (cliente) ou a pagar (fornecedor) com conta e data configuráveis';

-- 5. Tabela: financial_transactions
CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('inflow', 'outflow', 'transfer', 'refund')),
  account_id UUID NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
  destination_account_id UUID REFERENCES financial_accounts(id) ON DELETE RESTRICT,
  operation_id UUID REFERENCES financial_operations(id) ON DELETE SET NULL,
  commitment_id UUID REFERENCES financial_commitments(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'BRL')),
  transacted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  counterparty_name TEXT,
  description TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_account_id ON financial_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_operation_id ON financial_transactions(operation_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_commitment_id ON financial_transactions(commitment_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_transacted_at ON financial_transactions(transacted_at DESC);

DROP TRIGGER IF EXISTS tr_financial_transactions_set_updated_at ON financial_transactions;
CREATE TRIGGER tr_financial_transactions_set_updated_at
BEFORE UPDATE ON financial_transactions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and authenticated all on financial_transactions" ON financial_transactions;
CREATE POLICY "Allow anon and authenticated all on financial_transactions"
ON financial_transactions
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

COMMENT ON TABLE financial_transactions IS 'Movimentações reais de caixa registradas (recebimentos, pagamentos, reembolsos e transferências)';
