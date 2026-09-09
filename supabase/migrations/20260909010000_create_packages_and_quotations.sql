-- Migration: 20260909010000_create_packages_and_quotations.sql
-- Descrição: Criação das tabelas base 'packages' e 'quotations' para o Packager (Fase 2)

-- Extensão pgcrypto / gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Função utilitária para manter updated_at sincronizado
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Tabela: packages (Pacotes base de viagem)
CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  base_currency TEXT NOT NULL DEFAULT 'EUR' CHECK (base_currency IN ('EUR', 'BRL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para packages
CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);
CREATE INDEX IF NOT EXISTS idx_packages_reference ON packages(reference);
CREATE INDEX IF NOT EXISTS idx_packages_created_at ON packages(created_at DESC);

-- Trigger de updated_at para packages
DROP TRIGGER IF EXISTS tr_packages_set_updated_at ON packages;
CREATE TRIGGER tr_packages_set_updated_at
BEFORE UPDATE ON packages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 2. Tabela: quotations (Cotações derivadas de pacotes)
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  reference TEXT NOT NULL,
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'archived')),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'BRL')),
  exchange_rate NUMERIC(12, 6),
  exchange_rate_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para quotations
CREATE INDEX IF NOT EXISTS idx_quotations_package_id ON quotations(package_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_reference ON quotations(reference);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations(created_at DESC);

-- Trigger de updated_at para quotations
DROP TRIGGER IF EXISTS tr_quotations_set_updated_at ON quotations;
CREATE TRIGGER tr_quotations_set_updated_at
BEFORE UPDATE ON quotations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Comentários descritivos do schema
COMMENT ON TABLE packages IS 'Armazena pacotes base de viagens e seus componentes flexíveis via JSONB';
COMMENT ON TABLE quotations IS 'Armazena cotações com snapshot independente do pacote original no campo data (JSONB)';
COMMENT ON COLUMN quotations.package_id IS 'Referência ao pacote de origem. Mantém rastreabilidade sem afetar o snapshot independente';
COMMENT ON COLUMN quotations.data IS 'Snapshot completo e imutável dos dados e componentes da cotação no momento de criação';
