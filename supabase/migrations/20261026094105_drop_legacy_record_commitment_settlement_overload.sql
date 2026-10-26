-- Evita overload ambíguo: a versão de 7 argumentos mantém o último opcional.
-- No PROD atual, onde só existe a versão de 7 argumentos, é um no-op.
DROP FUNCTION IF EXISTS public.record_commitment_settlement(
  UUID,
  UUID,
  NUMERIC,
  TIMESTAMPTZ,
  TEXT,
  TEXT
);
