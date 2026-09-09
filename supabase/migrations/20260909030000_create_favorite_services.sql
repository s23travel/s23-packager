-- Migration: 20260909030000_create_favorite_services.sql
-- Descrição: Criação da tabela 'favorite_services' — Catálogo de serviços reutilizáveis para preenchimento de pacotes

-- Tabela: favorite_services
-- O catálogo é uma fonte de preenchimento. Packages mantêm snapshot próprio dos dados copiados.
CREATE TABLE IF NOT EXISTS favorite_services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL CHECK (type IN ('hotel', 'airline', 'transfer', 'tour', 'insurance', 'car_rental', 'additional', 'other')),
  name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
  region      TEXT NOT NULL CHECK (length(trim(region)) > 0),
  country     TEXT NOT NULL CHECK (length(trim(country)) > 0),
  city        TEXT,
  notes       TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para buscas e filtros operacionais
CREATE INDEX IF NOT EXISTS idx_favorite_services_type       ON favorite_services(type);
CREATE INDEX IF NOT EXISTS idx_favorite_services_active     ON favorite_services(active);
CREATE INDEX IF NOT EXISTS idx_favorite_services_name       ON favorite_services(lower(name));
CREATE INDEX IF NOT EXISTS idx_favorite_services_created_at ON favorite_services(created_at DESC);

-- Trigger de updated_at (reutiliza a função set_updated_at() já existente)
DROP TRIGGER IF EXISTS tr_favorite_services_set_updated_at ON favorite_services;
CREATE TRIGGER tr_favorite_services_set_updated_at
BEFORE UPDATE ON favorite_services
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- RLS — Habilitar Row Level Security na nova tabela
ALTER TABLE favorite_services ENABLE ROW LEVEL SECURITY;

-- Policy: permite acesso total a usuários anon e authenticated (padrão MVP atual)
DROP POLICY IF EXISTS "Allow anon and authenticated all on favorite_services" ON favorite_services;
CREATE POLICY "Allow anon and authenticated all on favorite_services"
ON favorite_services
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Comentários descritivos do schema
COMMENT ON TABLE favorite_services IS 'Catálogo de serviços reutilizáveis (hotéis, aéreas, transfers, etc.) para preenchimento de novos pacotes. Fonte de dados apenas — packages mantêm snapshot próprio.';
COMMENT ON COLUMN favorite_services.type IS 'Tipo do serviço: hotel, airline, transfer, tour, insurance, car_rental, additional, other';
COMMENT ON COLUMN favorite_services.active IS 'Serviços inativos não aparecem nas sugestões de autocomplete. Pacotes já criados não são alterados.';
