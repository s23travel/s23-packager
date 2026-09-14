-- Migration: 20260914060000_add_unique_reference_constraints.sql
-- Descrição: Garante a unicidade de referência em pacotes e cotações (Fase 2 Refinamento)

CREATE UNIQUE INDEX IF NOT EXISTS uq_packages_reference ON packages(reference);
CREATE UNIQUE INDEX IF NOT EXISTS uq_quotations_reference ON quotations(reference);
